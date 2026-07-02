import Ionicons from "@expo/vector-icons/Ionicons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useIsFocused } from "expo-router";
import { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CameraPreview } from "@/components/camera-preview";

import { tokens } from "@/constants/tokens";

// Forage Capture — ports ForageCaptureView. Tab entry: point the camera at a
// wild plant and capture to identify it.
export default function ForageCapture() {
  const insets = useSafeAreaInsets();
  const [permission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Capture a photo and hand it to the result screen, which uploads it to the
  // backend for identification. No-ops (rather than navigating without a
  // photo) if the camera isn't ready or the capture fails.
  async function capture() {
    if (!permission?.granted || !cameraRef.current) return;
    try {
      const shot = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      if (!shot?.uri) return;
      router.push({ pathname: "/forage/result", params: { photo: shot.uri } });
    } catch {
      // Ignore capture failures (e.g. camera not ready) and keep the user on the capture screen.
      return;
    }
  }

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-start px-4">
        <View className="flex-1">
          <Text className="font-display text-[28px] text-forest">Forage</Text>
          <Text className="font-body text-xs text-secondary">
            Identify wild plants on the trail
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/forage/finds")}
          className="h-10 w-10 items-center justify-center rounded-full border border-border bg-surface"
        >
          <Ionicons name="bookmark-outline" size={18} color={tokens.forest} />
        </Pressable>
      </View>

      {/* viewfinder */}
      <CameraPreview
        cameraRef={cameraRef}
        instructionText="Snap a berry, leaf, or whole plant"
        isFocused={useIsFocused()}
        style={{ flex: 1, marginHorizontal: 16, marginTop: 16 }}
      />

      {/* controls */}
      <View
        className="flex-row items-center justify-center px-4"
        style={{ paddingTop: 18, paddingBottom: insets.bottom + 96 }}
      >
        <Pressable
          onPress={() => capture()}
          disabled={!permission?.granted}
          className="h-[72px] w-[72px] items-center justify-center rounded-full bg-forest"
          style={{ opacity: permission?.granted ? 1 : 0.4 }}
        >
          <View className="h-[58px] w-[58px] rounded-full border-2 border-citron" />
        </Pressable>
        <Pressable
          onPress={() => router.push("/forage/finds")}
          className="absolute right-8 h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface"
        >
          <Ionicons name="images-outline" size={20} color={tokens.forest} />
        </Pressable>
      </View>

      <Text className="absolute bottom-[76px] w-full text-center font-body text-[11px] text-secondary">
        Field ID aid only — never eat on an app&apos;s word alone.
      </Text>
    </View>
  );
}
