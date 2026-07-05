import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IdentifyButton } from "@/components/identify-button";
import {
  RoomLightPicker,
  ROOMS,
  LIGHTS,
  type RoomOption,
  type LightOption,
} from "@/components/room-light-picker";
import { tokens } from "@/constants/tokens";
import { database } from "@/db";
import { Plant } from "@/db/models/Plant";

// Edit a plant's name/species. Reached from the pencil on Plant Detail — fixes
// plants stuck at "New plant" / "Unknown species" after a photo/quick add.
export default function EditPlant() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [heroPhoto, setHeroPhoto] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomOption>(ROOMS[0]);
  const [light, setLight] = useState<LightOption>(LIGHTS[1]);
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
        setHeroPhoto(plant.heroPhoto);
        setRoom((plant.room as RoomOption) ?? ROOMS[0]);
        setLight((plant.light as LightOption) ?? LIGHTS[1]);
        setLoaded(true);
      })
      .catch((e) => console.error("load plant failed:", e));
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setHeroPhoto(result.assets[0].uri);
  }

  async function save() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await database.write(async () => {
        const plant = await database.get<Plant>("plants").find(id);
        await plant.update((p) => {
          p.name = name.trim();
          p.species = species.trim() || "Unknown species";
          p.heroPhoto = heroPhoto;
          // dev-note: editing a legacy/seeded plant (room/light null) backfills
          // both to the picker's default (ROOMS[0]/LIGHTS[1]) on any save, since
          // the pill picker has no "unset" state — a deliberate tradeoff, not a
          // bug.
          p.room = room;
          p.light = light;
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

      {heroPhoto ? (
        <Pressable
          onPress={pickPhoto}
          className="h-[190px] items-center justify-center overflow-hidden rounded-[20px] bg-stoneBg"
        >
          <Image
            source={{ uri: heroPhoto }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
          <View className="absolute bottom-2 right-2 flex-row items-center gap-1 rounded-full bg-forest/80 px-3 py-1.5">
            <Ionicons name="camera" size={13} color={tokens.white} />
            <Text className="font-body text-xs text-white">Change</Text>
          </View>
        </Pressable>
      ) : (
        <Pressable
          onPress={pickPhoto}
          className="h-[130px] flex-row items-center justify-center gap-2 rounded-[20px] border border-dashed border-border bg-surface"
        >
          <Ionicons name="image-outline" size={20} color={tokens.secondary} />
          <Text className="font-body text-[13px] text-secondary">Add a photo (optional)</Text>
        </Pressable>
      )}

      <IdentifyButton
        photoUri={heroPhoto}
        onPhotoPicked={setHeroPhoto}
        onIdentified={({ name: n, scientificName }) => {
          setName(n);
          setSpecies(scientificName);
        }}
      />

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

        <RoomLightPicker
          room={room}
          light={light}
          onRoomChange={setRoom}
          onLightChange={setLight}
        />
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
