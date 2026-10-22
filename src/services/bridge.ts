import type { Tier } from "../domain/puzzle";

export type GameEvent =
  | { type: "session_started"; lang: "english"; tier: Tier }
  | {
      type: "level_completed";
      lang: "english";
      level_id: number;
      tier: Tier;
      attempts: number;
      duration_ms: number;
      score: number;
      max_score: number;
    };

interface EventEnvelope {
  type: "cr_event";
  payload: {
    payload_id: string;
    cr_user_id: string;
    sub_app_id: string;
    payload_version: 1;
    collection: "user_sessions_data";
    timestamp: string;
    data: GameEvent;
  };
}

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage?: (message: string) => void };
  }
}

const SUB_APP_ID = "dev-drag-into-place";
const MAX_EVENT_BYTES = 65_536;
const reportedBridgeFailures = new Set<string>();

export function createEventEnvelope(
  data: GameEvent,
  search: string,
  timestamp = new Date(),
  uuid = createUuid(),
): EventEnvelope | null {
  if (!hasFiniteNumbers(data)) return null;
  const envelope: EventEnvelope = {
    type: "cr_event",
    payload: {
      payload_id: uuid,
      cr_user_id: new URLSearchParams(search).get("cr_user_id") ?? "",
      sub_app_id: SUB_APP_ID,
      payload_version: 1,
      collection: "user_sessions_data",
      timestamp: timestamp.toISOString(),
      data,
    },
  };
  const serialized = JSON.stringify(envelope);
  return new TextEncoder().encode(serialized).length < MAX_EVENT_BYTES ? envelope : null;
}

export function postGameEvent(data: GameEvent): void {
  const bridge = window.ReactNativeWebView;
  if (typeof bridge?.postMessage !== "function") return;

  const envelope = createEventEnvelope(data, window.location.search);
  if (!envelope) {
    reportBridgeFailure("EVENT_INVALID");
    return;
  }
  try {
    bridge.postMessage(JSON.stringify(envelope));
  } catch {
    reportBridgeFailure("BRIDGE_FAILED");
  }
}

function hasFiniteNumbers(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(hasFiniteNumbers);
  if (typeof value === "object" && value !== null) {
    return Object.values(value).every(hasFiniteNumbers);
  }
  return true;
}

function createUuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  try {
    if (!globalThis.crypto?.getRandomValues) throw new Error("secure random unavailable");
    globalThis.crypto.getRandomValues(bytes);
  } catch {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function reportBridgeFailure(code: "EVENT_INVALID" | "BRIDGE_FAILED") {
  if (reportedBridgeFailures.has(code)) return;
  reportedBridgeFailures.add(code);
  console.warn(code);
}
