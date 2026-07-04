import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ForageResultView, forageStateChip } from "@/components/forage-result-view";
import { Chip } from "@/components/ui/chip";
import { SafetyStrip } from "@/components/ui/safety-strip";
import { tokens } from "@/constants/tokens";
import { database } from "@/db";
import { Find } from "@/db/models/Find";

// Forage Find detail — re-renders the saved snapshot (result_json) exactly as it
// was identified, offline and drift-free. The "View full species info" button
// inside ForageResultView still reaches the live server view.
export default function ForageFindDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [find, setFind] = useState<Find | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    database
      .get<Find>("finds")
      .find(id)
      .then((f) => !cancelled && setFind(f))
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const pad = {
    paddingTop: insets.top + 4,
    paddingHorizontal: 16,
    paddingBottom: insets.bottom + 24,
    gap: 18,
  };

  if (!find) {
    return (
      <ScrollView className="flex-1 bg-paper" contentContainerStyle={pad}>
        <Header title="Find" />
        {missing ? (
          <Text className="font-body text-[13px] text-secondary">
            This find is no longer saved.
          </Text>
        ) : null}
      </ScrollView>
    );
  }

  const chip = forageStateChip(find.result);

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerStyle={pad}>
      <Header title={find.commonName ?? "Find"}>
        {chip ? <Chip text={chip.text} bg={chip.bg} fg={chip.fg} /> : null}
      </Header>
      <ForageResultView result={find.result} photo={find.photo ?? undefined} />
      <SafetyStrip text={find.result.safety_strip} />
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
      <Text className="flex-1 font-display text-[20px] text-forest" numberOfLines={1}>
        {title}
      </Text>
      {children}
    </View>
  );
}
