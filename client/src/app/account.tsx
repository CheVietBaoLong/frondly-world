import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tokens } from "@/constants/tokens";
import { useAuth } from "@/lib/auth";
import { backup, lastBackupAt, restore } from "@/lib/backup";

// Declared at module scope (not inside AccountScreen) — components created
// during render reset their state every render, which the react-compiler
// lint rule (react-hooks/static-components) flags as an error.
function AccountHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <Pressable
        onPress={() => router.back()}
        className="h-9 w-9 items-center justify-center rounded-full border border-border bg-surface"
      >
        <Ionicons name="chevron-back" size={16} color={tokens.forest} />
      </Pressable>
      <View className="flex-1">
        <Text className="font-display text-[22px] text-forest">{title}</Text>
        <Text className="font-body text-xs text-secondary">{subtitle}</Text>
      </View>
    </View>
  );
}

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View className="flex-row items-center gap-2 rounded-[14px] bg-blushBg p-3.5">
      <Ionicons name="warning" size={18} color={tokens.rust} />
      <Text className="flex-1 font-body text-[13px] font-semibold text-rust">{message}</Text>
    </View>
  );
}

// Account — sign in/up when signed out, backup/restore/sign-out when signed
// in. Reached from the "V" avatar on Home. The app stays fully usable if a
// user never opens this screen — nothing here gates local plant data.
export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { user, initializing, signIn, signUp, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "auth" | "backup" | "restore">(null);
  const [lastAt, setLastAt] = useState<number | null>(null);

  useEffect(() => {
    if (user)
      lastBackupAt(user.uid)
        .then(setLastAt)
        .catch(() => {});
  }, [user]);

  const submitAuth = async () => {
    setError(null);
    setBusy("auth");
    try {
      await (mode === "signin" ? signIn : signUp)(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(null);
    }
  };

  const doBackup = async () => {
    if (!user) return;
    setError(null);
    setBusy("backup");
    try {
      setLastAt(await backup(user.uid));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backup failed");
    } finally {
      setBusy(null);
    }
  };

  const doRestore = () => {
    if (!user) return;
    Alert.alert("Restore backup?", "This replaces your current garden with your last backup.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Restore",
        style: "destructive",
        onPress: async () => {
          setError(null);
          setBusy("restore");
          try {
            await restore(user.uid);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Restore failed");
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  if (initializing) {
    return (
      <View
        className="flex-1 items-center justify-center bg-paper"
        style={{ paddingTop: insets.top }}
      >
        <ActivityIndicator color={tokens.forest} />
      </View>
    );
  }

  if (!user) {
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
        <AccountHeader
          title={mode === "signin" ? "Sign in" : "Create account"}
          subtitle={
            mode === "signin"
              ? "Sign in to back up your garden."
              : "Create an account to back up your garden."
          }
        />

        <View className="gap-4">
          <View>
            <Text className="font-body text-[13px] text-secondary">Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={tokens.secondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              className="mt-2 rounded-[18px] border border-border bg-surface px-4 py-3 font-body text-[15px] text-forest"
            />
          </View>

          <View>
            <Text className="font-body text-[13px] text-secondary">Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={tokens.secondary}
              secureTextEntry
              className="mt-2 rounded-[18px] border border-border bg-surface px-4 py-3 font-body text-[15px] text-forest"
            />
          </View>
        </View>

        <ErrorBanner message={error} />

        <Pressable
          onPress={submitAuth}
          disabled={!email.trim() || !password || busy === "auth"}
          className="rounded-[18px] bg-forest px-5 py-4"
          style={{ opacity: !email.trim() || !password || busy === "auth" ? 0.6 : 1 }}
        >
          <Text className="text-center font-body text-base font-semibold text-white">
            {busy === "auth"
              ? mode === "signin"
                ? "Signing in..."
                : "Creating account..."
              : mode === "signin"
                ? "Sign in"
                : "Sign up"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
        >
          <Text className="text-center font-body text-[13px] text-secondary">
            {mode === "signin" ? "Need an account? " : "Have an account? "}
            <Text className="font-semibold text-forest">
              {mode === "signin" ? "Sign up" : "Sign in"}
            </Text>
          </Text>
        </Pressable>
      </ScrollView>
    );
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
      <AccountHeader title="Account" subtitle="Manage your backup and sign-in." />

      <View className="flex-row items-center gap-3 rounded-[18px] border border-border bg-surface px-4 py-3.5">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-forest">
          <Ionicons name="person" size={16} color={tokens.citron} />
        </View>
        <Text className="flex-1 font-body text-[15px] text-forest" numberOfLines={1}>
          {user.email}
        </Text>
      </View>

      <View className="gap-2">
        <Pressable
          onPress={doBackup}
          disabled={!!busy}
          className="rounded-[18px] bg-forest px-5 py-4"
          style={{ opacity: busy ? 0.6 : 1 }}
        >
          <Text className="text-center font-body text-base font-semibold text-white">
            {busy === "backup" ? "Backing up..." : "Back up now"}
          </Text>
        </Pressable>
        <Text className="font-body text-xs text-secondary">
          {lastAt ? `Last backup: ${new Date(lastAt).toLocaleString()}` : "No backup yet"}
        </Text>
      </View>

      <Pressable
        onPress={doRestore}
        disabled={!!busy}
        className="rounded-[18px] border border-forest bg-surface px-5 py-4"
        style={{ opacity: busy ? 0.6 : 1 }}
      >
        <Text className="text-center font-body text-base font-semibold text-forest">
          {busy === "restore" ? "Restoring..." : "Restore from backup"}
        </Text>
      </Pressable>

      <ErrorBanner message={error} />

      <Pressable onPress={() => signOut()} disabled={!!busy} className="py-2">
        <Text className="text-center font-body text-[13px] font-semibold text-rust">Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}
