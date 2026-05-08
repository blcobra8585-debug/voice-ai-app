import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AudioModule,
  RecordingPresets,
  createAudioPlayer,
  useAudioRecorder,
  type AudioPlayer,
} from "expo-audio";
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
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [state, setState] = useState<VoiceState>("idle");
  const [history, setHistory] = useState<VoiceHistoryItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const playerRef = useRef<AudioPlayer | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadHistory();
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      playerRef.current?.remove();
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
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) {
          setErrorMessage("Microphone permission is required.");
          setState("error");
          return;
        }
        await AudioModule.setAudioModeAsync({
          allowsRecording: true,
          interruptionMode: 1,
          playsInSilent: true,
        });
      }

      await recorder.prepareToRecordAsync();
      recorder.record();

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
  }, [recorder]);

  const stopAndConvert = useCallback(async () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    try {
      setState("processing");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      await recorder.stop();
      const uri = recorder.uri;

      if (!uri) throw new Error("No recording URI found.");

      if (Platform.OS !== "web") {
        await AudioModule.setAudioModeAsync({ allowsRecording: false });
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
        const errText = await response.text();
        throw new Error(`API error ${response.status}: ${errText}`);
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
        durationMs: recordingDuration * 1000,
      };

      const updated = [newItem, ...history].slice(0, 20);
      await saveHistory(updated);

      await playFromUri(convertedUri, newItem.id);
    } catch (e: any) {
      setErrorMessage(e?.message ?? "Voice conversion failed.");
      setState("error");
    }
  }, [history, recordingDuration, recorder]);

  async function playFromUri(uri: string, id: string) {
    try {
      if (playerRef.current) {
        playerRef.current.remove();
        playerRef.current = null;
      }

      const player = createAudioPlayer({ uri });
      playerRef.current = player;

      player.play();
      setState("playing");
      setPlayingId(id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const checkInterval = setInterval(() => {
        if (!playerRef.current || playerRef.current.status === "readyToPlay" && !playerRef.current.playing) {
          clearInterval(checkInterval);
          setState("idle");
          setPlayingId(null);
        }
      }, 500);

      player.addListener("playbackStatusUpdate", (status) => {
        if (status.didJustFinish) {
          clearInterval(checkInterval);
          setState("idle");
          setPlayingId(null);
          player.remove();
          playerRef.current = null;
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
    if (playerRef.current) {
      playerRef.current.remove();
      playerRef.current = null;
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
