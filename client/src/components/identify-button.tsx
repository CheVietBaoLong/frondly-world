import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { tokens } from "@/constants/tokens";
import { identifyHouseplant, type PlantIdentity } from "@/lib/identify";

type Props = {
  photoUri: string | null;
  // Fired when the button picks a photo itself (no photoUri was set yet), so the
  // parent can persist it (e.g. as heroPhoto / the manual-form photo).
  onPhotoPicked?: (uri: string) => void;
  onIdentified: (identity: PlantIdentity) => void;
};

// "Identify from photo" — shared by Add-manual and Edit. Uses the current photo,
// or picks one if none is set. Prefill only; never writes to the database.
export function IdentifyButton({ photoUri, onPhotoPicked, onIdentified }: Props) {
  const [identifying, setIdentifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (identifying) return;
    setError(null);

    let uri = photoUri;
    if (!uri) {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.6,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      uri = result.assets[0].uri;
      onPhotoPicked?.(uri);
    }

    setIdentifying(true);
    try {
      const identity = await identifyHouseplant(uri);
      if (identity) onIdentified(identity);
      else setError("Couldn't identify — enter details manually.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Identify failed.");
    } finally {
      setIdentifying(false);
    }
  }

  return (
    <View className="gap-1.5">
      <Pressable
        onPress={run}
        disabled={identifying}
        className="flex-row items-center justify-center gap-2 rounded-[14px] bg-citron py-3"
        style={{ opacity: identifying ? 0.6 : 1 }}
      >
        {identifying ? (
          <ActivityIndicator color={tokens.forest} />
        ) : (
          <Ionicons name="sparkles" size={16} color={tokens.forest} />
        )}
        <Text className="font-body text-[15px] font-semibold text-forest">
          {identifying ? "Identifying…" : "Identify from photo"}
        </Text>
      </Pressable>
      {error ? <Text className="font-body text-xs text-secondary">{error}</Text> : null}
    </View>
  );
}
