import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState as RNAppState, Linking, Platform } from "react-native";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type EffectId =
  | "gojo" | "robot" | "deep" | "chipmunk" | "female"
  | "alien" | "echo" | "cave" | "demon" | "radio" | "whisper";

export interface EffectConfig {
  id: EffectId;
  label: string;
  icon: string;
  color: string;
  description: string;
}

export const EFFECTS: EffectConfig[] = [
  { id: "gojo",     label: "Gojo AI",   icon: "star",           color: "#FFD700", description: "Gojo Satoru voice" },
  { id: "robot",    label: "Robot",     icon: "cpu",            color: "#00E5FF", description: "Mechanical voice" },
  { id: "deep",     label: "Deep",      icon: "arrow-down",     color: "#7C4DFF", description: "Low bass voice" },
  { id: "chipmunk", label: "Chipmunk",  icon: "zap",            color: "#FF6D00", description: "High squeaky" },
  { id: "female",   label: "Female",    icon: "user",           color: "#FF4081", description: "Female pitch" },
  { id: "alien",    label: "Alien",     icon: "radio",          color: "#76FF03", description: "Extraterrestrial" },
  { id: "echo",     label: "Echo",      icon: "repeat",         color: "#00BCD4", description: "Deep reverb" },
  { id: "cave",     label: "Cave",      icon: "triangle",       color: "#78909C", description: "Cave echo" },
  { id: "demon",    label: "Demon",     icon: "alert-triangle", color: "#FF1744", description: "Dark demon" },
  { id: "radio",    label: "Radio",     icon: "wifi",           color: "#FFEA00", description: "Walkie talkie" },
  { id: "whisper",  label: "Whisper",   icon: "wind",           color: "#B2EBF2", description: "Soft whisper" },
];

export interface ClipItem {
  id: string;
  firestoreId?: string;
  timestamp: number;
  effectId: EffectId;
  audioUri: string;
  durationMs: number;
  isGojoConverted?: boolean;
}

export type AppState = "idle" | "recording" | "recorded" | "processing" | "playing" | "realtime" | "error";

interface VoiceContextType {
  appState: AppState;
  clips: ClipItem[];
  errorMessage: string | null;
  recordingDuration: number;
  playingId: string | null;
  processingEffect: EffectId | null;
  rawRecordingUri: string | null;
  bgmiMode: boolean;
  realtimeMode: boolean;
  realtimeEffect: EffectId;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  applyEffect: (effectId: EffectId) => Promise<void>;
  playClip: (clip: ClipItem) => Promise<void>;
  stopPlayback: () => Promise<void>;
  shareClip: (clip: ClipItem, target?: "whatsapp" | "instagram" | "any") => Promise<void>;
  deleteClip: (id: string) => Promise<void>;
  clearError: () => void;
  resetToIdle: () => void;
  toggleBgmiMode: () => void;
  toggleRealtimeMode: () => void;
  setRealtimeEffect: (id: EffectId) => void;
  startRealtimeSession: () => Promise<void>;
  stopRealtimeSession: () => Promise<void>;
}

const VoiceContext = createContext<VoiceContextType | null>(null);
const CLIPS_KEY = "voice_studio_clips_v3";
const REALTIME_CHUNK_MS = 2500;

// ─── Backend API URL ───────────────────────────────────────────────────────
const API_BASE = (() => {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "http://localhost:5000";
})();

// ─── Unified backend effect caller ────────────────────────────────────────
async function callBackendEffect(audioUri: string, effectId: EffectId): Promise<string> {
  const isGojo = effectId === "gojo";
  const endpoint = isGojo ? "speech-to-speech" : "effects";
  const url = `${API_BASE}/api/voice/${endpoint}`;

  const formData = new FormData();
  formData.append("audio", {
    uri: audioUri,
    name: "recording.m4a",
    type: "audio/m4a",
  } as unknown as Blob);

  if (!isGojo) {
    formData.append("effect", effectId);
  }

  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Server error ${res.status}: ${txt.slice(0, 120)}`);
  }

  const json = await res.json() as { audio: string };
  return json.audio;
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, attempt * 1500));
    }
  }
  throw lastError;
}

async function saveToFirestore(clip: Omit<ClipItem, "firestoreId" | "audioUri">): Promise<string | null> {
  try {
    const docRef = await addDoc(collection(db, "clips"), {
      timestamp: clip.timestamp,
      effectId: clip.effectId,
      durationMs: clip.durationMs,
      isGojoConverted: clip.isGojoConverted ?? false,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch {
    return null;
  }
}

async function deleteFromFirestore(firestoreId: string): Promise<void> {
  try { await deleteDoc(doc(db, "clips", firestoreId)); } catch {}
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [appState, setAppState]               = useState<AppState>("idle");
  const [clips, setClips]                     = useState<ClipItem[]>([]);
  const [errorMessage, setErrorMessage]       = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingId, setPlayingId]             = useState<string | null>(null);
  const [processingEffect, setProcessingEffect] = useState<EffectId | null>(null);
  const [rawRecordingUri, setRawRecordingUri] = useState<string | null>(null);
  const [bgmiMode, setBgmiMode]               = useState(false);
  const [realtimeMode, setRealtimeMode]       = useState(false);
  const [realtimeEffect, setRealtimeEffectState] = useState<EffectId>("gojo");

  const recordingRef   = useRef<Audio.Recording | null>(null);
  const soundRef       = useRef<Audio.Sound | null>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeActive = useRef(false);

  useEffect(() => {
    loadClips();
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      soundRef.current?.unloadAsync();
    };
  }, []);

  useEffect(() => {
    const sub = RNAppState.addEventListener("change", async (nextState) => {
      if (nextState === "background" && bgmiMode && soundRef.current) {
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
          });
        } catch {}
      }
    });
    return () => sub.remove();
  }, [bgmiMode]);

  async function loadClips() {
    try {
      const raw = await AsyncStorage.getItem(CLIPS_KEY);
      const local: ClipItem[] = raw ? JSON.parse(raw) : [];
      setClips(local);
    } catch {}
  }

  async function persistClips(items: ClipItem[]) {
    try { await AsyncStorage.setItem(CLIPS_KEY, JSON.stringify(items)); } catch {}
    setClips(items);
  }

  const startRecording = useCallback(async () => {
    try {
      if (Platform.OS !== "web") {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== "granted") {
          setErrorMessage("Microphone permission required. Allow in Settings.");
          setAppState("error");
          return;
        }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
      }
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setAppState("recording");
      setRecordingDuration(0);
      setRawRecordingUri(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      timerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to start recording.");
      setAppState("error");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    timerRef.current && clearInterval(timerRef.current);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (Platform.OS !== "web") {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      }
      if (!uri) throw new Error("Recording URI missing.");
      setRawRecordingUri(uri);
      setAppState("recorded");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to stop recording.");
      setAppState("error");
    }
  }, []);

  // ─── Real-time session ───────────────────────────────────────────────────
  const startRealtimeSession = useCallback(async () => {
    try {
      if (Platform.OS !== "web") {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== "granted") {
          setErrorMessage("Microphone permission required.");
          setAppState("error");
          return;
        }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
        });
      }
      realtimeActive.current = true;
      setAppState("realtime");
      setRecordingDuration(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      async function recordAndProcess() {
        if (!realtimeActive.current) return;
        try {
          const { recording } = await Audio.Recording.createAsync(
            Audio.RecordingOptionsPresets.HIGH_QUALITY
          );
          await new Promise(r => setTimeout(r, REALTIME_CHUNK_MS));
          if (!realtimeActive.current) {
            await recording.stopAndUnloadAsync();
            return;
          }
          await recording.stopAndUnloadAsync();
          const uri = recording.getURI();
          if (!uri) { recordAndProcess(); return; }

          const effectId = realtimeEffect;
          let outputUri: string;
          let isGojoConverted = false;

          try {
            const b64 = await withRetry(() => callBackendEffect(uri, effectId), 2);
            const ext = effectId === "gojo" ? "mp3" : "mp3";
            outputUri = (FileSystem.cacheDirectory ?? "") + `rt_${effectId}_${Date.now()}.${ext}`;
            await FileSystem.writeAsStringAsync(outputUri, b64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            isGojoConverted = effectId === "gojo";
          } catch {
            outputUri = uri;
          }

          if (!realtimeActive.current) return;

          const newClip: ClipItem = {
            id: `rt_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            timestamp: Date.now(),
            effectId,
            audioUri: outputUri,
            durationMs: REALTIME_CHUNK_MS,
            isGojoConverted,
          };
          const fid = await saveToFirestore(newClip);
          if (fid) newClip.firestoreId = fid;
          setClips(prev => {
            const updated = [newClip, ...prev].slice(0, 30);
            AsyncStorage.setItem(CLIPS_KEY, JSON.stringify(updated)).catch(() => {});
            return updated;
          });

          await playRealtimeChunk(outputUri);
          if (realtimeActive.current) recordAndProcess();
        } catch {
          if (realtimeActive.current) recordAndProcess();
        }
      }

      recordAndProcess();
      timerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Realtime mode failed.");
      setAppState("error");
    }
  }, [realtimeEffect]);

  const stopRealtimeSession = useCallback(async () => {
    realtimeActive.current = false;
    timerRef.current && clearInterval(timerRef.current);
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
    }
    if (Platform.OS !== "web") {
      try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false }); } catch {}
    }
    setAppState("idle");
    setRecordingDuration(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  async function playRealtimeChunk(uri: string) {
    try {
      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, volume: 1.0 }
      );
      soundRef.current = sound;
      await new Promise<void>(resolve => {
        sound.setOnPlaybackStatusUpdate(status => {
          if (status.isLoaded && status.didJustFinish) {
            sound.unloadAsync();
            soundRef.current = null;
            resolve();
          }
        });
      });
    } catch {}
  }

  // ─── Apply effect (routes ALL effects through backend) ───────────────────
  const applyEffect = useCallback(async (effectId: EffectId) => {
    if (!rawRecordingUri) return;
    try {
      setProcessingEffect(effectId);
      setAppState("processing");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const audioBase64 = await withRetry(() => callBackendEffect(rawRecordingUri, effectId), 3);
      const outputUri = (FileSystem.cacheDirectory ?? "") + `clip_${effectId}_${Date.now()}.mp3`;
      await FileSystem.writeAsStringAsync(outputUri, audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const newClip: ClipItem = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        effectId,
        audioUri: outputUri,
        durationMs: recordingDuration * 1000,
        isGojoConverted: effectId === "gojo",
      };

      const fid = await saveToFirestore(newClip);
      if (fid) newClip.firestoreId = fid;

      const updated = [newClip, ...clips].slice(0, 30);
      await persistClips(updated);
      setProcessingEffect(null);
      await playFromUri(outputUri, newClip.id);
    } catch (e: unknown) {
      setProcessingEffect(null);
      setErrorMessage(e instanceof Error ? e.message : "Effect failed. Check internet.");
      setAppState("error");
    }
  }, [rawRecordingUri, clips, recordingDuration]);

  async function playFromUri(uri: string, id: string) {
    try {
      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: bgmiMode,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, volume: 1.0 }
      );
      soundRef.current = sound;
      setAppState("playing");
      setPlayingId(id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) {
          setAppState("recorded");
          setPlayingId(null);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Playback failed.");
      setAppState("error");
    }
  }

  const playClip = useCallback(async (clip: ClipItem) => {
    await playFromUri(clip.audioUri, clip.id);
  }, [bgmiMode]);

  const stopPlayback = useCallback(async () => {
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
    setAppState(rawRecordingUri ? "recorded" : "idle");
    setPlayingId(null);
  }, [rawRecordingUri]);

  const shareClip = useCallback(async (clip: ClipItem, target: "whatsapp" | "instagram" | "any" = "any") => {
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) { setErrorMessage("Sharing not available."); return; }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const mimeType = "audio/mpeg";
      const uti = "public.mp3";

      if (target === "whatsapp") {
        const canOpen = await Linking.canOpenURL("whatsapp://send");
        if (canOpen) {
          await Sharing.shareAsync(clip.audioUri, { mimeType, dialogTitle: "Share to WhatsApp", UTI: uti });
          return;
        }
      }

      if (target === "instagram") {
        const canOpen = await Linking.canOpenURL("instagram://app");
        if (canOpen) {
          await Sharing.shareAsync(clip.audioUri, { mimeType, dialogTitle: "Share to Instagram", UTI: uti });
          return;
        }
      }

      await Sharing.shareAsync(clip.audioUri, { mimeType, dialogTitle: "Share Voice Clip", UTI: uti });
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Share failed.");
    }
  }, []);

  const deleteClip = useCallback(async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const clip = clips.find(c => c.id === id);
    if (clip?.firestoreId) await deleteFromFirestore(clip.firestoreId);
    try { if (clip?.audioUri) await FileSystem.deleteAsync(clip.audioUri, { idempotent: true }); } catch {}
    const updated = clips.filter(c => c.id !== id);
    await persistClips(updated);
  }, [clips]);

  const clearError = useCallback(() => {
    setErrorMessage(null);
    setAppState(rawRecordingUri ? "recorded" : "idle");
  }, [rawRecordingUri]);

  const resetToIdle = useCallback(() => {
    setAppState("idle");
    setRawRecordingUri(null);
    setRecordingDuration(0);
    setErrorMessage(null);
  }, []);

  const toggleBgmiMode = useCallback(() => {
    setBgmiMode(prev => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); return !prev; });
  }, []);

  const toggleRealtimeMode = useCallback(() => {
    setRealtimeMode(prev => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); return !prev; });
  }, []);

  const setRealtimeEffect = useCallback((id: EffectId) => {
    setRealtimeEffectState(id);
  }, []);

  return (
    <VoiceContext.Provider value={{
      appState, clips, errorMessage, recordingDuration,
      playingId, processingEffect, rawRecordingUri,
      bgmiMode, realtimeMode, realtimeEffect,
      startRecording, stopRecording, applyEffect,
      playClip, stopPlayback, shareClip, deleteClip,
      clearError, resetToIdle,
      toggleBgmiMode, toggleRealtimeMode, setRealtimeEffect,
      startRealtimeSession, stopRealtimeSession,
    }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be inside VoiceProvider");
  return ctx;
}
