import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AudioMeter } from "@/components/AudioMeter";
import { EffectGrid } from "@/components/EffectGrid";
import { GlassCard } from "@/components/GlassCard";
import { RecordButton } from "@/components/RecordButton";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";
import {
  EFFECTS, useVoice,
  type ClipItem, type EffectId,
} from "@/context/VoiceContext";
import { useColors } from "@/hooks/useColors";

function formatDur(ms: number) {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${s % 60}s`;
}
function formatTs(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────
function FilterBar({ filter, onFilter }: {
  filter: EffectId | "all" | "favorites";
  onFilter: (f: EffectId | "all" | "favorites") => void;
}) {
  const colors = useColors();
  const opts: Array<{ id: EffectId | "all" | "favorites"; label: string }> = [
    { id: "all", label: "All" },
    { id: "favorites", label: "⭐ Fav" },
    ...EFFECTS.filter(e => e.isAI).map(e => ({ id: e.id, label: e.label })),
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
      {opts.map(o => (
        <Pressable key={o.id} onPress={() => onFilter(o.id as EffectId | "all" | "favorites")} style={{ marginRight: 6 }}>
          <View style={[styles.filterChip, {
            backgroundColor: filter === o.id ? colors.cyan + "22" : colors.glassSurface,
            borderColor: filter === o.id ? colors.cyan : colors.glassBorder,
          }]}>
            <Text style={[styles.filterText, { color: filter === o.id ? colors.cyan : colors.mutedForeground }]}>{o.label}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── Realtime Effect Picker ───────────────────────────────────────────────────
function RealtimeEffectPicker({ selected, onSelect }: { selected: EffectId; onSelect: (id: EffectId) => void }) {
  const colors = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
      {EFFECTS.map(e => (
        <Pressable key={e.id} onPress={() => onSelect(e.id)} style={{ marginRight: 6 }}>
          <View style={[styles.filterChip, {
            backgroundColor: selected === e.id ? e.color + "22" : colors.glassSurface,
            borderColor: selected === e.id ? e.color : colors.glassBorder,
          }]}>
            {e.isAI && <Feather name="star" size={9} color={selected === e.id ? e.color : colors.mutedForeground} style={{ marginRight: 3 }} />}
            <Text style={[styles.filterText, { color: selected === e.id ? e.color : colors.mutedForeground }]}>{e.label}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── Rename Modal ─────────────────────────────────────────────────────────────
function RenameModal({ visible, clip, onSave, onClose }: {
  visible: boolean; clip: ClipItem | null;
  onSave: (id: string, label: string) => void; onClose: () => void;
}) {
  const colors = useColors();
  const [text, setText] = useState("");
  React.useEffect(() => { if (clip) setText(clip.label ?? ""); }, [clip]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <GlassCard style={styles.modalCard}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Rename Clip</Text>
          <TextInput
            value={text} onChangeText={setText}
            style={[styles.modalInput, { color: colors.foreground, borderColor: colors.glassBorder, backgroundColor: colors.glassSurface }]}
            placeholder="Enter name..." placeholderTextColor={colors.mutedForeground}
            autoFocus maxLength={40}
          />
          <View style={styles.modalBtns}>
            <Pressable onPress={onClose} style={[styles.modalBtn, { backgroundColor: colors.glassSurface }]}>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => { if (clip && text.trim()) { onSave(clip.id, text.trim()); onClose(); } }}
              style={[styles.modalBtn, { backgroundColor: colors.cyan + "22", borderColor: colors.cyan, borderWidth: 1 }]}>
              <Text style={{ color: colors.cyan, fontFamily: "Inter_600SemiBold" }}>Save</Text>
            </Pressable>
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
}

// ─── Clip Row ─────────────────────────────────────────────────────────────────
function ClipRow({ clip, isPlaying, isLooping, onPlay, onStop, onLoop, onFav, onShareWA, onShare, onSave, onRename, onDelete }: {
  clip: ClipItem; isPlaying: boolean; isLooping: boolean;
  onPlay: () => void; onStop: () => void; onLoop: () => void; onFav: () => void;
  onShareWA: () => void; onShare: () => void; onSave: () => void;
  onRename: () => void; onDelete: () => void;
}) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const effect = EFFECTS.find(e => e.id === clip.effectId);
  const color = effect?.color ?? colors.cyan;

  return (
    <GlassCard style={[styles.clipCard, isPlaying && { borderColor: color }]}>
      <View style={styles.clipMain}>
        <View style={[styles.effectDot, { backgroundColor: color }]} />
        <Pressable style={styles.clipInfo} onPress={() => setExpanded(e => !e)}>
          <View style={styles.clipNameRow}>
            <Text style={[styles.clipLabel, { color: colors.foreground }]} numberOfLines={1}>
              {clip.label ?? effect?.label ?? clip.effectId}
              {effect?.isAI ? " ✦" : ""}
            </Text>
            {clip.isFavorite && <Feather name="star" size={10} color="#FFD700" style={{ marginLeft: 4 }} />}
          </View>
          <Text style={[styles.clipMeta, { color: colors.mutedForeground }]}>
            {formatTs(clip.timestamp)}{clip.durationMs > 0 ? `  ·  ${formatDur(clip.durationMs)}` : ""}
          </Text>
        </Pressable>
        <View style={styles.clipActions}>
          <ActionBtn icon={isPlaying ? "square" : "play"} color={isPlaying ? color : colors.mutedForeground}
            bg={isPlaying ? color + "22" : colors.glassSurface} onPress={isPlaying ? onStop : onPlay} />
          <ActionBtn icon="repeat" color={isLooping ? colors.cyan : colors.mutedForeground}
            bg={isLooping ? colors.cyan + "22" : colors.glassSurface} onPress={onLoop} />
          <ActionBtn icon={clip.isFavorite ? "star" : "star"} color={clip.isFavorite ? "#FFD700" : colors.mutedForeground}
            bg={clip.isFavorite ? "#FFD70022" : colors.glassSurface} onPress={onFav} />
        </View>
      </View>
      {expanded && (
        <Animated.View entering={FadeInDown.duration(200)} style={[styles.clipExpanded, { borderTopColor: colors.glassBorder }]}>
          <View style={styles.expandedBtns}>
            <ExpandBtn icon="message-circle" label="WhatsApp" color="#25D366" onPress={onShareWA} />
            <ExpandBtn icon="share-2" label="Share" color={colors.cyan} onPress={onShare} />
            <ExpandBtn icon="download" label="Save" color="#7C4DFF" onPress={onSave} />
            <ExpandBtn icon="edit-2" label="Rename" color="#FF9800" onPress={onRename} />
            <ExpandBtn icon="trash-2" label="Delete" color={colors.destructive} onPress={onDelete} />
          </View>
        </Animated.View>
      )}
    </GlassCard>
  );
}

function ActionBtn({ icon, color, bg, onPress }: { icon: any; color: string; bg: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <View style={[styles.actionBtn, { backgroundColor: bg }]}>
        <Feather name={icon} size={12} color={color} />
      </View>
    </Pressable>
  );
}

function ExpandBtn({ icon, label, color, onPress }: { icon: any; label: string; color: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={styles.expandBtn}>
      <View style={[styles.expandBtnInner, { backgroundColor: color + "15", borderColor: color + "44" }]}>
        <Feather name={icon} size={14} color={color} />
      </View>
      <Text style={[styles.expandBtnLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    appState, filteredClips, clips, errorMessage, recordingDuration,
    playingId, loopId, processingEffect, rawRecordingUri,
    bgmiMode, realtimeMode, realtimeEffect, filterEffect, stats,
    pitchOffset, volumeBoost,
    startRecording, stopRecording, applyEffect,
    playClip, stopPlayback, toggleLoop,
    shareClip, saveToGallery, deleteClip, renameClip, toggleFavorite,
    clearError, resetToIdle,
    toggleBgmiMode, toggleRealtimeMode, setRealtimeEffect, setFilterEffect,
    startRealtimeSession, stopRealtimeSession,
  } = useVoice();

  const [renameClipTarget, setRenameClipTarget] = useState<ClipItem | null>(null);
  const topPad = Platform.OS === "web" ? 56 : insets.top;
  const botPad = Platform.OS === "web" ? 24 : insets.bottom;

  const isRecording  = appState === "recording";
  const isRecorded   = appState === "recorded";
  const isProcessing = appState === "processing";
  const isPlaying    = appState === "playing";
  const isError      = appState === "error";
  const isIdle       = appState === "idle";
  const isRealtime   = appState === "realtime";
  const waveActive   = isRecording || isPlaying || isRealtime;
  const waveColor    = isRealtime ? "#FF4500" : isRecording ? colors.recording : colors.cyan;

  function handleRecordBtn() {
    if (isError) { clearError(); return; }
    if (isRealtime) { stopRealtimeSession(); return; }
    if (isRecording) { stopRecording(); return; }
    if (isPlaying) { stopPlayback(); return; }
    if (isRecorded || isProcessing) return;
    if (realtimeMode) { startRealtimeSession(); return; }
    startRecording();
  }

  const statusLabel =
    isError      ? (errorMessage ?? "Error")                        :
    isRealtime   ? `🔴 Live · ${recordingDuration}s`               :
    isRecording  ? `● Recording · ${recordingDuration}s`            :
    isProcessing ? "Processing effect..."                           :
    isPlaying    ? "Playing back"                                   :
    isRecorded   ? "Choose an effect"                               :
    realtimeMode ? "Tap to start live voice"                        :
    "Tap to record";

  const statusColor =
    isError      ? colors.destructive :
    isRealtime   ? "#FF4500"          :
    isRecording  ? colors.recording   :
    isProcessing ? colors.processing  :
    isPlaying    ? colors.cyan        :
    isRecorded   ? colors.cyan        :
    colors.mutedForeground;

  return (
    <LinearGradient colors={["#050A14", "#06101C", "#050A14"]} style={styles.root}>
      <View style={[styles.screen, { paddingTop: topPad, paddingBottom: botPad }]}>

        {/* Header */}
        <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.dot, { backgroundColor: colors.cyan, shadowColor: colors.cyan }]} />
            <Text style={[styles.title, { color: colors.foreground }]}>Gojo Voice</Text>
            {stats.totalRecordings > 0 && (
              <View style={[styles.statsBadge, { backgroundColor: colors.glassSurface, borderColor: colors.glassBorder }]}>
                <Text style={[styles.statsBadgeText, { color: colors.mutedForeground }]}>{stats.totalRecordings} clips</Text>
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            <Pressable onPress={toggleBgmiMode} hitSlop={8}>
              <View style={[styles.modeBtn, { backgroundColor: bgmiMode ? "#FF4500" + "22" : colors.glassSurface, borderColor: bgmiMode ? "#FF4500" : colors.glassBorder }]}>
                <Feather name="zap" size={11} color={bgmiMode ? "#FF4500" : colors.mutedForeground} />
                <Text style={[styles.modeBtnText, { color: bgmiMode ? "#FF4500" : colors.mutedForeground }]}>BGMI</Text>
              </View>
            </Pressable>
            <Pressable onPress={toggleRealtimeMode} hitSlop={8}>
              <View style={[styles.modeBtn, { backgroundColor: realtimeMode ? colors.cyan + "22" : colors.glassSurface, borderColor: realtimeMode ? colors.cyan : colors.glassBorder }]}>
                <Feather name="radio" size={11} color={realtimeMode ? colors.cyan : colors.mutedForeground} />
                <Text style={[styles.modeBtnText, { color: realtimeMode ? colors.cyan : colors.mutedForeground }]}>Live</Text>
              </View>
            </Pressable>
            {(isRecorded || isProcessing || isPlaying) && (
              <Pressable onPress={resetToIdle} hitSlop={8}>
                <View style={[styles.iconBtn, { backgroundColor: colors.glassSurface }]}>
                  <Feather name="refresh-ccw" size={13} color={colors.mutedForeground} />
                </View>
              </Pressable>
            )}
            <Pressable onPress={() => router.push("/settings")} hitSlop={8}>
              <View style={[styles.iconBtn, { backgroundColor: colors.glassSurface }]}>
                <Feather name="settings" size={13} color={colors.mutedForeground} />
              </View>
            </Pressable>
          </View>
        </Animated.View>

        {/* Pitch & Volume indicator */}
        {(pitchOffset !== 0 || volumeBoost !== 1.0) && (
          <Animated.View entering={FadeIn.duration(200)}>
            <GlassCard style={styles.audioIndicator}>
              {pitchOffset !== 0 && (
                <View style={styles.audioChip}>
                  <Feather name="activity" size={10} color={colors.cyan} />
                  <Text style={[styles.audioChipText, { color: colors.cyan }]}>
                    Pitch {pitchOffset > 0 ? "+" : ""}{pitchOffset}
                  </Text>
                </View>
              )}
              {volumeBoost !== 1.0 && (
                <View style={styles.audioChip}>
                  <Feather name="volume-2" size={10} color="#FF9800" />
                  <Text style={[styles.audioChipText, { color: "#FF9800" }]}>{volumeBoost}x Vol</Text>
                </View>
              )}
            </GlassCard>
          </Animated.View>
        )}

        {/* Status */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <GlassCard style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]} numberOfLines={1}>{statusLabel}</Text>
            </View>
          </GlassCard>
        </Animated.View>

        {/* Live effect picker */}
        {realtimeMode && !isRealtime && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <GlassCard style={{ padding: 10, marginBottom: 4 }}>
              <Text style={[styles.rtLabel, { color: colors.mutedForeground }]}>Live Effect:</Text>
              <RealtimeEffectPicker selected={realtimeEffect} onSelect={setRealtimeEffect} />
            </GlassCard>
          </Animated.View>
        )}

        {/* Waveform + Meter */}
        <Animated.View entering={FadeIn.delay(150).duration(500)} style={styles.waveSection}>
          <WaveformVisualizer active={waveActive} color={waveColor} />
          {waveActive && <AudioMeter active={waveActive} color={waveColor} barHeight={32} />}
        </Animated.View>

        {/* Record Button */}
        <Animated.View entering={FadeIn.delay(200).duration(600)} style={styles.btnSection}>
          <RecordButton
            state={isRealtime ? "recording" : appState === "recorded" ? "idle" : appState}
            onPress={handleRecordBtn}
            disabled={isProcessing || isRecorded}
          />
          <Text style={[styles.btnHint, { color: isRealtime ? "#FF4500" : colors.mutedForeground }]}>
            {isRealtime   ? "Tap to stop live mode"  :
             isRecording  ? "Tap to stop"            :
             isProcessing ? "Processing..."          :
             isPlaying    ? "Tap to stop"            :
             isRecorded   ? "Choose an effect below" :
             isError      ? "Tap to dismiss"         :
             realtimeMode ? "Tap to go live"         :
             "Tap to record"}
          </Text>
        </Animated.View>

        {/* Effect Grid */}
        {(isRecorded || isProcessing) && (
          <Animated.View entering={FadeInUp.duration(400)} style={styles.effectSection}>
            <EffectGrid effects={EFFECTS} processingEffect={processingEffect} onSelect={applyEffect} disabled={isProcessing} />
          </Animated.View>
        )}

        {/* History */}
        {(isIdle || isPlaying || isRealtime) && clips.length > 0 && (
          <Animated.View entering={FadeInUp.delay(100).duration(400)} style={styles.historySection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Saved Clips</Text>
              <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>{clips.length}</Text>
            </View>
            <FilterBar filter={filterEffect} onFilter={setFilterEffect} />
            <FlatList
              data={filteredClips}
              keyExtractor={c => c.id}
              scrollEnabled={filteredClips.length > 2}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 6 }}
              renderItem={({ item }) => (
                <ClipRow
                  clip={item}
                  isPlaying={playingId === item.id}
                  isLooping={loopId === item.id}
                  onPlay={() => playClip(item)}
                  onStop={stopPlayback}
                  onLoop={() => toggleLoop(item.id)}
                  onFav={() => toggleFavorite(item.id)}
                  onShareWA={() => shareClip(item, "whatsapp")}
                  onShare={() => shareClip(item, "any")}
                  onSave={() => saveToGallery(item)}
                  onRename={() => setRenameClipTarget(item)}
                  onDelete={() => deleteClip(item.id)}
                />
              )}
            />
          </Animated.View>
        )}

        {/* Empty State */}
        {isIdle && clips.length === 0 && (
          <Animated.View entering={FadeIn.delay(300).duration(500)} style={styles.empty}>
            <Feather name="mic" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Record → Convert → Share</Text>
            <View style={styles.emptyFeatures}>
              {["6 AI Voices (ElevenLabs)", "14 Local Effects", "Live Real-time Mode", "WhatsApp · Instagram · BGMI"].map(f => (
                <View key={f} style={styles.emptyFeatureRow}>
                  <View style={[styles.emptyDot, { backgroundColor: colors.cyan }]} />
                  <Text style={[styles.emptyFeatureText, { color: colors.mutedForeground }]}>{f}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Rename Modal */}
        <RenameModal
          visible={!!renameClipTarget}
          clip={renameClipTarget}
          onSave={renameClip}
          onClose={() => setRenameClipTarget(null)}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1, paddingHorizontal: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 7 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4, shadowOffset: { width: 0, height: 0 }, shadowRadius: 6, shadowOpacity: 0.9 },
  title: { fontSize: 19, fontFamily: "Inter_700Bold" },
  statsBadge: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  statsBadgeText: { fontSize: 9, fontFamily: "Inter_400Regular" },
  modeBtn: { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 4, paddingHorizontal: 7, borderRadius: 10, borderWidth: 1 },
  modeBtnText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  iconBtn: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  audioIndicator: { flexDirection: "row", gap: 8, padding: 8, marginBottom: 4, borderRadius: 10 },
  audioChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  audioChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statusCard: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  rtLabel: { fontSize: 10, fontFamily: "Inter_400Regular", marginBottom: 4 },
  filterChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  filterText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  waveSection: { alignItems: "center", gap: 4, marginVertical: 2 },
  btnSection: { alignItems: "center", gap: 5, marginBottom: 6 },
  btnHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  effectSection: { flex: 1 },
  historySection: { flex: 1 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sectionCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  clipCard: { padding: 0, borderRadius: 14, overflow: "hidden" },
  clipMain: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, paddingHorizontal: 10 },
  effectDot: { width: 8, height: 8, borderRadius: 4 },
  clipInfo: { flex: 1 },
  clipNameRow: { flexDirection: "row", alignItems: "center" },
  clipLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  clipMeta: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  clipActions: { flexDirection: "row", gap: 4 },
  actionBtn: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  clipExpanded: { borderTopWidth: 1, paddingHorizontal: 10, paddingVertical: 10 },
  expandedBtns: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  expandBtn: { alignItems: "center", gap: 4 },
  expandBtnInner: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  expandBtnLabel: { fontSize: 9, fontFamily: "Inter_400Regular" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { width: "100%", gap: 14 },
  modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  modalInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  modalBtns: { flexDirection: "row", gap: 10 },
  modalBtn: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 16 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyFeatures: { gap: 6, alignSelf: "stretch", paddingHorizontal: 16 },
  emptyFeatureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  emptyDot: { width: 5, height: 5, borderRadius: 3 },
  emptyFeatureText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
