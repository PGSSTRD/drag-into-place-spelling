import { describe, expect, it } from "vitest";
import { validateContentPack } from "../../src/domain/content";
import { restoreProgress } from "../../src/services/progress";
import { bridgeEnvelopeAtBytes, bridgeEnvelopeFixture, contentFixtures, duplicateBridgeMessages, invalidBridgeEnvelope, invalidContentFixtures, snapshotFixture, syntheticWave, unsafePathFixtures } from "./browser-content";

describe("browser fixture integrity (not application acceptance)", () => {
  for (const [name, pack] of Object.entries(contentFixtures)) {
    it(`${name} is a valid isolated pack`, () => {
      expect(validateContentPack(pack)).toBe(pack);
      for (const level of pack.levels) {
        expect(new Set(level.letter_audio_paths).size).toBe(level.target_word.length);
      }
    });
  }
  for (const fixture of [...invalidContentFixtures, ...unsafePathFixtures]) {
    it(`rejects ${fixture.name} at ${fixture.field}`, () => {
      expect(() => validateContentPack(fixture.value)).toThrow("CONTENT_INVALID");
      expect(() => validateContentPack(fixture.value)).toThrow(fixture.field);
    });
  }
  it("preserves duplicate O instances and twelve-tile maximum", () => {
    expect(contentFixtures["F-02"].levels[0].letters).toEqual(["B", "O", "O", "K"]);
    const maximum = contentFixtures["F-03"].levels[1];
    expect(maximum.letters.length + maximum.foils.length).toBe(12);
  });
  it("provides current-format restore inputs without approving the unresolved snapshot contract", () => {
    for (const kind of ["partial", "completed"] as const) {
      expect(restoreProgress(snapshotFixture(kind), contentFixtures["F-01"].levels[0], "great", "1.0.0")).not.toBeNull();
    }
    for (const kind of ["stale", "stale-schema", "duplicate", "wrong-letter", "bad-hint", "bad-tile"] as const) {
      expect(restoreProgress(snapshotFixture(kind), contentFixtures["F-01"].levels[0], "great", "1.0.0")).toBeNull();
    }
  });
  it("provides exact UTF-8 envelope boundaries and duplicate/invalid UUID inputs", () => {
    for (const bytes of [65_535, 65_536, 65_537]) {
      expect(new TextEncoder().encode(bridgeEnvelopeAtBytes(bytes)).length).toBe(bytes);
    }
    expect(bridgeEnvelopeFixture().payload.payload_id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    expect(invalidBridgeEnvelope.payload.payload_id).toBe("not-a-uuid");
    expect(duplicateBridgeMessages[0]).toBe(duplicateBridgeMessages[1]);
  });
  it("generates a non-silent 100ms PCM WAV without external media", () => {
    const wave = syntheticWave();
    expect(wave.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wave.readUInt32LE(40)).toBe(1600);
    expect(wave.subarray(44).some((value) => value !== 0)).toBe(true);
  });
});
