import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
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

const CLIENT_EFFECT_CONFIG: Record<EffectId, { rate: number; correctPitch: boolean }> = {
  gojo:     { rate: 1.0,  correctPitch: true  },
  robot:    { rate: 0.88, correctPitch: false },
  deep:     { rate: 0.70, correctPitch: false },
  chipmunk: { rate: 1.70, correctPitch: false },
  female:   { rate: 1.20, correctPitch: false },
  alien:    { rate: 1.40, correctPitch: false },
  echo:     { rate: 0.92, correctPitch: false },
  cave:     { rate: 0.80, correctPitch: false },
  demon:    { rate: 0.60, correctPitch: false },
  radio:    { rate: 1.05, correctPitch: false },
  whisper:  { rate: 0.95, correctPitch: false },
};

export interface ClipItem {
  id: string;
  firestoreId?: string;
  timestamp: number;
  effectId: EffectId;
  audioUri: string;
  durationMs: number;
  playbackRate?: number;
  correctPitch?: boolean;
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
const ELEVENLABS_VOICE_ID = "erXw76RvabIuWST2abio";
const ELEVENLABS_MODEL    = "eleven_multilingual_v2";
const REALTIME_CHUNK_MS   = 2500;

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

async function callGojoVoice(audioUri: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_ELEVENLABS_KEY ?? "";
  if (!apiKey) throw new Error("ElevenLabs key not configured.");

  const fileInfo = await FileSystem.getInfoAsync(audioUri);
  if (!fileInfo.exists) throw new Error("Recording file not found.");

  const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const boundary = `----FormBoundary${Date.now()}`;
  const audioBytes = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
  const voiceSettings = JSON.stringify({
    stability: 0.4,
    similarity_boost: 0.85,
    style: 0.0,
    use_speaker_boost: true,
  });

  const res = await fetch(
    `https://api.elevenlabs.io/v1/speech-to-speech/${ELEVENLABS_VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: buildMultipart(boundary, audioBytes, voiceSettings).buffer as ArrayBuffer,
    }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`ElevenLabs: ${res.status} — ${txt.slice(0, 100)}`);
  }
  const buf = await res.arrayBuffer();
  return uint8ToBase64(new Uint8Array(buf));
}

function buildMultipart(boundary: string, audioBytes: Uint8Array, voiceSettings: string): Uint8Array {
  const enc = new TextEncoder();
  const parts = [
    enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="rec.m4a"\r\nContent-Type: audio/m4a\r\n\r\n`),
    audioBytes,
    enc.encode(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model_id"\r\n\r\n${ELEVENLABS_MODEL}`),
    enc.encode(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="voice_settings"\r\n\r\n${voiceSettings}`),
    enc.encode(`\r\n--${boundary}--\r\n`),
  ];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function saveToFirestore(clip: Omit<ClipItem, "firestoreId" | "audioUri">): Promise<string | null> {
  try {
    const docRef = await addDoc(collection(db, "clips"), {
      timestamp: clip.timestamp,
      effectId: clip.effectId,
      durationMs: clip.durationMs,
      playbackRate: clip.playbackRate ?? 1.0,
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

  const recordingRef     = useRef<Audio.Recording | null>(null);
  const soundRef         = useRef<Audio.Sound | null>(null);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeActive   = useRef(false);
  const realtimeChunkRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadClips();
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      realtimeChunkRef.current && clearInterval(realtimeChunkRef.current);
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
    } catch (e: any) {
      setErrorMessage(e?.message ?? "Failed to start recording.");
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
    } catch (e: any) {
      setErrorMessage(e?.message ?? "Failed to stop recording.");
      setAppState("error");
    }
  }, []);

  // Real-time session: record 2.5s chunks, process, play each chunk
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
          const cfg = CLIENT_EFFECT_CONFIG[effectId];
          let outputUri: string;
          let isGojoConverted = false;

          if (effectId === "gojo") {
            try {
              const b64 = await withRetry(() => callGojoVoice(uri), 2);
              outputUri = (FileSystem.cacheDirectory ?? "") + `rt_gojo_${Date.now()}.mp3`;
              await FileSystem.writeAsStringAsync(outputUri, b64, {
                encoding: FileSystem.EncodingType.Base64,
              });
              isGojoConverted = true;
            } catch {
              outputUri = uri;
            }
          } else {
            outputUri = (FileSystem.cacheDirectory ?? "") + `rt_${effectId}_${Date.now()}.m4a`;
            await FileSystem.copyAsync({ from: uri, to: outputUri });
          }

          if (!realtimeActive.current) return;

          const newClip: ClipItem = {
            id: `rt_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            timestamp: Date.now(),
            effectId,
            audioUri: outputUri,
            durationMs: REALTIME_CHUNK_MS,
            playbackRate: cfg.rate,
            correctPitch: cfg.correctPitch,
            isGojoConverted,
          };
          const fid = await saveToFirestore(newClip);
          if (fid) newClip.firestoreId = fid;
          setClips(prev => {
            const updated = [newClip, ...prev].slice(0, 30);
            AsyncStorage.setItem(CLIPS_KEY, JSON.stringify(updated)).catch(() => {});
            return updated;
          });

          await playRealtimeChunk(outputUri, cfg.rate, cfg.correctPitch);
          if (realtimeActive.current) recordAndProcess();
        } catch {
          if (realtimeActive.current) recordAndProcess();
        }
      }

      recordAndProcess();
      timerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch (e: any) {
      setErrorMessage(e?.message ?? "Realtime mode failed.");
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

  async function playRealtimeChunk(uri: string, rate: number, correctPitch: boolean) {
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
      if (rate !== 1.0) {
        try { await sound.setRateAsync(rate, correctPitch); } catch {}
      }
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

  const applyEffect = useCallback(async (effectId: EffectId) => {
    if (!rawRecordingUri) return;
    const effectCfg = CLIENT_EFFECT_CONFIG[effectId];
    try {
      setProcessingEffect(effectId);
      setAppState("processing");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      let outputUri: string;
      let isGojoConverted = false;

      if (effectId === "gojo") {
        const audioBase64 = await withRetry(() => callGojoVoice(rawRecordingUri), 3);
        outputUri = (FileSystem.cacheDirectory ?? "") + `clip_gojo_${Date.now()}.mp3`;
        await FileSystem.writeAsStringAsync(outputUri, audioBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        isGojoConverted = true;
      } else {
        outputUri = (FileSystem.cacheDirectory ?? "") + `clip_${effectId}_${Date.now()}.m4a`;
        await FileSystem.copyAsync({ from: rawRecordingUri, to: outputUri });
      }

      const newClip: ClipItem = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        effectId,
        audioUri: outputUri,
        durationMs: recordingDuration * 1000,
        playbackRate: effectCfg.rate,
        correctPitch: effectCfg.correctPitch,
        isGojoConverted,
      };

      const fid = await saveToFirestore(newClip);
      if (fid) newClip.firestoreId = fid;

      const updated = [newClip, ...clips].slice(0, 30);
      await persistClips(updated);
      setProcessingEffect(null);
      await playFromUri(outputUri, newClip.id, effectCfg.rate, effectCfg.correctPitch);
    } catch (e: any) {
      setProcessingEffect(null);
      setErrorMessage(e?.message ?? "Effect failed. Check internet.");
      setAppState("error");
    }
  }, [rawRecordingUri, clips, recordingDuration]);

  async function playFromUri(uri: string, id: string, rate = 1.0, correctPitch = true) {
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
      if (rate !== 1.0) {
        try { await sound.setRateAsync(rate, correctPitch); } catch {}
      }
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
    } catch (e: any) {
      setErrorMessage(e?.message ?? "Playback failed.");
      setAppState("error");
    }
  }

  const playClip = useCallback(async (clip: ClipItem) => {
    await playFromUri(clip.audioUri, clip.id, clip.playbackRate ?? 1.0, clip.correctPitch ?? true);
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

      if (target === "whatsapp") {
        // Try to open WhatsApp directly
        const waUrl = `whatsapp://send`;
        const canOpen = await Linking.canOpenURL(waUrl);
        if (canOpen) {
          await Sharing.shareAsync(clip.audioUri, {
            mimeType: clip.isGojoConverted ? "audio/mpeg" : "audio/m4a",
            dialogTitle: "Share to WhatsApp",
            UTI: clip.isGojoConverted ? "public.mp3" : "public.mpeg-4-audio",
          });
          return;
        }
      }

      if (target === "instagram") {
        const igUrl = `instagram://app`;
        const canOpen = await Linking.canOpenURL(igUrl);
        if (canOpen) {
          await Sharing.shareAsync(clip.audioUri, {
            mimeType: clip.isGojoConverted ? "audio/mpeg" : "audio/m4a",
            dialogTitle: "Share to Instagram",
            UTI: clip.isGojoConverted ? "public.mp3" : "public.mpeg-4-audio",
          });
          return;
        }
      }

      // Default: open system share sheet
      await Sharing.shareAsync(clip.audioUri, {
        mimeType: clip.isGojoConverted ? "audio/mpeg" : "audio/m4a",
        dialogTitle: "Share Voice Clip",
        UTI: clip.isGojoConverted ? "public.mp3" : "public.mpeg-4-audio",
      });
    } catch (e: any) {
      setErrorMessage(e?.message ?? "Share failed.");
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
