import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassCard } from "@/components/GlassCard";
import { RecordButton } from "@/components/RecordButton";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";
import { EffectGrid } from "@/components/EffectGrid";
import {
  EFFECTS,
  useVoice,
  type ClipItem,
} from "@/context/VoiceContext";
import { useColors } from "@/hooks/useColors";

function formatDur(ms: number) {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${s % 60}s`;
}

function formatTs(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ClipRow({
  clip,
  isPlaying,
  onPlay,
  onStop,
  onShare,
  onDelete,
}: {
  clip: ClipItem;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const effect = EFFECTS.find(e => e.id === clip.effectId);
  const color = effect?.color ?? colors.cyan;

  return (
    <GlassCard
      style={[
        styles.clipRow,
        isPlaying && { borderColor: color, shadowColor: color, shadowRadius: 10, shadowOpacity: 0.5 },
      ]}
    >
      <View style={[styles.effectDot, { backgroundColor: color }]} />
      <View style={styles.clipInfo}>
        <Text style={[styles.clipLabel, { color: colors.foreground }]}>
          {effect?.label ?? clip.effectId}
        </Text>
        <Text style={[styles.clipMeta, { color: colors.mutedForeground }]}>
          {formatTs(clip.timestamp)}
          {clip.durationMs > 0 ? `  ·  ${formatDur(clip.durationMs)}` : ""}
        </Text>
      </View>
      <View style={styles.clipActions}>
        <Pressable
          onPress={isPlaying ? onStop : onPlay}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <View style={[styles.actionBtn, { backgroundColor: isPlaying ? color : colors.glassSurface }]}>
            <Feather name={isPlaying ? "square" : "play"} size={13} color={isPlaying ? "#050A14" : color} />
          </View>
        </Pressable>
        <Pressable
          onPress={onShare}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <View style={[styles.actionBtn, { backgroundColor: colors.glassSurface }]}>
            <Feather name="share-2" size={13} color={colors.cyan} />
          </View>
        </Pressable>
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <View style={[styles.actionBtn, { backgroundColor: colors.glassSurface }]}>
            <Feather name="trash-2" size={13} color={colors.mutedForeground} />
          </View>
        </Pressable>
      </View>
    </GlassCard>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    appState, clips, errorMessage, recordingDuration,
    playingId, processingEffect, rawRecordingUri,
    startRecording, stopRecording, applyEffect,
    playClip, stopPlayback, shareClip, deleteClip,
    clearError, resetToIdle,
  } = useVoice();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const isRecording  = appState === "recording";
  const isRecorded   = appState === "recorded";
  const isProcessing = appState === "processing";
  const isPlaying    = appState === "playing";
  const isError      = appState === "error";
  const isIdle       = appState === "idle";

  const waveActive = isRecording || isPlaying;
  const waveColor  = isRecording ? colors.recording : colors.cyan;

  function handleRecordBtn() {
    if (isError)      { clearError(); return; }
    if (isRecording)  { stopRecording(); return; }
    if (isPlaying)    { stopPlayback(); return; }
    if (isRecorded || isProcessing) { return; }
    startRecording();
  }

  const statusLabel =
    isError      ? (errorMessage ?? "Error")    :
    isRecording  ? `Recording... ${recordingDuration}s` :
    isProcessing ? "Applying effect..."          :
    isPlaying    ? "Playing back"                :
    isRecorded   ? "Choose an effect below"      :
    "Tap to record your voice";

  const statusColor =
    isError     ? colors.destructive :
    isRecording ? colors.recording   :
    isProcessing? colors.processing  :
    isPlaying   ? colors.cyan        :
    isRecorded  ? colors.cyan        :
    colors.mutedForeground;

  return (
    <LinearGradient colors={["#050A14", "#06101C", "#050A14"]} style={styles.root}>
      <View style={[styles.screen, { paddingTop: topPad, paddingBottom: botPad }]}>

        {/* Header */}
        <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.dot, { backgroundColor: colors.cyan, shadowColor: colors.cyan }]} />
            <Text style={[styles.title, { color: colors.foreground }]}>Voice Studio</Text>
          </View>
          <View style={styles.headerRight}>
            <GlassCard style={styles.badge}>
              <Text style={[styles.badgeText, { color: colors.cyan }]}>BGMI · WhatsApp</Text>
            </GlassCard>
            {(isRecorded || isProcessing || isPlaying) && (
              <Pressable onPress={resetToIdle} hitSlop={8}>
                <View style={[styles.resetBtn, { backgroundColor: colors.glassSurface }]}>
                  <Feather name="refresh-ccw" size={14} color={colors.mutedForeground} />
                </View>
              </Pressable>
            )}
          </View>
        </Animated.View>

        {/* Status */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <GlassCard style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]} numberOfLines={1}>
                {statusLabel}
              </Text>
            </View>
          </GlassCard>
        </Animated.View>

        {/* Waveform */}
        <Animated.View entering={FadeIn.delay(150).duration(500)} style={styles.waveSection}>
          <WaveformVisualizer active={waveActive} color={waveColor} />
        </Animated.View>

        {/* Record Button */}
        <Animated.View entering={FadeIn.delay(200).duration(600)} style={styles.btnSection}>
          <RecordButton
            state={appState === "recorded" ? "idle" : appState}
            onPress={handleRecordBtn}
            disabled={isProcessing || isRecorded}
          />
          <Text style={[styles.btnHint, { color: colors.mutedForeground }]}>
            {isRecording  ? "Tap to stop"          :
             isProcessing ? "Processing..."         :
             isPlaying    ? "Tap to stop"           :
             isRecorded   ? "Tap an effect"         :
             isError      ? "Tap to dismiss"        :
             "Tap to start"}
          </Text>
        </Animated.View>

        {/* Effect Grid — shown after recording */}
        {(isRecorded || isProcessing) && (
          <Animated.View entering={FadeInUp.duration(400)} style={styles.effectSection}>
            <EffectGrid
              effects={EFFECTS}
              processingEffect={processingEffect}
              onSelect={applyEffect}
              disabled={isProcessing}
            />
          </Animated.View>
        )}

        {/* Clips History — shown when idle/playing */}
        {(isIdle || isPlaying) && clips.length > 0 && (
          <Animated.View entering={FadeInUp.delay(100).duration(400)} style={styles.historySection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Saved Clips</Text>
              <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>
                {clips.length} clip{clips.length !== 1 ? "s" : ""}
              </Text>
            </View>
            <FlatList
              data={clips}
              keyExtractor={c => c.id}
              scrollEnabled={clips.length > 3}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.clipList}
              renderItem={({ item }) => (
                <ClipRow
                  clip={item}
                  isPlaying={playingId === item.id}
                  onPlay={() => playClip(item)}
                  onStop={stopPlayback}
                  onShare={() => shareClip(item)}
                  onDelete={() => deleteClip(item.id)}
                />
              )}
            />
          </Animated.View>
        )}

        {/* Empty state */}
        {isIdle && clips.length === 0 && (
          <Animated.View entering={FadeIn.delay(300).duration(500)} style={styles.empty}>
            <Feather name="mic" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Record your voice, then pick an effect
            </Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              Share to WhatsApp · Play loud for BGMI
            </Text>
          </Animated.View>
        )}

      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  screen: { flex: 1, paddingHorizontal: 18 },

  header:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot:       { width: 8, height: 8, borderRadius: 4, shadowOffset: { width: 0, height: 0 }, shadowRadius: 6, shadowOpacity: 0.9 },
  title:     { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: 0.2 },
  badge:     { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 20 },
  badgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.4 },
  resetBtn:  { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  statusCard: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 12, marginBottom: 4 },
  statusRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot:  { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },

  waveSection: { alignItems: "center", marginVertical: 4 },
  btnSection:  { alignItems: "center", gap: 8, marginBottom: 8 },
  btnHint:     { fontSize: 12, fontFamily: "Inter_400Regular" },

  effectSection:  { flex: 1 },
  historySection: { flex: 1 },
  sectionHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sectionTitle:   { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sectionCount:   { fontSize: 12, fontFamily: "Inter_400Regular" },

  clipList: { gap: 8 },
  clipRow:  { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14 },
  effectDot: { width: 10, height: 10, borderRadius: 5 },
  clipInfo:  { flex: 1 },
  clipLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  clipMeta:  { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  clipActions: { flexDirection: "row", gap: 6 },
  actionBtn:   { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },

  empty:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 20 },
  emptyText: { fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptyHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
});
