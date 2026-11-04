import { describe, expect, it } from "vitest";
import type { Level } from "../src/domain/content";
import { createPuzzle, reducePuzzle } from "../src/domain/puzzle";
import { progressKey, restoreCycle, restoreProgress, saveProgress } from "../src/services/progress";

const level: Level = {
  level_id: 7,
  target_word: "book",
  letters: ["B", "O", "O", "K"],
  foils: ["A"],
  image_path: "assets/images/book.svg",
  word_audio_path: "lang/english/audios/book.mp3",
  letter_audio_paths: ["lang/english/a.mp3", "lang/english/b.mp3", "lang/english/c.mp3", "lang/english/d.mp3"],
  image_alt: "A book",
};

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("progress snapshots", () => {
  it("namespaces snapshots by opaque user for the sole Great implementation", () => {
    expect(progressKey("a/b")).toBe("drag-into-place:v1:a%2Fb:english");
    expect(progressKey(null)).toBe("drag-into-place:v1:guest:english");
  });

  it("restores valid repeated-letter placements and cycle order", () => {
    const storage = new MemoryStorage();
    let state = createPuzzle(level, "great", () => 0);
    state = reducePuzzle(state, { type: "acquire", tileId: "t:0" }).state;
    state = reducePuzzle(state, { type: "drop", slotIndex: 0 }).state;
    expect(saveProgress(storage, "learner", state, "1.0.0", [7, 8], 0)).toBe(true);
    const raw = JSON.parse(storage.getItem(progressKey("learner")) ?? "null") as unknown;
    expect(raw).toMatchObject({ phase: "playing", occurrence_counter: 1 });
    expect(restoreProgress(raw, level, "great", "1.0.0", () => 0)).toMatchObject({
      slots: ["t:0", null, null, null],
      puzzleOccurrence: 1,
    });
    expect(restoreCycle(raw, [7, 8], 7)).toEqual({ cycleIds: [7, 8], currentCycleIndex: 0 });
  });

  it("restores a completion marker without replaying completion", () => {
    const storage = new MemoryStorage();
    let state = createPuzzle(level, "great", () => 0);
    for (let index = 0; index < level.target_word.length; index += 1) {
      state = reducePuzzle(state, { type: "acquire", tileId: `t:${index}` }).state;
      state = reducePuzzle(state, { type: "drop", slotIndex: index }).state;
    }
    expect(state.completionRecorded).toBe(true);
    expect(saveProgress(storage, "learner", state, "1.0.0", [7], 0)).toBe(true);
    const raw = JSON.parse(storage.getItem(progressKey("learner")) ?? "null") as unknown;
    expect(raw).toMatchObject({ phase: "completed_pending_advance", occurrence_counter: 1 });
    const restored = restoreProgress(raw, level, "great", "1.0.0", () => 0);
    expect(restored?.phase).toBe("completing");
    expect(restored?.completionRecorded).toBe(true);
  });

  it("restores and advances the occurrence counter", () => {
    const snapshot = {
      schema_version: 1,
      content_version: "1.0.0",
      tier: "great",
      level_id: 7,
      slots: [null, null, null, null],
      removedFoilIds: [],
      revealedHints: [],
      attempts: 0,
      phase: "playing",
      completion_recorded: false,
      elapsed_ms: 0,
      occurrence_counter: 12,
      cycleIds: [7],
      currentCycleIndex: 0,
    };
    expect(restoreProgress(snapshot, level, "great", "1.0.0")?.puzzleOccurrence).toBe(12);
  });

  it("rejects duplicate tile bindings and invalid cycle state", () => {
    const invalid = {
      schema_version: 1,
      content_version: "1.0.0",
      tier: "great",
      level_id: 7,
      slots: ["t:1", "t:1", null, null],
      removedFoilIds: [],
      revealedHints: [],
      attempts: 2,
      phase: "playing",
      completion_recorded: false,
      elapsed_ms: 0,
      occurrence_counter: 1,
      cycleIds: [7, 8],
      currentCycleIndex: 1,
    };
    expect(restoreProgress(invalid, level, "great", "1.0.0")).toBeNull();
    expect(restoreCycle(invalid, [7, 8], 7)).toBeNull();
  });

  it("rejects legacy phases and missing or invalid occurrence counters", () => {
    const base = {
      schema_version: 1,
      content_version: "1.0.0",
      tier: "great",
      level_id: 7,
      slots: [null, null, null, null],
      removedFoilIds: [],
      revealedHints: [],
      attempts: 0,
      phase: "playing",
      completion_recorded: false,
      elapsed_ms: 0,
      occurrence_counter: 1,
    };
    expect(restoreProgress({ ...base, phase: "completing" }, level, "great", "1.0.0")).toBeNull();
    expect(restoreProgress({ ...base, occurrence_counter: 0 }, level, "great", "1.0.0")).toBeNull();
    const { occurrence_counter: _omitted, ...missingOccurrence } = base;
    expect(restoreProgress(missingOccurrence, level, "great", "1.0.0")).toBeNull();
  });
});
