import type { Page } from "@playwright/test";
import { test, expect } from "./support/app";

type LaneTile = { id: string; left: number; lane: number };

type Snapshot = {
  slots: Array<string | null>;
  attempts: number;
  elapsed_ms: number;
};

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const value = localStorage.getItem("drag-into-place:v1:browser-fixture:english");
    if (!value) throw new Error("The application did not persist its puzzle snapshot");
    return JSON.parse(value) as Snapshot;
  });
}

async function readLaneTiles(page: Page): Promise<LaneTile[]> {
  return page.locator(".moving-lane").evaluateAll((lanes) => lanes.flatMap((lane, index) =>
    [...lane.querySelectorAll<HTMLElement>(".tile[data-tile-id]")].map((tile) => ({
      id: tile.dataset.tileId ?? "",
      left: Number.parseFloat(tile.style.left) || 0,
      lane: index,
    })),
  ));
}

async function setVisible(page: Page, visible: boolean): Promise<void> {
  await page.evaluate((isVisible) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: isVisible ? "visible" : "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, visible);
}

test.describe("stage 4: movement and pause behavior", () => {
  test("T-11 moves and recycles all 12 target/foil tiles within the queue bound", async ({ app, page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await app.launch({
      fixture: "F-03",
      audio: "mock",
      clock: true,
      savedProgress: {
        schema_version: 1,
        content_version: "1.0.0",
        tier: "great",
        level_id: 2,
        slots: Array(8).fill(null),
        removedFoilIds: [],
        revealedHints: [],
        attempts: 0,
        phase: "playing",
        completion_recorded: false,
        elapsed_ms: 0,
        occurrence_counter: 2,
        cycleIds: [1, 2],
        currentCycleIndex: 1,
      },
    });
    await page.getByRole("button", { name: "Let's spell!" }).click();
    await page.clock.runFor(250);

    const initial = await readLaneTiles(page);
    expect(initial.slice(0, 2).map(({ lane }) => lane)).toEqual([0, 1]);
    expect(initial.length).toBeGreaterThanOrEqual(2);
    expect(new Set(initial.map(({ id }) => id)).size).toBe(initial.length);
    const laneWidth = await page.locator(".moving-lanes").evaluate((element) => element.clientWidth);
    const firstId = initial[0].id;
    const initialFirst = initial[0];
    if (!initialFirst) throw new Error("The first target letter did not enter its lane");

    await page.clock.runFor(1_000);
    const moved = await readLaneTiles(page);
    const movedFirst = moved.find(({ id }) => id === firstId);
    if (!movedFirst) throw new Error("The first target letter left its lane unexpectedly");
    const expectedDistance = (laneWidth + 52) / 8;
    expect(movedFirst.left - initialFirst.left).toBeGreaterThan(expectedDistance - 4);
    expect(movedFirst.left - initialFirst.left).toBeLessThan(expectedDistance + 4);

    for (const lane of [0, 1]) {
      const positions = moved.filter((tile) => tile.lane === lane).map(({ left }) => left).sort((a, b) => a - b);
      for (let index = 1; index < positions.length; index += 1) {
        expect(positions[index] - positions[index - 1]).toBeGreaterThanOrEqual(60);
      }
    }

    const ids = [...Array.from({ length: 8 }, (_, index) => `t:${index}`), ...Array.from({ length: 4 }, (_, index) => `f:${index}`)];
    const appearances = new Map(ids.map((id) => [id, 0]));
    let present = new Set(moved.map(({ id }) => id));
    for (const id of present) appearances.set(id, 1);
    for (let elapsed = 0; elapsed < 30_000; elapsed += 250) {
      await page.clock.runFor(250);
      const current = await readLaneTiles(page);
      const currentIds = current.map(({ id }) => id);
      expect(new Set(currentIds).size).toBe(currentIds.length);
      for (const id of currentIds) {
        if (!present.has(id)) appearances.set(id, (appearances.get(id) ?? 0) + 1);
      }
      present = new Set(currentIds);
    }
    expect([...appearances].filter(([, count]) => count < 2)).toEqual([]);
  });

  test("T-12 manual pause freezes lane positions, excludes paused time, and blocks drops", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", clock: true });
    await page.getByRole("button", { name: "Let's spell!" }).click();
    await page.clock.runFor(1_000);
    const initial = await readLaneTiles(page);
    const selectedId = initial[0]?.id;
    const pausedId = initial.find(({ id }) => id !== selectedId)?.id;
    const wrongId = selectedId === "t:0" ? pausedId : selectedId;
    if (!selectedId || !pausedId || !wrongId) throw new Error("The moving lanes did not start");
    const first = page.locator(`.moving-lane .tile[data-tile-id="${selectedId}"]`);
    await expect(first).toBeVisible();
    await first.click();
    await page.clock.runFor(1);
    const selected = page.locator(`.tile[data-tile-id="${selectedId}"]`);
    const otherBeforePause = (await readLaneTiles(page)).find(({ id }) => id === pausedId);
    if (!otherBeforePause) throw new Error("The other moving tile is not in its lane");

    await page.getByRole("button", { name: "Pause motion" }).click();
    await expect(page.getByRole("button", { name: "Space 1 of 3, empty" })).toBeDisabled();
    await page.locator('[data-slot-index="0"]').evaluate((element) => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(await snapshot(page)).toMatchObject({ attempts: 0, slots: [null, null, null] });
    await page.clock.runFor(5_000);
    const otherPaused = (await readLaneTiles(page)).find(({ id }) => id === pausedId);
    if (!otherPaused) throw new Error("The other moving tile disappeared during pause");
    expect(otherPaused.left).toBeCloseTo(otherBeforePause.left, 2);
    expect(await selected.getAttribute("aria-pressed")).toBe("true");

    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await page.clock.runFor(1_000);
    const otherResumed = (await readLaneTiles(page)).find(({ id }) => id === pausedId);
    if (!otherResumed) throw new Error("The other moving tile disappeared after resume");
    expect(otherResumed.left).toBeGreaterThan(otherPaused.left);

    if (wrongId !== selectedId) {
      await selected.click();
      await page.clock.runFor(1);
      await page.locator(`.tile[data-tile-id="${wrongId}"]`).click();
      await page.clock.runFor(1);
    }
    await page.locator('[data-slot-index="0"]').click();
    await page.clock.runFor(301);
    expect((await snapshot(page)).elapsed_ms).toBeLessThan(3_000);
    expect(await snapshot(page)).toMatchObject({ attempts: 1, slots: [null, null, null] });
  });

  test("T-12 keyboard focus pauses motion and pointer input clears only that pause", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", clock: true });
    await page.getByRole("button", { name: "Let's spell!" }).click();
    await page.clock.runFor(250);
    const initial = await readLaneTiles(page);
    const firstId = initial[0]?.id;
    const otherId = initial[1]?.id;
    if (!firstId || !otherId) throw new Error("The moving lanes did not start");
    const first = page.locator(`.moving-lane .tile[data-tile-id="${firstId}"]`);
    const other = page.locator(`.moving-lane .tile[data-tile-id="${otherId}"]`);
    await page.locator(".playfield .sound-toggle").focus();
    await page.keyboard.press("Tab");
    await expect(first).toBeFocused();
    await expect(page.getByText("Motion paused for keyboard access.", { exact: true })).toBeVisible();
    const before = (await readLaneTiles(page)).find(({ id }) => id === otherId);
    if (!before) throw new Error("The second moving tile is not in its lane");
    await page.clock.runFor(1_000);
    const paused = (await readLaneTiles(page)).find(({ id }) => id === otherId);
    if (!paused) throw new Error("The second moving tile disappeared during keyboard pause");
    expect(paused.left).toBeCloseTo(before.left, 2);

    const firstBeforePointer = (await readLaneTiles(page)).find(({ id }) => id === firstId);
    if (!firstBeforePointer) throw new Error("The focused moving tile disappeared");
    const otherBox = await other.boundingBox();
    if (!otherBox) throw new Error("Could not measure the second target tile");
    await page.mouse.click(otherBox.x + 26, otherBox.y + 26);
    await page.clock.runFor(100);
    await expect(page.getByText("Motion paused for keyboard access.", { exact: true })).toHaveCount(0);
    const resumed = (await readLaneTiles(page)).find(({ id }) => id === firstId);
    if (!resumed) throw new Error("The first moving tile disappeared after pointer input");
    expect(resumed.left).toBeGreaterThan(firstBeforePointer.left);
  });

  test("T-12 hidden-page pause suspends feedback timers and audio, then resumes them", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", clock: true });
    await page.getByRole("button", { name: "Let's spell!" }).click();
    await page.locator('.tile[data-tile-id="t:1"]').click();
    await page.clock.runFor(1);
    await page.locator('[data-slot-index="0"]').click();
    await expect.poll(() => page.evaluate(() =>
      window.__browserHarness.events.some((event) => event.type === "play" && event.path.endsWith("incorrect.wav")),
    )).toBe(true);
    await setVisible(page, false);
    await page.clock.runFor(1_000);

    const hiddenAudio = await page.evaluate(() => window.__browserHarness.events
      .filter((event) => event.path.endsWith("incorrect.wav"))
      .map((event) => event.type));
    expect(hiddenAudio).toContain("pause");
    expect(hiddenAudio).not.toContain("ended");
    await expect(page.locator(".tile:not(:disabled)")).toHaveCount(0);

    await setVisible(page, true);
    await page.clock.runFor(301);
    await expect(page.locator(".tile:not(:disabled)")).not.toHaveCount(0);
    const resumedAudio = await page.evaluate(() => window.__browserHarness.events
      .filter((event) => event.path.endsWith("incorrect.wav"))
      .map((event) => event.type));
    expect(resumedAudio.filter((event) => event === "play")).toHaveLength(2);
    expect(resumedAudio).toContain("ended");
  });

  test("T-12 hidden and manual pause reasons compose without background movement", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", clock: true });
    await page.getByRole("button", { name: "Let's spell!" }).click();
    await page.clock.runFor(500);
    const firstId = (await readLaneTiles(page))[0]?.id;
    if (!firstId) throw new Error("The first moving tile did not spawn");
    const first = page.locator(`.moving-lane .tile[data-tile-id="${firstId}"]`);
    await expect(first).toBeVisible();
    const before = await readLaneTiles(page);

    await page.getByRole("button", { name: "Pause motion" }).click();
    await setVisible(page, false);
    await page.getByRole("button", { name: "Resume", exact: true }).evaluate((button) => {
      (button as HTMLButtonElement).click();
    });
    await page.clock.runFor(1_000);
    const stillHidden = await readLaneTiles(page);
    expect(stillHidden.map(({ id, left }) => [id, left])).toEqual(before.map(({ id, left }) => [id, left]));

    await setVisible(page, true);
    await page.clock.runFor(500);
    const resumed = await readLaneTiles(page);
    const beforeFirst = before.find(({ id }) => id === firstId);
    const resumedFirst = resumed.find(({ id }) => id === firstId);
    if (!beforeFirst || !resumedFirst) throw new Error("The first moving tile is missing after resume");
    expect(resumedFirst.left).toBeGreaterThan(beforeFirst.left);
  });
});
