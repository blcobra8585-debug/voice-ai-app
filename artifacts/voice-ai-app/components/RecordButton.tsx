import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";

interface RecordButtonProps {
  state: "idle" | "recording" | "processing" | "playing" | "realtime" | "error";
  onPress: () => void;
  disabled?: boolean;
}

const SIZE = 120;

export function RecordButton({ state, onPress, disabled }: RecordButtonProps) {
  const colors = useColors();

  const scale = useSharedValue(1);
  const outerOpacity = useSharedValue(0.35);
  const outerScale = useSharedValue(1);
  const rotateVal = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(scale);
    cancelAnimation(outerOpacity);
    cancelAnimation(outerScale);
    cancelAnimation(rotateVal);

    if (state === "recording") {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      outerScale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 700 }),
          withTiming(1.2, { duration: 700 })
        ),
        -1,
        true
      );
      outerOpacity.value = withRepeat(
        withSequence(
          withTiming(0.55, { duration: 700 }),
          withTiming(0.15, { duration: 700 })
        ),
        -1,
        true
      );
    } else if (state === "processing") {
      rotateVal.value = withRepeat(
        withTiming(360, { duration: 1200, easing: Easing.linear }),
        -1,
        false
      );
      outerOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 400 }),
          withTiming(0.2, { duration: 400 })
        ),
        -1,
        true
      );
    } else if (state === "playing") {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 600 }),
          withTiming(1.0, { duration: 600 })
        ),
        -1,
        true
      );
      outerOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 600 }),
          withTiming(0.1, { duration: 600 })
        ),
        -1,
        true
      );
    } else {
      scale.value = withTiming(1, { duration: 300 });
      outerOpacity.value = withTiming(0.2, { duration: 300 });
      outerScale.value = withTiming(1, { duration: 300 });
    }
  }, [state]);

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const outerRingStyle = useAnimatedStyle(() => ({
    opacity: outerOpacity.value,
    transform: [{ scale: outerScale.value }],
  }));

  const processingRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateVal.value}deg` }],
  }));

  const isRecording = state === "recording";
  const isProcessing = state === "processing";
  const isPlaying = state === "playing";

  const coreColor = isRecording
    ? colors.recording
    : isPlaying
    ? colors.cyan
    : colors.cyan;

  const glowColor = isRecording
    ? colors.recordingGlow
    : colors.cyanGlowStrong;

  const ringColor = isProcessing
    ? colors.processing
    : isRecording
    ? colors.recording
    : colors.cyan;

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.outerRing,
          outerRingStyle,
          { borderColor: ringColor, shadowColor: ringColor },
        ]}
      />

      {isProcessing && (
        <Animated.View
          style={[
            styles.processingRing,
            processingRingStyle,
            { borderTopColor: colors.processing },
          ]}
        />
      )}

      <Animated.View style={innerStyle}>
        <Pressable
          onPress={onPress}
          disabled={disabled}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: coreColor,
              shadowColor: glowColor,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          testID="record-button"
        >
          <View
            style={[
              styles.innerGlow,
              { backgroundColor: "rgba(255,255,255,0.12)" },
            ]}
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE + 80,
    height: SIZE + 80,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 40,
    shadowOpacity: 1,
    elevation: 20,
    overflow: "hidden",
  },
  innerGlow: {
    position: "absolute",
    top: 8,
    left: 8,
    width: SIZE * 0.55,
    height: SIZE * 0.3,
    borderRadius: SIZE,
  },
  outerRing: {
    position: "absolute",
    width: SIZE + 40,
    height: SIZE + 40,
    borderRadius: (SIZE + 40) / 2,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
    shadowOpacity: 1,
  },
  processingRing: {
    position: "absolute",
    width: SIZE + 56,
    height: SIZE + 56,
    borderRadius: (SIZE + 56) / 2,
    borderWidth: 2.5,
    borderColor: "transparent",
    borderTopColor: "#FFEA00",
  },
});
