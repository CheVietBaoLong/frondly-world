import type { ReactNode } from "react";
import { Text, View } from "react-native";

// Citron score badge. `icon` is an optional glyph slot (the hero leaf), kept
// library-agnostic so the design system doesn't pin a vector-icon dependency.
export function ScoreBadge({
  score,
  compact = false,
  icon,
}: {
  score: number;
  compact?: boolean;
  icon?: ReactNode;
}) {
  return (
    <View
      className="flex-row items-center self-start rounded-full bg-citron"
      style={{ paddingHorizontal: compact ? 7 : 9, paddingVertical: compact ? 3 : 6 }}
    >
      <Text className="font-body font-semibold text-forest" style={{ fontSize: compact ? 12 : 15 }}>
        {score}
      </Text>
      {!compact && icon ? <View className="ml-0.5">{icon}</View> : null}
    </View>
  );
}
