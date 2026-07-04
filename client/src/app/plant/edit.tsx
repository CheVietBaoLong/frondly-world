import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tokens } from "@/constants/tokens";
import { database } from "@/db";
import { Plant } from "@/db/models/Plant";

// Edit a plant's name/species. Reached from the pencil on Plant Detail — fixes
// plants stuck at "New plant" / "Unknown species" after a photo/quick add.
// dev-note: species is free-text for now; an agent-assisted "identify this
// plant" prefill (like Forage) is the deferred next-milestone item.
export default function EditPlant() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    database
      .get<Plant>("plants")
      .find(id)
      .then((plant) => {
        if (cancelled) return;
        setName(plant.name);
        setSpecies(plant.species);
        setLoaded(true);
      })
      .catch((e) => console.error("load plant failed:", e));
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function save() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await database.write(async () => {
        const plant = await database.get<Plant>("plants").find(id);
        await plant.update((p) => {
          p.name = name.trim();
          p.species = species.trim() || "Unknown species";
        });
      });
      router.back();
    } catch (e) {
      console.error("edit save failed:", e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 24,
        gap: 18,
      }}
    >
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-full border border-border bg-surface"
        >
          <Ionicons name="chevron-back" size={16} color={tokens.forest} />
        </Pressable>
        <View className="flex-1">
          <Text className="font-display text-[22px] text-forest">Edit plant</Text>
          <Text className="font-body text-xs text-secondary">Update its name and species.</Text>
        </View>
      </View>

      <View className="gap-4">
        <View>
          <Text className="font-body text-[13px] text-secondary">Nickname</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Monstera"
            placeholderTextColor={tokens.secondary}
            className="mt-2 rounded-[18px] border border-border bg-surface px-4 py-3 font-body text-[15px] text-forest"
            autoCapitalize="words"
          />
        </View>

        <View>
          <Text className="font-body text-[13px] text-secondary">Species</Text>
          <TextInput
            value={species}
            onChangeText={setSpecies}
            placeholder="Monstera deliciosa"
            placeholderTextColor={tokens.secondary}
            className="mt-2 rounded-[18px] border border-border bg-surface px-4 py-3 font-body text-[15px] text-forest"
            autoCapitalize="words"
          />
        </View>
      </View>

      <Pressable
        onPress={save}
        disabled={!name.trim() || saving || !loaded}
        className="mt-4 rounded-[18px] bg-forest px-5 py-4"
        style={{ opacity: !name.trim() || saving || !loaded ? 0.6 : 1 }}
      >
        <Text className="text-center font-body text-base font-semibold text-white">
          {saving ? "Saving..." : "Save changes"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
