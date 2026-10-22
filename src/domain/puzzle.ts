import type { Level } from "./content";

export type Tier = "mvp" | "better";
export type PuzzlePhase = "playing" | "completing";
export type TileKind = "target" | "foil";

export interface Tile {
  id: string;
  letter: string;
  kind: TileKind;
}

export interface PuzzleState {
  level: Level;
  tier: Tier;
  tiles: Tile[];
  availableTileIds: string[];
  selectedTileId: string | null;
  slots: Array<string | null>;
  removedFoilIds: string[];
  revealedHints: number[];
  attempts: number;
  phase: PuzzlePhase;
  completionRecorded: boolean;
  elapsedMs: number;
}

export type PuzzleAction =
  | { type: "acquire"; tileId: string }
  | { type: "cancel" }
  | { type: "drop"; slotIndex: number };

export type DropResult = "correct" | "wrong" | "foil" | "neutral";

export function createPuzzle(
  level: Level,
  tier: Tier,
  random: () => number = Math.random,
): PuzzleState {
  const targets = level.letters.map((letter, index): Tile => ({
    id: `t:${index}`,
    letter,
    kind: "target",
  }));
  const foils =
    tier === "better"
      ? level.foils.map((letter, index): Tile => ({
          id: `f:${index}`,
          letter,
          kind: "foil",
        }))
      : [];
  const tiles = [...targets, ...foils];
  return {
    level,
    tier,
    tiles,
    availableTileIds: shuffle(tiles.map((tile) => tile.id), random),
    selectedTileId: null,
    slots: Array.from({ length: level.target_word.length }, () => null),
    removedFoilIds: [],
    revealedHints: [],
    attempts: 0,
    phase: "playing",
    completionRecorded: false,
    elapsedMs: 0,
  };
}

export function reducePuzzle(
  state: PuzzleState,
  action: PuzzleAction,
  random: () => number = Math.random,
): { state: PuzzleState; result: DropResult } {
  if (state.phase !== "playing") return { state, result: "neutral" };

  if (action.type === "acquire") {
    if (state.selectedTileId || !state.availableTileIds.includes(action.tileId)) {
      return { state, result: "neutral" };
    }
    return {
      state: { ...state, selectedTileId: action.tileId },
      result: "neutral",
    };
  }

  if (action.type === "cancel") {
    return {
      state: { ...state, selectedTileId: null },
      result: "neutral",
    };
  }

  const tileId = state.selectedTileId;
  const tile = state.tiles.find((entry) => entry.id === tileId);
  if (!tile || action.slotIndex < 0 || action.slotIndex >= state.slots.length) {
    return {
      state: { ...state, selectedTileId: null },
      result: "neutral",
    };
  }
  if (state.slots[action.slotIndex] !== null) {
    return {
      state: { ...state, selectedTileId: null },
      result: "neutral",
    };
  }

  if (tile.kind === "foil") {
    const next = {
      ...state,
      selectedTileId: null,
      availableTileIds: state.availableTileIds.filter((id) => id !== tile.id),
      removedFoilIds: [...state.removedFoilIds, tile.id],
      revealedHints: state.revealedHints.includes(action.slotIndex)
        ? state.revealedHints
        : [...state.revealedHints, action.slotIndex],
      attempts: state.attempts + 1,
    };
    return { state: next, result: "foil" };
  }

  if (tile.letter !== state.level.target_word[action.slotIndex].toUpperCase()) {
    const availableTileIds = relocateWrongTile(state.availableTileIds, tile.id, random);
    return {
      state: {
        ...state,
        selectedTileId: null,
        availableTileIds,
        attempts: state.attempts + 1,
      },
      result: "wrong",
    };
  }

  const slots = [...state.slots];
  slots[action.slotIndex] = tile.id;
  const next: PuzzleState = {
    ...state,
    selectedTileId: null,
    availableTileIds: state.availableTileIds.filter((id) => id !== tile.id),
    slots,
    attempts: state.attempts + 1,
    phase: slots.every((slot) => slot !== null) ? "completing" : "playing",
    completionRecorded: slots.every((slot) => slot !== null),
  };
  return { state: next, result: "correct" };
}

function relocateWrongTile(tileIds: string[], tileId: string, random: () => number): string[] {
  const previousIndex = tileIds.indexOf(tileId);
  if (previousIndex < 0 || tileIds.length < 2) return tileIds;
  const nextIndexCandidate = Math.floor(random() * (tileIds.length - 1));
  const nextIndex = nextIndexCandidate >= previousIndex ? nextIndexCandidate + 1 : nextIndexCandidate;
  const result = [...tileIds];
  result.splice(previousIndex, 1);
  result.splice(nextIndex, 0, tileId);
  return result;
}

export function shuffle<T>(values: T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function makeCycle(levelIds: number[], random: () => number): number[] {
  return shuffle(levelIds, random);
}
