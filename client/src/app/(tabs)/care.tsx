import Ionicons from "@expo/vector-icons/Ionicons";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AssistantCard } from "@/components/ui/assistant-card";
import { Chip } from "@/components/ui/chip";
import { ScoreBadge } from "@/components/ui/score-badge";
import { SectionLabel } from "@/components/ui/section-label";
import { tokens } from "@/constants/tokens";
import { useGarden, type PlantVM } from "@/hooks/use-garden";

const WEEK_TASKS = [
  { label: "Water Fiddle Fig", detail: "Today · 6:00 PM" },
  { label: "Treat Basil", detail: "Tomorrow · Morning" },
];

export default function Care() {
  const insets = useSafeAreaInsets();
  const { plants, loading } = useGarden();
  const needCare = plants.filter((plant) => plant.needsAttention);
  const thriving = plants.filter((plant) => !plant.needsAttention);

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 96,
        gap: 18,
      }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="font-display text-[28px] text-forest">Care</Text>
          <Text className="font-body text-xs text-secondary">
            {loading ? "Loading garden…" : `${plants.length} plants · ${needCare.length} tasks`}
          </Text>
        </View>
        <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
          <Ionicons name="water" size={18} color={tokens.forest} />
        </View>
      </View>

      <AssistantCard
        icon={<Ionicons name="today" size={18} color={tokens.forest} />}
        title={needCare.length ? "Today’s care" : "Garden is calm"}
        detail={
          needCare.length
            ? `${needCare.length} ${needCare.length === 1 ? "plant needs" : "plants need"} care today.`
            : "No urgent care due — keep your garden thriving."
        }
      />

      <View className="rounded-[24px] border border-border bg-surface p-4">
        <View className="flex-row items-center justify-between gap-3">
          <View>
            <SectionLabel text="Schedule" />
            <Text className="mt-1 font-display text-[15px] text-forest">Next care actions</Text>
          </View>
          <View className="rounded-full bg-mintBg px-3 py-1.5">
            <Text className="font-body text-[11px] font-semibold text-leafText">This week</Text>
          </View>
        </View>

        <View className="mt-4 space-y-3">
          {needCare.slice(0, 2).map((plant) => (
            <View key={plant.id} className="rounded-[18px] bg-paper p-4 shadow-sm">
              <Text className="font-body text-sm text-forest">Water {plant.name}</Text>
              <Text className="mt-1 font-body text-xs text-secondary">Today · 8:00 AM</Text>
            </View>
          ))}
          {needCare.length === 0 && (
            <View className="rounded-[18px] bg-paper p-4">
              <Text className="font-body text-sm text-secondary">
                No active care tasks for today.
              </Text>
            </View>
          )}
          {needCare.length > 2 && (
            <View className="rounded-[18px] bg-paper p-4">
              <Text className="font-body text-sm text-secondary">
                {needCare.length - 2} more care activities scheduled.
              </Text>
            </View>
          )}
        </View>
      </View>

      <View className="rounded-[24px] border border-border bg-surface p-4">
        <Text className="font-display text-[15px] text-forest">Need a reminder?</Text>
        <Text className="mt-2 font-body text-sm text-secondary">
          Keep the schedule flowing by adding new plants or checking care notes.
        </Text>
        <Link href="/add" asChild>
          <Pressable className="mt-4 rounded-[14px] bg-forest px-4 py-3">
            <Text className="font-body text-[15px] font-semibold text-white">Add a plant</Text>
          </Pressable>
        </Link>
      </View>

      {loading ? (
        <View className="rounded-[18px] border border-border bg-surface p-6">
          <Text className="font-body text-sm text-secondary">Loading plant care tasks…</Text>
        </View>
      ) : (
        <>
          <Section
            label="Today"
            items={needCare}
            emptyText="No plants need urgent care right now."
          />
          <Section
            label="This week"
            items={thriving}
            emptyText="No thriving plants yet — add one to get started."
          />
        </>
      )}
    </ScrollView>
  );
}

function Section({
  label,
  items,
  emptyText,
}: {
  label: string;
  items: PlantVM[];
  emptyText: string;
}) {
  return (
    <View className="gap-3">
      <SectionLabel text={label.toUpperCase()} />
      {items.length === 0 ? (
        <View className="rounded-[18px] border border-border bg-surface p-4">
          <Text className="font-body text-sm text-secondary">{emptyText}</Text>
        </View>
      ) : (
        <View className="flex-col gap-3">
          {items.map((plant) => (
            <PlantTaskCard key={plant.id} plant={plant} />
          ))}
        </View>
      )}
    </View>
  );
}

function PlantTaskCard({ plant }: { plant: PlantVM }) {
  return (
    <Link href={{ pathname: "/plant/[id]", params: { id: plant.id } }} asChild>
      <Pressable className="rounded-[20px] border border-border bg-surface p-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="font-display text-[16px] text-forest" numberOfLines={1}>
              {plant.name}
            </Text>
            <Text className="mt-1 font-body text-xs text-secondary" numberOfLines={2}>
              {plant.statusLine}
            </Text>
          </View>
          <ScoreBadge score={plant.score ?? 100} compact />
        </View>
        <View className="mt-3 flex-row flex-wrap items-center gap-2">
          <Chip
            text={plant.needsAttention ? "Needs care" : "Stable"}
            bg={plant.needsAttention ? "rust" : "mintBg"}
            fg={plant.needsAttention ? "white" : "leafText"}
          />
          <Chip text={plant.chip.label} bg={plant.chip.bg} fg={plant.chip.fg} />
        </View>
      </Pressable>
    </Link>
  );
}
