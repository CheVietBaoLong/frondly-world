// Client for houseplant identification (server/main.py: POST /plantcare/identify).
// Sibling of forage/api.ts — same local-dev base URL and XHR upload trick.
//
// dev-note: XHR (not fetch) because RN 0.85's fetch rejects the classic
// { uri } FormData file part.
import { API_BASE } from "./config";

export type PlantIdentity = {
  name: string;
  scientificName: string;
  confidence: number;
};

// Server response shape (snake_case, name null when Gemini couldn't name it).
type IdentifyResponse = {
  name: string | null;
  scientific_name: string | null;
  confidence: number;
};

// Upload the photo and return the top identity, or null when the server
// couldn't name the plant. Throws on network/timeout/HTTP errors.
export async function identifyHouseplant(uri: string): Promise<PlantIdentity | null> {
  const form = new FormData();
  form.append("file", { uri, name: "capture.jpg", type: "image/jpeg" } as any);

  const body = await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/plantcare/identify`);
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

  const data = JSON.parse(body) as IdentifyResponse;
  if (!data.name) return null;
  return {
    name: data.name,
    scientificName: data.scientific_name ?? "",
    confidence: data.confidence,
  };
}
