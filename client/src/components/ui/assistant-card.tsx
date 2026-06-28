import type { ReactNode } from "react";
import { Text, View } from "react-native";

// Dark forest card carrying the assistant's voice (weather / next-care). Ports AssistantCard.
// `icon` is an optional glyph slot rendered inside the citron circle (library-agnostic).
export function AssistantCard({
  title,
  detail,
  icon,
}: {
  title: string;
  detail: string;
  icon?: ReactNode;
}) {
  return (
    <View className="flex-row items-start rounded-[18px] bg-forest p-3.5">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-citron">{icon}</View>
      <View className="ml-3 flex-1">
        <Text className="font-display text-base text-white">{title}</Text>
        <Text className="font-body text-xs text-onDarkSecondary">{detail}</Text>
      </View>
    </View>
  );
}
