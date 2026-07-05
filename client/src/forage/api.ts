// Client for the Forage identify backend (server/main.py: POST /forage/identify).
//
// The phone reaches the local FastAPI server over the adb reverse tunnel
// (`adb reverse tcp:8000 tcp:8000`), so localhost:8000 on the device maps to the
// dev machine — same trick Metro uses for :8081.
//
import { API_BASE } from "@/lib/config";

// Mirrors server/forage/identify.py ForageResult. Four mutually exclusive states;
// below the confidence threshold the name is suppressed (low_confidence).
export type ForageState = "verified_edible" | "verified_toxic" | "unverified" | "low_confidence";

export type ForageFacts = {
  edible_part?: string;
  preparation?: string;
  season?: string;
  habitat?: string;
  range?: string;
};

// server/data/forage_pnw.json entries: toxic_lookalikes carries the "how to
// tell apart" comparison the spec calls for, so it's a richer object than
// benign_lookalikes (plain display strings — dataset has no comparison notes
// for those, since there's nothing dangerous to tell apart). Typed as a union
// since either shape can show up depending on the field.
export type ForageLookalike =
  | string
  | {
      common_name?: string | null;
      scientific_name?: string | null;
      severity?: string | null;
      why_confused?: string | null;
      how_to_tell_apart?: string | null;
    };

export function formatLookalike(lookalike: ForageLookalike): string {
  if (typeof lookalike === "string") {
    return lookalike;
  }

  const parts = [lookalike.common_name, lookalike.scientific_name].filter(Boolean) as string[];
  return parts.length ? parts.join(" — ") : "Unknown lookalike";
}

export function buildForageSpeciesId(
  result: Pick<ForageResult, "name" | "scientific_name">
): string {
  const base = result.scientific_name?.trim() || result.name?.trim() || "species";
  return (
    base
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "species"
  );
}

export type ForageResult = {
  state: ForageState;
  confidence: number; // 0.0–1.0
  name?: string | null;
  scientific_name?: string | null;
  edibility?: string | null;
  facts?: ForageFacts | null;
  toxic_lookalikes: ForageLookalike[];
  benign_lookalikes: ForageLookalike[];
  safety_caveat?: string | null;
  warning?: string | null; // verified_toxic
  possible_matches: string[]; // low_confidence — do not eat
  message?: string | null;
  sources: string[];
  safety_strip: string; // standing, non-dismissable disclaimer
};

// Last identification, shared with the species-detail screen (single active flow).
let lastResult: ForageResult | null = null;
export function getLastResult(): ForageResult | null {
  return lastResult;
}

// Upload the captured photo to the backend and return the identification.
//
// Uses XMLHttpRequest, not fetch: RN 0.85's spec fetch rejects the classic
// { uri } FormData file part ("Unsupported FormDataPart implementation"), while
// XHR goes through RN's native networking which handles file-URI parts.
export async function identifyPhoto(uri: string): Promise<ForageResult> {
  const form = new FormData();
  // FastAPI's `file: UploadFile` param name must be "file".
  form.append("file", { uri, name: "capture.jpg", type: "image/jpeg" } as any);

  const body = await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/forage/identify`);
    xhr.timeout = 20_000;
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve(xhr.responseText)
        : reject(new Error(`Identify failed (${xhr.status}).`));
    xhr.onerror = () =>
      reject(new Error("Network error — is the server running and adb reverse tcp:8000 set?"));
    xhr.ontimeout = () =>
      reject(new Error("Identify timed out. Check the server and adb reverse tcp:8000."));
    xhr.send(form);
  });

  const data = JSON.parse(body) as ForageResult;
  lastResult = data;
  return data;
}
