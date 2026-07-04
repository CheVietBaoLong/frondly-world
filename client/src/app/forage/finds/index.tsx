import Ionicons from "@expo/vector-icons/Ionicons";
import { Q } from "@nozbe/watermelondb";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip } from "@/components/ui/chip";
import { tokens } from "@/constants/tokens";
import { database } from "@/db";
import { Find } from "@/db/models/Find";

// Forage Finds — ports ForageFindsView. The forager's log of identified plants,
// reactive over the `finds` table (saved from the identify result screen),
// filterable by edibility.
const FILTERS = ["All", "Edible", "Caution"] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_CHIP: Record<
  Find["status"],
  { text: string; bg: "mintBg" | "blushBg" | "stoneBg"; fg: "leafText" | "rust" | "secondary" }
> = {
  edible: { text: "Edible", bg: "mintBg", fg: "leafText" },
  caution: { text: "Caution", bg: "blushBg", fg: "rust" },
  unconfirmed: { text: "Unconfirmed", bg: "stoneBg", fg: "secondary" },
};

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ForageFinds() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>("All");
  const [finds, setFinds] = useState<Find[]>([]);

  useEffect(() => {
    const sub = database
      .get<Find>("finds")
      .query(Q.sortBy("saved_at", Q.desc))
      .observe()
      .subscribe(setFinds);
    return () => sub.unsubscribe();
  }, []);

  const shown = finds.filter((f) => {
    if (filter === "Edible") return f.status === "edible";
    if (filter === "Caution") return f.status === "caution";
    return true;
  });

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{
        paddingTop: insets.top + 4,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 24,
        gap: 16,
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
          <Text className="font-display text-[22px] text-forest">Your finds</Text>
          <Text className="font-body text-xs text-secondary">
            {finds.length} {finds.length === 1 ? "find" : "finds"} · this season
          </Text>
        </View>
      </View>

      {/* filters */}
      <View className="flex-row gap-2">
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              className={
                active
                  ? "rounded-full bg-forest px-4 py-2"
                  : "rounded-full border border-border bg-surface px-4 py-2"
              }
            >
              <Text
                className="font-body text-[13px] font-semibold"
                style={{ color: active ? tokens.citron : tokens.secondary }}
              >
                {f}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* list */}
      {finds.length === 0 ? (
        <View className="items-center gap-2 rounded-[16px] border border-border bg-surface p-8">
          <Ionicons name="leaf-outline" size={28} color={tokens.secondary} />
          <Text className="text-center font-body text-[13px] text-secondary">
            No finds yet — identify a plant, then tap “Save to finds”.
          </Text>
        </View>
      ) : (
        <View className="gap-2.5">
          {shown.map((f) => {
            const chip = STATUS_CHIP[f.status];
            return (
              <Pressable
                key={f.id}
                onPress={() =>
                  router.push({ pathname: "/forage/finds/[id]", params: { id: f.id } })
                }
                className="flex-row items-center gap-3 rounded-[16px] border border-border bg-surface p-3"
              >
                <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-[12px] bg-sage">
                  {f.photo ? (
                    <Image
                      source={{ uri: f.photo }}
                      style={{ flex: 1, width: "100%" }}
                      contentFit="cover"
                    />
                  ) : (
                    <Ionicons name="leaf" size={18} color={tokens.leafText} />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="font-display text-[16px] text-forest">
                    {f.commonName ?? "Unknown plant"}
                  </Text>
                  {f.scientificName ? (
                    <Text className="font-body text-[11px] italic text-secondary">
                      {f.scientificName}
                    </Text>
                  ) : null}
                  <Text className="mt-0.5 font-body text-[11px] text-secondary">
                    Saved {formatDate(f.savedAt)}
                  </Text>
                </View>
                <Chip text={chip.text} bg={chip.bg} fg={chip.fg} />
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
