import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";
import type { EffectConfig, EffectId } from "@/context/VoiceContext";

interface EffectGridProps {
  effects: EffectConfig[];
  processingEffect: EffectId | null;
  onSelect: (id: EffectId) => void;
  disabled?: boolean;
}

function EffectButton({
  effect,
  isProcessing,
  onPress,
  disabled,
  index,
}: {
  effect: EffectConfig;
  isProcessing: boolean;
  onPress: () => void;
  disabled: boolean;
  index: number;
}) {
  const colors = useColors();
  const glowOpacity = useSharedValue(0.15);

  React.useEffect(() => {
    if (isProcessing) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 400 }),
          withTiming(0.15, { duration: 400 })
        ),
        -1,
        true
      );
    } else {
      glowOpacity.value = withTiming(0.15, { duration: 200 });
    }
  }, [isProcessing]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <Animated.View entering={FadeIn.delay(index * 40).duration(300)}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.effectBtn,
          {
            backgroundColor: colors.glass,
            borderColor: isProcessing ? effect.color : colors.glassBorder,
            borderWidth: isProcessing ? 1.5 : 1,
            opacity: disabled && !isProcessing ? 0.45 : pressed ? 0.75 : 1,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.glow,
            { backgroundColor: effect.color },
            glowStyle,
          ]}
        />
        <View style={[styles.iconBox, { backgroundColor: `${effect.color}22` }]}>
          {isProcessing ? (
            <ActivityIndicator size="small" color={effect.color} />
          ) : (
            <Feather
              name={effect.icon as any}
              size={18}
              color={effect.color}
            />
          )}
        </View>
        <Text
          style={[styles.effectLabel, { color: isProcessing ? effect.color : colors.foreground }]}
          numberOfLines={1}
        >
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

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: colors.foreground }]}>
        Choose Effect
      </Text>
      <ScrollView
        horizontal={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.grid}
      >
        {effects.map((effect, i) => (
          <EffectButton
            key={effect.id}
            effect={effect}
            isProcessing={processingEffect === effect.id}
            onPress={() => onSelect(effect.id)}
            disabled={!!disabled}
            index={i}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const COLS = 3;
const BTN_SIZE = 100;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heading: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  effectBtn: {
    width: BTN_SIZE,
    borderRadius: 16,
    padding: 10,
    alignItems: "center",
    gap: 6,
    overflow: "hidden",
    borderWidth: 1,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  effectLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  effectDesc: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
