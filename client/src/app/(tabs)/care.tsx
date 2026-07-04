import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip } from "@/components/ui/chip";
import { SectionLabel } from "@/components/ui/section-label";
import { tokens } from "@/constants/tokens";
import { database } from "@/db";
import { Plant } from "@/db/models/Plant";
import { useGarden, type PlantVM } from "@/hooks/use-garden";
import { useRecentRainfall } from "@/hooks/use-recent-rainfall";
import { useWateringSchedules } from "@/hooks/use-watering-schedules";
import { scheduleStatus, type ScheduleResult } from "@/lib/care";

// Same pixel-art fallback the Home grid and Plant Detail use for photo-less plants.
const PLANT_PLACEHOLDER = require("@/assets/images/plant-placeholder.jpeg");

async function markWatered(plantId: string) {
  await database.write(async () => {
    const plant = await database.get<Plant>("plants").find(plantId);
    await plant.update((p) => {
      p.lastWatered = new Date();
    });
  });
}

// Care tab — garden-wide watering list, soonest/overdue first. Ports the
// roadmap's "Care tab" slot (docs/watering-schedule-spec.md).
export default function Care() {
  const insets = useSafeAreaInsets();
  const { plants, loading } = useGarden();
  const precip7d = useRecentRainfall();
  const schedules = useWateringSchedules(plants, precip7d);

  // Plants with no resolved schedule yet sort last.
  const NO_SCHEDULE = "9999-99-99";
  const sorted = [...plants].sort((a, b) => {
    const aDate = schedules.get(a.id)?.next_water_date ?? NO_SCHEDULE;
    const bDate = schedules.get(b.id)?.next_water_date ?? NO_SCHEDULE;
    return aDate.localeCompare(bDate);
  });

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingHorizontal: 16,
        paddingBottom: 96,
        gap: 18,
      }}
    >
      <Text className="font-display text-[28px] text-forest">Care</Text>

      {!loading && plants.length === 0 ? (
        <Text className="font-body text-[13px] text-secondary">
          Add a plant to see its watering schedule.
        </Text>
      ) : (
        <View className="gap-2.5">
          <SectionLabel text="WATERING" />
          {sorted.map((plant) => (
            <CareRow key={plant.id} plant={plant} schedule={schedules.get(plant.id) ?? null} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function CareRow({ plant, schedule }: { plant: PlantVM; schedule: ScheduleResult | null }) {
  const status = scheduleStatus(
    schedule?.next_water_date ?? null,
    undefined,
    plant.lastWatered == null
  );

  return (
    <View className="flex-row items-center gap-3 rounded-[18px] border border-border bg-surface p-2.5">
      <Pressable
        className="flex-1 flex-row items-center gap-3"
        onPress={() => router.push({ pathname: "/plant/[id]", params: { id: plant.id } })}
      >
        <View className="h-12 w-12 overflow-hidden rounded-[12px] bg-sage">
          <Image
            source={plant.heroPhoto ? { uri: plant.heroPhoto } : PLANT_PLACEHOLDER}
            style={{ flex: 1 }}
            contentFit="cover"
          />
        </View>
        <View className="flex-1 gap-1">
          <Text className="font-display text-base text-forest" numberOfLines={1}>
            {plant.name}
          </Text>
          <Chip text={status.label} bg={status.bg} fg={status.fg} />
        </View>
      </Pressable>
      <Pressable
        onPress={() => markWatered(plant.id).catch((e) => console.error("mark watered failed:", e))}
        className="h-9 w-9 items-center justify-center rounded-full bg-mintBg"
      >
        <Ionicons name="water" size={16} color={tokens.leafText} />
      </Pressable>
    </View>
  );
}
