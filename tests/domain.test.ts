import { describe, expect, it } from "vitest";
import type { Level } from "../src/domain/content";
import { createPuzzle, makeCycle, reducePuzzle } from "../src/domain/puzzle";
import { contentFixtures } from "./fixtures/browser-content";

const book: Level = {
  level_id: 1,
  target_word: "book",
  letters: ["B", "O", "O", "K"],
  foils: ["A", "Z"],
  image_path: "assets/images/book.svg",
  word_audio_path: "lang/english/audios/book.wav",
  letter_audio_paths: Array.from({ length: 4 }, (_, index) => `lang/english/audios/book-${index}.wav`),
  image_alt: "A book",
};

describe("puzzle reducer", () => {
  it("creates deterministic, complete tile permutations for 1,000 seeded layouts", () => {
    const levels = [
      contentFixtures["F-01"].levels[0],
      contentFixtures["F-02"].levels[0],
      contentFixtures["F-03"].levels[1],
    ];

    for (let seed = 0; seed < 1000; seed += 1) {
      for (const level of levels) {
        const random = seededRandom(seed);
        const repeated = seededRandom(seed);
        const first = createPuzzle(level, "great", random);
        const second = createPuzzle(level, "great", repeated);
        const expectedIds = level.letters.map((_, index) => `t:${index}`)
          .concat(level.foils.map((_, index) => `f:${index}`))
          .sort();

        expect(first.availableTileIds).toEqual(second.availableTileIds);
        expect([...first.availableTileIds].sort()).toEqual(expectedIds);
        expect(new Set(first.availableTileIds).size).toBe(expectedIds.length);
        expect(first.tiles.map((tile) => tile.id).sort()).toEqual(expectedIds);
        expect(first.tiles.map((tile) => tile.letter).sort()).toEqual(
          [...level.letters, ...level.foils].sort(),
        );
      }
    }
  });

  it("accepts repeated letters by value, regardless of tile identity", () => {
    let state = createPuzzle(book, "great", () => 0);
    for (const [tileId, slotIndex] of [["t:0", 0], ["t:2", 1], ["t:1", 2], ["t:3", 3]] as const) {
      state = reducePuzzle(state, { type: "acquire", tileId }).state;
      const outcome = reducePuzzle(state, { type: "drop", slotIndex });
      expect(outcome.result).toBe("correct");
      state = outcome.state;
    }
    expect(state.phase).toBe("completing");
    expect(state.attempts).toBe(4);
  });

  it("removes Great foils and reveals only the dropped position", () => {
    let state = createPuzzle(book, "great", () => 0);
    state = reducePuzzle(state, { type: "acquire", tileId: "f:0" }).state;
    const result = reducePuzzle(state, { type: "drop", slotIndex: 2 });
    expect(result.result).toBe("foil");
    expect(result.state.revealedHints).toEqual([2]);
    expect(result.state.availableTileIds).not.toContain("f:0");
    expect(result.state.attempts).toBe(1);
  });

  it("returns a wrong target to a different randomized available position", () => {
    let state = createPuzzle(book, "great", () => 0);
    const originalIndex = state.availableTileIds.indexOf("t:1");
    state = reducePuzzle(state, { type: "acquire", tileId: "t:1" }).state;
    const result = reducePuzzle(state, { type: "drop", slotIndex: 0 }, () => 0);
    expect(result.result).toBe("wrong");
    expect(result.state.availableTileIds).toContain("t:1");
    expect(result.state.availableTileIds.indexOf("t:1")).not.toBe(originalIndex);
    expect(result.state.attempts).toBe(1);
  });

  it("always instantiates Great foils", () => {
    const state = createPuzzle(book, "great", () => 0);
    expect(state.tiles.filter((tile) => tile.kind === "foil")).toHaveLength(2);
  });

  it("treats an occupied slot as a neutral cancellation", () => {
    let state = createPuzzle(book, "great", () => 0);
    state = reducePuzzle(state, { type: "acquire", tileId: "t:0" }).state;
    state = reducePuzzle(state, { type: "drop", slotIndex: 0 }).state;
    state = reducePuzzle(state, { type: "acquire", tileId: "t:1" }).state;
    const result = reducePuzzle(state, { type: "drop", slotIndex: 0 });
    expect(result.result).toBe("neutral");
    expect(result.state.attempts).toBe(1);
    expect(result.state.availableTileIds).toContain("t:1");
  });

  it("keeps one-level packs indefinitely addressable", () => {
    expect(makeCycle([4], () => 0)).toEqual([4]);
  });
});

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
