import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from "react";
import { AppState as RNAppState, Linking, Platform } from "react-native";
import { collection, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type EffectId =
  | "gojo" | "aria" | "roger" | "sarah" | "charlie" | "george"
  | "robot" | "deep" | "chipmunk" | "female" | "alien"
  | "echo" | "cave" | "demon" | "radio" | "whisper"
  | "reverb" | "telephone" | "megaphone" | "underwater";

export interface EffectConfig {
  id: EffectId;
  label: string;
  icon: string;
  color: string;
  description: string;
  isAI: boolean;
  voiceId?: string;
}

export const EFFECTS: EffectConfig[] = [
  { id: "gojo",      label: "Gojo AI",    icon: "star",           color: "#FFD700", description: "Gojo Satoru",    isAI: true,  voiceId: "erXw76RvabIuWST2abio" },
  { id: "aria",      label: "Aria",       icon: "feather",        color: "#E040FB", description: "Smooth female",  isAI: true,  voiceId: "9BWtsMINqrJLrRacOk9x" },
  { id: "roger",     label: "Roger",      icon: "mic",            color: "#FF6D00", description: "Confident male", isAI: true,  voiceId: "CwhRBWXzGAHq8TQ4Fs17" },
  { id: "sarah",     label: "Sarah",      icon: "heart",          color: "#FF4081", description: "Warm female",    isAI: true,  voiceId: "EXAVITQu4vr4xnNLhMaY" },
  { id: "charlie",   label: "Charlie",    icon: "smile",          color: "#69F0AE", description: "Casual male",    isAI: true,  voiceId: "IKne3meq5aSn9XLyUdCD" },
  { id: "george",    label: "George",     icon: "award",          color: "#40C4FF", description: "Deep British",   isAI: true,  voiceId: "JBFqnCBsd6RMkjVDRZzb" },
  { id: "robot",     label: "Robot",      icon: "cpu",            color: "#00E5FF", description: "Mechanical",     isAI: false },
  { id: "deep",      label: "Deep",       icon: "arrow-down",     color: "#7C4DFF", description: "Low bass",       isAI: false },
  { id: "chipmunk",  label: "Chipmunk",   icon: "zap",            color: "#FFAB40", description: "High squeaky",   isAI: false },
  { id: "female",    label: "Female",     icon: "user",           color: "#FF80AB", description: "Female pitch",   isAI: false },
  { id: "alien",     label: "Alien",      icon: "radio",          color: "#76FF03", description: "Otherworldly",   isAI: false },
  { id: "echo",      label: "Echo",       icon: "repeat",         color: "#00BCD4", description: "Deep reverb",    isAI: false },
  { id: "cave",      label: "Cave",       icon: "triangle",       color: "#78909C", description: "Cave echo",      isAI: false },
  { id: "demon",     label: "Demon",      icon: "alert-triangle", color: "#FF1744", description: "Dark demon",     isAI: false },
  { id: "radio",     label: "Radio",      icon: "wifi",           color: "#FFEA00", description: "Walkie-talkie",  isAI: false },
  { id: "whisper",   label: "Whisper",    icon: "wind",           color: "#B2EBF2", description: "Soft whisper",   isAI: false },
  { id: "reverb",    label: "Reverb",     icon: "layers",         color: "#CE93D8", description: "Hall reverb",    isAI: false },
  { id: "telephone", label: "Telephone",  icon: "phone",          color: "#A5D6A7", description: "Old phone",      isAI: false },
  { id: "megaphone", label: "Megaphone",  icon: "volume-2",       color: "#FFB74D", description: "Loud & clear",   isAI: false },
  { id: "underwater",label: "Underwater", icon: "droplet",        color: "#4FC3F7", description: "Submerged",      isAI: false },
];

const CLIENT_EFFECT_CONFIG: Record<EffectId, { rate: number; correctPitch: boolean }> = {
  gojo:      { rate: 1.00, correctPitch: true  },
  aria:      { rate: 1.00, correctPitch: true  },
  roger:     { rate: 1.00, correctPitch: true  },
  sarah:     { rate: 1.00, correctPitch: true  },
  charlie:   { rate: 1.00, correctPitch: true  },
  george:    { rate: 1.00, correctPitch: true  },
  robot:     { rate: 0.75, correctPitch: false },
  deep:      { rate: 0.60, correctPitch: false },
  chipmunk:  { rate: 1.85, correctPitch: false },
  female:    { rate: 1.28, correctPitch: false },
  alien:     { rate: 1.45, correctPitch: false },
  echo:      { rate: 0.92, correctPitch: false },
  cave:      { rate: 0.80, correctPitch: false },
  demon:     { rate: 0.52, correctPitch: false },
  radio:     { rate: 1.05, correctPitch: false },
  whisper:   { rate: 0.88, correctPitch: false },
  reverb:    { rate: 0.90, correctPitch: true  },
  telephone: { rate: 1.02, correctPitch: false },
  megaphone: { rate: 1.08, correctPitch: true  },
  underwater:{ rate: 0.72, correctPitch: false },
};

const ELEVENLABS_MODEL = "eleven_multilingual_v2";

export interface ClipItem {
  id: string;
  firestoreId?: string;
  timestamp: number;
  effectId: EffectId;
  label?: string;
  audioUri: string;
  durationMs: number;
  playbackRate: number;
  correctPitch: boolean;
  isAIConverted?: boolean;
  isFavorite?: boolean;
}

export interface AppStats {
  totalRecordings: number;
  totalDurationMs: number;
  aiConversions: number;
  mostUsedEffect: EffectId | null;
}

export type AppState = "idle" | "recording" | "recorded" | "processing" | "playing" | "realtime" | "error";

interface VoiceContextType {
  appState: AppState;
  clips: ClipItem[];
  filteredClips: ClipItem[];
  errorMessage: string | null;
  recordingDuration: number;
  playingId: string | null;
  loopId: string | null;
  processingEffect: EffectId | null;
  rawRecordingUri: string | null;
  bgmiMode: boolean;
  realtimeMode: boolean;
  realtimeEffect: EffectId;
  filterEffect: EffectId | "all" | "favorites";
  stats: AppStats;
  autoStopSeconds: number;
  pitchOffset: number;
  volumeBoost: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  applyEffect: (effectId: EffectId) => Promise<void>;
  playClip: (clip: ClipItem) => Promise<void>;
  stopPlayback: () => Promise<void>;
  toggleLoop: (id: string) => void;
  shareClip: (clip: ClipItem, target?: "whatsapp" | "instagram" | "any") => Promise<void>;
  saveToGallery: (clip: ClipItem) => Promise<void>;
  deleteClip: (id: string) => Promise<void>;
  renameClip: (id: string, label: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  clearError: () => void;
  resetToIdle: () => void;
  toggleBgmiMode: () => void;
  toggleRealtimeMode: () => void;
  setRealtimeEffect: (id: EffectId) => void;
  setFilterEffect: (f: EffectId | "all" | "favorites") => void;
  setAutoStopSeconds: (s: number) => void;
  setPitchOffset: (p: number) => void;
  setVolumeBoost: (v: number) => void;
  startRealtimeSession: () => Promise<void>;
  stopRealtimeSession: () => Promise<void>;
}

const VoiceContext = createContext<VoiceContextType | null>(null);
const CLIPS_KEY = "gojo_clips_v5";
const STATS_KEY = "gojo_stats_v1";
const SETTINGS_KEY = "gojo_settings_v1";
const REALTIME_CHUNK_MS = 2000;

async function callElevenLabs(audioUri: string, voiceId: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_ELEVENLABS_KEY ?? "";
  if (!apiKey) throw new Error("ElevenLabs key missing. Add EXPO_PUBLIC_ELEVENLABS_KEY.");

  const info = await FileSystem.getInfoAsync(audioUri);
  if (!info.exists) throw new Error("Audio file not found.");

  const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const boundary = `----GojoVoice${Date.now()}`;
  const enc = new TextEncoder();
  const audioBytes = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
  const voiceSettings = JSON.stringify({ stability: 0.35, similarity_boost: 0.88, style: 0.0, use_speaker_boost: true });

  const parts: Uint8Array[] = [
    enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="rec.m4a"\r\nContent-Type: audio/m4a\r\n\r\n`),
    audioBytes,
    enc.encode(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model_id"\r\n\r\n${ELEVENLABS_MODEL}`),
    enc.encode(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="voice_settings"\r\n\r\n${voiceSettings}`),
    enc.encode(`\r\n--${boundary}--\r\n`),
  ];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const body = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) { body.set(p, offset); offset += p.length; }

  const res = await fetch(`https://api.elevenlabs.io/v1/speech-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body: body.buffer as ArrayBuffer,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${txt.slice(0, 120)}`);
  }
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function saveToFirestore(clip: Omit<ClipItem, "firestoreId" | "audioUri">): Promise<string | null> {
  try {
    const ref = await addDoc(collection(db, "clips"), {
      ...clip, audioUri: null, createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch { return null; }
}
async function deleteFromFirestore(id: string) {
  try { await deleteDoc(doc(db, "clips", id)); } catch {}
}
async function updateFirestore(id: string, data: Record<string, unknown>) {
  try { await updateDoc(doc(db, "clips", id), data); } catch {}
}

async function withRetry<T>(fn: () => Promise<T>, max = 3): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= max; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      if (i < max) await new Promise(r => setTimeout(r, i * 1200));
    }
  }
  throw last;
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [appState, setAppState]                   = useState<AppState>("idle");
  const [clips, setClips]                         = useState<ClipItem[]>([]);
  const [errorMessage, setErrorMessage]           = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingId, setPlayingId]                 = useState<string | null>(null);
  const [loopId, setLoopId]                       = useState<string | null>(null);
  const [processingEffect, setProcessingEffect]   = useState<EffectId | null>(null);
  const [rawRecordingUri, setRawRecordingUri]     = useState<string | null>(null);
  const [bgmiMode, setBgmiMode]                   = useState(false);
  const [realtimeMode, setRealtimeMode]           = useState(false);
  const [realtimeEffect, setRealtimeEffectState]  = useState<EffectId>("gojo");
  const [filterEffect, setFilterEffect]           = useState<EffectId | "all" | "favorites">("all");
  const [stats, setStats]                         = useState<AppStats>({ totalRecordings: 0, totalDurationMs: 0, aiConversions: 0, mostUsedEffect: null });
  const [autoStopSeconds, setAutoStopSecondsState]= useState(0);
  const [pitchOffset, setPitchOffsetState]        = useState(0);
  const [volumeBoost, setVolumeBoostState]        = useState(1.0);

  const recordingRef   = useRef<Audio.Recording | null>(null);
  const soundRef       = useRef<Audio.Sound | null>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeActive = useRef(false);
  const loopIdRef      = useRef<string | null>(null);

  useEffect(() => { loopIdRef.current = loopId; }, [loopId]);

  useEffect(() => {
    loadAll();
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      autoStopRef.current && clearTimeout(autoStopRef.current);
      soundRef.current?.unloadAsync();
    };
  }, []);

  useEffect(() => {
    const sub = RNAppState.addEventListener("change", async next => {
      if (next === "background" && bgmiMode && soundRef.current) {
        try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: true }); } catch {}
      }
    });
    return () => sub.remove();
  }, [bgmiMode]);

  async function loadAll() {
    try {
      const [rawClips, rawStats, rawSettings] = await Promise.all([
        AsyncStorage.getItem(CLIPS_KEY),
        AsyncStorage.getItem(STATS_KEY),
        AsyncStorage.getItem(SETTINGS_KEY),
      ]);
      if (rawClips) setClips(JSON.parse(rawClips));
      if (rawStats) setStats(JSON.parse(rawStats));
      if (rawSettings) {
        const s = JSON.parse(rawSettings);
        if (s.bgmiMode !== undefined) setBgmiMode(s.bgmiMode);
        if (s.autoStopSeconds !== undefined) setAutoStopSecondsState(s.autoStopSeconds);
        if (s.pitchOffset !== undefined) setPitchOffsetState(s.pitchOffset);
        if (s.volumeBoost !== undefined) setVolumeBoostState(s.volumeBoost);
      }
    } catch {}
  }

  async function saveClips(items: ClipItem[]) {
    try { await AsyncStorage.setItem(CLIPS_KEY, JSON.stringify(items)); } catch {}
    setClips(items);
  }

  async function saveStats(s: AppStats) {
    try { await AsyncStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {}
    setStats(s);
  }

  async function saveSettings(patch: Partial<{ bgmiMode: boolean; autoStopSeconds: number; pitchOffset: number; volumeBoost: number }>) {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      const existing = raw ? JSON.parse(raw) : {};
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...existing, ...patch }));
    } catch {}
  }

  function updateStats(effectId: EffectId, durationMs: number, isAI: boolean) {
    setStats(prev => {
      const next: AppStats = {
        totalRecordings: prev.totalRecordings + 1,
        totalDurationMs: prev.totalDurationMs + durationMs,
        aiConversions: prev.aiConversions + (isAI ? 1 : 0),
        mostUsedEffect: effectId,
      };
      saveStats(next);
      return next;
    });
  }

  const filteredClips = React.useMemo(() => {
    if (filterEffect === "all") return clips;
    if (filterEffect === "favorites") return clips.filter(c => c.isFavorite);
    return clips.filter(c => c.effectId === filterEffect);
  }, [clips, filterEffect]);

  const startRecording = useCallback(async () => {
    try {
      if (Platform.OS !== "web") {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== "granted") { setErrorMessage("Mic permission required. Enable in Settings."); setAppState("error"); return; }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, staysActiveInBackground: false });
      }
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setAppState("recording");
      setRecordingDuration(0);
      setRawRecordingUri(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      timerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
      if (autoStopSeconds > 0) {
        autoStopRef.current = setTimeout(() => { stopRecording(); }, autoStopSeconds * 1000);
      }
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to start recording.");
      setAppState("error");
    }
  }, [autoStopSeconds]);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    timerRef.current && clearInterval(timerRef.current);
    autoStopRef.current && clearTimeout(autoStopRef.current);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (Platform.OS !== "web") await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      if (!uri) throw new Error("Recording URI missing.");
      setRawRecordingUri(uri);
      setAppState("recorded");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to stop recording.");
      setAppState("error");
    }
  }, []);

  const applyEffect = useCallback(async (effectId: EffectId) => {
    if (!rawRecordingUri) return;
    const effectCfg = EFFECTS.find(e => e.id === effectId)!;
    const rateCfg = CLIENT_EFFECT_CONFIG[effectId];
    const isAI = effectCfg.isAI;

    try {
      setProcessingEffect(effectId);
      setAppState("processing");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      let outputUri: string;

      if (isAI && effectCfg.voiceId) {
        const b64 = await withRetry(() => callElevenLabs(rawRecordingUri, effectCfg.voiceId!), 3);
        outputUri = `${FileSystem.cacheDirectory ?? ""}clip_${effectId}_${Date.now()}.mp3`;
        await FileSystem.writeAsStringAsync(outputUri, b64, { encoding: FileSystem.EncodingType.Base64 });
      } else {
        outputUri = `${FileSystem.cacheDirectory ?? ""}clip_${effectId}_${Date.now()}.m4a`;
        await FileSystem.copyAsync({ from: rawRecordingUri, to: outputUri });
      }

      const newClip: ClipItem = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        effectId,
        audioUri: outputUri,
        durationMs: recordingDuration * 1000,
        playbackRate: rateCfg.rate,
        correctPitch: rateCfg.correctPitch,
        isAIConverted: isAI,
        isFavorite: false,
      };

      const fid = await saveToFirestore(newClip);
      if (fid) newClip.firestoreId = fid;

      const updated = [newClip, ...clips].slice(0, 50);
      await saveClips(updated);
      updateStats(effectId, newClip.durationMs, isAI);
      setProcessingEffect(null);
      await playFromUri(outputUri, newClip.id, rateCfg.rate, rateCfg.correctPitch);
    } catch (e: unknown) {
      setProcessingEffect(null);
      setErrorMessage(e instanceof Error ? e.message : "Effect failed.");
      setAppState("error");
    }
  }, [rawRecordingUri, clips, recordingDuration]);

  async function playFromUri(uri: string, id: string, rate = 1.0, correctPitch = true, loop = false) {
    try {
      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: bgmiMode });

      const finalRate = Math.max(0.25, Math.min(4.0, rate + pitchOffset * 0.05));
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume: Math.min(4.0, volumeBoost), isLooping: loop });

      if (finalRate !== 1.0) {
        try { await sound.setRateAsync(finalRate, correctPitch); } catch {}
      }
      soundRef.current = sound;
      setAppState("playing");
      setPlayingId(id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish && !loop) {
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
    const isLooping = loopIdRef.current === clip.id;
    await playFromUri(clip.audioUri, clip.id, clip.playbackRate ?? 1.0, clip.correctPitch ?? true, isLooping);
  }, [bgmiMode, pitchOffset, volumeBoost]);

  const stopPlayback = useCallback(async () => {
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
    setAppState(rawRecordingUri ? "recorded" : "idle");
    setPlayingId(null);
  }, [rawRecordingUri]);

  const toggleLoop = useCallback((id: string) => {
    setLoopId(prev => {
      const next = prev === id ? null : id;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return next;
    });
  }, []);

  const startRealtimeSession = useCallback(async () => {
    try {
      if (Platform.OS !== "web") {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== "granted") { setErrorMessage("Mic permission required."); setAppState("error"); return; }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, staysActiveInBackground: true });
      }
      realtimeActive.current = true;
      setAppState("realtime");
      setRecordingDuration(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      async function chunk() {
        if (!realtimeActive.current) return;
        try {
          const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
          await new Promise(r => setTimeout(r, REALTIME_CHUNK_MS));
          if (!realtimeActive.current) { await recording.stopAndUnloadAsync(); return; }
          await recording.stopAndUnloadAsync();
          const uri = recording.getURI();
          if (!uri) { chunk(); return; }

          const effectId = realtimeEffect;
          const effectCfg = EFFECTS.find(e => e.id === effectId)!;
          const rateCfg = CLIENT_EFFECT_CONFIG[effectId];
          let outputUri: string;

          if (effectCfg.isAI && effectCfg.voiceId) {
            try {
              const b64 = await withRetry(() => callElevenLabs(uri, effectCfg.voiceId!), 2);
              outputUri = `${FileSystem.cacheDirectory ?? ""}rt_${effectId}_${Date.now()}.mp3`;
              await FileSystem.writeAsStringAsync(outputUri, b64, { encoding: FileSystem.EncodingType.Base64 });
            } catch { outputUri = uri; }
          } else {
            outputUri = `${FileSystem.cacheDirectory ?? ""}rt_${effectId}_${Date.now()}.m4a`;
            await FileSystem.copyAsync({ from: uri, to: outputUri });
          }

          if (!realtimeActive.current) return;

          const newClip: ClipItem = {
            id: `rt_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            timestamp: Date.now(), effectId, audioUri: outputUri,
            durationMs: REALTIME_CHUNK_MS, playbackRate: rateCfg.rate,
            correctPitch: rateCfg.correctPitch, isAIConverted: effectCfg.isAI,
          };
          const fid = await saveToFirestore(newClip);
          if (fid) newClip.firestoreId = fid;
          setClips(prev => {
            const updated = [newClip, ...prev].slice(0, 50);
            AsyncStorage.setItem(CLIPS_KEY, JSON.stringify(updated)).catch(() => {});
            return updated;
          });

          await playRealtimeChunk(outputUri, rateCfg.rate, rateCfg.correctPitch);
          if (realtimeActive.current) chunk();
        } catch { if (realtimeActive.current) chunk(); }
      }

      chunk();
      timerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Realtime failed.");
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
    if (Platform.OS !== "web") try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false }); } catch {}
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
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: true });
      const finalRate = Math.max(0.25, Math.min(4.0, rate + pitchOffset * 0.05));
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume: Math.min(4.0, volumeBoost) });
      if (finalRate !== 1.0) try { await sound.setRateAsync(finalRate, correctPitch); } catch {}
      soundRef.current = sound;
      await new Promise<void>(resolve => {
        sound.setOnPlaybackStatusUpdate(s => {
          if (s.isLoaded && s.didJustFinish) { sound.unloadAsync(); soundRef.current = null; resolve(); }
        });
      });
    } catch {}
  }

  const shareClip = useCallback(async (clip: ClipItem, target: "whatsapp" | "instagram" | "any" = "any") => {
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) { setErrorMessage("Sharing not available."); return; }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const mimeType = clip.isAIConverted ? "audio/mpeg" : "audio/m4a";
      const uti = clip.isAIConverted ? "public.mp3" : "public.mpeg-4-audio";
      if (target === "whatsapp" && await Linking.canOpenURL("whatsapp://send")) {
        await Sharing.shareAsync(clip.audioUri, { mimeType, dialogTitle: "Share to WhatsApp", UTI: uti }); return;
      }
      if (target === "instagram" && await Linking.canOpenURL("instagram://app")) {
        await Sharing.shareAsync(clip.audioUri, { mimeType, dialogTitle: "Share to Instagram", UTI: uti }); return;
      }
      await Sharing.shareAsync(clip.audioUri, { mimeType, dialogTitle: "Share Voice Clip", UTI: uti });
    } catch (e: unknown) { setErrorMessage(e instanceof Error ? e.message : "Share failed."); }
  }, []);

  const saveToGallery = useCallback(async (clip: ClipItem) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") { setErrorMessage("Storage permission required."); return; }
      await MediaLibrary.createAssetAsync(clip.audioUri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) { setErrorMessage(e instanceof Error ? e.message : "Save failed."); }
  }, []);

  const deleteClip = useCallback(async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const clip = clips.find(c => c.id === id);
    if (clip?.firestoreId) await deleteFromFirestore(clip.firestoreId);
    try { if (clip?.audioUri) await FileSystem.deleteAsync(clip.audioUri, { idempotent: true }); } catch {}
    if (loopId === id) setLoopId(null);
    await saveClips(clips.filter(c => c.id !== id));
  }, [clips, loopId]);

  const renameClip = useCallback(async (id: string, label: string) => {
    const updated = clips.map(c => c.id === id ? { ...c, label } : c);
    await saveClips(updated);
    const clip = updated.find(c => c.id === id);
    if (clip?.firestoreId) await updateFirestore(clip.firestoreId, { label });
  }, [clips]);

  const toggleFavorite = useCallback(async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = clips.map(c => c.id === id ? { ...c, isFavorite: !c.isFavorite } : c);
    await saveClips(updated);
    const clip = updated.find(c => c.id === id);
    if (clip?.firestoreId) await updateFirestore(clip.firestoreId, { isFavorite: clip.isFavorite });
  }, [clips]);

  const clearError = useCallback(() => {
    setErrorMessage(null);
    setAppState(rawRecordingUri ? "recorded" : "idle");
  }, [rawRecordingUri]);

  const resetToIdle = useCallback(() => {
    setAppState("idle"); setRawRecordingUri(null); setRecordingDuration(0); setErrorMessage(null);
  }, []);

  const toggleBgmiMode = useCallback(() => {
    setBgmiMode(prev => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      saveSettings({ bgmiMode: !prev });
      return !prev;
    });
  }, []);

  const toggleRealtimeMode = useCallback(() => {
    setRealtimeMode(prev => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); return !prev; });
  }, []);

  const setRealtimeEffect = useCallback((id: EffectId) => setRealtimeEffectState(id), []);
  const setAutoStopSeconds = useCallback((s: number) => { setAutoStopSecondsState(s); saveSettings({ autoStopSeconds: s }); }, []);
  const setPitchOffset = useCallback((p: number) => { setPitchOffsetState(p); saveSettings({ pitchOffset: p }); }, []);
  const setVolumeBoost = useCallback((v: number) => { setVolumeBoostState(v); saveSettings({ volumeBoost: v }); }, []);

  return (
    <VoiceContext.Provider value={{
      appState, clips, filteredClips, errorMessage, recordingDuration,
      playingId, loopId, processingEffect, rawRecordingUri,
      bgmiMode, realtimeMode, realtimeEffect, filterEffect, stats,
      autoStopSeconds, pitchOffset, volumeBoost,
      startRecording, stopRecording, applyEffect,
      playClip, stopPlayback, toggleLoop,
      shareClip, saveToGallery, deleteClip, renameClip, toggleFavorite,
      clearError, resetToIdle,
      toggleBgmiMode, toggleRealtimeMode, setRealtimeEffect,
      setFilterEffect, setAutoStopSeconds, setPitchOffset, setVolumeBoost,
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
