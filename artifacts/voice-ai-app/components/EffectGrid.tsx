import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import Animated, {
  FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";
import type { EffectConfig, EffectId } from "@/context/VoiceContext";

interface EffectGridProps {
  effects: EffectConfig[];
  processingEffect: EffectId | null;
  onSelect: (id: EffectId) => void;
  disabled?: boolean;
}

function EffectButton({ effect, isProcessing, onPress, disabled, index }: {
  effect: EffectConfig; isProcessing: boolean;
  onPress: () => void; disabled: boolean; index: number;
}) {
  const colors = useColors();
  const glowOpacity = useSharedValue(0.12);

  React.useEffect(() => {
    if (isProcessing) {
      glowOpacity.value = withRepeat(
        withSequence(withTiming(0.7, { duration: 350 }), withTiming(0.12, { duration: 350 })),
        -1, true
      );
    } else {
      glowOpacity.value = withTiming(0.12, { duration: 200 });
    }
  }, [isProcessing]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  return (
    <Animated.View entering={FadeIn.delay(index * 30).duration(250)} style={styles.btnWrap}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [styles.effectBtn, {
          backgroundColor: colors.glass,
          borderColor: isProcessing ? effect.color : colors.glassBorder,
          borderWidth: isProcessing ? 1.5 : 1,
          opacity: disabled && !isProcessing ? 0.4 : pressed ? 0.72 : 1,
        }]}
      >
        <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: effect.color, borderRadius: 14 }, glowStyle]} />
        {effect.isAI && (
          <View style={[styles.aiBadge, { backgroundColor: effect.color + "30", borderColor: effect.color + "60" }]}>
            <Text style={[styles.aiBadgeText, { color: effect.color }]}>AI</Text>
          </View>
        )}
        <View style={[styles.iconBox, { backgroundColor: effect.color + "20" }]}>
          {isProcessing
            ? <ActivityIndicator size="small" color={effect.color} />
            : <Feather name={effect.icon as any} size={17} color={effect.color} />}
        </View>
        <Text style={[styles.effectLabel, { color: isProcessing ? effect.color : colors.foreground }]} numberOfLines={1}>
          {effect.label}
        </Text>
        <Text style={[styles.effectDesc, { color: colors.mutedForeground }]} numberOfLines={1}>
          {effect.description}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function EffectGrid({ effects, processingEffect, onSelect, disabled }: EffectGridProps) {
  const colors = useColors();
  const aiEffects = effects.filter(e => e.isAI);
  const localEffects = effects.filter(e => !e.isAI);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* AI Voices */}
        <Text style={[styles.groupLabel, { color: colors.cyan }]}>✦ AI VOICES</Text>
        <View style={styles.grid}>
          {aiEffects.map((effect, i) => (
            <EffectButton
              key={effect.id} effect={effect} index={i}
              isProcessing={processingEffect === effect.id}
              onPress={() => onSelect(effect.id)}
              disabled={!!disabled}
            />
          ))}
        </View>
        {/* Local Effects */}
        <Text style={[styles.groupLabel, { color: colors.mutedForeground, marginTop: 10 }]}>⚡ LOCAL EFFECTS</Text>
        <View style={styles.grid}>
          {localEffects.map((effect, i) => (
            <EffectButton
              key={effect.id} effect={effect} index={aiEffects.length + i}
              isProcessing={processingEffect === effect.id}
              onPress={() => onSelect(effect.id)}
              disabled={!!disabled}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const BTN_SIZE = 94;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 8 },
  groupLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 1.4, marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btnWrap: { width: BTN_SIZE },
  effectBtn: {
    width: BTN_SIZE, borderRadius: 14, padding: 9,
    alignItems: "center", gap: 5, overflow: "hidden", borderWidth: 1,
  },
  aiBadge: {
    position: "absolute", top: 5, right: 5,
    borderRadius: 5, borderWidth: 1, paddingHorizontal: 4, paddingVertical: 1,
  },
  aiBadgeText: { fontSize: 7, fontFamily: "Inter_700Bold" },
  iconBox: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  effectLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  effectDesc: { fontSize: 8, fontFamily: "Inter_400Regular", textAlign: "center" },
});
