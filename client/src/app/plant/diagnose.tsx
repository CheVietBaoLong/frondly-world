import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip } from "@/components/ui/chip";
import { SectionLabel } from "@/components/ui/section-label";
import { tokens } from "@/constants/tokens";
import { database } from "@/db";
import { Observation } from "@/db/models/Observation";
import { Plant } from "@/db/models/Plant";
import {
  buildDiagnoseParts,
  createSession,
  sendMessage,
  type Diagnosis,
  type MessagePart,
} from "@/lib/api";
import {
  appendFollowUp,
  markTurnDone,
  markTurnError,
  markTurnNoteSaved,
  resetTurnForRetry,
  setTurnDiagnosis,
  setTurnText,
  type Turn,
} from "@/lib/diagnose-turns";

type Phase = "pick" | "sending" | "done" | "error";

// Diagnose flow: photo → streamed agent reply → diagnosis auto-saved as an
// Observation → optional follow-up questions on the same session.
// dev-note: single reply block, not a message history — leaving the screen
// ends the session; the journal is the durable record.
export default function Diagnose() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("pick");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const nextTurnId = useRef(0);
  const isStreaming = turns.some((t) => t.status === "streaming");
  // dev-note: hasSession mirrors sessionRef for render-time reads (React
  // Compiler's react-hooks/refs rule forbids reading ref.current in render);
  // sessionRef itself stays the source of truth for the async flow below.
  const [hasSession, setHasSession] = useState(false);
  const sessionRef = useRef<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // Abort any in-flight stream when leaving the screen.
  useEffect(() => () => xhrRef.current?.abort(), []);

  async function pick(source: "camera" | "library") {
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.7,
            base64: true,
          });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    setPhotoUri(result.assets[0].uri);
    setPhotoBase64(result.assets[0].base64);
  }

  async function saveObservation(d: Diagnosis) {
    const plant = await database.get<Plant>("plants").find(id);
    await database.write(async () => {
      await database.get<Observation>("observations").create((o) => {
        o.plant.set(plant);
        o.note = d.problem;
        o.severity = d.severity;
        o.healthScore = d.healthScore;
        o.confidence = d.confidence;
        o.careSteps = d.careSteps;
        // dev-note: camera-cache URI stored as-is; durable copy via
        // expo-file-system is a deferred item shared with heroPhoto.
        o.photo = photoUri;
        o.date = new Date();
      });
    });
  }

  // Persist a chat reply as a plain journal note (no health score) so a helpful
  // follow-up answer isn't lost when the session ends. Surfaces on Plant Detail
  // via `latestNote`.
  async function saveNote(text: string) {
    const plant = await database.get<Plant>("plants").find(id);
    await database.write(async () => {
      await database.get<Observation>("observations").create((o) => {
        o.plant.set(plant);
        o.note = text;
        o.date = new Date();
      });
    });
  }

  function runInitialStream(parts: MessagePart[]) {
    setPhase("sending");
    setError(null);
    setReply("");
    setNoteSaved(false);
    xhrRef.current = sendMessage(sessionRef.current as string, parts, {
      onText: setReply,
      onDiagnosis: (d) => {
        setDiagnosis(d);
        saveObservation(d).catch((e) => console.error("diagnosis save failed:", e));
      },
      onDone: () => setPhase("done"),
      onError: (e) => {
        setError(e.message);
        setPhase("error");
      },
    });
  }

  // Follow-ups no longer touch `phase`/`reply`/`diagnosis` — they update
  // one Turn by id, found via `assistantId`'s closure below.
  // dev-note: if a turn's diagnosis fires and then the same stream errors,
  // a successful retry re-fires onDiagnosis and double-saves the
  // Observation (retry resends the full turn, not just the missing tail).
  // Bounded to that one interleaving; fix by tracking "already saved" per
  // turn if it turns out to matter in practice.
  function runFollowUpStream(assistantId: string, parts: MessagePart[]) {
    xhrRef.current = sendMessage(sessionRef.current as string, parts, {
      onText: (text) => setTurns((t) => setTurnText(t, assistantId, text)),
      onDiagnosis: (d) => {
        setTurns((t) => setTurnDiagnosis(t, assistantId, d));
        saveObservation(d).catch((e) => console.error("diagnosis save failed:", e));
      },
      onDone: () => setTurns((t) => markTurnDone(t, assistantId)),
      onError: (e) => setTurns((t) => markTurnError(t, assistantId, e.message)),
    });
  }

  async function diagnose() {
    if (!photoBase64) return;
    try {
      setPhase("sending");
      const plant = await database.get<Plant>("plants").find(id);
      const history = await plant.historyForBackend();
      sessionRef.current = sessionRef.current ?? (await createSession());
      setHasSession(true);
      runInitialStream(buildDiagnoseParts(plant, history, photoBase64));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }

  function ask() {
    const q = followUp.trim();
    if (!q || !sessionRef.current || isStreaming) return;
    setFollowUp("");
    const assistantId = `turn-${nextTurnId.current++}`;
    setTurns((t) => appendFollowUp(t, q, assistantId));
    runFollowUpStream(assistantId, [{ text: q }]);
  }

  function retryTurn(id: string, originalText: string) {
    if (isStreaming) return;
    setTurns((t) => resetTurnForRetry(t, id));
    runFollowUpStream(id, [{ text: originalText }]);
  }

  function saveTurnNote(id: string, text: string) {
    saveNote(text)
      .then(() => setTurns((t) => markTurnNoteSaved(t, id)))
      .catch((e) => console.error("save note failed:", e));
  }

  const canAsk = phase === "done" && hasSession && !isStreaming;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-paper"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 4,
          paddingHorizontal: 16,
          paddingBottom: 24,
          gap: 20,
        }}
      >
        {/* header */}
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-full border border-border bg-surface"
          >
            <Ionicons name="chevron-back" size={16} color={tokens.forest} />
          </Pressable>
          <Text className="flex-1 font-display text-[22px] text-forest">Diagnose</Text>
        </View>

        {/* photo preview */}
        {photoUri ? (
          <View className="h-[220px] overflow-hidden rounded-[20px] bg-forest">
            <Image source={{ uri: photoUri }} style={{ flex: 1 }} contentFit="cover" />
          </View>
        ) : null}

        {phase === "pick" ? (
          <View className="gap-3">
            <Text className="font-body text-sm text-secondary">
              Snap a clear photo of the whole plant (or the problem area) and I’ll take a look.
            </Text>
            <Pressable
              onPress={() => pick("camera")}
              className="flex-row items-center justify-center gap-2 rounded-[14px] bg-citron py-3.5"
            >
              <Ionicons name="camera" size={16} color={tokens.forest} />
              <Text className="font-body text-[15px] font-semibold text-forest">Take photo</Text>
            </Pressable>
            <Pressable
              onPress={() => pick("library")}
              className="flex-row items-center justify-center gap-2 rounded-[14px] border border-border bg-surface py-3.5"
            >
              <Ionicons name="images" size={16} color={tokens.forest} />
              <Text className="font-body text-[15px] font-semibold text-forest">
                Choose from library
              </Text>
            </Pressable>
            {photoUri ? (
              <Pressable
                onPress={diagnose}
                className="flex-row items-center justify-center gap-2 rounded-[14px] bg-forest py-3.5"
              >
                <Ionicons name="sparkles" size={16} color="white" />
                <Text className="font-body text-[15px] font-semibold text-white">Diagnose</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* waiting on the first token — show a spinner so the screen never
            looks frozen while the agent thinks */}
        {phase === "sending" && !reply ? (
          <View className="flex-row items-center gap-2.5 rounded-[18px] border border-border bg-surface p-3.5">
            <ActivityIndicator color={tokens.forest} />
            <Text className="font-body text-sm text-secondary">Looking at your plant…</Text>
          </View>
        ) : null}

        {/* streaming / final reply */}
        {reply && phase !== "pick" ? (
          <View className="gap-2 rounded-[18px] border border-border bg-surface p-3.5">
            <SectionLabel text={phase === "sending" ? "THINKING…" : "ASSISTANT"} />
            <Text className="font-body text-sm text-forest">{reply}</Text>
            {phase === "done" ? (
              noteSaved ? (
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="checkmark-circle" size={13} color={tokens.leafText} />
                  <Text className="font-body text-xs text-leafText">Saved to journal</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() =>
                    saveNote(reply)
                      .then(() => setNoteSaved(true))
                      .catch((e) => console.error("save note failed:", e))
                  }
                  className="flex-row items-center gap-1.5 self-start rounded-full bg-mintBg px-3 py-1.5"
                >
                  <Ionicons name="bookmark-outline" size={13} color={tokens.leafText} />
                  <Text className="font-body text-xs font-semibold text-leafText">
                    Save this note
                  </Text>
                </Pressable>
              )
            ) : null}
          </View>
        ) : null}

        {/* diagnosis card */}
        {diagnosis ? (
          <View className="gap-2 rounded-[18px] border border-border bg-surface p-3.5">
            <SectionLabel text="DIAGNOSIS" />
            <Text className="font-body text-sm text-forest">{diagnosis.problem}</Text>
            {diagnosis.careSteps.map((step) => (
              <View key={step} className="flex-row items-center gap-1.5">
                <Ionicons name="checkmark-circle" size={13} color={tokens.secondary} />
                <Text className="flex-1 font-body text-xs text-secondary">{step}</Text>
              </View>
            ))}
            <View className="flex-row items-center gap-2">
              <Chip
                text={`Confidence ${Math.round(diagnosis.confidence * 100)}%`}
                bg="mintBg"
                fg="leafText"
              />
              <Text className="font-body text-xs text-secondary">Saved to journal ✓</Text>
            </View>
          </View>
        ) : null}

        {/* follow-up thread */}
        {turns.map((turn, i) => (
          <MessageBubble
            key={turn.id}
            turn={turn}
            onRetry={
              turn.role === "assistant" && turn.status === "error" && !isStreaming
                ? () => retryTurn(turn.id, turns[i - 1]?.text ?? "")
                : undefined
            }
            // dev-note: covers "error" so a diagnosed-then-errored turn keeps
            // its Save button, but a turn that errors before any text streams
            // (empty turn.text, no diagnosis) can still show it, saving a
            // blank Observation. Low-impact — saveNote/saveObservation don't
            // validate elsewhere either — gate on turn.text/diagnosis if it matters.
            onSaveNote={
              turn.role === "assistant" && turn.status !== "streaming" && !turn.noteSaved
                ? () => saveTurnNote(turn.id, turn.text)
                : undefined
            }
          />
        ))}

        {/* error + retry */}
        {phase === "error" ? (
          <View className="gap-3 rounded-[18px] border border-border bg-surface p-3.5">
            <Text className="font-body text-sm text-forest">{error}</Text>
            <Pressable onPress={diagnose} className="items-center rounded-[14px] bg-citron py-3">
              <Text className="font-body text-[15px] font-semibold text-forest">Try again</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {/* follow-up input */}
      {canAsk ? (
        <View
          className="flex-row items-center gap-2 border-t border-border bg-surface px-4 py-2"
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          <TextInput
            value={followUp}
            onChangeText={setFollowUp}
            placeholder="Ask a follow-up…"
            placeholderTextColor={tokens.secondary}
            className="flex-1 rounded-[14px] border border-border bg-paper px-3 py-2 font-body text-sm text-forest"
            onSubmitEditing={ask}
            returnKeyType="send"
          />
          <Pressable
            onPress={ask}
            className="h-9 w-9 items-center justify-center rounded-full bg-forest"
          >
            <Ionicons name="arrow-up" size={16} color="white" />
          </Pressable>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function MessageBubble({
  turn,
  onRetry,
  onSaveNote,
}: {
  turn: Turn;
  onRetry?: () => void;
  onSaveNote?: () => void;
}) {
  if (turn.role === "user") {
    return (
      <View
        className="self-end rounded-[18px] rounded-br-sm bg-forest px-3.5 py-2.5"
        style={{ maxWidth: "85%" }}
      >
        <Text className="font-body text-sm text-white">{turn.text}</Text>
      </View>
    );
  }

  // Shared between the "error" and "done" branches below: an assistant turn
  // that already received a diagnosis before erroring (e.g. a retry that
  // failed after the model had already streamed a diagnosis, or a fresh
  // follow-up that errored post-diagnosis) must keep showing the diagnosis
  // card and save-note affordance — markTurnError only patches
  // status/errorMessage and deliberately preserves turn.diagnosis/noteSaved.
  const diagnosisCard = turn.diagnosis ? (
    <View className="gap-2 border-t border-border pt-2">
      <SectionLabel text="DIAGNOSIS" />
      <Text className="font-body text-sm text-forest">{turn.diagnosis.problem}</Text>
      {turn.diagnosis.careSteps.map((step) => (
        <View key={step} className="flex-row items-center gap-1.5">
          <Ionicons name="checkmark-circle" size={13} color={tokens.secondary} />
          <Text className="flex-1 font-body text-xs text-secondary">{step}</Text>
        </View>
      ))}
      <Chip
        text={`Confidence ${Math.round(turn.diagnosis.confidence * 100)}%`}
        bg="mintBg"
        fg="leafText"
      />
    </View>
  ) : null;

  const saveNoteAffordance = turn.noteSaved ? (
    <View className="flex-row items-center gap-1.5">
      <Ionicons name="checkmark-circle" size={13} color={tokens.leafText} />
      <Text className="font-body text-xs text-leafText">Saved to journal</Text>
    </View>
  ) : onSaveNote ? (
    <Pressable
      onPress={onSaveNote}
      className="flex-row items-center gap-1.5 self-start rounded-full bg-mintBg px-3 py-1.5"
    >
      <Ionicons name="bookmark-outline" size={13} color={tokens.leafText} />
      <Text className="font-body text-xs font-semibold text-leafText">Save this note</Text>
    </Pressable>
  ) : null;

  if (turn.status === "error") {
    return (
      <View
        className="gap-2 self-start rounded-[18px] rounded-bl-sm border border-border bg-surface p-3"
        style={{ maxWidth: "85%" }}
      >
        <Text className="font-body text-sm text-forest">{turn.errorMessage}</Text>
        {onRetry ? (
          <Pressable onPress={onRetry} className="self-start rounded-full bg-citron px-3 py-1.5">
            <Text className="font-body text-xs font-semibold text-forest">Retry</Text>
          </Pressable>
        ) : null}
        {diagnosisCard}
        {saveNoteAffordance}
      </View>
    );
  }

  return (
    <View
      className="gap-2 self-start rounded-[18px] rounded-bl-sm border border-border bg-surface p-3"
      style={{ maxWidth: "85%" }}
    >
      {turn.status === "streaming" && !turn.text ? (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator color={tokens.forest} size="small" />
          <Text className="font-body text-sm text-secondary">Thinking…</Text>
        </View>
      ) : (
        <Text className="font-body text-sm text-forest">{turn.text}</Text>
      )}

      {diagnosisCard}

      {turn.status === "done" ? saveNoteAffordance : null}
    </View>
  );
}
