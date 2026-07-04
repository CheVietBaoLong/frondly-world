import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip } from "@/components/ui/chip";
import { SafetyStrip } from "@/components/ui/safety-strip";
import {
  ForageResultView,
  Photo,
  PrimaryButton,
  forageStateChip,
} from "@/components/forage-result-view";
import { tokens } from "@/constants/tokens";
import { database } from "@/db";
import { Find } from "@/db/models/Find";
import { identifyPhoto, type ForageResult as ForageResultType } from "@/forage/api";

// Persist an identification as a saved Find (a durable, offline snapshot).
async function saveFind(result: ForageResultType, photo?: string) {
  await database.write(async () => {
    await database.get<Find>("finds").create((f) => {
      f.commonName = result.name ?? null;
      f.scientificName = result.scientific_name ?? null;
      f.state = result.state;
      f.confidence = result.confidence;
      f.photo = photo ?? null;
      f.result = result;
      f.savedAt = new Date();
    });
  });
}

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
  const [saved, setSaved] = useState(false);

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

  const chip = forageStateChip(result);
  const title = result.state === "low_confidence" ? "Identification" : "Identified";

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerStyle={pad}>
      <Header title={title}>
        {chip ? <Chip text={chip.text} bg={chip.bg} fg={chip.fg} /> : null}
      </Header>

      <ForageResultView result={result} photo={photo} />

      {saved ? (
        <View className="flex-row items-center justify-center gap-2 rounded-[14px] border border-border bg-surface py-3.5">
          <Ionicons name="checkmark-circle" size={16} color={tokens.leafText} />
          <Text className="font-body text-[15px] font-semibold text-leafText">Saved to finds</Text>
        </View>
      ) : (
        <PrimaryButton
          icon="bookmark"
          label="Save to finds"
          onPress={() =>
            saveFind(result, photo)
              .then(() => setSaved(true))
              .catch((e) => console.error("save find failed:", e))
          }
        />
      )}

      {result.state === "low_confidence" ? (
        <PrimaryButton
          icon="camera-reverse"
          label="Retake — show leaves & berries"
          onPress={() => router.back()}
        />
      ) : null}

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
