import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "./GlassCard";
import type { VoiceHistoryItem } from "@/context/VoiceContext";

interface HistoryListProps {
  items: VoiceHistoryItem[];
  playingId: string | null;
  onPlay: (item: VoiceHistoryItem) => void;
  onStop: () => void;
  onDelete: (id: string) => void;
}

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function formatTimestamp(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function HistoryItemRow({
  item,
  isPlaying,
  onPlay,
  onStop,
  onDelete,
  index,
}: {
  item: VoiceHistoryItem;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onDelete: () => void;
  index: number;
}) {
  const colors = useColors();

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <GlassCard
        style={[
          styles.item,
          isPlaying && {
            borderColor: colors.cyanGlow,
            shadowColor: colors.cyan,
            shadowOpacity: 0.4,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      >
        <View style={styles.itemLeft}>
          <View
            style={[styles.iconBox, { backgroundColor: colors.glassSurface }]}
          >
            <Feather
              name={isPlaying ? "volume-2" : "mic"}
              size={16}
              color={isPlaying ? colors.cyan : colors.mutedForeground}
            />
          </View>
          <View>
            <Text style={[styles.itemTitle, { color: colors.foreground }]}>
              Voice Clip
            </Text>
            <Text
              style={[styles.itemSubtitle, { color: colors.mutedForeground }]}
            >
              {formatTimestamp(item.timestamp)}
              {item.durationMs > 0 ? `  ·  ${formatTime(item.durationMs)}` : ""}
            </Text>
          </View>
        </View>

        <View style={styles.itemActions}>
          <Pressable
            onPress={isPlaying ? onStop : onPlay}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <View
              style={[
                styles.actionBtn,
                { backgroundColor: isPlaying ? colors.cyan : colors.glassSurface },
              ]}
            >
              <Feather
                name={isPlaying ? "square" : "play"}
                size={14}
                color={isPlaying ? colors.background : colors.cyan}
              />
            </View>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onDelete();
            }}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <View
              style={[styles.actionBtn, { backgroundColor: colors.glassSurface }]}
            >
              <Feather name="trash-2" size={14} color={colors.mutedForeground} />
            </View>
          </Pressable>
        </View>
      </GlassCard>
    </Animated.View>
  );
}

export function HistoryList({
  items,
  playingId,
  onPlay,
  onStop,
  onDelete,
}: HistoryListProps) {
  const colors = useColors();

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Feather name="mic-off" size={32} color={colors.mutedForeground} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          No recordings yet
        </Text>
        <Text
          style={[styles.emptySubtext, { color: colors.mutedForeground }]}
        >
          Hold the button to record your voice
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      scrollEnabled={!!items.length}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      renderItem={({ item, index }) => (
        <HistoryItemRow
          item={item}
          isPlaying={playingId === item.id}
          onPlay={() => onPlay(item)}
          onStop={onStop}
          onDelete={() => onDelete(item.id)}
          index={index}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
    paddingBottom: 40,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  itemSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  itemActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  emptySubtext: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
