import Ionicons from "@expo/vector-icons/Ionicons";
import { TabTrigger } from "expo-router/ui";
import { forwardRef } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tokens } from "@/constants/tokens";

// Custom citron-pill bottom bar. Ports ContentView.TabBar (green-ish-client):
// active tab = citron pill (icon + uppercase label); others icon-only, muted, spread evenly.
// Uses expo-router/ui headless tabs — v56 Tabs has no `tabBar` prop.
const TABS = [
  { name: "garden", label: "Garden", icon: "leaf" },
  { name: "add", label: "Add", icon: "add" },
  { name: "care", label: "Care", icon: "water" },
  { name: "forage", label: "Forage", icon: "map" },
] as const;

// shadow: forest @ 8% — className can't express RN shadows; iOS shadow* + Android elevation.
const shadow = {
  shadowColor: tokens.forest,
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 6,
} as const;

export function TabBar() {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="absolute left-6 right-6 flex-row items-center justify-evenly rounded-full border border-border bg-surface px-3 py-2"
      style={{ bottom: insets.bottom + 6, ...shadow }}
    >
      {TABS.map((tab) => (
        <TabTrigger key={tab.name} name={tab.name} asChild>
          <TabPill icon={tab.icon} label={tab.label} />
        </TabTrigger>
      ))}
    </View>
  );
}

type TabPillProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  // injected by TabTrigger via asChild (isFocused + press handlers)
  isFocused?: boolean;
};

const TabPill = forwardRef<View, TabPillProps>(function TabPill(
  { icon, label, isFocused, ...handlers },
  ref
) {
  const color = isFocused ? tokens.forest : tokens.secondary;
  // Each tab is natural-width (no reserved empty cells): inactive = icon only,
  // active = citron pill with icon + label. The bar's justify-evenly spaces them.
  return (
    <Pressable
      ref={ref}
      {...handlers}
      className={
        isFocused
          ? "flex-row items-center gap-1.5 rounded-full bg-citron px-4 py-2.5"
          : "rounded-full p-2.5"
      }
    >
      <Ionicons name={icon} size={16} color={color} />
      {isFocused && (
        <Text
          numberOfLines={1}
          className="font-body text-[11px] font-semibold uppercase tracking-wider"
          style={{ color }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
});
