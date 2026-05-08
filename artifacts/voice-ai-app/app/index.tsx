import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCard } from "@/components/GlassCard";
import { HistoryList } from "@/components/HistoryList";
import { RecordButton } from "@/components/RecordButton";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";
import { useVoice } from "@/context/VoiceContext";
import { useColors } from "@/hooks/useColors";

const STATE_LABELS: Record<string, string> = {
  idle: "Tap to speak",
  recording: "Recording...",
  processing: "Converting voice...",
  playing: "Playing back",
  error: "Something went wrong",
};

const STATE_COLORS_MAP = {
  idle: "cyan",
  recording: "recording",
  processing: "processing",
  playing: "cyan",
  error: "destructive",
};

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
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
  } = useVoice();

  const isActive = state === "recording" || state === "playing";
  const isDisabled = state === "processing";

  const handleButtonPress = useCallback(async () => {
    if (state === "error") {
      clearError();
      return;
    }
    if (state === "recording") {
      await stopAndConvert();
    } else if (state === "playing") {
      await stopPlayback();
    } else if (state === "idle") {
      await startRecording();
    }
  }, [state]);

  const statusColor =
    state === "recording"
      ? colors.recording
      : state === "processing"
      ? colors.processing
      : state === "error"
      ? colors.destructive
      : colors.cyan;

  const waveformColor =
    state === "recording"
      ? colors.recording
      : state === "playing"
      ? colors.cyan
      : colors.cyanDim;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <LinearGradient
      colors={["#050A14", "#070D1A", "#050A14"]}
      style={styles.root}
    >
      <View
        style={[styles.container, { paddingTop: topPad, paddingBottom: bottomPad }]}
      >
        <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.dot, { backgroundColor: colors.cyan }]} />
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              Bella AI
            </Text>
          </View>
          <GlassCard style={styles.badge}>
            <Text style={[styles.badgeText, { color: colors.cyan }]}>
              ElevenLabs
            </Text>
          </GlassCard>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(100).duration(500)}
          style={styles.statusCard}
        >
          <GlassCard style={styles.statusInner}>
            <View style={styles.statusRow}>
              <View
                style={[styles.statusDot, { backgroundColor: statusColor }]}
              />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {errorMessage
                  ? "Error"
                  : STATE_LABELS[state] ?? "Ready"}
              </Text>
              {state === "recording" && (
                <Text
                  style={[styles.duration, { color: colors.mutedForeground }]}
                >
                  {recordingDuration}s
                </Text>
              )}
            </View>
            {errorMessage && (
              <Text
                style={[styles.errorText, { color: colors.mutedForeground }]}
                numberOfLines={2}
              >
                {errorMessage}
              </Text>
            )}
          </GlassCard>
        </Animated.View>

        <Animated.View
          entering={FadeIn.delay(200).duration(600)}
          style={styles.visualizerSection}
        >
          <WaveformVisualizer
            active={state === "recording" || state === "playing"}
            color={waveformColor}
          />
        </Animated.View>

        <Animated.View
          entering={FadeIn.delay(300).duration(600)}
          style={styles.buttonSection}
        >
          <RecordButton
            state={state}
            onPress={handleButtonPress}
            disabled={isDisabled}
          />
          <Text
            style={[styles.buttonHint, { color: colors.mutedForeground }]}
          >
            {state === "recording"
              ? "Tap to stop & convert"
              : state === "playing"
              ? "Tap to stop"
              : state === "processing"
              ? "Processing your voice..."
              : state === "error"
              ? "Tap to dismiss"
              : "Tap to start recording"}
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(400).duration(500)}
          style={styles.historySection}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              History
            </Text>
            <Text
              style={[styles.sectionCount, { color: colors.mutedForeground }]}
            >
              {history.length} clip{history.length !== 1 ? "s" : ""}
            </Text>
          </View>

          <HistoryList
            items={history}
            playingId={playingId}
            onPlay={playItem}
            onStop={stopPlayback}
            onDelete={deleteItem}
          />
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
    shadowOpacity: 0.9,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  statusCard: {
    marginBottom: 8,
  },
  statusInner: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  duration: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  visualizerSection: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  buttonSection: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
    gap: 12,
  },
  buttonHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.2,
  },
  historySection: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  sectionCount: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
