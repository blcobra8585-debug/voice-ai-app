import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation, useAnimatedStyle, useSharedValue,
  withDelay, withRepeat, withSequence, withTiming, Easing,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";

const BAR_COUNT = 24;

function MeterBar({ index, active, color, height: maxH }: { index: number; active: boolean; color: string; height: number }) {
  const h = useSharedValue(2);
  useEffect(() => {
    cancelAnimation(h);
    if (active) {
      const peak = 6 + Math.random() * (maxH - 6);
      const dur = 150 + Math.random() * 250;
      h.value = withDelay(index * 12, withRepeat(
        withSequence(
          withTiming(peak, { duration: dur, easing: Easing.out(Easing.quad) }),
          withTiming(2 + Math.random() * 8, { duration: dur, easing: Easing.in(Easing.quad) })
        ), -1, true
      ));
    } else {
      h.value = withTiming(2, { duration: 300 });
    }
  }, [active]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[styles.bar, style, { backgroundColor: color, opacity: active ? 1 : 0.2 }]} />;
}

interface AudioMeterProps {
  active: boolean;
  color?: string;
  barHeight?: number;
}

export function AudioMeter({ active, color, barHeight = 48 }: AudioMeterProps) {
  const colors = useColors();
  const barColor = color ?? colors.cyan;
  return (
    <View style={[styles.container, { height: barHeight }]}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <MeterBar key={i} index={i} active={active} color={barColor} height={barHeight} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 2 },
  bar: { width: 5, borderRadius: 3, minHeight: 2 },
});
