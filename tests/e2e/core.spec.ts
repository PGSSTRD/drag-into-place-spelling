import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/app";
import {
  acceptanceViewports,
  contentFixtures,
  invalidContentFixtures,
  unsafePathFixtures,
} from "../fixtures/browser-content";

type Snapshot = {
  level_id: number;
  slots: Array<string | null>;
  attempts: number;
  phase: string;
  cycleIds: number[];
  currentCycleIndex: number;
  removedFoilIds: string[];
  revealedHints: number[];
};

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const value = localStorage.getItem("drag-into-place:v1:browser-fixture:english");
    if (!value) throw new Error("The application did not persist its puzzle snapshot");
    return JSON.parse(value) as Snapshot;
  });
}

async function rejectCurrentPack(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Try loading again" })).toBeVisible();
  await expect(page.getByText("Try again. Error code: CONTENT_INVALID", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Let's spell!" })).toHaveCount(0);
  await expect(page.locator(".slot")).toHaveCount(0);
}

async function start(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Let's spell!" }).click();
}

async function placeLetter(
  page: Page,
  letter: string,
  slotIndex: number,
  feedbackMs = 301,
): Promise<void> {
  await page.getByRole("button", { name: `Letter ${letter}`, exact: true }).first().click();
  await page.clock.runFor(1);
  await page.locator(`[data-slot-index="${slotIndex}"]`).click();
  await page.clock.runFor(feedbackMs);
}

async function completePuzzle(
  page: Page,
  word: string,
): Promise<void> {
  for (let index = 0; index < word.length; index += 1) {
    const feedbackMs = index === word.length - 1 ? 1301 : 301;
    await placeLetter(page, word[index].toUpperCase(), index, feedbackMs);
  }
  await expect.poll(async () => {
    const current = await snapshot(page);
    return current.attempts === 0 && current.slots.every((slot) => slot === null);
  }).toBe(true);
}

async function moveTileToSlot(
  page: Page,
  tile: Locator,
  slotIndex: number,
): Promise<void> {
  const tileBox = await tile.boundingBox();
  const slotBox = await page.locator(`[data-slot-index="${slotIndex}"]`).boundingBox();
  if (!tileBox || !slotBox) throw new Error("Could not measure the tile and answer slot");
  await page.mouse.move(tileBox.x + tileBox.width / 2, tileBox.y + tileBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2, { steps: 3 });
  await page.mouse.up();
}

test.describe("stage 2: content validation and core spelling", () => {
  test("T-01 rejects every invalid content and path fixture without a playable partial pack", async ({ app, page }) => {
    const variants = [...invalidContentFixtures, ...unsafePathFixtures];
    await app.launch({ rawContent: JSON.stringify(variants[0].value), audio: "mock" });
    await rejectCurrentPack(page);

    for (const variant of variants.slice(1)) {
      await writeFile(
        resolve(app.root, "lang", "english", "levels.json"),
        JSON.stringify(variant.value),
      );
      await page.reload();
      await rejectCurrentPack(page);
    }
  });

  test("T-01 loads the authored F-11 pack and rendered local image", async ({ app, page }) => {
    await app.launch({ fixture: "F-11", audio: "mock", reducedMotion: "reduce" });
    await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
    const pack = JSON.parse(await readFile(resolve(app.root, "lang", "english", "levels.json"), "utf8")) as {
      levels: Array<{ image_alt: string; level_id: number }>;
    };
    const currentId = (await snapshot(page)).level_id;
    const level = pack.levels.find((entry) => entry.level_id === currentId);
    if (!level) throw new Error(`Missing rendered F-11 level ${currentId}`);
    const image = page.getByRole("img", { name: level.image_alt });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  });

  test("T-02 presents all 12 F-03 tiles inside the pool across the required viewports", async ({ app, page }) => {
    const maximumPack = structuredClone(contentFixtures["F-03"]);
    maximumPack.levels = [maximumPack.levels[1]];
    await app.launch({ fixture: "F-03", content: maximumPack, audio: "mock", reducedMotion: "reduce" });
    await start(page);
    await expect(page.getByRole("img", { name: "Synthetic test picture for elephant" })).toBeVisible();
    await expect(page.locator(".tile-pool .tile")).toHaveCount(12);
    await expect(page.locator(".slot")).toHaveCount(8);

    for (const viewport of acceptanceViewports) {
      await page.setViewportSize(viewport);
      const layout = await page.evaluate(() => {
        const pool = document.querySelector<HTMLElement>(".tile-pool")?.getBoundingClientRect();
        const playfield = document.querySelector<HTMLElement>(".playfield")?.getBoundingClientRect();
        const tiles = [...document.querySelectorAll<HTMLElement>(".tile-pool .tile")]
          .map((tile) => tile.getBoundingClientRect());
        if (!pool || !playfield) throw new Error("The tile pool or playfield is missing");
        return {
          viewportWidth: innerWidth,
          pool: { left: pool.left, right: pool.right, top: pool.top, bottom: pool.bottom },
          playfield: { left: playfield.left, right: playfield.right },
          tiles: tiles.map((tile) => ({
            left: tile.left, right: tile.right, top: tile.top, bottom: tile.bottom,
          })),
        };
      });
      expect(layout.tiles).toHaveLength(12);
      expect(layout.pool.left).toBeGreaterThanOrEqual(0);
      expect(layout.pool.right).toBeLessThanOrEqual(layout.viewportWidth);
      for (const tile of layout.tiles) {
        expect(tile.left).toBeGreaterThanOrEqual(layout.pool.left);
        expect(tile.right).toBeLessThanOrEqual(layout.pool.right);
        expect(tile.top).toBeGreaterThanOrEqual(layout.pool.top);
        expect(tile.bottom).toBeLessThanOrEqual(layout.pool.bottom);
      }
      for (let left = 0; left < layout.tiles.length; left += 1) {
        for (let right = left + 1; right < layout.tiles.length; right += 1) {
          const first = layout.tiles[left];
          const second = layout.tiles[right];
          expect(
            first.right <= second.left || second.right <= first.left ||
              first.bottom <= second.top || second.bottom <= first.top,
            `Tiles ${left} and ${right} overlap at ${viewport.width}x${viewport.height}`,
          ).toBe(true);
        }
      }
    }
  });

  test("T-03 locks a mouse-dragged correct tile once and plays its destination cue", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", clock: true });
    await start(page);
    await moveTileToSlot(page, page.locator('.tile[data-tile-id="t:0"]'), 0);
    await expect(page.getByRole("button", { name: "Space 1 of 3, C, locked" })).toBeDisabled();
    expect(await snapshot(page)).toMatchObject({ attempts: 1, slots: ["t:0", null, null] });
    await expect(page.locator('.tile[data-tile-id="t:0"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.__browserHarness.events
      .filter((event) => event.type === "play")
      .map((event) => event.path))).toContainEqual(expect.stringMatching(/cat-0\.wav$/));
  });

  test("T-03 accepts correct tap-select/place and keyboard placement", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", clock: true });
    const startButton = page.getByRole("button", { name: "Let's spell!" });
    await startButton.focus();
    await page.keyboard.press("Enter");
    const cTile = page.locator('.tile[data-tile-id="t:0"]');
    await cTile.focus();
    await page.keyboard.press("Enter");
    await expect(cTile).toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-slot-index="0"]').focus();
    await page.keyboard.press("Enter");
    await page.clock.runFor(301);
    await expect(page.getByRole("button", { name: "Space 1 of 3, C, locked" })).toBeDisabled();
    expect(await snapshot(page)).toMatchObject({ attempts: 1, slots: ["t:0", null, null] });

    await page.locator('.tile[data-tile-id="t:1"]').click();
    await page.clock.runFor(1);
    await page.locator('[data-slot-index="1"]').click();
    await page.clock.runFor(301);
    await expect(page.getByRole("button", { name: "Space 2 of 3, A, locked" })).toBeDisabled();
  });

  test.describe("touch input", () => {
    test.use({ hasTouch: true, viewport: { width: 320, height: 568 } });

    test("T-03 places a correct tile with touch taps", async ({ app, page }) => {
      await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", clock: true });
      await page.getByRole("button", { name: "Let's spell!" }).tap();
      await page.locator('.tile[data-tile-id="t:0"]').tap();
      await page.clock.runFor(1);
      await page.locator('[data-slot-index="0"]').tap();
      await page.clock.runFor(301);
      await expect(page.getByRole("button", { name: "Space 1 of 3, C, locked" })).toBeDisabled();
      expect(await snapshot(page)).toMatchObject({ attempts: 1, slots: ["t:0", null, null] });
    });
  });

  test("T-04 keeps a wrong target available and does not reveal a hint", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", clock: true });
    await start(page);
    await page.getByRole("button", { name: "Letter A", exact: true }).click();
    await page.clock.runFor(1);
    await page.locator('[data-slot-index="0"]').click();
    await page.clock.runFor(301);
    await expect(page.getByText("Try another space.")).toBeVisible();
    await expect(page.locator(".hint.visible")).toHaveCount(0);
    await expect(page.locator('.tile[data-tile-id="t:1"]')).toBeVisible();
    expect(await snapshot(page)).toMatchObject({ attempts: 1, slots: [null, null, null], removedFoilIds: [] });
    expect(await page.evaluate(() => window.__browserHarness.events
      .filter((event) => event.type === "play")
      .map((event) => event.path))).toContainEqual(expect.stringMatching(/incorrect\.wav$/));
  });

  test("T-05 treats Escape, outside drops and occupied-slot drops as neutral", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", clock: true });
    await start(page);
    const bTile = page.locator('.tile[data-tile-id="f:0"]');
    await bTile.click();
    await expect(bTile).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(bTile).toHaveAttribute("aria-pressed", "false");
    expect(await snapshot(page)).toMatchObject({ attempts: 0, slots: [null, null, null] });

    await moveTileToSlot(page, page.locator('.tile[data-tile-id="t:0"]'), 0);
    await page.clock.runFor(301);
    const aTile = page.locator('.tile[data-tile-id="t:1"]');
    const aBox = await aTile.boundingBox();
    const playfield = await page.locator(".playfield").boundingBox();
    if (!aBox || !playfield) throw new Error("Could not measure the tile and playfield");
    await page.mouse.move(aBox.x + aBox.width / 2, aBox.y + aBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(playfield.x + 10, playfield.y + playfield.height - 10, { steps: 3 });
    await page.mouse.up();
    await page.clock.runFor(1);
    expect(await snapshot(page)).toMatchObject({ attempts: 1, slots: ["t:0", null, null] });
    await expect(aTile).toBeVisible();

    await moveTileToSlot(page, aTile, 0);
    await page.clock.runFor(1);
    expect(await snapshot(page)).toMatchObject({ attempts: 1, slots: ["t:0", null, null] });
    await expect(aTile).toBeVisible();
    expect(await page.evaluate(() => window.__browserHarness.events
      .filter((event) => event.type === "play").length)).toBe(1);
  });

  test("T-06 swaps distinct BOOK O tiles and uses destination-index audio", async ({ app, page }) => {
    await app.launch({ fixture: "F-02", audio: "mock", reducedMotion: "reduce", clock: true });
    await start(page);
    for (const [tileId, slotIndex] of [["t:0", 0], ["t:2", 1], ["t:1", 2], ["t:3", 3]] as const) {
      await page.locator(`.tile[data-tile-id="${tileId}"]`).click();
      await page.clock.runFor(1);
      await page.locator(`[data-slot-index="${slotIndex}"]`).click();
      await page.clock.runFor(301);
    }
    expect(await snapshot(page)).toMatchObject({
      attempts: 4,
      phase: "completing",
      slots: ["t:0", "t:2", "t:1", "t:3"],
    });
    await page.clock.runFor(1000);
    await expect(page.locator(".slot:not(.locked)")).toHaveCount(4);
    const finalSnapshot = await snapshot(page);
    expect(finalSnapshot).toMatchObject({
      attempts: 0,
      phase: "playing",
      slots: [null, null, null, null],
    });
    const mediaPaths = await page.evaluate(() => window.__browserHarness.events
      .filter((event) => event.type === "play")
      .map((event) => event.path));
    const finalLetterCue = mediaPaths.findIndex((path) => path.endsWith("book-3.wav"));
    const wordCue = mediaPaths.findIndex((path) => path.endsWith("book.wav"));
    expect(mediaPaths.filter((path) => /book-[0-3]\.wav$/.test(path))
      .map((path) => path.match(/book-[0-3]\.wav$/)?.[0]))
      .toEqual(["book-0.wav", "book-1.wav", "book-2.wav", "book-3.wav"]);
    expect(finalLetterCue).toBeGreaterThanOrEqual(0);
    expect(wordCue).toBeGreaterThan(finalLetterCue);
    expect(mediaPaths.filter((path) => path.endsWith("book.wav"))).toHaveLength(1);
  });

  test("T-07 completes once, orders the final letter before the word, and advances", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", clock: true });
    await start(page);
    await completePuzzle(page, "cat");
    const mediaPaths = await page.evaluate(() => window.__browserHarness.events
      .filter((event) => event.type === "play")
      .map((event) => event.path));
    const finalLetterCue = mediaPaths.findIndex((path) => path.endsWith("cat-2.wav"));
    const wordCue = mediaPaths.findIndex((path) => path.endsWith("cat.wav"));
    expect(finalLetterCue).toBeGreaterThanOrEqual(0);
    expect(wordCue).toBeGreaterThan(finalLetterCue);
    expect(mediaPaths.filter((path) => path.endsWith("cat.wav"))).toHaveLength(1);
    expect(await snapshot(page)).toMatchObject({
      attempts: 0,
      slots: [null, null, null],
      phase: "playing",
    });
  });

  test("T-08 completes two seeded F-04 cycles without a boundary repeat", async ({ app, page }) => {
    await app.launch({ fixture: "F-04-cycle", audio: "mock", reducedMotion: "reduce", clock: true });
    await start(page);
    const cycleOrders: number[][] = [[], []];
    const cycleIds: number[][] = [];

    for (let occurrence = 0; occurrence < 6; occurrence += 1) {
      const current = await snapshot(page);
      const cycleIndex = occurrence % 3;
      const cycleNumber = Math.floor(occurrence / 3);
      expect(current.currentCycleIndex).toBe(cycleIndex);
      expect(current.cycleIds[current.currentCycleIndex]).toBe(current.level_id);
      cycleOrders[cycleNumber].push(current.level_id);
      cycleIds[cycleNumber] = current.cycleIds;
      const level = contentFixtures["F-04-cycle"].levels.find((entry) => entry.level_id === current.level_id);
      if (!level) throw new Error(`Missing F-04 level ${current.level_id}`);
      await completePuzzle(page, level.target_word);
    }

    for (let index = 0; index < 2; index += 1) {
      expect([...cycleOrders[index]].sort()).toEqual([1, 2, 3]);
      expect(new Set(cycleIds[index]).size).toBe(3);
    }
    expect(cycleOrders[0][2]).not.toBe(cycleOrders[1][0]);

  });

  test("T-08 reaches every authored F-11 level once in each seeded cycle", async ({ app, page }) => {
    await app.launch({ fixture: "F-11", audio: "mock", reducedMotion: "reduce", clock: true });
    const pack = JSON.parse(await readFile(resolve(app.root, "lang", "english", "levels.json"), "utf8")) as {
      levels: Array<{ level_id: number; target_word: string }>;
    };
    await start(page);
    const levels = pack.levels.map((level) => level.level_id).sort();
    const cycleOrders: number[][] = [[], []];

    for (let occurrence = 0; occurrence < levels.length * 2; occurrence += 1) {
      const current = await snapshot(page);
      const cycleNumber = Math.floor(occurrence / levels.length);
      const cycleIndex = occurrence % levels.length;
      expect(current.currentCycleIndex).toBe(cycleIndex);
      expect(current.cycleIds[current.currentCycleIndex]).toBe(current.level_id);
      cycleOrders[cycleNumber].push(current.level_id);
      const level = pack.levels.find((entry) => entry.level_id === current.level_id);
      if (!level) throw new Error(`Missing F-11 level ${current.level_id}`);
      await completePuzzle(page, level.target_word);
    }

    expect([...cycleOrders[0]].sort()).toEqual(levels);
    expect([...cycleOrders[1]].sort()).toEqual(levels);
    expect(cycleOrders[0][cycleOrders[0].length - 1]).not.toBe(cycleOrders[1][0]);
  });

  test("T-08 replays a one-level pack indefinitely", async ({ app, page }) => {
    await app.launch({ fixture: "F-04-single", audio: "mock", reducedMotion: "reduce", clock: true });
    await start(page);
    await completePuzzle(page, "cat");
    const first = await snapshot(page);
    await completePuzzle(page, "cat");
    const second = await snapshot(page);
    expect(first).toMatchObject({ level_id: 1, currentCycleIndex: 0, cycleIds: [1] });
    expect(second).toMatchObject({ level_id: 1, currentCycleIndex: 0, cycleIds: [1] });
  });

  test("T-09/T-10 removes a foil, reveals one hint, and suppresses it after filling", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", clock: true });
    await start(page);
    await expect(page.locator(".tile-pool .tile")).toHaveCount(5);
    expect(await page.locator(".tile").evaluateAll((tiles) => new Set(tiles.map((tile) => tile.className)).size)).toBe(1);
    const tileStyles = await page.locator(".tile").evaluateAll((tiles) => tiles.map((tile) => {
      const style = getComputedStyle(tile);
      return [style.backgroundColor, style.borderColor, style.color].join("|");
    }));
    expect(new Set(tileStyles).size).toBe(1);

    await page.locator('.tile[data-tile-id="f:0"]').click();
    await page.clock.runFor(1);
    await page.locator('[data-slot-index="1"]').click();
    await page.clock.runFor(251);
    await expect(page.locator('[data-slot-index="1"]')).toHaveAttribute("aria-label", "Space 2 of 3, empty");
    const hint = page.locator(".hint.visible");
    await expect(hint).toHaveCount(1);
    await expect(hint).toHaveAttribute("aria-label", "Hint for space 2: A");
    expect(await snapshot(page)).toMatchObject({
      attempts: 1,
      removedFoilIds: ["f:0"],
      revealedHints: [1],
    });
    await expect(page.locator(".tile-pool .tile")).toHaveCount(4);

    await page.locator('.tile[data-tile-id="t:1"]').click();
    await page.clock.runFor(1);
    await page.locator('[data-slot-index="1"]').click();
    await page.clock.runFor(301);
    await expect(page.locator(".hint.visible")).toHaveCount(0);
    expect(await snapshot(page)).toMatchObject({ revealedHints: [1], slots: [null, "t:1", null] });
  });

  test("T-01 keeps the authored F-11 content separate from synthetic fixtures", async ({ app, page }) => {
    await app.launch({ fixture: "F-11", audio: "mock", reducedMotion: "reduce" });
    await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
    expect(await page.locator(".slot").count()).toBeGreaterThan(0);
    expect(JSON.parse(await readFile(resolve(app.root, "lang", "english", "levels.json"), "utf8"))).toMatchObject({
      content_version: "1.4.1",
      levels: expect.arrayContaining([expect.objectContaining({ level_id: 1, target_word: "cat" })]),
    });
  });
});
