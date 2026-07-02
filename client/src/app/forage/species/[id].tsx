import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip } from "@/components/ui/chip";
import { SafetyStrip } from "@/components/ui/safety-strip";
import { SectionLabel } from "@/components/ui/section-label";
import type { ColorToken } from "@/constants/tokens";
import { tokens } from "@/constants/tokens";
import { getLastResult, type ForageState } from "@/forage/api";

// There's no species catalog yet — the only id ever pushed is the sentinel
// "current" (see result.tsx), which reads the last in-memory identification.
// dev-note: once a real catalog/route exists, resolve `id` to a species record
// instead of this sentinel check.
const CURRENT_RESULT_ID = "current";

const STATUS_CHIP: Record<ForageState, { text: string; bg: ColorToken; fg: ColorToken }> = {
  verified_edible: { text: "Edible", bg: "mintBg", fg: "leafText" },
  verified_toxic: { text: "Do not eat", bg: "blushBg", fg: "rust" },
  unverified: { text: "Unverified", bg: "stoneBg", fg: "secondary" },
  low_confidence: { text: "Low confidence", bg: "blushBg", fg: "rust" },
};

// Forage Species Detail — ports ForageDetailView. Renders the full curated info
// from the last identification (facts, lookalikes, safety caveat, sources).
export default function ForageSpecies() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const r = id === CURRENT_RESULT_ID ? getLastResult() : null;

  if (!r || !r.name) {
    return (
      <View
        className="flex-1 items-center justify-center gap-3 bg-paper px-8"
        style={{ paddingTop: insets.top }}
      >
        <Text className="text-center font-body text-[13px] text-secondary">
          No species selected. Identify a plant first.
        </Text>
        <Pressable onPress={() => router.back()} className="rounded-full bg-forest px-5 py-2.5">
          <Text className="font-body text-[13px] font-semibold text-white">Back</Text>
        </Pressable>
      </View>
    );
  }

  const facts: [string, string | undefined][] = [
    ["Edible part", r.facts?.edible_part],
    ["Preparation", r.facts?.preparation],
    ["Season", r.facts?.season],
    ["Habitat", r.facts?.habitat],
    ["Range", r.facts?.range],
  ];

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{
        paddingTop: insets.top + 4,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 24,
        gap: 20,
      }}
    >
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-full border border-border bg-surface"
        >
          <Ionicons name="chevron-back" size={16} color={tokens.forest} />
        </Pressable>
        <View className="flex-1">
          <Text className="font-display text-[22px] text-forest" numberOfLines={1}>
            {r.name}
          </Text>
          {r.scientific_name ? (
            <Text className="font-body text-xs italic text-secondary" numberOfLines={1}>
              {r.scientific_name}
            </Text>
          ) : null}
        </View>
        <Chip {...STATUS_CHIP[r.state]} />
      </View>

      {/* quick facts */}
      <View className="gap-2.5">
        <SectionLabel text="QUICK FACTS" />
        {facts
          .filter(([, v]) => !!v)
          .map(([label, value]) => (
            <View key={label} className="rounded-[14px] border border-border bg-surface p-3">
              <Text className="font-body text-[10px] font-semibold uppercase tracking-wider text-secondary">
                {label}
              </Text>
              <Text className="mt-1 font-body text-[13px] text-forest">{value}</Text>
            </View>
          ))}
      </View>

      {/* toxic lookalikes */}
      {r.toxic_lookalikes.length ? (
        <View className="gap-2.5">
          <SectionLabel text="TOXIC LOOKALIKES" />
          <View className="gap-2 rounded-[16px] bg-blushBg p-3.5">
            {r.toxic_lookalikes.map((l) => (
              <View key={l} className="flex-row gap-2">
                <Ionicons name="warning" size={13} color={tokens.rust} style={{ marginTop: 2 }} />
                <Text className="flex-1 font-body text-[13px] text-forest">{l}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* benign lookalikes */}
      {r.benign_lookalikes.length ? (
        <View className="gap-2.5">
          <SectionLabel text="SIMILAR & SAFE" />
          <View className="gap-2 rounded-[16px] bg-mintBg p-3.5">
            {r.benign_lookalikes.map((l) => (
              <View key={l} className="flex-row gap-2">
                <Ionicons name="leaf" size={13} color={tokens.leafText} style={{ marginTop: 2 }} />
                <Text className="flex-1 font-body text-[13px] text-forest">{l}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* safety caveat */}
      {r.safety_caveat ? (
        <View className="gap-2.5">
          <SectionLabel text="HOW TO TELL" />
          <View className="rounded-[18px] border border-border bg-surface p-3.5">
            <Text className="font-body text-[13px] text-forest">{r.safety_caveat}</Text>
          </View>
        </View>
      ) : null}

      {/* sources */}
      {r.sources.length ? (
        <Text className="font-body text-[11px] text-secondary">
          Sources: {r.sources.join(", ")}
        </Text>
      ) : null}

      <SafetyStrip text={r.safety_strip} />
    </ScrollView>
  );
}
