import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./support/app";

type Snapshot = {
  slots: Array<string | null>;
  attempts: number;
};

type CaptureState = {
  pointerId: number;
  captured: boolean;
  lost: number;
};

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const value = localStorage.getItem("drag-into-place:v1:browser-fixture:english");
    if (!value) throw new Error("The application did not persist its puzzle snapshot");
    return JSON.parse(value) as Snapshot;
  });
}

async function start(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Let's spell!" }).click();
}

async function startByKeyboard(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: "Let's spell!" });
  await button.focus();
  await page.keyboard.press("Enter");
  await page.clock.runFor(1);
}

async function startByTouch(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Let's spell!" }).tap();
}

async function moveMouseToSlot(page: Page, tile: Locator, slotIndex: number): Promise<void> {
  const tileBox = await tile.boundingBox();
  const slotBox = await page.locator(`[data-slot-index="${slotIndex}"]`).boundingBox();
  if (!tileBox || !slotBox) throw new Error("Could not measure the tile and answer slot");
  await page.mouse.move(tileBox.x + tileBox.width / 2, tileBox.y + tileBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2, { steps: 3 });
  await page.mouse.up();
}

async function dispatchTouches(
  page: Page,
  steps: Array<{
    type: "touchStart" | "touchMove" | "touchEnd" | "touchCancel";
    point?: { x: number; y: number };
  }>,
): Promise<void> {
  const session = await page.context().newCDPSession(page);
  try {
    for (const { type, point } of steps) {
      await session.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: point ? [{ ...point, id: 1 }] : [],
      });
    }
  } finally {
    await session.detach();
  }
}

async function focusByTab(page: Page, target: Locator, limit = 20): Promise<void> {
  for (let count = 0; count < limit; count += 1) {
    if (await target.evaluate((element) => document.activeElement === element)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Keyboard navigation did not reach the requested control");
}

async function keyboardPlace(
  page: Page,
  tileId: string,
  slotIndex: number,
  finalFeedbackMs = 301,
): Promise<void> {
  const tile = page.locator(`.tile[data-tile-id="${tileId}"]`);
  const slot = page.locator(`[data-slot-index="${slotIndex}"]`);
  await focusByTab(page, tile);
  await page.keyboard.press("Enter");
  await expect(tile).toHaveAttribute("aria-pressed", "true");
  await focusByTab(page, slot);
  await page.keyboard.press("Enter");
  await page.clock.runFor(finalFeedbackMs);
  await page.clock.runFor(1);
}

async function trackPointerCapture(page: Page): Promise<void> {
  await page.evaluate(() => {
    type CaptureWindow = Window & { __testCapture?: CaptureState };
    const field = document.querySelector<HTMLElement>(".playfield");
    if (!field) throw new Error("Missing spelling playfield");
    const state: CaptureState = { pointerId: -1, captured: false, lost: 0 };
    (window as CaptureWindow).__testCapture = state;
    field.addEventListener("gotpointercapture", (event) => {
      state.pointerId = event.pointerId;
      state.captured = field.hasPointerCapture(event.pointerId);
    });
    field.addEventListener("lostpointercapture", (event) => {
      if (state.pointerId === event.pointerId) {
        state.captured = false;
        state.lost += 1;
      }
    });
  });
}

async function captureState(page: Page): Promise<CaptureState> {
  return page.evaluate(() => {
    type CaptureWindow = Window & { __testCapture?: CaptureState };
    const state = (window as CaptureWindow).__testCapture;
    const field = document.querySelector<HTMLElement>(".playfield");
    if (!state || !field) throw new Error("Pointer capture monitoring was not installed");
    return {
      ...state,
      captured: state.pointerId >= 0 && field.hasPointerCapture(state.pointerId),
    };
  });
}

test.describe("stage 3: pointer, touch, and keyboard interaction", () => {
  test("T-03 locks a mouse-dragged tile and prevents reacquisition", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", clock: true });
    await start(page);
    const tile = page.locator('.tile[data-tile-id="t:0"]');
    await moveMouseToSlot(page, tile, 0);
    await page.clock.runFor(301);

    await expect(page.getByRole("button", { name: "Space 1 of 3, C, locked" })).toBeDisabled();
    await expect(page.locator('.tile[data-tile-id="t:0"]')).toHaveCount(0);
    expect(await snapshot(page)).toMatchObject({
      attempts: 1,
      slots: ["t:0", null, null],
    });
  });

  test.describe("touch emulation", () => {
    test.use({ hasTouch: true, viewport: { width: 568, height: 320 } });

    test("T-03 places and locks a touch-dragged tile", async ({ app, page }) => {
      await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", clock: true });
      await startByTouch(page);
      const tile = page.locator('.tile[data-tile-id="t:0"]');
      const tileBox = await tile.boundingBox();
      const slotBox = await page.locator('[data-slot-index="0"]').boundingBox();
      if (!tileBox || !slotBox) throw new Error("Could not measure touch targets");
      await dispatchTouches(page, [
        {
          type: "touchStart",
          point: { x: tileBox.x + tileBox.width / 2, y: tileBox.y + tileBox.height / 2 },
        },
        {
          type: "touchMove",
          point: { x: slotBox.x + slotBox.width / 2, y: slotBox.y + slotBox.height / 2 },
        },
        { type: "touchEnd" },
      ]);
      await page.clock.runFor(301);

      await expect(page.getByRole("button", { name: "Space 1 of 3, C, locked" })).toBeDisabled();
      expect(await snapshot(page)).toMatchObject({ attempts: 1, slots: ["t:0", null, null] });
    });

    test("T-05 cancels touchcancel without consuming the tile or poisoning the next click", async ({ app, page }) => {
      await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", clock: true });
      await startByTouch(page);
      const tile = page.locator('.tile[data-tile-id="t:0"]');
      const box = await tile.boundingBox();
      if (!box) throw new Error("Could not measure the touch tile");
      await dispatchTouches(page, [
        { type: "touchStart", point: { x: box.x + 26, y: box.y + 26 } },
        { type: "touchMove", point: { x: box.x + 50, y: box.y + 26 } },
        { type: "touchCancel" },
      ]);
      await page.clock.runFor(1);

      await expect(tile).toHaveAttribute("aria-pressed", "false");
      await expect(page.locator(".drag-ghost")).toHaveCount(0);
      expect(await snapshot(page)).toMatchObject({
        attempts: 0,
        slots: [null, null, null],
      });
      await tile.tap();
      await page.clock.runFor(1);
      await page.locator('[data-slot-index="0"]').tap();
      await page.clock.runFor(301);
      expect(await snapshot(page)).toMatchObject({ attempts: 1, slots: ["t:0", null, null] });
    });
  });

  test("T-17 keeps a moving tile captured, applies the drag threshold, and clamps its full bounds", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", clock: true });
    await start(page);
    await page.clock.runFor(2500);
    const tile = page.locator('.moving-lanes .tile[data-tile-id="t:0"]');
    await expect(tile).toBeVisible();
    await trackPointerCapture(page);
    const initial = await tile.boundingBox();
    if (!initial) throw new Error("Could not measure the moving tile");
    const pointerX = initial.x + initial.width - 5;
    const pointerY = initial.y + initial.height / 2;
    await page.mouse.move(pointerX, pointerY);
    await page.mouse.down();
    await page.clock.runFor(400);

    const stopped = await tile.boundingBox();
    if (!stopped) throw new Error("The acquired tile left the playfield");
    expect(stopped.x).toBeCloseTo(initial.x, 0);
    await expect(page.getByText("Motion paused for keyboard access.", { exact: true })).toHaveCount(0);
    expect((await captureState(page)).captured).toBe(true);

    await page.mouse.move(pointerX + 8, pointerY);
    await expect(page.locator(".drag-ghost")).toHaveCount(0);
    await page.mouse.move(pointerX + 9, pointerY);
    await expect(page.locator(".drag-ghost")).toBeVisible();
    expect((await captureState(page)).captured).toBe(true);

    const field = await page.locator(".playfield").boundingBox();
    if (!field) throw new Error("Could not measure the playfield");
    await page.mouse.move(Math.min(field.x + field.width - 1, 767), Math.min(field.y + field.height - 1, 1023));
    const geometry = await page.evaluate(() => {
      const playfield = document.querySelector<HTMLElement>(".playfield")?.getBoundingClientRect();
      const ghost = document.querySelector<HTMLElement>(".drag-ghost")?.getBoundingClientRect();
      if (!playfield || !ghost) throw new Error("Missing playfield or drag preview");
      return { playfield, ghost };
    });
    expect(geometry.ghost.left).toBeGreaterThanOrEqual(geometry.playfield.left);
    expect(geometry.ghost.top).toBeGreaterThanOrEqual(geometry.playfield.top);
    expect(geometry.ghost.right).toBeLessThanOrEqual(geometry.playfield.right);
    expect(geometry.ghost.bottom).toBeLessThanOrEqual(geometry.playfield.bottom);
    await page.mouse.up();
    await page.clock.runFor(1);
    expect(await snapshot(page)).toMatchObject({ attempts: 0, slots: [null, null, null] });
  });

  test("T-17 taps a moving tile to stop it, then drags it to its slot in a later gesture", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", clock: true });
    await start(page);
    await page.clock.runFor(2500);
    const tile = page.locator('.moving-lanes .tile[data-tile-id="t:0"]');
    await expect(tile).toBeVisible();
    const initial = await tile.boundingBox();
    if (!initial) throw new Error("Could not measure the moving tile");
    const offsetX = 44;
    const offsetY = 8;
    await page.mouse.click(initial.x + offsetX, initial.y + offsetY);
    await page.clock.runFor(1);
    await expect(tile).toHaveAttribute("aria-pressed", "true");
    const stopped = await tile.boundingBox();
    if (!stopped) throw new Error("The selected tile left its lane");
    await page.clock.runFor(500);
    const stillStopped = await tile.boundingBox();
    if (!stillStopped) throw new Error("The selected tile left its lane");
    expect(stillStopped.x).toBeCloseTo(stopped.x, 0);
    const laneBounds = await page.locator(".moving-lanes").boundingBox();
    if (!laneBounds) throw new Error("Could not measure the moving lanes");
    expect(stopped.x - 6).toBeGreaterThanOrEqual(laneBounds.x);
    expect(stopped.x + stopped.width + 6).toBeLessThanOrEqual(laneBounds.x + laneBounds.width);
    expect(stopped.y - 6).toBeGreaterThanOrEqual(laneBounds.y);
    expect(stopped.y + stopped.height + 6).toBeLessThanOrEqual(laneBounds.y + laneBounds.height);
    await expect(page.getByText("Motion paused for keyboard access.", { exact: true })).toHaveCount(0);

    const slot = await page.locator('[data-slot-index="0"]').boundingBox();
    if (!slot) throw new Error("Could not measure the answer slot");
    await page.mouse.move(stillStopped.x + offsetX, stillStopped.y + offsetY);
    await page.mouse.down();
    await page.mouse.move(slot.x + slot.width / 2 + offsetX - 26, slot.y + slot.height / 2 + offsetY - 26, { steps: 3 });
    await expect(page.locator(".drag-ghost")).toBeVisible();
    await page.mouse.up();
    await page.clock.runFor(301);
    expect(await snapshot(page)).toMatchObject({ attempts: 1, slots: ["t:0", null, null] });
  });

  test("T-05 cancels on lost pointer capture and accepts a fresh interaction", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", clock: true });
    await start(page);
    await trackPointerCapture(page);
    const tile = page.locator('.tile[data-tile-id="t:0"]');
    const box = await tile.boundingBox();
    if (!box) throw new Error("Could not measure the tile");
    await page.mouse.move(box.x + 26, box.y + 26);
    await page.mouse.down();
    await page.mouse.move(box.x + 50, box.y + 26);
    expect((await captureState(page)).captured).toBe(true);
    await page.evaluate(() => {
      type CaptureWindow = Window & { __testCapture?: CaptureState };
      const state = (window as CaptureWindow).__testCapture;
      const field = document.querySelector<HTMLElement>(".playfield");
      if (!state || !field) throw new Error("Pointer capture was not established");
      field.releasePointerCapture(state.pointerId);
    });
    await page.mouse.move(box.x + 51, box.y + 27);
    await expect.poll(async () => (await captureState(page)).lost).toBeGreaterThan(0);
    await page.mouse.up();
    await page.clock.runFor(1);
    await expect(tile).toHaveAttribute("aria-pressed", "false");
    expect(await snapshot(page)).toMatchObject({ attempts: 0, slots: [null, null, null] });

    await tile.click();
    await page.clock.runFor(1);
    await page.locator('[data-slot-index="0"]').click();
    await page.clock.runFor(301);
    expect(await snapshot(page)).toMatchObject({ attempts: 1, slots: ["t:0", null, null] });
  });

  test("T-05 cancels active input on blur and resize without changing the puzzle", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", clock: true });
    await start(page);
    const tile = page.locator('.tile[data-tile-id="t:0"]');
    for (const reason of ["blur", "resize"] as const) {
      const box = await tile.boundingBox();
      if (!box) throw new Error(`Could not measure the tile before ${reason}`);
      await page.mouse.move(box.x + 26, box.y + 26);
      await page.mouse.down();
      await page.mouse.move(box.x + 50, box.y + 26);
      await expect(page.locator(".drag-ghost")).toBeVisible();
      if (reason === "blur") {
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      } else {
        await page.setViewportSize({ width: 568, height: 320 });
      }
      await page.mouse.up();
      await page.clock.runFor(1);
      await expect(page.locator(".drag-ghost")).toHaveCount(0);
      await expect(tile).toHaveAttribute("aria-pressed", "false");
      expect(await snapshot(page)).toMatchObject({ attempts: 0, slots: [null, null, null] });
      if (reason === "resize") await page.setViewportSize({ width: 768, height: 1024 });
    }
  });

  test("T-18 completes CAT using keyboard navigation and announces a single placement", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", clock: true });
    await startByKeyboard(page);
    await expect(page.locator(".hint")).toHaveCount(3);
    expect(await page.locator(".hint").evaluateAll((hints) =>
      hints.every((hint) => !hint.hasAttribute("aria-label") && hint.textContent?.trim() === ""),
    )).toBe(true);
    await page.evaluate(() => {
      type AnnouncementWindow = Window & { __stage3Announcements?: string[] };
      const status = document.querySelector<HTMLElement>(".status");
      if (!status) throw new Error("Missing live status region");
      const target = window as AnnouncementWindow;
      target.__stage3Announcements = [];
      new MutationObserver(() => target.__stage3Announcements?.push(status.textContent ?? ""))
        .observe(status, { childList: true, characterData: true, subtree: true });
    });

    await keyboardPlace(page, "t:0", 0);
    await expect(page.getByRole("button", { name: "Space 1 of 3, C, locked" })).toBeDisabled();
    await expect(page.locator(".tile:focus")).toHaveCount(1);
    await expect(page.locator('[role="status"][aria-live="polite"]')).toHaveText("Nice work!");
    expect(await page.evaluate(() => {
      type AnnouncementWindow = Window & { __stage3Announcements?: string[] };
      return (window as AnnouncementWindow).__stage3Announcements?.filter((message) => message === "Nice work!");
    })).toEqual(["Nice work!"]);
    await keyboardPlace(page, "t:1", 1);
    await keyboardPlace(page, "t:2", 2, 1301);
    expect(await snapshot(page)).toMatchObject({ attempts: 0, slots: [null, null, null] });
  });

  test.describe("touch-select input", () => {
    test.use({ hasTouch: true, viewport: { width: 320, height: 568 } });

    test("T-18 completes CAT using tap-select/place", async ({ app, page }) => {
      await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", clock: true });
      await startByTouch(page);
      for (let index = 0; index < 3; index += 1) {
        await page.locator(`.tile[data-tile-id="t:${index}"]`).tap();
        await page.clock.runFor(1);
        await page.locator(`[data-slot-index="${index}"]`).tap();
        await page.clock.runFor(index === 2 ? 1301 : 301);
      }
      expect(await snapshot(page)).toMatchObject({ attempts: 0, slots: [null, null, null] });
    });

    test("T-18 completes BOOK with tap-select/place and preserves duplicate tile identities", async ({ app, page }) => {
      await app.launch({ fixture: "F-02", audio: "mock", reducedMotion: "reduce", clock: true });
      await startByTouch(page);
      for (let index = 0; index < 4; index += 1) {
        await page.locator(`.tile[data-tile-id="t:${index}"]`).tap();
        await page.clock.runFor(1);
        await page.locator(`[data-slot-index="${index}"]`).tap();
        await page.clock.runFor(index === 3 ? 1301 : 301);
      }
      expect(await snapshot(page)).toMatchObject({
        attempts: 0,
        slots: [null, null, null, null],
      });
    });
  });

  test("T-18 completes BOOK using keyboard navigation", async ({ app, page }) => {
    await app.launch({ fixture: "F-02", audio: "mock", reducedMotion: "reduce", clock: true });
    await startByKeyboard(page);
    for (let index = 0; index < 4; index += 1) {
      await keyboardPlace(page, `t:${index}`, index, index === 3 ? 1301 : 301);
    }
    expect(await snapshot(page)).toMatchObject({
      attempts: 0,
      slots: [null, null, null, null],
    });
  });

  test("T-18 cancels and changes a keyboard selection before making one placement", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", clock: true });
    await startByKeyboard(page);
    const foil = page.locator('.tile[data-tile-id="f:0"]');
    await focusByTab(page, foil);
    await page.keyboard.press("Space");
    await expect(foil).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(foil).toHaveAttribute("aria-pressed", "false");
    expect(await snapshot(page)).toMatchObject({ attempts: 0, slots: [null, null, null] });

    const cTile = page.locator('.tile[data-tile-id="t:0"]');
    await focusByTab(page, cTile);
    await page.keyboard.press("Enter");
    const firstSlot = page.locator('[data-slot-index="0"]');
    await focusByTab(page, firstSlot);
    await page.keyboard.press("Space");
    await page.clock.runFor(301);
    expect(await snapshot(page)).toMatchObject({ attempts: 1, slots: ["t:0", null, null] });
  });

  test("T-18 keeps keyboard focus on a wrong target after correction feedback", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", clock: true });
    await startByKeyboard(page);
    const aTile = page.locator('.tile[data-tile-id="t:1"]');
    await focusByTab(page, aTile);
    await page.keyboard.press("Enter");
    const firstSlot = page.locator('[data-slot-index="0"]');
    await focusByTab(page, firstSlot);
    await page.keyboard.press("Enter");
    await page.clock.runFor(301);

    await expect(aTile).toHaveAttribute("aria-pressed", "false");
    await expect(aTile).toBeEnabled();
    await expect(aTile).toBeFocused();
    await expect(page.getByText("Try another space.", { exact: true })).toBeVisible();
    await expect(page.locator(".hint.visible")).toHaveCount(0);
    expect(await snapshot(page)).toMatchObject({ attempts: 1, slots: [null, null, null] });
  });

  test("T-18 moves keyboard focus to an available tile after removing a foil", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", clock: true });
    await startByKeyboard(page);
    const foil = page.locator('.tile[data-tile-id="f:0"]');
    await focusByTab(page, foil);
    await page.keyboard.press("Enter");
    const secondSlot = page.locator('[data-slot-index="1"]');
    await focusByTab(page, secondSlot);
    await page.keyboard.press("Enter");
    await page.clock.runFor(251);

    await expect(page.locator(".hint.visible")).toHaveCount(1);
    await expect(page.locator(".tile:focus")).toHaveCount(1);
    await expect(page.locator('.tile[data-tile-id="f:0"]')).toHaveCount(0);
    expect(await snapshot(page)).toMatchObject({ attempts: 1, removedFoilIds: ["f:0"], revealedHints: [1] });
  });

  test("T-19 cancels a drag on orientation resize while preserving completed placements", async ({ app, page }) => {
    await app.launch({ fixture: "F-01", audio: "mock", reducedMotion: "reduce", clock: true });
    await start(page);
    await page.locator('.tile[data-tile-id="t:0"]').click();
    await page.clock.runFor(1);
    await page.locator('[data-slot-index="0"]').click();
    await page.clock.runFor(301);
    const activeTile = page.locator('.tile[data-tile-id="t:1"]');
    const box = await activeTile.boundingBox();
    if (!box) throw new Error("Could not measure the tile before orientation change");
    await page.mouse.move(box.x + 26, box.y + 26);
    await page.mouse.down();
    await page.mouse.move(box.x + 50, box.y + 26);
    await expect(page.locator(".drag-ghost")).toBeVisible();
    await page.setViewportSize({ width: 568, height: 320 });
    await page.mouse.up();
    await page.clock.runFor(1);

    await expect(page.locator(".drag-ghost")).toHaveCount(0);
    await expect(activeTile).toHaveAttribute("aria-pressed", "false");
    expect(await snapshot(page)).toMatchObject({
      attempts: 1,
      slots: ["t:0", null, null],
    });
    await activeTile.click();
    await page.clock.runFor(1);
    await page.locator('[data-slot-index="1"]').click();
    await page.clock.runFor(301);
    expect(await snapshot(page)).toMatchObject({ attempts: 2, slots: ["t:0", "t:1", null] });
  });
});
