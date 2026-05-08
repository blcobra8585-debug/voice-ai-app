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
import { Platform } from "react-native";

export type EffectId =
  | "robot" | "deep" | "chipmunk" | "female"
  | "alien" | "echo" | "cave" | "demon" | "radio" | "whisper" | "bella";

export interface EffectConfig {
  id: EffectId;
  label: string;
  icon: string;
  color: string;
  description: string;
}

export const EFFECTS: EffectConfig[] = [
  { id: "bella",    label: "Bella AI",  icon: "star",      color: "#FFD700", description: "ElevenLabs AI" },
  { id: "robot",    label: "Robot",     icon: "cpu",       color: "#00E5FF", description: "Mechanical voice" },
  { id: "deep",     label: "Deep",      icon: "arrow-down",color: "#7C4DFF", description: "Low bass voice" },
  { id: "chipmunk", label: "Chipmunk",  icon: "zap",       color: "#FF6D00", description: "High squeaky" },
  { id: "female",   label: "Female",    icon: "user",      color: "#FF4081", description: "Female pitch" },
  { id: "alien",    label: "Alien",     icon: "radio",     color: "#76FF03", description: "Extraterrestrial" },
  { id: "echo",     label: "Echo",      icon: "repeat",    color: "#00BCD4", description: "Deep reverb" },
  { id: "cave",     label: "Cave",      icon: "triangle",  color: "#78909C", description: "Cave echo" },
  { id: "demon",    label: "Demon",     icon: "alert-triangle", color: "#FF1744", description: "Dark demon" },
  { id: "radio",    label: "Radio",     icon: "wifi",      color: "#FFEA00", description: "Walkie talkie" },
  { id: "whisper",  label: "Whisper",   icon: "wind",      color: "#B2EBF2", description: "Soft whisper" },
];

export interface ClipItem {
  id: string;
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
const CLIPS_KEY = "voice_studio_clips_v1";
const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [appState, setAppState]               = useState<AppState>("idle");
  const [clips, setClips]                     = useState<ClipItem[]>([]);
  const [errorMessage, setErrorMessage]       = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingId, setPlayingId]             = useState<string | null>(null);
  const [processingEffect, setProcessingEffect] = useState<EffectId | null>(null);
  const [rawRecordingUri, setRawRecordingUri] = useState<string | null>(null);

  const recordingRef  = useRef<Audio.Recording | null>(null);
  const soundRef      = useRef<Audio.Sound | null>(null);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);

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
      if (raw) setClips(JSON.parse(raw));
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

      if (effectId === "bella") {
        const formData = new FormData();
        formData.append("audio", { uri: rawRecordingUri, type: "audio/m4a", name: "rec.m4a" } as any);
        const res = await fetch(`${BASE_URL}/api/voice/speech-to-speech`, { method: "POST", body: formData });
        if (!res.ok) throw new Error(`Bella error: ${res.status}`);
        ({ audio: audioBase64 } = await res.json());
      } else {
        const formData = new FormData();
        formData.append("audio", { uri: rawRecordingUri, type: "audio/m4a", name: "rec.m4a" } as any);
        formData.append("effect", effectId);
        const res = await fetch(`${BASE_URL}/api/voice/effects`, { method: "POST", body: formData });
        if (!res.ok) throw new Error(`Effect error: ${res.status}`);
        ({ audio: audioBase64 } = await res.json());
      }

      const outputUri = (FileSystem.cacheDirectory ?? "") + `clip_${effectId}_${Date.now()}.mp3`;
      await FileSystem.writeAsStringAsync(outputUri, audioBase64, { encoding: FileSystem.EncodingType.Base64 });

      const newClip: ClipItem = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        effectId,
        audioUri: outputUri,
        durationMs: recordingDuration * 1000,
      };

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
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume: 1.0 });
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
      if (!canShare) { setErrorMessage("Sharing not available on this device."); return; }
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
