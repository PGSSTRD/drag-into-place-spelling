import { afterEach, describe, expect, it, vi } from "vitest";
import { createEventEnvelope, postGameEvent, type GameEvent } from "../src/services/bridge";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("container event envelopes", () => {
  it("uses the required schema and exact container user namespace", () => {
    const envelope = createEventEnvelope(
      { type: "session_started", lang: "english", tier: "great" },
      "?cr_user_id=abc%2Fdef",
      new Date("2026-10-22T06:00:00.000Z"),
      "12345678-1234-4234-8234-123456789abc",
    );
    expect(envelope).toEqual({
      type: "cr_event",
      payload: {
        payload_id: "12345678-1234-4234-8234-123456789abc",
        cr_user_id: "abc/def",
        sub_app_id: "dev-drag-into-place",
        payload_version: 1,
        collection: "user_sessions_data",
        timestamp: "2026-10-22T06:00:00.000Z",
        data: { type: "session_started", lang: "english", tier: "great" },
      },
    });
  });

  it("drops non-finite or oversized event data", () => {
    expect(createEventEnvelope({
      type: "level_completed",
      lang: "english",
      level_id: 1,
      tier: "great",
      attempts: Number.NaN,
      duration_ms: 4,
      score: 3,
      max_score: 3,
    }, "")).toBeNull();
    expect(createEventEnvelope({
      type: "session_started",
      lang: "english",
      tier: "great",
    }, `?cr_user_id=${"x".repeat(66_000)}`)).toBeNull();
  });

  it("generates a version-4 identifier", () => {
    const envelope = createEventEnvelope(
      { type: "session_started", lang: "english", tier: "great" },
      "",
    );
    expect(envelope?.payload.payload_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  for (const bytes of [65_535, 65_536, 65_537]) {
    for (const multibyte of [false, true]) {
      it(`enforces ${bytes} UTF-8 bytes with ${multibyte ? "multibyte" : "ASCII"} user routing`, () => {
        const event: GameEvent = { type: "session_started", lang: "english", tier: "great" };
        const date = new Date("2026-11-05T00:00:00Z");
        const uuid = "00000000-0000-4000-8000-000000000001";
        const envelope = createEventEnvelope(event, "", date, uuid);
        const overhead = new TextEncoder().encode(JSON.stringify(envelope)).length;
        const remaining = bytes - overhead;
        const user = multibyte ? "é".repeat(Math.floor(remaining / 2)) + "a".repeat(remaining % 2) : "a".repeat(remaining);
        const result = createEventEnvelope(event, `?cr_user_id=${encodeURIComponent(user)}`, date, uuid);
        if (bytes < 65_536) {
          expect(result).not.toBeNull();
          expect(new TextEncoder().encode(JSON.stringify(result))).toHaveLength(bytes);
        } else expect(result).toBeNull();
      });
    }
  }

  it("rejects malformed event shapes, invalid UUIDs and dates", () => {
    const event: GameEvent = { type: "session_started", lang: "english", tier: "great" };
    for (const mutation of [{ extra: true }, { lang: "invalid" }, { tier: "mvp" }, { type: "per_tap" }]) {
      expect(createEventEnvelope(Object.assign({}, event, mutation), "")).toBeNull();
    }
    expect(createEventEnvelope(event, "", new Date("invalid"))).toBeNull();
    expect(createEventEnvelope(event, "", new Date(), "not-a-uuid")).toBeNull();
    for (const mutation of [{ score: -1 }, { max_score: 9 }, { duration_ms: Infinity }, { attempts: NaN }, { level_id: 0 }]) {
      expect(createEventEnvelope(Object.assign({
        type: "level_completed", lang: "english", tier: "great",
        level_id: 1, attempts: 3, duration_ms: 100, score: 3, max_score: 3,
      } satisfies GameEvent, mutation), "")).toBeNull();
    }
  });

  it("silently ignores an absent bridge and diagnoses invalid data without posting", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("window", { location: { search: "" } });
    const event: GameEvent = { type: "session_started", lang: "english", tier: "great" };
    postGameEvent(event);
    expect(warn).not.toHaveBeenCalled();
    const postMessage = vi.fn();
    vi.stubGlobal("window", { location: { search: "" }, ReactNativeWebView: { postMessage } });
    postGameEvent(Object.assign({}, event, { extra: true }));
    postGameEvent(Object.assign({}, event, { extra: true }));
    expect(postMessage).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledExactlyOnceWith("EVENT_INVALID");
  });
});
