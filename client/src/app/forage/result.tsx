import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip } from "@/components/ui/chip";
import { SectionLabel } from "@/components/ui/section-label";
import { tokens } from "@/constants/tokens";
import { getSpecies, identify } from "@/forage/data";

// Forage Result — ports ForageResultView + ForageLowConfidenceView. Shows the
// stubbed identification: a confident species card, or the low-confidence
// "won't name it" state when the top guess is below the safe threshold.
//
// dev-note: `unsure=1` forces the low-confidence path for preview until the
// real model decides (identify() is stubbed).
export default function ForageResult() {
  const insets = useSafeAreaInsets();
  const { unsure, photo } = useLocalSearchParams<{ unsure?: string; photo?: string }>();
  const result = identify(unsure === "1");

  const pad = {
    paddingTop: insets.top + 4,
    paddingHorizontal: 16,
    paddingBottom: insets.bottom + 24,
    gap: 18,
  };

  if (result.kind === "unsure") {
    return (
      <ScrollView className="flex-1 bg-paper" contentContainerStyle={pad}>
        <Header title="Identification">
          <Chip text="Low confidence" bg="blushBg" fg="rust" />
        </Header>

        <Photo uri={photo} />

        <View className="gap-1.5">
          <Text className="font-display text-[22px] text-forest">
            Not confident enough to name this
          </Text>
          <Text className="font-body text-[13px] text-secondary">
            This photo could match a few plants, and a toxic lookalike can&apos;t be ruled out. I
            won&apos;t guess on something you might eat.
          </Text>
        </View>

        <View className="flex-row items-center gap-2 rounded-[14px] bg-blushBg p-3.5">
          <Ionicons name="warning" size={18} color={tokens.rust} />
          <Text className="flex-1 font-body text-[13px] font-semibold text-rust">
            Best guess {result.bestGuess}% — below safe threshold
          </Text>
        </View>

        <View className="gap-2.5">
          <SectionLabel text="POSSIBLE — NONE CONFIRMED, DO NOT EAT" />
          {result.candidates.map((c) => (
            <View
              key={c.name}
              className="flex-row items-center justify-between rounded-[14px] border border-border bg-surface p-3"
            >
              <View className="flex-1">
                <Text className="font-display text-[15px] text-forest">{c.name}</Text>
                <Text className="font-body text-xs text-secondary">{c.latin}</Text>
              </View>
              <Text className="font-body text-[13px] font-semibold text-rust">{c.confidence}%</Text>
            </View>
          ))}
        </View>

        <View className="gap-2.5">
          <PrimaryButton
            icon="camera-reverse"
            label="Retake — show leaves & berries"
            onPress={() => router.back()}
          />
          <Pressable onPress={() => router.back()} className="items-center py-2">
            <Text className="font-body text-[13px] font-semibold text-secondary">
              Save as unconfirmed
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  const species = getSpecies(result.speciesId);
  if (!species) return <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }} />;

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerStyle={pad}>
      <Header title="Identified" />

      <Photo uri={photo} />

      <View className="gap-2">
        <View>
          <Text className="font-display text-[24px] text-forest">{species.name}</Text>
          <Text className="font-body text-[13px] italic text-secondary">{species.latin}</Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Chip text={`Confidence ${result.confidence}%`} bg="mintBg" fg="leafText" />
          {species.edible ? (
            <Chip
              text={`Edible · ${species.ediblePart.split(" ")[0].toLowerCase()}`}
              bg="mintBg"
              fg="leafText"
            />
          ) : (
            <Chip text="Not confirmed edible" bg="blushBg" fg="rust" />
          )}
          <Chip text={species.season} bg="stoneBg" fg="secondary" />
        </View>
      </View>

      {species.lookalike && !species.lookalike.safe ? (
        <View className="gap-2 rounded-[16px] bg-blushBg p-3.5">
          <View className="flex-row items-center gap-2">
            <Ionicons name="warning" size={18} color={tokens.rust} />
            <Text className="font-display text-[15px] text-rust">Toxic lookalike to know</Text>
          </View>
          <Text className="font-body text-[13px] text-forest">
            <Text className="font-semibold">
              {species.lookalike.name} ({species.lookalike.danger})
            </Text>
            {" — "}
            {species.lookalike.note}
          </Text>
        </View>
      ) : null}

      <PrimaryButton
        icon="leaf"
        label="View full species info"
        onPress={() =>
          router.push({ pathname: "/forage/species/[id]", params: { id: species.id } })
        }
      />
    </ScrollView>
  );
}

function Header({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <View className="flex-row items-center gap-3">
      <Pressable
        onPress={() => router.back()}
        className="h-9 w-9 items-center justify-center rounded-full border border-border bg-surface"
      >
        <Ionicons name="chevron-back" size={16} color={tokens.forest} />
      </Pressable>
      <Text className="flex-1 font-display text-[20px] text-forest">{title}</Text>
      {children}
    </View>
  );
}

// The captured photo (from expo-camera); falls back to a placeholder if the
// shot failed or the screen was reached without one.
function Photo({ uri }: { uri?: string }) {
  return (
    <View className="h-[190px] items-center justify-center overflow-hidden rounded-[20px] bg-stoneBg">
      {uri ? (
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
      ) : (
        <Ionicons name="image-outline" size={36} color={tokens.secondary} />
      )}
    </View>
  );
}

function PrimaryButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-center gap-2 rounded-[14px] bg-forest py-3.5"
    >
      <Ionicons name={icon} size={16} color={tokens.citron} />
      <Text className="font-body text-[15px] font-semibold text-white">{label}</Text>
    </Pressable>
  );
}
