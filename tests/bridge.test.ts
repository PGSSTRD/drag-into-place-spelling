import { describe, expect, it } from "vitest";
import { createEventEnvelope } from "../src/services/bridge";

describe("container event envelopes", () => {
  it("uses the required schema and exact container user namespace", () => {
    const envelope = createEventEnvelope(
      { type: "session_started", lang: "english", tier: "better" },
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
        data: { type: "session_started", lang: "english", tier: "better" },
      },
    });
  });

  it("drops non-finite or oversized event data", () => {
    expect(createEventEnvelope({
      type: "level_completed",
      lang: "english",
      level_id: 1,
      tier: "mvp",
      attempts: Number.NaN,
      duration_ms: 4,
      score: 3,
      max_score: 3,
    }, "")).toBeNull();
    expect(createEventEnvelope({
      type: "session_started",
      lang: "english",
      tier: "mvp",
    }, `?cr_user_id=${"x".repeat(66_000)}`)).toBeNull();
  });

  it("generates a version-4 identifier", () => {
    const envelope = createEventEnvelope(
      { type: "session_started", lang: "english", tier: "mvp" },
      "",
    );
    expect(envelope?.payload.payload_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
