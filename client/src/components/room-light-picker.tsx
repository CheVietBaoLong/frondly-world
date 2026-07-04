import { Pressable, Text, View } from "react-native";

import { tokens } from "@/constants/tokens";

export const ROOMS = ["Living room", "Bedroom", "Kitchen", "Office"] as const;
export const LIGHTS = ["Bright", "Medium", "Low"] as const;

export type RoomOption = (typeof ROOMS)[number];
export type LightOption = (typeof LIGHTS)[number];

type RoomLightPickerProps = {
  room: RoomOption;
  light: LightOption;
  onRoomChange: (room: RoomOption) => void;
  onLightChange: (light: LightOption) => void;
};

export function RoomLightPicker({
  room,
  light,
  onRoomChange,
  onLightChange,
}: RoomLightPickerProps) {
  return (
    <>
      <View>
        <Text className="font-body text-[13px] text-secondary">Room</Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          {ROOMS.map((option) => (
            <Pressable
              key={option}
              onPress={() => onRoomChange(option)}
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
              onPress={() => onLightChange(option)}
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
    </>
  );
}
