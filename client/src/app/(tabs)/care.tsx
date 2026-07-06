import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type CareItem = {
  plant: PlantVM;
  schedule: ScheduleResult | null;
  nextDate: string | null;
  neverWatered: boolean;
};

async function markWatered(plantId: string) {
  await database.write(async () => {
    const plant = await database.get<Plant>("plants").find(plantId);
    await plant.update((p) => {
      p.lastWatered = new Date();
    });
  });
}

// The due-day chip in the "This week" list: a weekday for a real date, or a
// soft label when there's no firm anchor yet.
function dueLabel(item: CareItem): string {
  if (item.neverWatered) return "Dry";
  if (!item.nextDate) return "—";
  return WEEKDAYS[new Date(`${item.nextDate}T00:00:00Z`).getUTCDay()];
}

// A short, honest weather-aware headline for the banner. precip7d genuinely
// shifts the schedule (see lib/care.ts's +floor(precip/10) adjustment), so the
// "recent rain eased watering" message is always true when shown.
function bannerContent(precip7d: number, dueToday: number) {
  if (precip7d >= 10) {
    return {
      icon: "rainy" as const,
      title: "Recent rain",
      detail: "Watering eased across your garden.",
    };
  }
  if (dueToday > 0) {
    return {
      icon: "sunny" as const,
      title: `${dueToday} ${dueToday === 1 ? "plant" : "plants"} due today`,
      detail: "Check the soil — water if it's dry to the touch.",
    };
  }
  return {
    icon: "leaf" as const,
    title: "Garden's happy",
    detail: "Nothing needs watering today.",
  };
}

// Care tab — watering tasks split into "Today" (overdue/due-now) and "This
// week" (upcoming), with a weather banner. Ports docs/watering-schedule-spec.md
// and matches the green-ish.pen Care design.
export default function Care() {
  const insets = useSafeAreaInsets();
  const { plants, loading } = useGarden();
  const precip7d = useRecentRainfall();
  const schedules = useWateringSchedules(plants, precip7d);

  const today = new Date().toISOString().slice(0, 10);
  const dueToday: CareItem[] = [];
  const thisWeek: CareItem[] = [];
  for (const plant of plants) {
    const schedule = schedules.get(plant.id) ?? null;
    const nextDate = schedule?.next_water_date ?? null;
    const neverWatered = plant.lastWatered == null;
    const item: CareItem = { plant, schedule, nextDate, neverWatered };
    // Due today or overdue → actionable "Today"; everything else → "This week".
    if (!neverWatered && nextDate != null && nextDate <= today) dueToday.push(item);
    else thisWeek.push(item);
  }
  // Soonest first within each group; undated items sort last.
  const NO_DATE = "9999-99-99";
  const byDate = (a: CareItem, b: CareItem) =>
    (a.nextDate ?? NO_DATE).localeCompare(b.nextDate ?? NO_DATE);
  dueToday.sort(byDate);
  thisWeek.sort(byDate);

  const banner = bannerContent(precip7d ?? 0, dueToday.length);

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingHorizontal: 20,
        paddingBottom: 96,
        gap: 14,
      }}
    >
      {/* header + live task count */}
      <View className="gap-0.5">
        <Text className="font-display text-[26px] text-forest">Care</Text>
        {plants.length > 0 ? (
          <Text className="font-body text-[13px] text-secondary">
            {dueToday.length} {dueToday.length === 1 ? "task" : "tasks"} today · {thisWeek.length}{" "}
            this week
          </Text>
        ) : null}
      </View>

      {plants.length === 0 ? (
        !loading ? (
          <Text className="font-body text-[13px] text-secondary">
            Add a plant to see its watering schedule.
          </Text>
        ) : null
      ) : (
        <>
          {/* weather-aware assistant banner */}
          <View className="flex-row items-center gap-3.5 rounded-[24px] bg-forest p-4">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-citron">
              <Ionicons name={banner.icon} size={22} color={tokens.forest} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="font-body text-sm font-semibold text-paper" numberOfLines={1}>
                {banner.title}
              </Text>
              <Text className="font-body text-xs" style={{ color: tokens.onDarkSecondary }}>
                {banner.detail}
              </Text>
            </View>
          </View>

          {dueToday.length > 0 ? (
            <View className="gap-2.5">
              <SectionLabel text="TODAY" />
              {dueToday.map((item) => (
                <TodayRow key={item.plant.id} item={item} today={today} />
              ))}
            </View>
          ) : null}

          {thisWeek.length > 0 ? (
            <View className="gap-2.5">
              <SectionLabel text="THIS WEEK" />
              {thisWeek.map((item) => (
                <WeekRow key={item.plant.id} item={item} />
              ))}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function Thumb({ uri, size, radius }: { uri: string | null; size: number; radius: number }) {
  return (
    <View
      className="overflow-hidden bg-sage"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <Image source={uri ? { uri } : PLANT_PLACEHOLDER} style={{ flex: 1 }} contentFit="cover" />
    </View>
  );
}

// "Today" row: bold task, a reason line (the real schedule status), and a
// tap-to-complete circle that marks the plant watered (it then leaves the list).
function TodayRow({ item, today }: { item: CareItem; today: string }) {
  const { plant, nextDate } = item;
  const reason = scheduleStatus(nextDate, today, false).label;
  return (
    <View className="flex-row items-center gap-3 rounded-[20px] bg-surface p-3">
      <Pressable
        className="flex-1 flex-row items-center gap-3"
        onPress={() => router.push({ pathname: "/plant/[id]", params: { id: plant.id } })}
      >
        <Thumb uri={plant.heroPhoto} size={48} radius={14} />
        <View className="flex-1 gap-0.5">
          <Text className="font-display text-base text-forest" numberOfLines={1}>
            Water {plant.name}
          </Text>
          <Text className="font-body text-xs text-secondary" numberOfLines={1}>
            {reason}
          </Text>
        </View>
      </Pressable>
      <Pressable
        hitSlop={10}
        onPress={() => markWatered(plant.id).catch((e) => console.error("mark watered failed:", e))}
        className="h-[26px] w-[26px] rounded-full border-2 border-border"
      />
    </View>
  );
}

// "This week" row: plant, task type, and a due-day chip.
function WeekRow({ item }: { item: CareItem }) {
  const { plant } = item;
  return (
    <Pressable
      className="flex-row items-center gap-3 rounded-[18px] bg-surface px-3 py-2.5"
      onPress={() => router.push({ pathname: "/plant/[id]", params: { id: plant.id } })}
    >
      <Thumb uri={plant.heroPhoto} size={40} radius={12} />
      <View className="flex-1 gap-0.5">
        <Text className="font-display text-[15px] text-forest" numberOfLines={1}>
          {plant.name}
        </Text>
        <Text className="font-body text-xs text-secondary">Water</Text>
      </View>
      <View className="rounded-full bg-stoneBg px-2.5 py-1">
        <Text className="font-body text-[11px] font-semibold text-secondary">{dueLabel(item)}</Text>
      </View>
    </Pressable>
  );
}
