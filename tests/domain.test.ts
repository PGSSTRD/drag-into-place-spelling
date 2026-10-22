import { describe, expect, it } from "vitest";
import type { Level } from "../src/domain/content";
import { createPuzzle, makeCycle, reducePuzzle } from "../src/domain/puzzle";

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
  it("accepts repeated letters by value, regardless of tile identity", () => {
    let state = createPuzzle(book, "mvp", () => 0);
    for (const [tileId, slotIndex] of [["t:0", 0], ["t:2", 1], ["t:1", 2], ["t:3", 3]] as const) {
      state = reducePuzzle(state, { type: "acquire", tileId }).state;
      const outcome = reducePuzzle(state, { type: "drop", slotIndex });
      expect(outcome.result).toBe("correct");
      state = outcome.state;
    }
    expect(state.phase).toBe("completing");
    expect(state.attempts).toBe(4);
  });

  it("removes Better foils and reveals only the dropped position", () => {
    let state = createPuzzle(book, "better", () => 0);
    state = reducePuzzle(state, { type: "acquire", tileId: "f:0" }).state;
    const result = reducePuzzle(state, { type: "drop", slotIndex: 2 });
    expect(result.result).toBe("foil");
    expect(result.state.revealedHints).toEqual([2]);
    expect(result.state.availableTileIds).not.toContain("f:0");
    expect(result.state.attempts).toBe(1);
  });

  it("returns a wrong target to a different randomized available position", () => {
    let state = createPuzzle(book, "mvp", () => 0);
    const originalIndex = state.availableTileIds.indexOf("t:1");
    state = reducePuzzle(state, { type: "acquire", tileId: "t:1" }).state;
    const result = reducePuzzle(state, { type: "drop", slotIndex: 0 }, () => 0);
    expect(result.result).toBe("wrong");
    expect(result.state.availableTileIds).toContain("t:1");
    expect(result.state.availableTileIds.indexOf("t:1")).not.toBe(originalIndex);
    expect(result.state.attempts).toBe(1);
  });

  it("does not instantiate foils in MVP", () => {
    const state = createPuzzle(book, "mvp", () => 0);
    expect(state.tiles.every((tile) => tile.kind === "target")).toBe(true);
  });

  it("treats an occupied slot as a neutral cancellation", () => {
    let state = createPuzzle(book, "mvp", () => 0);
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
