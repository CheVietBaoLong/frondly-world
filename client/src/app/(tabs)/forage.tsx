import Ionicons from "@expo/vector-icons/Ionicons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tokens } from "@/constants/tokens";

// Forage Capture — ports ForageCaptureView. Tab entry: point the camera at a
// wild plant and capture to identify it.
export default function ForageCapture() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // dev-note: `unsure` (long-press) previews the low-confidence path until the
  // real model decides confidence. The captured photo URI rides through to the
  // result card; identify() is still stubbed.
  async function capture(unsure = false) {
    let photo: string | undefined;
    try {
      const shot = await cameraRef.current?.takePictureAsync({ quality: 0.5 });
      photo = shot?.uri;
    } catch {
      // fall through — result renders its placeholder without a photo
    }
    router.push({
      pathname: "/forage/result",
      params: { ...(photo ? { photo } : {}), ...(unsure ? { unsure: "1" } : {}) },
    });
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
      <View className="mx-4 mt-4 flex-1 overflow-hidden rounded-[24px] bg-stoneBg">
        {permission?.granted ? (
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" mode="picture" />
        ) : (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Ionicons name="camera-outline" size={40} color={tokens.secondary} />
            <Text className="text-center font-body text-[13px] text-secondary">
              {permission ? "Camera access is needed to identify plants." : "Preparing the camera…"}
            </Text>
            {permission && !permission.granted ? (
              <Pressable onPress={requestPermission} className="rounded-full bg-forest px-5 py-2.5">
                <Text className="font-body text-[13px] font-semibold text-white">
                  Enable camera
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
        {permission?.granted ? (
          <View className="absolute bottom-4 w-full items-center">
            <View className="rounded-full bg-forest/90 px-3.5 py-2">
              <Text className="font-body text-[13px] text-white">
                Snap a berry, leaf, or whole plant
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* controls */}
      <View
        className="flex-row items-center justify-center px-4"
        style={{ paddingTop: 18, paddingBottom: insets.bottom + 96 }}
      >
        <Pressable
          onPress={() => capture(false)}
          onLongPress={() => capture(true)}
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
