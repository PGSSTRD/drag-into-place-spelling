import { createPuzzle, type PuzzleState, type Tier } from "../domain/puzzle";
import type { Level } from "../domain/content";

const KEY_PREFIX = "drag-into-place:v1:";
const reportedStorageFailures = new Set<string>();

export type ProgressRead =
  | { kind: "missing" }
  | { kind: "value"; snapshot: unknown }
  | { kind: "invalid" }
  | { kind: "unavailable" };

function reportStorageFailure(code: "SAVE_INVALID" | "SAVE_UNAVAILABLE") {
  if (reportedStorageFailures.has(code)) return;
  reportedStorageFailures.add(code);
  console.warn(code);
}

export function progressKey(userId: string | null, tier: Tier): string {
  const user = userId || "guest";
  return `${KEY_PREFIX}${encodeURIComponent(user)}:english:${tier}`;
}

export function settingsKey(userId: string | null): string {
  return `${KEY_PREFIX}${encodeURIComponent(userId || "guest")}:english:settings`;
}

export function loadTier(storage: Storage, userId: string | null): Tier {
  try {
    const settings = JSON.parse(storage.getItem(settingsKey(userId)) ?? "null") as { tier?: unknown } | null;
    return settings?.tier === "better" ? "better" : "mvp";
  } catch {
    return "mvp";
  }
}

export function saveTier(storage: Storage, userId: string | null, tier: Tier): boolean {
  try {
    let muted = false;
    try {
      const previous = JSON.parse(storage.getItem(settingsKey(userId)) ?? "null") as { muted?: unknown } | null;
      muted = previous?.muted === true;
    } catch {
      muted = false;
    }
    storage.setItem(settingsKey(userId), JSON.stringify({ tier, muted }));
    return true;
  } catch {
    reportStorageFailure("SAVE_UNAVAILABLE");
    return false;
  }
}

export function saveProgress(
  storage: Storage,
  userId: string | null,
  state: PuzzleState,
  contentVersion: string,
  cycleIds: number[],
  currentCycleIndex: number,
): boolean {
  try {
    storage.setItem(progressKey(userId, state.tier), JSON.stringify({
      schema_version: 1,
      content_version: contentVersion,
      tier: state.tier,
      level_id: state.level.level_id,
      slots: state.slots,
      removedFoilIds: state.removedFoilIds,
      revealedHints: state.revealedHints,
      attempts: state.attempts,
      phase: state.phase,
      completion_recorded: state.completionRecorded,
      elapsed_ms: state.elapsedMs,
      cycleIds,
      currentCycleIndex,
    }));
    return true;
  } catch {
    reportStorageFailure("SAVE_UNAVAILABLE");
    return false;
  }
}

export function restoreProgress(
  snapshot: unknown,
  level: Level,
  tier: Tier,
  contentVersion: string,
  random: () => number = Math.random,
): PuzzleState | null {
  if (!isRecord(snapshot)) return null;
  const wordLength = level.target_word.length;
  if (
    snapshot.schema_version !== 1 ||
    snapshot.content_version !== contentVersion ||
    snapshot.tier !== tier ||
    snapshot.level_id !== level.level_id ||
    !Array.isArray(snapshot.slots) ||
    snapshot.slots.length !== wordLength ||
    !Array.isArray(snapshot.removedFoilIds) ||
    !Array.isArray(snapshot.revealedHints) ||
    !Number.isSafeInteger(snapshot.attempts) ||
    (snapshot.attempts as number) < 0 ||
    (snapshot.phase !== "playing" && snapshot.phase !== "completing") ||
    typeof snapshot.completion_recorded !== "boolean" ||
    typeof snapshot.elapsed_ms !== "number" ||
    !Number.isFinite(snapshot.elapsed_ms) ||
    snapshot.elapsed_ms < 0
  ) {
    return null;
  }

  const state = createPuzzle(level, tier, random);
  const used = new Set<string>();
  const validTile = new Map(state.tiles.map((tile) => [tile.id, tile]));
  for (let index = 0; index < wordLength; index += 1) {
    const tileId: unknown = snapshot.slots[index];
    if (tileId === null) continue;
    if (typeof tileId !== "string" || used.has(tileId)) return null;
    const tile = validTile.get(tileId);
    if (!tile || tile.kind !== "target" || tile.letter !== level.target_word[index].toUpperCase()) return null;
    used.add(tileId);
    state.slots[index] = tileId;
  }

  const removed = new Set<string>();
  for (const id of snapshot.removedFoilIds) {
    if (typeof id !== "string" || removed.has(id) || validTile.get(id)?.kind !== "foil") return null;
    removed.add(id);
  }
  for (const hint of snapshot.revealedHints) {
    if (!Number.isSafeInteger(hint) || hint < 0 || hint >= wordLength || state.revealedHints.includes(hint)) return null;
    state.revealedHints.push(hint);
  }
  state.removedFoilIds = [...removed];
  state.availableTileIds = state.availableTileIds.filter((id) => !used.has(id) && !removed.has(id));
  state.attempts = snapshot.attempts as number;
  state.elapsedMs = snapshot.elapsed_ms;
  state.phase = state.slots.every((slot) => slot !== null) ? "completing" : "playing";
  state.completionRecorded = snapshot.completion_recorded;
  if (snapshot.phase !== state.phase || state.completionRecorded !== (state.phase === "completing")) return null;
  return state;
}

export function restoreCycle(
  snapshot: unknown,
  levelIds: number[],
  levelId: number,
): { cycleIds: number[]; currentCycleIndex: number } | null {
  if (!isRecord(snapshot) || !Array.isArray(snapshot.cycleIds)) return null;
  const cycleIds: unknown[] = snapshot.cycleIds;
  const currentCycleIndex = snapshot.currentCycleIndex;
  if (
    cycleIds.length !== levelIds.length ||
    cycleIds.some((id) => typeof id !== "number" || !Number.isSafeInteger(id)) ||
    new Set(cycleIds).size !== levelIds.length ||
    levelIds.some((id) => !cycleIds.includes(id)) ||
    typeof currentCycleIndex !== "number" ||
    !Number.isSafeInteger(currentCycleIndex) ||
    currentCycleIndex < 0 ||
    currentCycleIndex >= cycleIds.length ||
    cycleIds[currentCycleIndex] !== levelId
  ) {
    return null;
  }
  return {
    cycleIds: cycleIds as number[],
    currentCycleIndex,
  };
}

export function readProgress(
  storage: Storage,
  userId: string | null,
  tier: Tier,
): ProgressRead {
  try {
    const raw = storage.getItem(progressKey(userId, tier));
    if (raw === null) return { kind: "missing" };
    try {
      return { kind: "value", snapshot: JSON.parse(raw) as unknown };
    } catch {
      reportStorageFailure("SAVE_INVALID");
      return { kind: "invalid" };
    }
  } catch {
    reportStorageFailure("SAVE_UNAVAILABLE");
    return { kind: "unavailable" };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
