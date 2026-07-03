import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Chip } from "@/components/ui/chip";
import { SectionLabel } from "@/components/ui/section-label";
import { tokens } from "@/constants/tokens";
import { buildForageSpeciesId, formatLookalike, type ForageResult } from "@/forage/api";

// Shared presentation for a completed ForageResult, used by both the live
// identify flow (forage/result.tsx) and a saved find's detail
// (forage/finds/[id].tsx). Renders the photo and the state-specific body.
// Flow-specific actions (Save / Retake / Try again), the SafetyStrip footer,
// and the screen header stay with each caller.
export function ForageResultView({ result, photo }: { result: ForageResult; photo?: string }) {
  const pct = Math.round(result.confidence * 100);
  return (
    <>
      <Photo uri={photo} />
      {result.state === "low_confidence" ? <LowConfidenceBody result={result} pct={pct} /> : null}
      {result.state === "verified_toxic" ? <ToxicBody result={result} /> : null}
      {result.state === "unverified" ? <UnverifiedBody result={result} pct={pct} /> : null}
      {result.state === "verified_edible" ? <EdibleBody result={result} pct={pct} /> : null}
    </>
  );
}

// The chip shown in the screen header for a given result state (null = no chip).
export function forageStateChip(
  result: ForageResult
): { text: string; bg: "blushBg"; fg: "rust" } | null {
  if (result.state === "low_confidence")
    return { text: "Low confidence", bg: "blushBg", fg: "rust" };
  if (result.state === "verified_toxic") return { text: "Do not eat", bg: "blushBg", fg: "rust" };
  return null;
}

// Low confidence: the name is suppressed on purpose — this is the safety feature.
function LowConfidenceBody({ result, pct }: { result: ForageResult; pct: number }) {
  return (
    <>
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
    </>
  );
}

function ToxicBody({ result }: { result: ForageResult }) {
  return (
    <>
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
    </>
  );
}

function UnverifiedBody({ result, pct }: { result: ForageResult; pct: number }) {
  return (
    <>
      <NameBlock name={result.name} scientific={result.scientific_name}>
        <Chip text={`Confidence ${pct}%`} bg="stoneBg" fg="secondary" />
      </NameBlock>
      <View className="flex-row items-start gap-2 rounded-[14px] border border-border bg-surface p-3.5">
        <Ionicons name="information-circle" size={18} color={tokens.secondary} />
        <Text className="flex-1 font-body text-[13px] text-secondary">
          {result.message ?? "Not in our verified database yet, so we can't show foraging info."}
        </Text>
      </View>
    </>
  );
}

function EdibleBody({ result, pct }: { result: ForageResult; pct: number }) {
  return (
    <>
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
    </>
  );
}

export function Photo({ uri }: { uri?: string }) {
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

export function PrimaryButton({
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
