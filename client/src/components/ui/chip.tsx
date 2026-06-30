import { Text, View } from "react-native";
import { tokens, type ColorToken } from "@/constants/tokens";

// Pill chip: status ("Healthy"), confidence, header tags. Ports Theme.swift Chip.
export function Chip({
  text,
  bg = "mintBg",
  fg = "leafText",
}: {
  text: string;
  bg?: ColorToken;
  fg?: ColorToken;
}) {
  return (
    <View
      className="self-start rounded-full px-2.5 py-[5px]"
      style={{ backgroundColor: tokens[bg] }}
    >
      <Text className="font-body text-xs font-semibold" style={{ color: tokens[fg] }}>
        {text}
      </Text>
    </View>
  );
}
