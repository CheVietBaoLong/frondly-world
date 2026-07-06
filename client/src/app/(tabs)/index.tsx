import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AssistantCard } from "@/components/ui/assistant-card";
import { Chip } from "@/components/ui/chip";
import { ScoreBadge } from "@/components/ui/score-badge";
import { SectionLabel } from "@/components/ui/section-label";
import { tokens } from "@/constants/tokens";
import { useAuth } from "@/lib/auth";
import { useGarden, type PlantVM } from "@/hooks/use-garden";
import { useWeather } from "@/hooks/use-weather";
import { formatTemp } from "@/lib/weather";

// Pixel-art fallback for plants without a captured photo.
const PLANT_PLACEHOLDER = require("@/assets/images/plant-placeholder.jpeg");

// Garden Home — ports GardenHomeView. Reactive list of the user's plants split
// into Needs Attention / Thriving, with a conversational care card up top.
export default function Garden() {
  const insets = useSafeAreaInsets();
  const { plants } = useGarden();
  const weather = useWeather();
  const { user } = useAuth();
  const needCare = plants.filter((p) => p.needsAttention);
  const thriving = plants.filter((p) => !p.needsAttention);

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingHorizontal: 16,
        paddingBottom: 96, // clear the floating tab bar
        gap: 18,
      }}
    >
      <View className="flex-row items-start">
        <View className="flex-1">
          <Text className="font-display text-[28px] text-forest">Leafy Pals</Text>
          <Text className="font-body text-xs text-secondary">
            {weather ? `${weather.city} · ${formatTemp(weather)} · ` : ""}
            {plants.length} plants · {needCare.length} need care today
          </Text>
        </View>
        <Link href="/account" asChild>
          <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-forest">
            {user?.email ? (
              <Text className="font-display text-base text-citron">
                {user.email[0].toUpperCase()}
              </Text>
            ) : (
              <Ionicons name="person" size={16} color={tokens.citron} />
            )}
          </Pressable>
        </Link>
      </View>

      <AssistantCard
        icon={<Ionicons name={weather?.icon ?? "sunny"} size={18} color={tokens.forest} />}
        title={
          weather ? `${weather.city} · ${formatTemp(weather)} · ${weather.label}` : "Your garden"
        }
        detail={
          needCare.length === 0
            ? "Calm week ahead — everyone's well watered."
            : `${needCare.length} ${needCare.length === 1 ? "plant needs" : "plants need"} a little care today.`
        }
      />

      <Section label="NEEDS ATTENTION" items={needCare} />
      <Section label="THRIVING" items={thriving} />
    </ScrollView>
  );
}

function Section({ label, items }: { label: string; items: PlantVM[] }) {
  if (items.length === 0) return null;
  return (
    <View className="gap-3">
      <SectionLabel text={label} />
      <View className="flex-row flex-wrap justify-between gap-y-3.5">
        {items.map((p) => (
          <PlantCard key={p.id} plant={p} />
        ))}
      </View>
    </View>
  );
}

function PlantCard({ plant }: { plant: PlantVM }) {
  return (
    <Link href={{ pathname: "/plant/[id]", params: { id: plant.id } }} asChild>
      <Pressable className="w-[48%] rounded-[18px] border border-border bg-surface p-2.5">
        <View className="h-[116px] overflow-hidden rounded-[14px] bg-sage">
          {/* dev-note: heroPhoto assumed to be a displayable URI; falls back to the pixel-art placeholder until a photo is captured. */}
          <Image
            source={plant.heroPhoto ? { uri: plant.heroPhoto } : PLANT_PLACEHOLDER}
            style={{ flex: 1 }}
            contentFit="cover"
          />
          {plant.score != null ? (
            <View className="absolute left-2 top-2">
              <ScoreBadge score={plant.score} compact />
            </View>
          ) : null}
        </View>
        <Text className="mt-2 font-display text-[17px] text-forest" numberOfLines={1}>
          {plant.name}
        </Text>
        <Text className="font-body text-xs text-secondary" numberOfLines={1}>
          {plant.statusLine}
        </Text>
        <View className="mt-2">
          <Chip text={plant.chip.label} bg={plant.chip.bg} fg={plant.chip.fg} />
        </View>
      </Pressable>
    </Link>
  );
}
