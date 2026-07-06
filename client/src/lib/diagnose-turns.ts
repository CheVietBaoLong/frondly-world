import type { Diagnosis } from "@/lib/api";

// One message in the diagnose follow-up thread. The initial diagnose
// (photo -> reply) does NOT go through this — it keeps diagnose.tsx's
// original phase/reply/diagnosis state. Turns exist only for follow-ups.
export type Turn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  status: "streaming" | "done" | "error";
  diagnosis?: Diagnosis;
  noteSaved?: boolean;
  errorMessage?: string;
};

function updateTurn(turns: Turn[], id: string, patch: Partial<Turn>): Turn[] {
  return turns.map((t) => (t.id === id ? { ...t, ...patch } : t));
}

// A follow-up always arrives as a pair: the user's question (immediately
// "done" — there's nothing to stream) and a placeholder assistant turn
// that onText/onDiagnosis/markTurnDone/markTurnError fill in by id.
export function appendFollowUp(turns: Turn[], userText: string, assistantId: string): Turn[] {
  return [
    ...turns,
    { id: `${assistantId}-user`, role: "user", text: userText, status: "done" },
    { id: assistantId, role: "assistant", text: "", status: "streaming" },
  ];
}

export function setTurnText(turns: Turn[], id: string, text: string): Turn[] {
  return updateTurn(turns, id, { text });
}

export function setTurnDiagnosis(turns: Turn[], id: string, diagnosis: Diagnosis): Turn[] {
  return updateTurn(turns, id, { diagnosis });
}

export function markTurnDone(turns: Turn[], id: string): Turn[] {
  return updateTurn(turns, id, { status: "done" });
}

export function markTurnError(turns: Turn[], id: string, errorMessage: string): Turn[] {
  return updateTurn(turns, id, { status: "error", errorMessage });
}

export function markTurnNoteSaved(turns: Turn[], id: string): Turn[] {
  return updateTurn(turns, id, { noteSaved: true });
}

// Retry re-sends the same turn id: back to streaming, clear the old error
// and any partial text, keep the turn in place (no duplicate bubble). Any
// diagnosis/noteSaved already attached (e.g. record_diagnosis fired before
// a later network drop) is preserved, not wiped.
export function resetTurnForRetry(turns: Turn[], id: string): Turn[] {
  return updateTurn(turns, id, { status: "streaming", text: "", errorMessage: undefined });
}
