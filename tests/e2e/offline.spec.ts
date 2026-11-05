import type { Page } from "@playwright/test";
import { test, expect } from "./support/app";
import { installRuntime } from "./support/runtime";

async function nativeMedia(page: Page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const paths = ["cat.wav", "cat-0.wav", "cat-1.wav", "cat-2.wav"].map((name) => `lang/english/audios/${name}`);
    paths.push("assets/audios/incorrect.wav");
    const context = new AudioContext();
    try {
      const durations = [];
      for (const path of paths) {
        const data = await new Promise<ArrayBuffer>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("GET", path);
          xhr.responseType = "arraybuffer";
          xhr.onload = () => xhr.response instanceof ArrayBuffer ? resolve(xhr.response) : reject(new Error("Missing binary"));
          xhr.onerror = () => reject(new Error(`Unable to load ${path}`));
          xhr.send();
        });
        durations.push((await context.decodeAudioData(data)).duration);
      }
      return {
        durations,
        font: [...document.fonts].some((font) => font.family === "Lexend" && font.status === "loaded"),
        family: getComputedStyle(document.querySelector(".tile")!).fontFamily,
      };
    } finally { await context.close(); }
  });
}

test.describe("stage 7: file offline acceptance (desktop, not archives or device)", () => {
  test("T-26/T-27 ten cold contexts reach Ready offline within 10 seconds with real media", async ({ app, browser, context }, testInfo) => {
    test.setTimeout(120000);
    await context.setOffline(true);
    await app.launch({ audio: "real" });
    const boots: Array<{ trial: number; readyMs: number }> = [];
    for (let trial = 1; trial <= 10; trial++) {
      const cold = await browser.newContext({ offline: true, reducedMotion: trial % 2 ? "reduce" : "no-preference" });
      const page = await cold.newPage();
      const errors: string[] = [];
      const external: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => { if (message.type() === "warning" || message.type() === "error") errors.push(message.text()); });
      page.on("request", (request) => { if (/^https?:/.test(request.url())) external.push(request.url()); });
      try {
        await installRuntime(page, { audio: "real", uuid: "native" });
        const start = performance.now();
        await page.goto(app.url);
        await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible({ timeout: 10000 });
        const readyMs = performance.now() - start;
        boots.push({ trial, readyMs });
        expect(readyMs).toBeLessThanOrEqual(10000);
        const media = await nativeMedia(page);
        expect(media.font).toBe(true);
        expect(media.family).toContain("Lexend");
        expect(media.durations).toHaveLength(5);
        expect(media.durations.every((duration) => duration > 0)).toBe(true);
        const network = await page.evaluate(() => window.__browserHarness.network);
        expect(network.filter((entry) => entry.api !== "xhr")).toEqual([]);
        expect(network.every((entry) => entry.url.startsWith("file:"))).toBe(true);
        expect(external).toEqual([]);
        expect(errors).toEqual([]);
      } finally { await cold.close(); }
    }
    await testInfo.attach("cold-launch-timings", { body: JSON.stringify(boots, null, 2), contentType: "application/json" });
  });

  for (const motion of ["reduce", "no-preference"] as const) {
    test(`T-27 real offline ${motion} completes and restores progress without network or file fetch`, async ({ app, context, page }) => {
      test.setTimeout(45000);
      await context.setOffline(true);
      const diagnostics: string[] = [];
      page.on("console", (message) => { if (message.type() === "warning" || message.type() === "error") diagnostics.push(message.text()); });
      await app.launch({ audio: "real", reducedMotion: motion });
      await page.getByRole("button", { name: "Let's spell!" }).click();
      const choose = async (index: number) => {
        const tile = page.locator(`.tile[data-tile-id="t:${index}"]`);
        if (motion === "reduce") await tile.click();
        else {
          await expect.poll(async () => {
            const box = await tile.boundingBox();
            const lanes = await page.locator(".moving-lanes").boundingBox();
            return Boolean(box && lanes && box.x >= lanes.x + 8 && box.x + box.width <= lanes.x + lanes.width - 8);
          }, { timeout: 15000 }).toBe(true);
          const box = await tile.boundingBox();
          if (!box) throw new Error("Moving tile disappeared before pointer-down");
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.up();
          await expect(tile).toHaveAttribute("aria-pressed", "true");
        }
      };
      const place = async (index: number) => {
        await choose(index);
        await page.locator(`[data-slot-index="${index}"]`).click();
        await expect(page.getByRole("button", { name: "Hear the word" })).toBeEnabled();
      };
      await place(0);
      await page.reload();
      await expect(page.getByRole("button", { name: "Keep going!" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Space 1 of 3, C, locked" })).toBeDisabled();
      await page.getByRole("button", { name: "Keep going!" }).click();
      await place(1);
      await choose(2);
      await page.locator('[data-slot-index="2"]').click();
      await expect(page.getByText("You spelled it!", { exact: true })).toBeVisible();
      await expect(page.locator(".slot.locked")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Hear the word" })).toBeEnabled();
      const attempts = await page.evaluate(() => window.__browserHarness.network);
      expect(attempts.every((entry) => entry.api === "xhr" && entry.url.startsWith("file:"))).toBe(true);
      expect(diagnostics).toEqual([]);
    });
  }
});
