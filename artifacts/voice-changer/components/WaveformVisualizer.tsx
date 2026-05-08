import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation, useAnimatedStyle, useSharedValue,
  withDelay, withRepeat, withSequence, withTiming, Easing,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";

const BAR_COUNT = 32;
const BAR_WIDTH = 4;
const BAR_GAP = 3;
const MAX_HEIGHT = 80;
const MIN_HEIGHT = 4;

function WaveBar({ index, active, color }: { index: number; active: boolean; color: string }) {
  const height = useSharedValue(MIN_HEIGHT);

  useEffect(() => {
    cancelAnimation(height);
    if (active) {
      const randomMax = MIN_HEIGHT + Math.random() * (MAX_HEIGHT - MIN_HEIGHT);
      const randomDuration = 250 + Math.random() * 400;
      const delay = index * 18;
      height.value = withDelay(delay, withRepeat(
        withSequence(
          withTiming(randomMax, { duration: randomDuration, easing: Easing.inOut(Easing.ease) }),
          withTiming(MIN_HEIGHT + Math.random() * 20, { duration: randomDuration, easing: Easing.inOut(Easing.ease) })
        ), -1, true
      ));
    } else {
      height.value = withTiming(MIN_HEIGHT, { duration: 400 });
    }
  }, [active]);

  const animStyle = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Animated.View style={[styles.bar, animStyle, {
      backgroundColor: color, width: BAR_WIDTH,
      marginHorizontal: BAR_GAP / 2, borderRadius: 3,
      opacity: active ? 0.9 : 0.25,
    }]} />
  );
}

export function WaveformVisualizer({ active, color, style }: { active: boolean; color?: string; style?: object }) {
  const colors = useColors();
  const barColor = color ?? colors.cyan;
  return (
    <View style={[styles.container, style]}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <WaveBar key={i} index={i} active={active} color={barColor} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: MAX_HEIGHT + 8 },
  bar: { alignSelf: "center" },
});
