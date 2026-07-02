import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip } from "@/components/ui/chip";
import { SafetyStrip } from "@/components/ui/safety-strip";
import { SectionLabel } from "@/components/ui/section-label";
import { tokens } from "@/constants/tokens";
import {
  buildForageSpeciesId,
  formatLookalike,
  identifyPhoto,
  type ForageResult as ForageResultType,
} from "@/forage/api";

// Forage Result — ports ForageResultView + ForageLowConfidenceView. Uploads the
// captured photo to the backend and renders one of the four safety-first states
// (verified_edible / verified_toxic / unverified / low_confidence). Edibility is
// never inferred client-side — it comes from the server's curated dataset.
export default function ForageResult() {
  const insets = useSafeAreaInsets();
  const { photo } = useLocalSearchParams<{ photo?: string }>();
  const [status, setStatus] = useState<"loading" | "error" | "done">(photo ? "loading" : "error");
  const [result, setResult] = useState<ForageResultType | null>(null);
  const [errorMsg, setErrorMsg] = useState(photo ? "" : "No photo to identify.");

  useEffect(() => {
    if (!photo) return;
    let cancelled = false;
    identifyPhoto(photo)
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        setStatus("done");
      })
      .catch((e) => {
        if (cancelled) return;
        setErrorMsg(String(e?.message ?? e));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [photo]);

  const pad = {
    paddingTop: insets.top + 4,
    paddingHorizontal: 16,
    paddingBottom: insets.bottom + 24,
    gap: 18,
  };

  if (status === "loading") {
    return (
      <ScrollView className="flex-1 bg-paper" contentContainerStyle={pad}>
        <Header title="Identifying" />
        <Photo uri={photo} />
        <View className="items-center gap-3 py-6">
          <ActivityIndicator color={tokens.forest} />
          <Text className="font-body text-[13px] text-secondary">Identifying this plant…</Text>
        </View>
      </ScrollView>
    );
  }

  if (status === "error" || !result) {
    return (
      <ScrollView className="flex-1 bg-paper" contentContainerStyle={pad}>
        <Header title="Identification" />
        <Photo uri={photo} />
        <View className="flex-row items-center gap-2 rounded-[14px] bg-blushBg p-3.5">
          <Ionicons name="cloud-offline" size={18} color={tokens.rust} />
          <Text className="flex-1 font-body text-[13px] font-semibold text-rust">{errorMsg}</Text>
        </View>
        <PrimaryButton icon="camera-reverse" label="Try again" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  const pct = Math.round(result.confidence * 100);

  // Low confidence: the name is suppressed on purpose — this is the safety feature.
  if (result.state === "low_confidence") {
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
          {result.message ? (
            <Text className="font-body text-[13px] text-secondary">{result.message}</Text>
          ) : null}
        </View>
        {pct > 0 ? (
          <View className="flex-row items-center gap-2 rounded-[14px] bg-blushBg p-3.5">
            <Ionicons name="warning" size={18} color={tokens.rust} />
            <Text className="flex-1 font-body text-[13px] font-semibold text-rust">
              Best guess {pct}% — below safe threshold
            </Text>
          </View>
        ) : null}
        {result.possible_matches.length ? (
          <View className="gap-2.5">
            <SectionLabel text="POSSIBLE — NONE CONFIRMED, DO NOT EAT" />
            {result.possible_matches.map((name) => (
              <View key={name} className="rounded-[14px] border border-border bg-surface p-3">
                <Text className="font-display text-[15px] text-forest">{name}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <PrimaryButton
          icon="camera-reverse"
          label="Retake — show leaves & berries"
          onPress={() => router.back()}
        />
        <SafetyStrip text={result.safety_strip} />
      </ScrollView>
    );
  }

  // Verified toxic: hard stop.
  if (result.state === "verified_toxic") {
    return (
      <ScrollView className="flex-1 bg-paper" contentContainerStyle={pad}>
        <Header title="Identified">
          <Chip text="Do not eat" bg="blushBg" fg="rust" />
        </Header>
        <Photo uri={photo} />
        <NameBlock name={result.name} scientific={result.scientific_name} />
        <View className="gap-2 rounded-[16px] bg-blushBg p-3.5">
          <View className="flex-row items-center gap-2">
            <Ionicons name="skull-outline" size={18} color={tokens.rust} />
            <Text className="font-display text-[15px] text-rust">Toxic plant</Text>
          </View>
          {result.warning ? (
            <Text className="font-body text-[13px] text-forest">{result.warning}</Text>
          ) : null}
          {result.message ? (
            <Text className="font-body text-[13px] font-semibold text-rust">{result.message}</Text>
          ) : null}
        </View>
        <SafetyStrip text={result.safety_strip} />
      </ScrollView>
    );
  }

  // Unverified: confident name, but not in the curated dataset — withhold safety data.
  if (result.state === "unverified") {
    return (
      <ScrollView className="flex-1 bg-paper" contentContainerStyle={pad}>
        <Header title="Identified" />
        <Photo uri={photo} />
        <NameBlock name={result.name} scientific={result.scientific_name}>
          <Chip text={`Confidence ${pct}%`} bg="stoneBg" fg="secondary" />
        </NameBlock>
        <View className="flex-row items-start gap-2 rounded-[14px] border border-border bg-surface p-3.5">
          <Ionicons name="information-circle" size={18} color={tokens.secondary} />
          <Text className="flex-1 font-body text-[13px] text-secondary">
            {result.message ?? "Not in our verified database yet, so we can't show foraging info."}
          </Text>
        </View>
        <SafetyStrip text={result.safety_strip} />
      </ScrollView>
    );
  }

  // Verified edible.
  return (
    <ScrollView className="flex-1 bg-paper" contentContainerStyle={pad}>
      <Header title="Identified" />
      <Photo uri={photo} />
      <NameBlock name={result.name} scientific={result.scientific_name}>
        <View className="flex-row flex-wrap gap-2">
          <Chip text={`Confidence ${pct}%`} bg="mintBg" fg="leafText" />
          <Chip text="Edible" bg="mintBg" fg="leafText" />
          {result.facts?.season ? (
            <Chip text={firstSentence(result.facts.season)} bg="stoneBg" fg="secondary" />
          ) : null}
        </View>
      </NameBlock>

      {result.toxic_lookalikes.length ? (
        <View className="gap-2 rounded-[16px] bg-blushBg p-3.5">
          <View className="flex-row items-center gap-2">
            <Ionicons name="warning" size={18} color={tokens.rust} />
            <Text className="font-display text-[15px] text-rust">Toxic lookalike to know</Text>
          </View>
          {result.toxic_lookalikes.map((l, index) => (
            <Text
              key={`${formatLookalike(l)}-${index}`}
              className="font-body text-[13px] text-forest"
            >
              • {formatLookalike(l)}
            </Text>
          ))}
        </View>
      ) : null}

      {result.safety_caveat ? (
        <Text className="font-body text-[13px] text-secondary">{result.safety_caveat}</Text>
      ) : null}

      <PrimaryButton
        icon="leaf"
        label="View full species info"
        onPress={() =>
          router.push({
            pathname: "/forage/species/[id]",
            params: { id: result.name ? buildForageSpeciesId(result) : "species" },
          })
        }
      />
      <SafetyStrip text={result.safety_strip} />
    </ScrollView>
  );
}

function Header({ title, children }: { title: string; children?: ReactNode }) {
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

function NameBlock({
  name,
  scientific,
  children,
}: {
  name?: string | null;
  scientific?: string | null;
  children?: ReactNode;
}) {
  return (
    <View className="gap-2">
      <View>
        <Text className="font-display text-[24px] text-forest">{name ?? "Unknown plant"}</Text>
        {scientific ? (
          <Text className="font-body text-[13px] italic text-secondary">{scientific}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

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

function firstSentence(s: string): string {
  const cut = s.split(/[.;(]/)[0].trim();
  return cut.length > 28 ? cut.slice(0, 28) + "…" : cut;
}
