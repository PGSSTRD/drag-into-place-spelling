import { describe, expect, it } from "vitest";
import {
  advanceMovement,
  createMovementState,
  releaseStoppedTile,
  stopMovingTile,
} from "../src/domain/movement";

describe("Great moving tile scheduler", () => {
  it("spawns from the left in alternating lanes and moves right at a fixed speed", () => {
    let state = createMovementState(["t:0", "t:1"]);
    state = advanceMovement(state, 16, 320);
    expect(state.lanes.map(({ id, lane, x }) => [id, lane, x])).toEqual([
      ["t:0", 0, -52],
      ["t:1", 1, -52],
    ]);

    state = advanceMovement(state, 1_000, 320);
    expect(state.lanes[0].x).toBeCloseTo(-5.5);
    expect(state.lanes[1].x).toBeCloseTo(-5.5);
  });

  it("stops an acquired tile and puts cancelled or wrong tiles at the queue tail", () => {
    let state = advanceMovement(createMovementState(["t:0", "f:0", "t:1"]), 16, 320);
    state = stopMovingTile(state, "t:0");
    expect(state.stopped).toEqual({ id: "t:0", lane: 0, x: -52 });
    expect(state.lanes.some(({ id }) => id === "t:0")).toBe(false);
    state = releaseStoppedTile(state, true);
    expect(state.queue).toEqual(["t:1", "t:0"]);
    expect(state.stopped).toBeNull();
  });

  it("recycles an exiting target and never duplicates a live tile", () => {
    let state = advanceMovement(createMovementState(["t:0", "t:1"]), 16, 320);
    for (let index = 0; index < 40; index += 1) {
      state = advanceMovement(state, 1_000, 320);
      const ids = [...state.lanes.map(({ id }) => id), ...state.queue];
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(state.queue.length + state.lanes.length).toBe(2);
  });

  it("recycles all 12 tiles within the Great scheduler's 30-second queue bound", () => {
    for (const width of [320, 568, 768, 1024]) {
      const ids = Array.from({ length: 12 }, (_, index) => `t:${index}`);
      let state = createMovementState(ids);
      let timeMs = 0;
      const lastSpawn = new Map<string, number>();
      const spawnCounts = new Map<string, number>();

      while (timeMs <= 90_000 && [...ids].some((id) => (spawnCounts.get(id) ?? 0) < 2)) {
        state = advanceMovement(state, 50, width);
        timeMs += 50;
        const liveIds = [...state.lanes.map(({ id }) => id), ...state.queue];
        expect(new Set(liveIds).size).toBe(liveIds.length);
        for (const { id, x } of state.lanes) {
          if (x !== -52) continue;
          const previous = lastSpawn.get(id);
          if (previous !== undefined) expect(timeMs - previous).toBeLessThanOrEqual(30_000);
          lastSpawn.set(id, timeMs);
          spawnCounts.set(id, (spawnCounts.get(id) ?? 0) + 1);
        }
      }

      expect([...ids].every((id) => (spawnCounts.get(id) ?? 0) >= 2)).toBe(true);
    }
  });
});
