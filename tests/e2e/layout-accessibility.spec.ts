import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/app";
import { acceptanceViewports, contentFixtures } from "../fixtures/browser-content";

async function setVisible(page: Page, visible: boolean) {
  await page.evaluate((value) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: value ? "visible" : "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  }, visible);
}

async function lanePositions(page: Page) {
  return page.locator(".moving-lane .tile").evaluateAll((tiles) => tiles.map((tile) => ({
    id: tile.getAttribute("data-tile-id"), left: (tile as HTMLElement).style.left,
  })));
}

async function scan(page: Page, label: string) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "best-practice"]).analyze();
  await test.info().attach(`axe-${label}`, { body: JSON.stringify(result, null, 2), contentType: "application/json" });
  expect(result.violations, `Accessibility violations in ${label}`).toEqual([]);
}

function contrast(foreground: string, background: string) {
  const luminance = (color: string) => {
    const components = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    if (!components || components.length !== 3) throw new Error(`Unsupported computed color: ${color}`);
    const linear = components.map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const first = luminance(foreground), second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test.describe("stage 7: layout and accessibility", () => {
  for (const motion of ["reduce", "no-preference"] as const) {
    test(`T-20/T-21 maximum layout and 44px targets across six viewports in ${motion}`, async ({ app, page }) => {
      const pack = structuredClone(contentFixtures["F-03"]);
      pack.levels = [pack.levels[1]];
      await app.launch({ fixture: "F-03", content: pack, audio: "mock", reducedMotion: motion, clock: true });
      await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
      await expect(page.locator(".tile")).toHaveCount(12);
      for (const viewport of acceptanceViewports) {
        await page.setViewportSize(viewport);
        const measurements = await page.evaluate(() => {
          const box = (element: Element) => {
            const rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
          };
          const field = document.querySelector(".playfield")!;
          const style = getComputedStyle(field);
          return {
            width: innerWidth, scroll: document.documentElement.scrollWidth,
            answerWidth: style.display === "grid" ? parseFloat(style.gridTemplateColumns.split(" ").at(-1)!) : field.clientWidth - 32,
            body: parseFloat(getComputedStyle(document.body).fontSize),
            targets: [...document.querySelectorAll("button")].filter((element) => element.getClientRects().length).map(box),
            slots: [...document.querySelectorAll(".answer-cell")].map((element) => ({
              slot: box(element.querySelector(".slot")!), hint: box(element.querySelector(".hint")!),
            })),
            letters: [...document.querySelectorAll(".tile, .slot")].map((element) => parseFloat(getComputedStyle(element).fontSize)),
            tileClues: [...document.querySelectorAll(".tile")].map((element) => {
              const style = getComputedStyle(element);
              return [style.color, style.backgroundColor, style.borderColor, style.borderWidth, style.fontSize, style.width, style.height];
            }),
          };
        });
        expect(measurements.scroll).toBeLessThanOrEqual(viewport.width);
        expect(measurements.body).toBeGreaterThanOrEqual(16);
        for (const target of measurements.targets) {
          expect(target.width).toBeGreaterThanOrEqual(44);
          expect(target.height).toBeGreaterThanOrEqual(44);
          expect(target.left).toBeGreaterThanOrEqual(0);
          expect(target.right).toBeLessThanOrEqual(viewport.width);
        }
        for (const pair of measurements.slots) {
          expect(pair.hint.top).toBeGreaterThanOrEqual(pair.slot.bottom);
          expect(Math.abs((pair.hint.left + pair.hint.right) / 2 - (pair.slot.left + pair.slot.right) / 2)).toBeLessThan(1);
        }
        for (let index = 1; index < measurements.slots.length; index++) {
          const before = measurements.slots[index - 1].slot, after = measurements.slots[index].slot;
          expect(after.top > before.top || after.left > before.left).toBe(true);
        }
        const firstRow = measurements.slots.filter(({ slot }) => Math.abs(slot.top - measurements.slots[0].slot.top) < 1).length;
        expect(firstRow).toBe(Math.min(8, Math.floor((measurements.answerWidth + 8) / 52)));
        expect(measurements.letters.every((size) => size >= 28)).toBe(true);
        expect(new Set(measurements.tileClues.map((style) => JSON.stringify(style))).size).toBe(1);
        await expect(page.locator(motion === "reduce" ? ".tile-pool" : ".moving-lanes")).toHaveCount(1);
        await expect(page.locator(motion === "reduce" ? ".moving-lanes" : ".tile-pool")).toHaveCount(0);
        await expect(page.getByText("Letters move from left to right.", { exact: true })).toHaveCount(0);
        expect(await page.locator("main").innerText()).not.toMatch(/elephant|score|grade|foil/i);
        const screenshot = test.info().outputPath(`maximum-${motion}-${viewport.width}x${viewport.height}.png`);
        await page.screenshot({ path: screenshot, fullPage: true });
        await test.info().attach(`maximum-${motion}-${viewport.width}x${viewport.height}`, { path: screenshot, contentType: "image/png" });
      }
      await page.getByRole("button", { name: "Let's spell!" }).click();
      await page.clock.runFor(250);
      await expect(page.getByRole("button", { name: "Pause motion" })).toHaveCount(motion === "reduce" ? 0 : 1);
    });
  }

  test("T-20 portrait hint/status baselines stay within 48px with motion status above answers", async ({ app, page }) => {
    await app.launch({ audio: "mock", reducedMotion: "reduce", clock: true });
    await page.getByRole("button", { name: "Let's spell!" }).click();
    await page.locator('.tile[data-tile-id="f:0"]').click();
    await page.clock.runFor(1);
    await page.locator('[data-slot-index="1"]').click();
    await page.clock.runFor(251);
    for (const viewport of acceptanceViewports.filter(({ width, height }) => height > width)) {
      await page.setViewportSize(viewport);
      const distances = await page.evaluate(() => {
        function baseline(selector: string) {
          const element = document.querySelector(selector);
          if (!element) throw new Error(`Missing ${selector}`);
          const marker = document.createElement("span");
          marker.style.cssText = "display:inline-block;width:0;height:0;padding:0;margin:0;vertical-align:baseline";
          element.append(marker);
          const result = marker.getBoundingClientRect().top;
          marker.remove();
          return result;
        }
        return {
          gap: baseline(".status") - baseline(".hint.visible"),
          motion: document.querySelector(".motion-label")!.getBoundingClientRect().bottom,
          answers: document.querySelector(".answers")!.getBoundingClientRect().top,
        };
      });
      expect(distances.gap).toBeGreaterThanOrEqual(36);
      expect(distances.gap).toBeLessThanOrEqual(48);
      expect(distances.motion).toBeLessThanOrEqual(distances.answers);
    }
  });

  test("T-21 scans ready, playing, hint, correct and Settings surfaces", async ({ app, page }) => {
    test.setTimeout(60000);
    await app.launch({ audio: "mock", reducedMotion: "reduce" });
    await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
    await scan(page, "ready");
    await page.getByRole("button", { name: "Let's spell!" }).click();
    await scan(page, "playing");
    await page.locator('.tile[data-tile-id="f:0"]').click();
    await page.locator('[data-slot-index="1"]').click();
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeEnabled();
    await scan(page, "hint");
    await page.locator('.tile[data-tile-id="t:0"]').click();
    await page.locator('[data-slot-index="0"]').click();
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeEnabled();
    await scan(page, "correct");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await scan(page, "settings");
    await page.keyboard.press("Escape");
  });

  test("T-21 scans the recoverable fatal surface", async ({ app, page }) => {
    await app.launch({ rawContent: "{broken", audio: "mock" });
    await expect(page.getByRole("button", { name: "Try loading again" })).toBeVisible();
    await scan(page, "fatal");
  });

  test("T-21 rendered text, borders, focus and selected state meet contrast thresholds", async ({ app, page }) => {
    await app.launch({ audio: "mock", reducedMotion: "reduce", clock: true });
    await page.getByRole("button", { name: "Let's spell!" }).click();
    const read = async (selector: string) => page.locator(selector).first().evaluate((element) => {
      const style = getComputedStyle(element);
      let background = style.backgroundColor;
      let parent = element.parentElement;
      while (background === "rgba(0, 0, 0, 0)" && parent) {
        background = getComputedStyle(parent).backgroundColor;
        parent = parent.parentElement;
      }
      return {
        text: style.color, background, border: style.borderTopColor,
        outline: style.outlineColor, outlineWidth: parseFloat(style.outlineWidth), outlineOffset: parseFloat(style.outlineOffset),
      };
    });
    for (const selector of [".status", ".tile", ".replay", ".sound-toggle", ".motion-label"]) {
      const style = await read(selector);
      expect(contrast(style.text, style.background), selector).toBeGreaterThanOrEqual(4.5);
    }
    for (const selector of [".tile", ".slot", ".sound-toggle"]) {
      const style = await read(selector);
      expect(contrast(style.border, style.background), selector).toBeGreaterThanOrEqual(3);
    }
    const tile = page.locator('.tile[data-tile-id="t:0"]');
    await tile.focus();
    await page.keyboard.press("Tab");
    await tile.focus();
    const focus = await read('.tile[data-tile-id="t:0"]');
    expect(focus.outlineWidth).toBe(3);
    expect(focus.outlineOffset).toBe(2);
    expect(contrast(focus.outline, focus.background)).toBeGreaterThanOrEqual(3);
    await page.keyboard.press("Escape");
    await page.locator('.tile[data-tile-id="f:0"]').click();
    await page.clock.runFor(1);
    await page.locator('[data-slot-index="1"]').click();
    await page.clock.runFor(251);
    const hint = await read(".hint.visible");
    expect(contrast(hint.text, hint.background)).toBeGreaterThanOrEqual(4.5);
    await page.locator('.tile[data-tile-id="t:0"]').click();
    await page.clock.runFor(1);
    await page.locator('[data-slot-index="0"]').click();
    const locked = await read(".slot.locked");
    expect(contrast(locked.text, locked.background)).toBeGreaterThanOrEqual(4.5);
    await expect(page.locator(".slot.locked .lock-mark")).toBeVisible();
    await expect(page.getByText("Nice work!", { exact: true })).toBeVisible();
  });

  test("T-21/T-22 Settings, pause and focus", async ({ app, page }) => {
    await app.launch({ audio: "mock", clock: true });
    await page.getByRole("button", { name: "Let's spell!" }).click();
    await page.clock.runFor(1500);
    const tile = page.locator(".moving-lane .tile").first();
    await tile.click();
    await page.clock.runFor(1);
    await expect(page.locator(".tile.selected")).toHaveCount(1);
    const settings = page.getByRole("button", { name: "Settings", exact: true });
    await settings.click();
    const dialog = page.getByRole("dialog", { name: "Settings" });
    await expect(dialog).toBeVisible();
    await expect(page.locator(".tile.selected, .drag-ghost")).toHaveCount(0);
    const sound = dialog.getByRole("button", { name: "Sound on" });
    const close = dialog.getByRole("button", { name: "Close" });
    await expect(sound).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(sound).toBeFocused();
    const positions = await lanePositions(page);
    await page.clock.runFor(5000);
    expect(await lanePositions(page)).toEqual(positions);
    await setVisible(page, false);
    await page.clock.runFor(2000);
    await setVisible(page, true);
    await expect(dialog).toBeVisible();
    expect(await lanePositions(page)).toEqual(positions);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(settings).toBeFocused();
    await page.clock.runFor(1000);
    expect(await lanePositions(page)).not.toEqual(positions);
    await page.getByRole("button", { name: "Pause motion" }).click();
    const paused = await lanePositions(page);
    await settings.click();
    await dialog.getByRole("button", { name: "Sound on" }).click();
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(settings).toBeFocused();
    await setVisible(page, false);
    await page.clock.runFor(1000);
    await setVisible(page, true);
    await page.clock.runFor(1000);
    expect(await lanePositions(page)).toEqual(paused);
    await expect(page.getByRole("button", { name: "Resume motion" })).toBeVisible();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await page.clock.runFor(1000);
    expect(await lanePositions(page)).not.toEqual(paused);
  });

  test("T-21 Play without drag or sound, with distinct focus/selection and 200 percent text", async ({ app, page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await app.launch({ audio: "mock", clock: true, reducedMotion: "reduce", savedMute: true });
    await page.getByRole("button", { name: "Let's spell!" }).focus();
    await page.keyboard.press("Enter");
    await page.clock.runFor(1);
    await page.locator('.tile[data-tile-id="t:0"]').focus();
    await page.keyboard.press("Space");
    const selected = page.locator(".tile.selected");
    await expect(selected).toBeFocused();
    const focused = await selected.evaluate((element) => ({ outline: getComputedStyle(element).outlineWidth, shadow: getComputedStyle(element).boxShadow }));
    await page.keyboard.press("Tab");
    const unfocused = await selected.evaluate((element) => ({ outline: getComputedStyle(element).outlineWidth, shadow: getComputedStyle(element).boxShadow }));
    expect(focused).not.toEqual(unfocused);
    await page.keyboard.press("Escape");
    await page.addStyleTag({ content: ":root { font-size: 32px !important; }" });
    expect(await page.locator("body").evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBe(32);
    for (let index = 0; index < 3; index++) {
      const tile = page.locator(`.tile[data-tile-id="t:${index}"]`);
      await tile.focus();
      await page.keyboard.press("Enter");
      const slot = page.locator(`[data-slot-index="${index}"]`);
      await slot.focus();
      await expect(slot).toBeInViewport();
      await page.keyboard.press("Space");
      await expect(page.getByRole("status").filter({ hasText: index === 2 ? "You spelled it!" : "Nice work!" })).toBeVisible();
      await page.clock.runFor(index === 2 ? 1201 : 301);
    }
    expect(await page.evaluate(() => window.__browserHarness.events.filter((event) => event.type === "play"))).toEqual([]);
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeEnabled();
    await page.clock.resume();
    await scan(page, "text-zoom-muted");
  });

  test("existing text-selection regression preserves mouse drag and keyboard spelling", async ({ app, page }) => {
    await app.launch({ audio: "mock", reducedMotion: "reduce", clock: true });
    await page.getByRole("button", { name: "Let's spell!" }).click();
    for (const selector of ["h1", ".status"]) {
      const box = await page.locator(selector).boundingBox();
      if (!box) throw new Error(`Missing ${selector}`);
      await page.mouse.move(box.x + 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 5 });
      await page.mouse.up();
      expect(await page.evaluate(() => getSelection()?.toString())).toBe("");
    }
    const tile = await page.locator('.tile[data-tile-id="t:0"]').boundingBox();
    const slot = await page.locator('[data-slot-index="0"]').boundingBox();
    if (!tile || !slot) throw new Error("Missing drag geometry");
    await page.mouse.move(tile.x + 10, tile.y + 10);
    await page.mouse.down();
    await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.clock.runFor(301);
    await expect(page.getByRole("button", { name: "Space 1 of 3, C, locked" })).toBeDisabled();
    expect(await page.evaluate(() => getSelection()?.toString())).toBe("");
    await page.locator('.tile[data-tile-id="t:1"]').focus();
    await page.keyboard.press("Enter");
    await page.locator('[data-slot-index="1"]').focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Space 2 of 3, A, locked" })).toBeDisabled();
  });
});
