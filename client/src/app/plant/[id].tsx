import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AssistantCard } from "@/components/ui/assistant-card";
import { Chip } from "@/components/ui/chip";
import { ScoreBadge } from "@/components/ui/score-badge";
import { SectionLabel } from "@/components/ui/section-label";
import { tokens } from "@/constants/tokens";
import { database } from "@/db";
import { Plant } from "@/db/models/Plant";
import { usePlantDetail, type VinePoint } from "@/hooks/use-plant-detail";
import { useRecentRainfall } from "@/hooks/use-recent-rainfall";
import { useWateringSchedules } from "@/hooks/use-watering-schedules";
import { scheduleStatus } from "@/lib/care";

// Pixel-art fallback for plants without a captured photo.
const PLANT_PLACEHOLDER = require("@/assets/images/plant-placeholder.jpeg");

async function markWatered(plantId: string) {
  await database.write(async () => {
    const plant = await database.get<Plant>("plants").find(plantId);
    await plant.update((p) => {
      p.lastWatered = new Date();
    });
  });
}

// Plant Detail — ports PlantDetailView. Pushed over the tabs from a Garden card.
export default function PlantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const vm = usePlantDetail(id);
  const precip7d = useRecentRainfall();
  const schedules = useWateringSchedules(
    vm ? [{ id, species: vm.species, lastWatered: vm.lastWatered, dateAdded: vm.dateAdded }] : [],
    precip7d
  );

  if (!vm) {
    return <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }} />;
  }

  const schedule = schedules.get(id) ?? null;
  const status = scheduleStatus(schedule?.next_water_date ?? null);

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
      {/* header */}
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-full border border-border bg-surface"
        >
          <Ionicons name="chevron-back" size={16} color={tokens.forest} />
        </Pressable>
        <View className="flex-1">
          <Text className="font-display text-[22px] text-forest" numberOfLines={1}>
            {vm.name}
          </Text>
          <Text className="font-body text-xs text-secondary" numberOfLines={1}>
            {vm.species}
          </Text>
        </View>
        <Chip text={vm.chip.label} bg={vm.chip.bg} fg={vm.chip.fg} />
      </View>

      {/* hero */}
      <View className="h-[150px] overflow-hidden rounded-[20px] bg-forest">
        <Image
          source={vm.heroPhoto ? { uri: vm.heroPhoto } : PLANT_PLACEHOLDER}
          style={{ flex: 1 }}
          contentFit="cover"
        />
        {vm.score != null ? (
          <View className="absolute left-3 top-3">
            <ScoreBadge score={vm.score} />
          </View>
        ) : null}
      </View>

      {/* growth journal */}
      <View className="gap-2.5">
        <View className="flex-row items-center justify-between">
          <SectionLabel text="GROWTH JOURNAL" />
          {vm.score != null ? (
            <Text className="font-display text-lg text-forest">Health {vm.score}</Text>
          ) : null}
        </View>
        <GrowthVine points={vm.vine} />
      </View>

      {/* diagnosis */}
      {vm.latestNote ? (
        <View className="gap-2 rounded-[18px] border border-border bg-surface p-3.5">
          <SectionLabel text="DIAGNOSIS" />
          <Text className="font-body text-sm text-forest">{vm.latestNote}</Text>
          {vm.careSteps.map((step) => (
            <View key={step} className="flex-row items-center gap-1.5">
              <Ionicons name="checkmark-circle" size={13} color={tokens.secondary} />
              <Text className="flex-1 font-body text-xs text-secondary">{step}</Text>
            </View>
          ))}
          {vm.confidence != null ? (
            <Chip
              text={`Confidence ${Math.round(vm.confidence * 100)}%`}
              bg="mintBg"
              fg="leafText"
            />
          ) : null}
        </View>
      ) : null}

      {/* next care + diagnose CTA */}
      <View className="gap-3">
        <AssistantCard
          icon={<Ionicons name="water" size={18} color={tokens.forest} />}
          title={status.label}
          detail={schedule?.reason ?? "Add a watering to start the schedule."}
        />
        <Pressable
          onPress={() => markWatered(id).catch((e) => console.error("mark watered failed:", e))}
          className="flex-row items-center justify-center gap-2 rounded-[14px] border border-border bg-surface py-3"
        >
          <Ionicons name="checkmark-circle-outline" size={16} color={tokens.leafText} />
          <Text className="font-body text-[15px] font-semibold text-leafText">Mark watered</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: "/plant/diagnose", params: { id } })}
          className="flex-row items-center justify-center gap-2 rounded-[14px] bg-citron py-3.5"
        >
          <Ionicons name="sparkles" size={16} color={tokens.forest} />
          <Text className="font-body text-[15px] font-semibold text-forest">
            Diagnose with a photo
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// The signature element: a horizontal "vine" of health scores over time.
// Fixed-height bands (score / leaf dot / date) with a connecting line behind the
// dots; the paper-filled dot circles mask the line at each point.
function GrowthVine({ points }: { points: VinePoint[] }) {
  if (points.length === 0) {
    return (
      <Text className="py-2 font-body text-[13px] text-secondary">
        No observations yet — diagnose to start the journal.
      </Text>
    );
  }
  return (
    <View className="h-[60px] justify-center">
      <View className="absolute left-0 right-0 border-t-2 border-border" style={{ top: 30 }} />
      <View className="flex-row">
        {points.map((pt, i) => (
          <View key={i} className="flex-1 items-center">
            <Text className="h-5 font-body text-xs font-semibold text-forest">{pt.score}</Text>
            <View className="h-5 w-[18px] items-center justify-center rounded-full bg-paper">
              <Ionicons name="leaf" size={11} color={tokens.leafText} />
            </View>
            <Text className="h-5 font-body text-[10px] text-secondary">{pt.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
