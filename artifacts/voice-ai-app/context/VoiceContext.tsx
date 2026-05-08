import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

export interface VoiceHistoryItem {
  id: string;
  timestamp: number;
  convertedUri: string;
  durationMs: number;
}

type VoiceState = "idle" | "recording" | "processing" | "playing" | "error";

interface VoiceContextType {
  state: VoiceState;
  history: VoiceHistoryItem[];
  errorMessage: string | null;
  startRecording: () => Promise<void>;
  stopAndConvert: () => Promise<void>;
  playItem: (item: VoiceHistoryItem) => Promise<void>;
  stopPlayback: () => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  clearError: () => void;
  playingId: string | null;
  recordingDuration: number;
}

const VoiceContext = createContext<VoiceContextType | null>(null);

const HISTORY_KEY = "voice_ai_history_v2";
const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<VoiceState>("idle");
  const [history, setHistory] = useState<VoiceHistoryItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadHistory();
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      soundRef.current?.unloadAsync();
    };
  }, []);

  async function loadHistory() {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }

  async function saveHistory(items: VoiceHistoryItem[]) {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(items));
    setHistory(items);
  }

  const startRecording = useCallback(async () => {
    try {
      if (Platform.OS !== "web") {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== "granted") {
          setErrorMessage("Microphone permission required.");
          setState("error");
          return;
        }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      }

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;

      setState("recording");
      setRecordingDuration(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (e: any) {
      setErrorMessage(e?.message ?? "Failed to start recording.");
      setState("error");
    }
  }, []);

  const stopAndConvert = useCallback(async () => {
    if (!recordingRef.current) return;

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    const currentDuration = recordingDuration;

    try {
      setState("processing");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error("No recording URI.");

      if (Platform.OS !== "web") {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      }

      const formData = new FormData();
      formData.append("audio", {
        uri,
        type: "audio/m4a",
        name: "recording.m4a",
      } as any);

      const response = await fetch(`${BASE_URL}/api/voice/speech-to-speech`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Server error ${response.status}: ${txt}`);
      }

      const { audio } = await response.json();

      const convertedUri =
        (FileSystem.cacheDirectory ?? "") + `voice_${Date.now()}.mp3`;
      await FileSystem.writeAsStringAsync(convertedUri, audio, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const newItem: VoiceHistoryItem = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        convertedUri,
        durationMs: currentDuration * 1000,
      };

      const updated = [newItem, ...history].slice(0, 20);
      await saveHistory(updated);

      await playFromUri(convertedUri, newItem.id);
    } catch (e: any) {
      setErrorMessage(e?.message ?? "Voice conversion failed.");
      setState("error");
    }
  }, [history, recordingDuration]);

  async function playFromUri(uri: string, id: string) {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      soundRef.current = sound;
      setState("playing");
      setPlayingId(id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setState("idle");
          setPlayingId(null);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (e: any) {
      setErrorMessage(e?.message ?? "Playback failed.");
      setState("error");
    }
  }

  const playItem = useCallback(async (item: VoiceHistoryItem) => {
    await playFromUri(item.convertedUri, item.id);
  }, []);

  const stopPlayback = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setState("idle");
    setPlayingId(null);
  }, []);

  const deleteItem = useCallback(
    async (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const updated = history.filter((h) => h.id !== id);
      await saveHistory(updated);
    },
    [history]
  );

  const clearError = useCallback(() => {
    setErrorMessage(null);
    setState("idle");
  }, []);

  return (
    <VoiceContext.Provider
      value={{
        state,
        history,
        errorMessage,
        startRecording,
        stopAndConvert,
        playItem,
        stopPlayback,
        deleteItem,
        clearError,
        playingId,
        recordingDuration,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used inside VoiceProvider");
  return ctx;
}
