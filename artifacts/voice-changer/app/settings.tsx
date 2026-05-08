import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCard } from "@/components/GlassCard";
import { useVoice } from "@/context/VoiceContext";
import { useColors } from "@/hooks/useColors";

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
        {sub && <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{sub}</Text>}
      </View>
      {children}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.cyan }]}>{title.toUpperCase()}</Text>
      <GlassCard style={styles.sectionCard}>{children}</GlassCard>
    </View>
  );
}

function SliderRow({ label, sub, value, min, max, step, format, onChange }: {
  label: string; sub?: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  const colors = useColors();
  const steps = Math.round((max - min) / step);
  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderHeader}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.sliderValue, { color: colors.cyan }]}>{format(value)}</Text>
      </View>
      {sub && <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{sub}</Text>}
      <View style={styles.sliderBtns}>
        <Pressable onPress={() => onChange(Math.max(min, value - step))} style={[styles.sliderBtn, { backgroundColor: colors.glassSurface, borderColor: colors.glassBorder }]}>
          <Feather name="minus" size={14} color={colors.cyan} />
        </Pressable>
        <View style={[styles.sliderTrack, { backgroundColor: colors.glassSurface }]}>
          {Array.from({ length: steps + 1 }).map((_, i) => {
            const v = min + i * step;
            const active = v <= value;
            return <View key={i} style={[styles.sliderDot, { backgroundColor: active ? colors.cyan : colors.glassBorder }]} />;
          })}
        </View>
        <Pressable onPress={() => onChange(Math.min(max, value + step))} style={[styles.sliderBtn, { backgroundColor: colors.glassSurface, borderColor: colors.glassBorder }]}>
          <Feather name="plus" size={14} color={colors.cyan} />
        </Pressable>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    bgmiMode, toggleBgmiMode,
    autoStopSeconds, setAutoStopSeconds,
    pitchOffset, setPitchOffset,
    volumeBoost, setVolumeBoost,
    stats, clips, deleteClip,
  } = useVoice();

  function confirmClearAll() {
    Alert.alert("Clear All Clips", "Delete all saved clips? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete All", style: "destructive", onPress: () => { clips.forEach(c => deleteClip(c.id)); } },
    ]);
  }

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  return (
    <LinearGradient colors={["#050A14", "#06101C", "#050A14"]} style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Feather name="arrow-left" size={20} color={colors.cyan} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
          <View style={{ width: 32 }} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(400)}>
          <Section title="📊 Statistics">
            <View style={styles.statsGrid}>
              {[
                { label: "Recordings", value: String(stats.totalRecordings) },
                { label: "AI Conversions", value: String(stats.aiConversions) },
                { label: "Total Duration", value: formatDuration(stats.totalDurationMs) },
                { label: "Saved Clips", value: String(clips.length) },
              ].map(s => (
                <View key={s.label} style={[styles.statBox, { backgroundColor: colors.glassSurface, borderColor: colors.glassBorder }]}>
                  <Text style={[styles.statValue, { color: colors.cyan }]}>{s.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
                </View>
              ))}
            </View>
          </Section>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(400)}>
          <Section title="🎚️ Audio Controls">
            <SliderRow label="Pitch Offset" sub="Shift pitch for all effects"
              value={pitchOffset} min={-10} max={10} step={1}
              format={v => v === 0 ? "Default" : v > 0 ? `+${v}` : `${v}`}
              onChange={setPitchOffset} />
            <View style={[styles.divider, { backgroundColor: colors.glassBorder }]} />
            <SliderRow label="Volume Boost" sub="Amplify output volume"
              value={volumeBoost} min={0.5} max={3.0} step={0.5}
              format={v => `${v}x`} onChange={setVolumeBoost} />
            <View style={[styles.divider, { backgroundColor: colors.glassBorder }]} />
            <SliderRow label="Auto-Stop Timer" sub="Auto-stop recording (0 = off)"
              value={autoStopSeconds} min={0} max={60} step={5}
              format={v => v === 0 ? "Off" : `${v}s`} onChange={setAutoStopSeconds} />
          </Section>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(400)}>
          <Section title="⚡ Modes">
            <Row label="BGMI Mode" sub="Audio plays in background — use with Virtual Mic app">
              <Switch value={bgmiMode} onValueChange={toggleBgmiMode}
                trackColor={{ false: colors.glassBorder, true: "#FF4500" + "88" }}
                thumbColor={bgmiMode ? "#FF4500" : colors.mutedForeground} />
            </Row>
          </Section>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(240).duration(400)}>
          <Section title="ℹ️ About">
            {[
              { label: "App", value: "Gojo Voice" },
              { label: "Version", value: "2.0.0" },
              { label: "AI Model", value: "ElevenLabs Multilingual v2" },
              { label: "Effects", value: "20 (6 AI + 14 local)" },
            ].map((item, i, arr) => (
              <React.Fragment key={item.label}>
                <Row label={item.label}>
                  <Text style={[styles.aboutValue, { color: colors.mutedForeground }]}>{item.value}</Text>
                </Row>
                {i < arr.length - 1 && <View style={[styles.divider, { backgroundColor: colors.glassBorder }]} />}
              </React.Fragment>
            ))}
          </Section>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Section title="⚠️ Danger Zone">
            <Pressable onPress={confirmClearAll} style={({ pressed }) => [styles.dangerBtn, { backgroundColor: "#FF1744" + (pressed ? "33" : "15"), borderColor: "#FF1744" + "44" }]}>
              <Feather name="trash-2" size={16} color="#FF1744" />
              <Text style={[styles.dangerText, { color: "#FF1744" }]}>Delete All Clips</Text>
            </Pressable>
          </Section>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, gap: 4 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, marginBottom: 4 },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, marginBottom: 6, marginLeft: 2 },
  sectionCard: { padding: 0, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  rowLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  rowSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  divider: { height: 1, marginHorizontal: 14 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12 },
  statBox: { flex: 1, minWidth: "45%", borderRadius: 12, borderWidth: 1, padding: 12, alignItems: "center", gap: 2 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
  aboutValue: { fontSize: 13, fontFamily: "Inter_400Regular" },
  sliderRow: { paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  sliderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sliderValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  sliderBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
  sliderBtn: { width: 30, height: 30, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sliderTrack: { flex: 1, height: 28, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 4 },
  sliderDot: { width: 5, height: 5, borderRadius: 3 },
  dangerBtn: { margin: 12, borderRadius: 12, borderWidth: 1, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  dangerText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
