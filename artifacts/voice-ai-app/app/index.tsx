import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
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
  type EffectId,
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
  clip, isPlaying, onPlay, onStop, onShareWA, onShareIG, onShare, onDelete,
}: {
  clip: ClipItem; isPlaying: boolean;
  onPlay: () => void; onStop: () => void;
  onShareWA: () => void; onShareIG: () => void;
  onShare: () => void; onDelete: () => void;
}) {
  const colors = useColors();
  const effect = EFFECTS.find(e => e.id === clip.effectId);
  const color = effect?.color ?? colors.cyan;
  const [expanded, setExpanded] = useState(false);

  return (
    <GlassCard style={[styles.clipRow, isPlaying && { borderColor: color, shadowColor: color, shadowRadius: 10, shadowOpacity: 0.5 }]}>
      <View style={[styles.effectDot, { backgroundColor: color }]} />
      <Pressable style={styles.clipInfo} onPress={() => setExpanded(e => !e)}>
        <Text style={[styles.clipLabel, { color: colors.foreground }]}>
          {effect?.label ?? clip.effectId}
          {clip.isGojoConverted ? " ✦" : ""}
        </Text>
        <Text style={[styles.clipMeta, { color: colors.mutedForeground }]}>
          {formatTs(clip.timestamp)}
          {clip.durationMs > 0 ? `  ·  ${formatDur(clip.durationMs)}` : ""}
        </Text>
      </Pressable>
      <View style={styles.clipActions}>
        <Pressable onPress={isPlaying ? onStop : onPlay} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <View style={[styles.actionBtn, { backgroundColor: isPlaying ? color : colors.glassSurface }]}>
            <Feather name={isPlaying ? "square" : "play"} size={13} color={isPlaying ? "#050A14" : color} />
          </View>
        </Pressable>
        <Pressable onPress={onShareWA} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <View style={[styles.actionBtn, { backgroundColor: "#25D366" + "22" }]}>
            <Feather name="message-circle" size={13} color="#25D366" />
          </View>
        </Pressable>
        <Pressable onPress={onShare} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <View style={[styles.actionBtn, { backgroundColor: colors.glassSurface }]}>
            <Feather name="share-2" size={13} color={colors.cyan} />
          </View>
        </Pressable>
        <Pressable onPress={onDelete} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <View style={[styles.actionBtn, { backgroundColor: colors.glassSurface }]}>
            <Feather name="trash-2" size={13} color={colors.mutedForeground} />
          </View>
        </Pressable>
      </View>
    </GlassCard>
  );
}

function RealtimeEffectPicker({ selected, onSelect }: { selected: EffectId; onSelect: (id: EffectId) => void }) {
  const colors = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
      {EFFECTS.map(e => (
        <Pressable key={e.id} onPress={() => onSelect(e.id)} style={{ marginRight: 8 }}>
          <View style={[
            styles.rtEffectChip,
            { backgroundColor: selected === e.id ? e.color + "33" : colors.glassSurface,
              borderColor: selected === e.id ? e.color : colors.glassBorder }
          ]}>
            <Text style={[styles.rtEffectText, { color: selected === e.id ? e.color : colors.mutedForeground }]}>
              {e.label}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    appState, clips, errorMessage, recordingDuration,
    playingId, processingEffect, rawRecordingUri,
    bgmiMode, realtimeMode, realtimeEffect,
    startRecording, stopRecording, applyEffect,
    playClip, stopPlayback, shareClip, deleteClip,
    clearError, resetToIdle,
    toggleBgmiMode, toggleRealtimeMode, setRealtimeEffect,
    startRealtimeSession, stopRealtimeSession,
  } = useVoice();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const isRecording  = appState === "recording";
  const isRecorded   = appState === "recorded";
  const isProcessing = appState === "processing";
  const isPlaying    = appState === "playing";
  const isError      = appState === "error";
  const isIdle       = appState === "idle";
  const isRealtime   = appState === "realtime";

  const waveActive = isRecording || isPlaying || isRealtime;
  const waveColor  = isRealtime ? "#FF4500" : isRecording ? colors.recording : colors.cyan;

  function handleRecordBtn() {
    if (isError)      { clearError(); return; }
    if (isRealtime)   { stopRealtimeSession(); return; }
    if (isRecording)  { stopRecording(); return; }
    if (isPlaying)    { stopPlayback(); return; }
    if (isRecorded || isProcessing) return;
    if (realtimeMode) { startRealtimeSession(); return; }
    startRecording();
  }

  const statusLabel =
    isError      ? (errorMessage ?? "Error")                            :
    isRealtime   ? `🔴 Real-Time Active... ${recordingDuration}s`       :
    isRecording  ? `Recording... ${recordingDuration}s`                  :
    isProcessing ? "Applying effect..."                                  :
    isPlaying    ? "Playing back"                                        :
    isRecorded   ? "Choose an effect below"                              :
    realtimeMode ? "Tap to start real-time voice"                        :
    "Tap to record your voice";

  const statusColor =
    isError     ? colors.destructive :
    isRealtime  ? "#FF4500"          :
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
            <Text style={[styles.title, { color: colors.foreground }]}>Gojo Voice</Text>
          </View>
          <View style={styles.headerRight}>
            {/* BGMI Mode */}
            <Pressable onPress={toggleBgmiMode} hitSlop={8}>
              <View style={[styles.modeBtn, { backgroundColor: bgmiMode ? "#FF4500" + "33" : colors.glassSurface, borderColor: bgmiMode ? "#FF4500" : colors.glassBorder }]}>
                <Feather name="zap" size={12} color={bgmiMode ? "#FF4500" : colors.mutedForeground} />
                <Text style={[styles.modeBtnText, { color: bgmiMode ? "#FF4500" : colors.mutedForeground }]}>BGMI</Text>
              </View>
            </Pressable>
            {/* Real-Time Mode */}
            <Pressable onPress={toggleRealtimeMode} hitSlop={8}>
              <View style={[styles.modeBtn, { backgroundColor: realtimeMode ? colors.cyan + "33" : colors.glassSurface, borderColor: realtimeMode ? colors.cyan : colors.glassBorder }]}>
                <Feather name="radio" size={12} color={realtimeMode ? colors.cyan : colors.mutedForeground} />
                <Text style={[styles.modeBtnText, { color: realtimeMode ? colors.cyan : colors.mutedForeground }]}>Live</Text>
              </View>
            </Pressable>
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

        {/* Real-time effect picker */}
        {realtimeMode && !isRealtime && (
          <Animated.View entering={FadeInDown.duration(300)} style={{ marginBottom: 4 }}>
            <GlassCard style={{ padding: 10 }}>
              <Text style={[styles.rtLabel, { color: colors.mutedForeground }]}>Real-Time Effect:</Text>
              <RealtimeEffectPicker selected={realtimeEffect} onSelect={setRealtimeEffect} />
            </GlassCard>
          </Animated.View>
        )}

        {/* Share to Apps Banner — shown in idle/playing */}
        {(isIdle || isRealtime) && clips.length > 0 && (
          <Animated.View entering={FadeIn.duration(300)}>
            <GlassCard style={styles.shareBanner}>
              <Text style={[styles.shareBannerText, { color: colors.mutedForeground }]}>
                Tap 💬 to share to WhatsApp · 📤 for all apps (Instagram, BGMI, etc.)
              </Text>
            </GlassCard>
          </Animated.View>
        )}

        {/* Waveform */}
        <Animated.View entering={FadeIn.delay(150).duration(500)} style={styles.waveSection}>
          <WaveformVisualizer active={waveActive} color={waveColor} />
        </Animated.View>

        {/* Record Button */}
        <Animated.View entering={FadeIn.delay(200).duration(600)} style={styles.btnSection}>
          <RecordButton
            state={isRealtime ? "recording" : appState === "recorded" ? "idle" : appState}
            onPress={handleRecordBtn}
            disabled={isProcessing || isRecorded}
          />
          <Text style={[styles.btnHint, { color: isRealtime ? "#FF4500" : colors.mutedForeground }]}>
            {isRealtime   ? "Tap to stop real-time"  :
             isRecording  ? "Tap to stop"            :
             isProcessing ? "Processing..."          :
             isPlaying    ? "Tap to stop"            :
             isRecorded   ? "Tap an effect"          :
             isError      ? "Tap to dismiss"         :
             realtimeMode ? "Tap to go live"         :
             "Tap to start"}
          </Text>
        </Animated.View>

        {/* Effect Grid */}
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

        {/* Clips History */}
        {(isIdle || isPlaying || isRealtime) && clips.length > 0 && (
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
                  onShareWA={() => shareClip(item, "whatsapp")}
                  onShareIG={() => shareClip(item, "instagram")}
                  onShare={() => shareClip(item, "any")}
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
            <Text style={[styles.emptyText, { color: colors.foreground }]}>
              Record → Convert → Share
            </Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              WhatsApp · Instagram · BGMI · Any App
            </Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              Enable "Live" for real-time voice
            </Text>
          </Animated.View>
        )}

      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  screen: { flex: 1, paddingHorizontal: 16 },

  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  headerLeft:  { flexDirection: "row", alignItems: "center", gap: 8 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot:         { width: 8, height: 8, borderRadius: 4, shadowOffset: { width: 0, height: 0 }, shadowRadius: 6, shadowOpacity: 0.9 },
  title:       { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: 0.2 },
  modeBtn:     { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1 },
  modeBtnText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  resetBtn:    { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },

  statusCard:  { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4 },
  statusRow:   { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot:   { width: 7, height: 7, borderRadius: 4 },
  statusText:  { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },

  shareBanner:     { paddingVertical: 7, paddingHorizontal: 10, marginBottom: 4, borderRadius: 10 },
  shareBannerText: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },

  rtLabel:     { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 4 },
  rtEffectChip:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  rtEffectText:    { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  waveSection: { alignItems: "center", marginVertical: 2 },
  btnSection:  { alignItems: "center", gap: 6, marginBottom: 6 },
  btnHint:     { fontSize: 12, fontFamily: "Inter_400Regular" },

  effectSection:  { flex: 1 },
  historySection: { flex: 1 },
  sectionHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  sectionTitle:   { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sectionCount:   { fontSize: 12, fontFamily: "Inter_400Regular" },

  clipList:    { gap: 6 },
  clipRow:     { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 14 },
  effectDot:   { width: 9, height: 9, borderRadius: 5 },
  clipInfo:    { flex: 1 },
  clipLabel:   { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  clipMeta:    { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  clipActions: { flexDirection: "row", gap: 5 },
  actionBtn:   { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },

  empty:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 20 },
  emptyText: { fontSize: 15, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
});
