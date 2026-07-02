import Ionicons from "@expo/vector-icons/Ionicons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useIsFocused } from "expo-router";
import { useRef } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CameraPreview } from "@/components/camera-preview";

import { tokens } from "@/constants/tokens";

export default function AddPlant() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [permission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  async function capture() {
    if (!permission?.granted || !cameraRef.current) return;
    try {
      const shot = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      if (!shot?.uri) return;
      router.push({ pathname: "/add/manual", params: { photo: shot.uri } });
    } catch {
      return;
    }
  }

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top + 8 }}>
      <View className="px-4">
        <Text className="font-display text-[28px] text-forest">Add a plant</Text>
        <Text className="mt-1 font-body text-xs text-secondary">
          {"Point at a plant — we\'ll identify it and check its health"}
        </Text>
      </View>

      <CameraPreview
        cameraRef={cameraRef}
        instructionText="Snap a leaf, flower, or whole plant"
        isFocused={useIsFocused()}
        style={{ height: Math.round(height * 0.38), marginHorizontal: 16, marginTop: 16 }}
      />

      <View
        className="flex-row items-center justify-center px-4"
        style={{ paddingTop: 8, paddingBottom: insets.bottom * 0.5 }}
      >
        <Pressable
          onPress={() => capture()}
          disabled={!permission?.granted}
          className="h-[72px] w-[72px] items-center justify-center rounded-full bg-forest"
          style={{ opacity: permission?.granted ? 1 : 0.4 }}
        >
          <View className="h-[58px] w-[58px] rounded-full border-2 border-citron" />
        </Pressable>
      </View>

      <View className="mx-4 mb-0 rounded-[22px] border border-border bg-surface p-4">
        <Pressable
          onPress={() => router.push("/add/photos")}
          className="mb-3 rounded-[18px] border border-border bg-paper px-4 py-3"
        >
          <View className="flex-row items-center gap-3">
            <Ionicons name="images-outline" size={18} color={tokens.forest} />
            <Text className="font-body text-[15px] text-forest">Choose from Photos</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => router.push("/add/manual")}
          className="rounded-[18px] border border-border bg-paper px-4 py-3"
        >
          <View className="flex-row items-center gap-3">
            <Ionicons name="pencil-outline" size={18} color={tokens.forest} />
            <Text className="font-body text-[15px] text-forest">Add manually</Text>
          </View>
        </Pressable>
      </View>

      <Text className="absolute bottom-[76px] w-full text-center font-body text-[11px] text-secondary">
        {"Field ID aid only — never eat on an app\'s word alone."}
      </Text>
    </View>
  );
}
