import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip } from "@/components/ui/chip";
import { tokens } from "@/constants/tokens";
import { database } from "@/db";
import { Observation } from "@/db/models/Observation";

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

const titleOf = (note: string) =>
  note
    .split("\n")
    .find((l) => l.trim())
    ?.trim() ?? "Note";

// Full-screen view of one journal note. Reached by tapping a note card on Plant
// Detail. Notes are immutable once saved, so a one-shot fetch is enough.
export default function NoteDetail() {
  const insets = useSafeAreaInsets();
  const { noteId } = useLocalSearchParams<{ noteId: string }>();
  const [obs, setObs] = useState<Observation | null>(null);

  useEffect(() => {
    let cancelled = false;
    database
      .get<Observation>("observations")
      .find(noteId)
      .then((o) => !cancelled && setObs(o))
      .catch((e) => console.error("note load failed:", e));
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  if (!obs) {
    return <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }} />;
  }

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{
        paddingTop: insets.top + 8,
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
          <Text className="font-display text-[22px] text-forest" numberOfLines={2}>
            {titleOf(obs.note)}
          </Text>
          <Text className="font-body text-xs text-secondary">{fmtDate(obs.date)}</Text>
        </View>
      </View>

      {obs.photo ? (
        <View className="h-[190px] overflow-hidden rounded-[20px] bg-forest">
          <Image source={{ uri: obs.photo }} style={{ flex: 1 }} contentFit="cover" />
        </View>
      ) : null}

      <View className="flex-row gap-2">
        {obs.healthScore != null ? (
          <Chip text={`Health ${obs.healthScore}`} bg="mintBg" fg="leafText" />
        ) : null}
        {obs.confidence != null ? (
          <Chip
            text={`Confidence ${Math.round(obs.confidence * 100)}%`}
            bg="mintBg"
            fg="leafText"
          />
        ) : null}
      </View>

      <Text className="font-body text-sm leading-5 text-forest">{obs.note}</Text>

      {obs.careSteps.length > 0 ? (
        <View className="gap-2 rounded-[18px] border border-border bg-surface p-3.5">
          {obs.careSteps.map((step) => (
            <View key={step} className="flex-row items-start gap-1.5">
              <Ionicons name="checkmark-circle" size={14} color={tokens.leafText} />
              <Text className="flex-1 font-body text-[13px] text-secondary">{step}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
