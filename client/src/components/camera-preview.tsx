import Ionicons from "@expo/vector-icons/Ionicons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, type RefObject } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";

import { tokens } from "@/constants/tokens";

type CameraPreviewProps = {
  cameraRef: RefObject<CameraView | null>;
  instructionText: string;
  style?: ViewStyle;
  isFocused: boolean;
};

export function CameraPreview({
  cameraRef,
  instructionText,
  style,
  isFocused,
}: CameraPreviewProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const hasPermission = permission?.granted;

  useEffect(() => {
    if (!hasPermission || !cameraRef.current) {
      return;
    }

    if (isFocused) {
      cameraRef.current?.resumePreview?.();
    } else {
      cameraRef.current?.pausePreview?.().catch(() => {});
    }
  }, [cameraRef, hasPermission, isFocused]);

  return (
    <View
      style={[style, { flex: style?.height == null ? 1 : undefined }]}
      className="overflow-hidden rounded-[24px] bg-stoneBg"
    >
      {hasPermission && isFocused ? (
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="back"
          mode="picture"
          active={true}
        />
      ) : hasPermission ? (
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-center font-body text-[13px] text-secondary">
            Camera paused while switching tabs...
          </Text>
        </View>
      ) : (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Ionicons name="camera-outline" size={40} color={tokens.secondary} />
          <Text className="text-center font-body text-[13px] text-secondary">
            {permission ? "Camera access is needed to identify plants." : "Preparing the camera…"}
          </Text>
          {permission && !permission.granted ? (
            <Pressable onPress={requestPermission} className="rounded-full bg-forest px-5 py-2.5">
              <Text className="font-body text-[13px] font-semibold text-white">Enable camera</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {hasPermission && isFocused ? (
        <View className="absolute bottom-4 w-full items-center">
          <View className="rounded-full bg-forest/90 px-3.5 py-2">
            <Text className="font-body text-[13px] text-white">{instructionText}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
