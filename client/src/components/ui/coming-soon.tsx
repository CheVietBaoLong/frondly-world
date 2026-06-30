import { Text, View } from "react-native";

// Placeholder tab/screen body (Add / Care / Forage). Ports ContentView.placeholder.
export function ComingSoon({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-paper">
      <Text className="font-display text-2xl text-forest">{title}</Text>
      <Text className="mt-1.5 font-body text-[13px] text-secondary">{subtitle}</Text>
    </View>
  );
}
