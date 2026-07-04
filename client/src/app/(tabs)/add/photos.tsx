import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tokens } from "@/constants/tokens";

export default function AddPhotos() {
  const insets = useSafeAreaInsets();
  const [permission, setPermission] = useState<boolean | null>(null);

  useEffect(() => {
    ImagePicker.getMediaLibraryPermissionsAsync().then((result) => {
      setPermission(result.granted ?? false);
    });
  }, []);

  // Pick a photo, then hand it to the manual form so the user names the plant
  // and confirms its details — matching the camera flow (add/index.tsx). We no
  // longer save a bare "New plant" here and bounce home.
  async function choosePhoto() {
    if (permission !== true) {
      const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setPermission(result.granted ?? false);
      if (!result.granted) return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      allowsEditing: true,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;
    router.replace({ pathname: "/add/manual", params: { photo: result.assets[0].uri } });
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
          <Text className="font-display text-[22px] text-forest">Choose from Photos</Text>
          <Text className="font-body text-xs text-secondary">
            Select an image to add it to your garden.
          </Text>
        </View>
      </View>

      <View className="rounded-[24px] border border-border bg-surface p-6">
        <Text className="font-body text-sm text-secondary">
          {"Pick a photo from your library, then add its details on the next screen."}
        </Text>
        <Pressable onPress={choosePhoto} className="mt-6 rounded-[18px] bg-forest px-5 py-4">
          <Text className="text-center font-body text-base font-semibold text-white">
            {permission === false ? "Allow photo access" : "Choose Photo"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
