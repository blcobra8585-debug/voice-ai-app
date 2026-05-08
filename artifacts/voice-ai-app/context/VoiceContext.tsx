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
import { Platform } from "react-native";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit,
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
}

export type AppState = "idle" | "recording" | "recorded" | "processing" | "playing" | "error";

interface VoiceContextType {
  appState: AppState;
  clips: ClipItem[];
  errorMessage: string | null;
  recordingDuration: number;
  playingId: string | null;
  processingEffect: EffectId | null;
  rawRecordingUri: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  applyEffect: (effectId: EffectId) => Promise<void>;
  playClip: (clip: ClipItem) => Promise<void>;
  stopPlayback: () => Promise<void>;
  shareClip: (clip: ClipItem) => Promise<void>;
  deleteClip: (id: string) => Promise<void>;
  clearError: () => void;
  resetToIdle: () => void;
}

const VoiceContext = createContext<VoiceContextType | null>(null);
const CLIPS_KEY = "voice_studio_clips_v2";

const ELEVENLABS_VOICE_ID = "erXw76RvabIuWST2abio";
const ELEVENLABS_MODEL    = "eleven_multilingual_v2";
const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? ""}`;

async function callGojoVoice(audioUri: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_ELEVENLABS_KEY ?? "";

  if (apiKey) {
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
      throw new Error(`ElevenLabs error: ${res.status} — ${txt.slice(0, 120)}`);
    }
    const buf = await res.arrayBuffer();
    return uint8ToBase64(new Uint8Array(buf));
  }

  const formData = new FormData();
  formData.append("audio", { uri: audioUri, type: "audio/m4a", name: "rec.m4a" } as any);
  const res = await fetch(`${API_BASE}/api/voice/speech-to-speech`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  const { audio } = await res.json();
  return audio as string;
}

function buildMultipart(boundary: string, audioBytes: Uint8Array, voiceSettings: string): Uint8Array {
  const enc = new TextEncoder();
  const audioPart = [
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="audio"; filename="rec.m4a"\r\n`,
    `Content-Type: audio/m4a\r\n\r\n`,
  ].join("");
  const modelPart = [
    `\r\n--${boundary}\r\n`,
    `Content-Disposition: form-data; name="model_id"\r\n\r\n`,
    ELEVENLABS_MODEL,
  ].join("");
  const settingsPart = [
    `\r\n--${boundary}\r\n`,
    `Content-Disposition: form-data; name="voice_settings"\r\n\r\n`,
    voiceSettings,
  ].join("");
  const closing = `\r\n--${boundary}--\r\n`;

  const parts = [
    enc.encode(audioPart),
    audioBytes,
    enc.encode(modelPart + settingsPart + closing),
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

async function callFFmpegEffect(audioUri: string, effectId: EffectId): Promise<string> {
  const formData = new FormData();
  formData.append("audio", { uri: audioUri, type: "audio/m4a", name: "rec.m4a" } as any);
  formData.append("effect", effectId);
  const res = await fetch(`${API_BASE}/api/voice/effects`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`Effect server error: ${res.status}`);
  const { audio } = await res.json();
  return audio as string;
}

async function saveClipToFirestore(clip: Omit<ClipItem, "firestoreId" | "audioUri">): Promise<string | null> {
  try {
    const docRef = await addDoc(collection(db, "clips"), {
      timestamp: clip.timestamp,
      effectId: clip.effectId,
      durationMs: clip.durationMs,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch {
    return null;
  }
}

async function loadClipsFromFirestore(): Promise<Omit<ClipItem, "audioUri">[]> {
  try {
    const q = query(collection(db, "clips"), orderBy("timestamp", "desc"), limit(30));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      firestoreId: d.id,
      timestamp: d.data().timestamp,
      effectId: d.data().effectId,
      durationMs: d.data().durationMs,
    }));
  } catch {
    return [];
  }
}

async function deleteClipFromFirestore(firestoreId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "clips", firestoreId));
  } catch {}
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [appState, setAppState]               = useState<AppState>("idle");
  const [clips, setClips]                     = useState<ClipItem[]>([]);
  const [errorMessage, setErrorMessage]       = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingId, setPlayingId]             = useState<string | null>(null);
  const [processingEffect, setProcessingEffect] = useState<EffectId | null>(null);
  const [rawRecordingUri, setRawRecordingUri] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef     = useRef<Audio.Sound | null>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadClips();
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      soundRef.current?.unloadAsync();
    };
  }, []);

  async function loadClips() {
    try {
      const raw = await AsyncStorage.getItem(CLIPS_KEY);
      const local: ClipItem[] = raw ? JSON.parse(raw) : [];
      setClips(local);
    } catch {}
  }

  async function persistClips(items: ClipItem[]) {
    await AsyncStorage.setItem(CLIPS_KEY, JSON.stringify(items));
    setClips(items);
  }

  const startRecording = useCallback(async () => {
    try {
      if (Platform.OS !== "web") {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== "granted") {
          setErrorMessage("Microphone permission required. Please allow in Settings.");
          setAppState("error");
          return;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
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

  const applyEffect = useCallback(async (effectId: EffectId) => {
    if (!rawRecordingUri) return;
    try {
      setProcessingEffect(effectId);
      setAppState("processing");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      let audioBase64: string;
      if (effectId === "gojo") {
        audioBase64 = await callGojoVoice(rawRecordingUri);
      } else {
        audioBase64 = await callFFmpegEffect(rawRecordingUri, effectId);
      }

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
      };

      const firestoreId = await saveClipToFirestore(newClip);
      if (firestoreId) newClip.firestoreId = firestoreId;

      const updated = [newClip, ...clips].slice(0, 30);
      await persistClips(updated);

      setProcessingEffect(null);
      await playFromUri(outputUri, newClip.id);
    } catch (e: any) {
      setProcessingEffect(null);
      setErrorMessage(e?.message ?? "Effect failed.");
      setAppState("error");
    }
  }, [rawRecordingUri, clips, recordingDuration]);

  async function playFromUri(uri: string, id: string) {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (Platform.OS !== "web") {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
      }
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
    } catch (e: any) {
      setErrorMessage(e?.message ?? "Playback failed.");
      setAppState("error");
    }
  }

  const playClip = useCallback(async (clip: ClipItem) => {
    await playFromUri(clip.audioUri, clip.id);
  }, []);

  const stopPlayback = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setAppState(rawRecordingUri ? "recorded" : "idle");
    setPlayingId(null);
  }, [rawRecordingUri]);

  const shareClip = useCallback(async (clip: ClipItem) => {
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        setErrorMessage("Sharing not available on this device.");
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await Sharing.shareAsync(clip.audioUri, {
        mimeType: "audio/mpeg",
        dialogTitle: "Share Voice Clip",
        UTI: "public.mp3",
      });
    } catch (e: any) {
      setErrorMessage(e?.message ?? "Share failed.");
    }
  }, []);

  const deleteClip = useCallback(async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const clip = clips.find(c => c.id === id);
    if (clip?.firestoreId) await deleteClipFromFirestore(clip.firestoreId);
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

  return (
    <VoiceContext.Provider value={{
      appState, clips, errorMessage, recordingDuration,
      playingId, processingEffect, rawRecordingUri,
      startRecording, stopRecording, applyEffect,
      playClip, stopPlayback, shareClip, deleteClip,
      clearError, resetToIdle,
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
