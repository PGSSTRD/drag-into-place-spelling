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
  it("namespaces snapshots by opaque user and tier", () => {
    expect(progressKey("a/b", "better")).toBe("drag-into-place:v1:a%2Fb:english:better");
    expect(progressKey(null, "mvp")).toBe("drag-into-place:v1:guest:english:mvp");
  });

  it("restores valid repeated-letter placements and cycle order", () => {
    const storage = new MemoryStorage();
    let state = createPuzzle(level, "better", () => 0);
    state = reducePuzzle(state, { type: "acquire", tileId: "t:0" }).state;
    state = reducePuzzle(state, { type: "drop", slotIndex: 0 }).state;
    expect(saveProgress(storage, "learner", state, "1.0.0", [7, 8], 0)).toBe(true);
    const raw = JSON.parse(storage.getItem(progressKey("learner", "better")) ?? "null") as unknown;
    expect(restoreProgress(raw, level, "better", "1.0.0", () => 0)?.slots).toEqual(["t:0", null, null, null]);
    expect(restoreCycle(raw, [7, 8], 7)).toEqual({ cycleIds: [7, 8], currentCycleIndex: 0 });
  });

  it("restores a completion marker without replaying completion", () => {
    const storage = new MemoryStorage();
    let state = createPuzzle(level, "better", () => 0);
    for (let index = 0; index < level.target_word.length; index += 1) {
      state = reducePuzzle(state, { type: "acquire", tileId: `t:${index}` }).state;
      state = reducePuzzle(state, { type: "drop", slotIndex: index }).state;
    }
    expect(state.completionRecorded).toBe(true);
    expect(saveProgress(storage, "learner", state, "1.0.0", [7], 0)).toBe(true);
    const raw = JSON.parse(storage.getItem(progressKey("learner", "better")) ?? "null") as unknown;
    const restored = restoreProgress(raw, level, "better", "1.0.0", () => 0);
    expect(restored?.phase).toBe("completing");
    expect(restored?.completionRecorded).toBe(true);
  });

  it("rejects duplicate tile bindings and invalid cycle state", () => {
    const invalid = {
      schema_version: 1,
      content_version: "1.0.0",
      tier: "mvp",
      level_id: 7,
      slots: ["t:1", "t:1", null, null],
      removedFoilIds: [],
      revealedHints: [],
      attempts: 2,
      phase: "playing",
      cycleIds: [7, 8],
      currentCycleIndex: 1,
    };
    expect(restoreProgress(invalid, level, "mvp", "1.0.0")).toBeNull();
    expect(restoreCycle(invalid, [7, 8], 7)).toBeNull();
  });
});
