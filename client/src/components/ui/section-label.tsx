import { Text } from "react-native";

// Uppercase tracked section label. Ports Theme.swift SectionLabel.
export function SectionLabel({ text }: { text: string }) {
  return (
    <Text className="font-body text-[11px] font-semibold uppercase tracking-wider text-secondary">
      {text}
    </Text>
  );
}
