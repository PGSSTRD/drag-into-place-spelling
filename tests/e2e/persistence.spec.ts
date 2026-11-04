import { test, expect } from "./support/app";
import { contentFixtures, snapshotFixture } from "../fixtures/browser-content";

type Snapshot = {
  schema_version: number;
  content_version: string;
  level_id: number;
  slots: Array<string | null>;
  removedFoilIds: string[];
  revealedHints: number[];
  attempts: number;
  phase: string;
  completion_recorded: boolean;
  elapsed_ms: number;
  occurrence_counter: number;
  cycleIds: number[];
  currentCycleIndex: number;
};

const storageKey = (userId = "browser-fixture") =>
  `drag-into-place:v1:${encodeURIComponent(userId)}:english`;

async function snapshot(page: import("@playwright/test").Page, userId?: string): Promise<Snapshot> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error("The application did not persist its puzzle snapshot");
    return JSON.parse(raw) as Snapshot;
  }, storageKey(userId));
}

async function placeTile(
  page: import("@playwright/test").Page,
  tileId: string,
  slotIndex: number,
  feedbackMs = 301,
): Promise<void> {
  await page.locator(`.tile[data-tile-id="${tileId}"]`).click();
  await page.clock.runFor(1);
  await page.locator(`[data-slot-index="${slotIndex}"]`).click();
  await page.clock.runFor(feedbackMs);
}

async function completeCurrentPuzzle(
  page: import("@playwright/test").Page,
  word: string,
): Promise<void> {
  for (let index = 0; index < word.length; index += 1) {
    await placeTile(page, `t:${index}`, index, index === word.length - 1 ? 1301 : 301);
  }
}

test.describe("stage 5: persistence and progression", () => {
  test("T-13 restores wrong, correct, duplicate-letter and foil outcomes without positions", async ({ app, page }) => {
    await app.launch({ fixture: "F-02", audio: "mock", reducedMotion: "reduce", clock: true });
    await page.getByRole("button", { name: "Let's spell!" }).click();

    await page.clock.runFor(2500);
    await placeTile(page, "t:1", 0);
    expect(await snapshot(page)).toMatchObject({
      slots: [null, null, null, null],
      attempts: 1,
      phase: "playing",
      elapsed_ms: expect.any(Number),
    });
    expect((await snapshot(page)).elapsed_ms).toBeGreaterThan(0);

    await page.reload();
    await expect(page.getByRole("button", { name: "Keep going!" })).toBeVisible();
    const afterWrong = await snapshot(page);
    expect(afterWrong).toMatchObject({ slots: [null, null, null, null], attempts: 1 });
    const initialIds = await page.locator(".tile").evaluateAll((tiles) =>
      tiles.map((tile) => (tile as HTMLElement).dataset.tileId));
    expect(initialIds).toHaveLength(6);
    expect(new Set(initialIds).size).toBe(initialIds.length);
    await page.getByRole("button", { name: "Keep going!" }).click();

    await placeTile(page, "t:0", 0);
    await placeTile(page, "t:2", 1);
    await placeTile(page, "f:0", 2);
    expect(await snapshot(page)).toMatchObject({
      slots: ["t:0", "t:2", null, null],
      removedFoilIds: ["f:0"],
      revealedHints: [2],
      attempts: 4,
      occurrence_counter: 1,
    });

    await page.reload();
    await expect(page.getByRole("button", { name: "Keep going!" })).toBeVisible();
    const restored = await snapshot(page);
    expect(restored).toMatchObject({
      slots: ["t:0", "t:2", null, null],
      removedFoilIds: ["f:0"],
      revealedHints: [2],
      attempts: 4,
    });
    expect(await page.locator('.tile[data-tile-id="t:0"]').count()).toBe(0);
    expect(await page.locator('.tile[data-tile-id="t:2"]').count()).toBe(0);
    expect(await page.locator('.tile[data-tile-id="f:0"]').count()).toBe(0);
    const restoredIds = await page.locator(".tile").evaluateAll((tiles) =>
      tiles.map((tile) => (tile as HTMLElement).dataset.tileId));
    expect(new Set(restoredIds).size).toBe(restoredIds.length);
    expect(restoredIds).toContain("t:1");
    expect(Object.keys(restored)).not.toContain("movement");
    expect(Object.keys(restored)).not.toContain("positions");
  });

  test("T-14 isolates progress and mute settings by user", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", clock: true });
    await page.getByRole("button", { name: "Sound on" }).click();
    await page.getByRole("button", { name: "Let's spell!" }).click();
    await placeTile(page, "t:0", 0);
    expect(await snapshot(page)).toMatchObject({ slots: ["t:0", null, null] });

    const otherUser = new URL(app.url);
    otherUser.searchParams.set("cr_user_id", "another-learner");
    await page.goto(otherUser.href);
    await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sound on" })).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), storageKey("another-learner"))).toBeTruthy();

    await page.goto(app.url);
    await expect(page.getByRole("button", { name: "Keep going!" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sound off" })).toBeVisible();
    expect(await snapshot(page)).toMatchObject({ slots: ["t:0", null, null] });
  });

  test("T-14 rejects stale snapshots, preserves valid settings and reports a fresh puzzle", async ({ app, page }) => {
    await app.launch({
      fixture: "F-01",
      audio: "mock",
      reducedMotion: "reduce",
      savedProgress: snapshotFixture("stale"),
      savedMute: true,
    });
    await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sound off" })).toBeVisible();
    await expect(page.getByText("Let's start a new puzzle.", { exact: true })).toBeVisible();
    const reset = await snapshot(page);
    expect(reset).toMatchObject({
      content_version: "1.0.0",
      slots: [null, null, null],
      attempts: 0,
      occurrence_counter: 1,
    });
    expect(await page.evaluate((key) => localStorage.getItem(key), `${storageKey()}:settings`))
      .toBe(JSON.stringify({ muted: true }));
  });

  test("T-14 diagnoses malformed saved JSON", async ({ app, page }) => {
    const diagnostics: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning") diagnostics.push(message.text());
    });
    await app.launch({
      fixture: "F-01",
      audio: "mock",
      reducedMotion: "reduce",
      savedProgress: "{broken",
    });
    await expect(page.getByText("Let's start a new puzzle.", { exact: true })).toBeVisible();
    expect(diagnostics).toContain("SAVE_INVALID");
  });

  test("T-14 rejects a structurally invalid JSON null snapshot", async ({ app, page }) => {
    const diagnostics: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning") diagnostics.push(message.text());
    });
    await app.launch({
      fixture: "F-01",
      audio: "mock",
      reducedMotion: "reduce",
      savedProgress: "null",
    });
    await expect(page.getByText("Let's start a new puzzle.", { exact: true })).toBeVisible();
    expect(diagnostics).toContain("SAVE_INVALID");
  });

  test("T-14 remains playable when storage reads are denied", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", storage: "read-denied" });
    await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
    await expect(page.getByText("You can play, but your progress can't be saved.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Let's spell!" }).click();
    await placeTile(page, "t:0", 0);
    await expect(page.getByRole("button", { name: "Space 1 of 3, C, locked" })).toBeDisabled();
  });

  test("T-14 remains playable and never claims saves succeeded when writes are denied", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", storage: "write-denied" });
    await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
    await expect(page.getByText("You can play, but your progress can't be saved.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Let's spell!" }).click();
    await placeTile(page, "t:0", 0);
    await expect(page.getByRole("button", { name: "Space 1 of 3, C, locked" })).toBeDisabled();
    await expect(page.getByText("You can play, but your progress can't be saved.", { exact: true })).toBeVisible();
  });

  test("T-15 advances a saved completion marker without posting a duplicate completion", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", bridge: "recording", reducedMotion: "reduce", clock: true });
    await page.getByRole("button", { name: "Let's spell!" }).click();
    await placeTile(page, "t:0", 0);
    await placeTile(page, "t:1", 1);
    await page.locator('.tile[data-tile-id="t:2"]').click();
    await page.clock.runFor(1);
    await page.locator('[data-slot-index="2"]').click();
    await page.clock.runFor(1);
    expect(await snapshot(page)).toMatchObject({
      slots: ["t:0", "t:1", "t:2"],
      phase: "completed_pending_advance",
      completion_recorded: true,
      occurrence_counter: 1,
    });
    const completionCount = await page.evaluate(() => window.__browserHarness.messages
      .map((message) => JSON.parse(message) as { payload?: { data?: { type?: string } } })
      .filter((message) => message.payload?.data?.type === "level_completed").length);
    expect(completionCount).toBe(1);

    await page.reload();
    await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
    expect(await snapshot(page)).toMatchObject({
      slots: [null, null, null],
      phase: "playing",
      completion_recorded: false,
      occurrence_counter: 2,
      currentCycleIndex: 0,
    });
    expect(await page.evaluate(() => window.__browserHarness.messages
      .map((message) => JSON.parse(message) as { payload?: { data?: { type?: string } } })
      .filter((message) => message.payload?.data?.type === "level_completed"))).toEqual([]);
  });

  test("T-08 completes two F-04 cycles once each without repeating across boundaries", async ({ app, page }) => {
    await app.launch({ fixture: "F-04-cycle", audio: "mock", reducedMotion: "reduce", clock: true });
    await page.getByRole("button", { name: "Let's spell!" }).click();
    const first = await snapshot(page);
    const words = new Map(contentFixtures["F-04-cycle"].levels.map((level) => [level.level_id, level.target_word]));
    const completedIds: number[] = [];

    for (let occurrence = 1; occurrence <= 6; occurrence += 1) {
      const current = await snapshot(page);
      completedIds.push(current.level_id);
      const word = words.get(current.level_id);
      if (!word) throw new Error(`Unknown cycle level ${current.level_id}`);
      await completeCurrentPuzzle(page, word);
      await expect.poll(async () => (await snapshot(page)).occurrence_counter).toBe(occurrence + 1);
    }

    const next = await snapshot(page);
    expect(new Set(completedIds.slice(0, 3))).toEqual(new Set(first.cycleIds));
    expect(new Set(completedIds.slice(3, 6))).toEqual(new Set(first.cycleIds));
    expect(completedIds[3]).not.toBe(completedIds[2]);
    expect(next.cycleIds).toHaveLength(3);
    expect(new Set(next.cycleIds)).toEqual(new Set(first.cycleIds));
    expect(next.currentCycleIndex).toBe(0);
    expect(next.level_id).not.toBe(completedIds[5]);
    expect(next.occurrence_counter).toBe(7);
  });

  test("T-08 replays a one-level cycle indefinitely with increasing occurrences", async ({ app, page }) => {
    await app.launch({ fixture: "F-04-single", audio: "mock", reducedMotion: "reduce", clock: true });
    await page.getByRole("button", { name: "Let's spell!" }).click();
    for (let occurrence = 1; occurrence <= 2; occurrence += 1) {
      await completeCurrentPuzzle(page, "cat");
      await expect.poll(async () => (await snapshot(page)).occurrence_counter).toBe(occurrence + 1);
    }
    expect(await snapshot(page)).toMatchObject({
      level_id: 1,
      currentCycleIndex: 0,
      cycleIds: [1],
      occurrence_counter: 3,
      phase: "playing",
    });
  });
});
