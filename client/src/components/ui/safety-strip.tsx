import Ionicons from "@expo/vector-icons/Ionicons";
import { Text, View } from "react-native";

import { tokens } from "@/constants/tokens";

// The standing, non-dismissable safety disclaimer from the server (ForageResult.safety_strip).
export function SafetyStrip({ text }: { text: string }) {
  return (
    <View className="flex-row items-start gap-2 rounded-[12px] bg-stoneBg p-3">
      <Ionicons
        name="shield-checkmark"
        size={14}
        color={tokens.secondary}
        style={{ marginTop: 1 }}
      />
      <Text className="flex-1 font-body text-[11px] text-secondary">{text}</Text>
    </View>
  );
}
