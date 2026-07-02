import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { database } from "@/db";
import { Plant } from "@/db/models/Plant";
import { tokens } from "@/constants/tokens";

const ROOMS = ["Living room", "Bedroom", "Kitchen", "Office"] as const;
const LIGHTS = ["Bright", "Medium", "Low"] as const;

type RoomOption = (typeof ROOMS)[number];
type LightOption = (typeof LIGHTS)[number];

export default function AddManual() {
  const insets = useSafeAreaInsets();
  const { photo } = useLocalSearchParams<{ photo?: string }>();
  const [name, setName] = useState("");
  const [room, setRoom] = useState<RoomOption>(ROOMS[0]);
  const [light, setLight] = useState<LightOption>(LIGHTS[1]);
  const [saving, setSaving] = useState(false);

  // dev-note: room/light aren't on the Plant model/schema yet, so they're
  // captured in the UI but not persisted. Add columns + a migration when
  // those fields are actually needed downstream.
  async function save() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await database.write(async () => {
        await database.get<Plant>("plants").create((plant) => {
          plant.name = name.trim();
          plant.species = "Unknown species";
          plant.dateAdded = new Date();
          plant.latitude = null;
          plant.longitude = null;
          plant.heroPhoto = photo ?? null;
        });
      });
      router.replace("/");
    } catch (e) {
      console.error("save failed", e);
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
          <Text className="font-display text-[22px] text-forest">Add manually</Text>
          <Text className="font-body text-xs text-secondary">
            Enter plant details and save it to your garden.
          </Text>
        </View>
      </View>

      {photo ? (
        <View className="h-[190px] items-center justify-center overflow-hidden rounded-[20px] bg-stoneBg">
          <Image
            source={{ uri: photo }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        </View>
      ) : null}

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
          <Text className="font-body text-[13px] text-secondary">Room</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {ROOMS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setRoom(option)}
                className={
                  option === room
                    ? "rounded-full bg-forest px-4 py-3"
                    : "rounded-full border border-border bg-surface px-4 py-3"
                }
              >
                <Text
                  className="font-body text-[13px]"
                  style={{ color: option === room ? tokens.white : tokens.forest }}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View>
          <Text className="font-body text-[13px] text-secondary">Light</Text>
          <View className="mt-2 flex-row items-center justify-between rounded-[18px] border border-border bg-paper p-2">
            {LIGHTS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setLight(option)}
                className={
                  option === light
                    ? "rounded-full bg-forest px-4 py-2"
                    : "rounded-full bg-surface px-4 py-2"
                }
              >
                <Text
                  className="font-body text-[13px]"
                  style={{ color: option === light ? tokens.white : tokens.forest }}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <Pressable
        onPress={save}
        disabled={!name.trim() || saving}
        className="mt-4 rounded-[18px] bg-forest px-5 py-4"
        style={{ opacity: !name.trim() || saving ? 0.6 : 1 }}
      >
        <Text className="text-center font-body text-base font-semibold text-white">
          {saving ? "Saving..." : "Save to garden"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
