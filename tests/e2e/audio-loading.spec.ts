import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/app";
import { acceptanceViewports, contentFixtures, snapshotFixture } from "../fixtures/browser-content";

const soundNotice = "Sound isn't available. You can still play.";
const contentBody = JSON.stringify(contentFixtures["F-01"]);

async function snapshot(page: Page): Promise<{ occurrence_counter: number; attempts: number; level_id: number }> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("drag-into-place:v1:browser-fixture:english");
    if (!raw) throw new Error("Missing saved puzzle");
    return JSON.parse(raw);
  });
}

async function place(page: Page, index: number, settle = true): Promise<void> {
  await page.locator(`.tile[data-tile-id="t:${index}"]`).click();
  await page.clock.runFor(1);
  await page.locator(`[data-slot-index="${index}"]`).click();
  if (settle) await page.clock.runFor(301);
}

async function plays(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__browserHarness.events
    .filter((event) => event.type === "play").map((event) => event.path.split("/").pop()!));
}

async function replayLayout(page: Page) {
  return page.locator(".target-image, .replay, .answers, .status, .tile-pool, .moving-lanes")
    .evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height };
    }));
}

async function fatal(page: Page, code = "CONTENT_INVALID"): Promise<void> {
  await expect(page.getByRole("button", { name: "Try loading again" })).toBeVisible();
  await expect(page.getByText(`Try again. Error code: ${code}`, { exact: true })).toBeVisible();
  await expect(page.locator(".slot, .tile, .start")).toHaveCount(0);
  expect(await page.locator("main").innerText()).not.toMatch(/lang\/|assets\/|browser-fixture|Error:| at /);
}

test.describe("stage 6: audio, loading and failure recovery", () => {
  test("T-16 uses the required transport and accepts nonempty successful content", async ({ app, page }, testInfo) => {
    const file = testInfo.project.metadata.transport === "file";
    await app.launch({
      audio: "mock",
      contentResponses: [{ status: file ? 0 : 200, body: contentBody }],
    });
    await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
    const requests = await page.evaluate(() => window.__browserHarness.network
      .filter((request) => request.url.endsWith("/lang/english/levels.json")));
    expect(requests).toHaveLength(1);
    expect(requests[0].api).toBe(file ? "xhr" : "fetch");
  });

  for (const variant of ["malformed", "truncated", "empty", "missing-json", "missing-image", "corrupt-image"] as const) {
    test(`T-16/T-23 Failed load versus failed audio: ${variant} is fatal and Retry recovers`, async ({ app, page }) => {
      const diagnostics: string[] = [];
      page.on("console", (message) => { if (message.type() === "warning") diagnostics.push(message.text()); });
      const image = "assets/images/cat.svg";
      await app.launch({
        audio: "mock",
        rawContent: variant === "malformed" ? "{broken" : variant === "truncated" ? contentBody.slice(0, -3) : variant === "empty" ? "" : undefined,
        removeFiles: variant === "missing-json" ? ["lang/english/levels.json"] : variant === "missing-image" ? [image] : [],
        corruptFiles: variant === "corrupt-image" ? [image] : [],
      });
      await fatal(page);
      expect(diagnostics.some((message) => message.startsWith("CONTENT_INVALID"))).toBe(true);
      await writeFile(resolve(app.root, "lang", "english", "levels.json"), contentBody);
      await writeFile(resolve(app.root, "assets", "images", "cat.svg"),
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="24"/></svg>');
      await page.getByRole("button", { name: "Try loading again" }).click();
      await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
      await expect(page.getByRole("img")).toBeVisible();
      await expect(page.getByRole("button", { name: "Try loading again" })).toHaveCount(0);
    });
  }

  test("T-16 rejects a non-success response and retries without reloading the document", async ({ app, page }) => {
    await app.launch({
      audio: "mock",
      contentResponses: [{ status: 404, body: contentBody }, { status: 200, body: contentBody }],
    });
    await fatal(page);
    await page.evaluate(() => { window.__browserHarness.seed = 777; });
    await page.getByRole("button", { name: "Try loading again" }).click();
    await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
    expect(await page.evaluate(() => window.__browserHarness.seed)).toBe(777);
  });

  test("T-16 reaches error at the 10-second deadline and ignores old-generation completion after Retry", async ({ app, page }, testInfo) => {
    await app.launch({
      audio: "mock", clock: true,
      contentResponses: [
        { status: testInfo.project.metadata.transport === "file" ? 0 : 200, body: "{stale invalid", pending: true },
        { status: 200, body: contentBody },
      ],
    });
    await expect(page.getByRole("status")).toHaveText("Getting your letters ready...");
    await page.clock.runFor(9999);
    await expect(page.getByRole("button", { name: "Try loading again" })).toHaveCount(0);
    await page.clock.runFor(1);
    await fatal(page, "BOOT_TIMEOUT");
    await page.getByRole("button", { name: "Try loading again" }).click();
    await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
    await page.evaluate(() => window.__browserHarness.emitContent(0));
    await page.clock.runFor(1);
    await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try loading again" })).toHaveCount(0);
    expect((await snapshot(page)).attempts).toBe(0);
  });

  test("T-16 pending preloads settle independently at the 4-second media watchdog", async ({ app, page }) => {
    await app.launch({
      audio: "mock", clock: true, reducedMotion: "reduce",
      audioOutcomes: { "cat-1.wav": "pending", "cat.wav": "unavailable" },
    });
    await expect.poll(() => page.evaluate(() => window.__browserHarness.events
      .filter((event) => event.type === "load").length)).toBe(5);
    await page.clock.runFor(3999);
    await expect(page.getByRole("button", { name: "Let's spell!" })).toHaveCount(0);
    await page.clock.runFor(1);
    await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
    await expect(page.getByText(soundNotice, { exact: true })).toBeVisible();
    const loaded = await page.evaluate(() => window.__browserHarness.events.filter((event) => event.type === "load").map((event) => event.path));
    for (const suffix of ["cat.wav", "cat-0.wav", "cat-1.wav", "cat-2.wav", "incorrect.wav"]) {
      expect(loaded.some((path) => path.endsWith(suffix))).toBe(true);
    }
    await page.getByRole("button", { name: "Let's spell!" }).click();
    await place(page, 0);
    await expect(page.getByRole("button", { name: "Space 1 of 3, C, locked" })).toBeDisabled();
  });

  test("T-16 the whole-boot watchdog also bounds a stalled required image", async ({ app, page }) => {
    await app.launch({ audio: "mock", clock: true, stallImages: true });
    await expect.poll(() => page.evaluate(() => window.__browserHarness.events
      .filter((event) => event.type === "image-stalled").length)).toBe(1);
    await page.clock.runFor(9999);
    await expect(page.getByRole("button", { name: "Try loading again" })).toHaveCount(0);
    await page.clock.runFor(1);
    await fatal(page, "BOOT_TIMEOUT");
  });

  for (const cue of ["cat.wav", "cat-0.wav", "cat-1.wav", "cat-2.wav", "incorrect.wav"]) {
    test(`T-23 retains the sound notice when ${cue} fails but another required cue succeeds`, async ({ app, page }) => {
      const diagnostics: string[] = [];
      page.on("console", (message) => { if (message.type() === "warning") diagnostics.push(message.text()); });
      await app.launch({
        audio: "mock", clock: true, reducedMotion: "reduce",
        audioOutcomes: { [cue]: "unavailable" },
      });
      await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
      await expect(page.getByText(soundNotice, { exact: true })).toBeVisible();
      expect(diagnostics.some((message) => message.includes("AUDIO_UNAVAILABLE") && message.endsWith(cue))).toBe(true);
      await page.getByRole("button", { name: "Let's spell!" }).click();
      const goodIndex = cue === "cat-0.wav" ? 1 : 0;
      await place(page, goodIndex);
      await expect(page.getByText(soundNotice, { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Enable sound" })).toHaveCount(0);
      expect((await snapshot(page)).attempts).toBe(1);
    });
  }

  for (const fault of ["missing-audio", "corrupt-audio", "missing-font"] as const) {
    test(`T-23 real ${fault} is diagnosed without preventing visual play`, async ({ app, page }) => {
      const diagnostics: string[] = [];
      page.on("console", (message) => { if (message.type() === "warning") diagnostics.push(message.text()); });
      await app.launch({
        audio: "real", reducedMotion: "reduce", missingFont: fault === "missing-font",
        removeFiles: fault === "missing-audio" ? ["lang/english/audios/cat-1.wav"] : [],
        corruptFiles: fault === "corrupt-audio" ? ["lang/english/audios/cat-1.wav"] : [],
      });
      await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
      if (fault !== "missing-font") await expect(page.getByText(soundNotice, { exact: true })).toBeVisible();
      expect(diagnostics.some((message) => message.startsWith(fault === "missing-font" ? "FONT_UNAVAILABLE" : "AUDIO_UNAVAILABLE"))).toBe(true);
      await page.getByRole("button", { name: "Let's spell!" }).click();
      await page.locator('.tile[data-tile-id="t:0"]').click();
      await page.locator('[data-slot-index="0"]').click();
      await expect(page.getByRole("button", { name: "Space 1 of 3, C, locked" })).toBeDisabled();
      await expect(page.getByText("Nice work!", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Try loading again" })).toHaveCount(0);
    });
  }

  for (const outcome of ["played", "unavailable", "blocked", "pending", "muted"] as const) {
    test(`T-07 final letter precedes word and advances once with ${outcome} audio`, async ({ app, page }) => {
      await app.launch({
        audio: "mock", reducedMotion: "reduce", clock: true, bridge: "recording",
        savedMute: outcome === "muted",
        audioPlayOutcomes: outcome === "muted" ? {} : { "cat-2.wav": outcome, "cat.wav": outcome },
      });
      await page.getByRole("button", { name: "Let's spell!" }).click();
      await place(page, 0);
      await place(page, 1);
      await place(page, 2, false);
      const occurrence = (await snapshot(page)).occurrence_counter;
      await expect(page.getByText("You spelled it!", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Hear the word" })).toBeDisabled();
      const lastSlot = page.locator('[data-slot-index="2"]');
      await lastSlot.dispatchEvent("pointerup", { pointerId: 1 });
      if (outcome === "pending") {
        await page.clock.runFor(3999);
        expect((await plays(page)).filter((path) => path === "cat.wav")).toHaveLength(0);
        expect((await snapshot(page)).occurrence_counter).toBe(occurrence);
        await page.clock.runFor(1);
        expect((await plays(page)).slice(-2)).toEqual(["cat-2.wav", "cat.wav"]);
        await page.clock.runFor(3999);
        expect((await snapshot(page)).occurrence_counter).toBe(occurrence);
        await page.clock.runFor(1);
      } else {
        await page.clock.runFor(1199);
        expect((await snapshot(page)).occurrence_counter).toBe(occurrence);
        await page.clock.runFor(2);
      }
      await expect.poll(async () => (await snapshot(page)).occurrence_counter).toBe(occurrence + 1);
      const played = await plays(page);
      if (outcome === "muted") expect(played).toEqual([]);
      else expect(played.slice(-2)).toEqual(["cat-2.wav", "cat.wav"]);
      await page.evaluate(() => {
        for (const event of window.__browserHarness.events.filter((event) => event.type === "play")) {
          window.__browserHarness.emitAudio(event.path, "ended", event.id);
          window.__browserHarness.emitAudio(event.path, "error", event.id);
        }
      });
      await page.clock.runFor(5000);
      expect((await snapshot(page)).occurrence_counter).toBe(occurrence + 1);
      const messages = await page.evaluate(() => window.__browserHarness.messages.map((message) => JSON.parse(message)));
      expect(messages.filter((message) => message.payload.data.type === "level_completed")).toHaveLength(1);
    });
  }

  test("T-07 waits for successful word completion even after the animation finishes", async ({ app, page }) => {
    await app.launch({
      audio: "mock", reducedMotion: "reduce", clock: true,
      audioPlayOutcomes: { "cat.wav": "pending" },
    });
    await page.getByRole("button", { name: "Let's spell!" }).click();
    await place(page, 0);
    await place(page, 1);
    await place(page, 2, false);
    await page.clock.runFor(1500);
    expect((await snapshot(page)).occurrence_counter).toBe(1);
    const word = await page.evaluate(() => window.__browserHarness.events
      .find((event) => event.type === "play" && event.path.endsWith("cat.wav"))!);
    await page.evaluate((event) => window.__browserHarness.emitAudio(event.path, "ended", event.id), word);
    await page.clock.runFor(1);
    expect((await snapshot(page)).occurrence_counter).toBe(2);
  });

  test("T-22 muting active feedback stops playback and suppresses the queued word without hanging", async ({ app, page }) => {
    await app.launch({
      audio: "mock", reducedMotion: "reduce", clock: true,
      audioPlayOutcomes: { "cat-2.wav": "pending" },
    });
    await page.getByRole("button", { name: "Let's spell!" }).click();
    await place(page, 0);
    await place(page, 1);
    await place(page, 2, false);
    await page.getByRole("button", { name: "Sound on" }).click();
    await page.clock.runFor(1201);
    expect((await snapshot(page)).occurrence_counter).toBe(2);
    expect(await plays(page)).not.toContain("cat.wav");
    const events = await page.evaluate(() => window.__browserHarness.events);
    const cue = events.find((event) => event.type === "play" && event.path.endsWith("cat-2.wav"))!;
    expect(events.some((event) => event.type === "pause" && event.id === cue.id)).toBe(true);
    await expect(page.getByText(soundNotice, { exact: true })).toHaveCount(0);
  });

  test("T-23 a successful destination level clears the previous level notice and ignores stale callbacks", async ({ app, page }) => {
    await app.launch({
      fixture: "F-04-cycle", audio: "mock", reducedMotion: "reduce", clock: true,
      audioOutcomes: { "cat-1.wav": "unavailable" },
      savedProgress: { ...snapshotFixture("partial"), cycleIds: [1, 2, 3] },
    });
    await page.getByRole("button", { name: "Keep going!" }).click();
    await expect(page.getByText(soundNotice, { exact: true })).toBeVisible();
    const oldCues = await page.evaluate(() => window.__browserHarness.events.filter((event) => event.path.endsWith("cat-1.wav")));
    await place(page, 1);
    await place(page, 2, false);
    await page.clock.runFor(1301);
    expect((await snapshot(page)).level_id).toBe(2);
    await expect(page.getByText(soundNotice, { exact: true })).toHaveCount(0);
    await page.evaluate((events) => {
      for (const event of events) window.__browserHarness.emitAudio(event.path, "error", event.id);
    }, oldCues);
    await page.clock.runFor(1);
    await expect(page.getByText(soundNotice, { exact: true })).toHaveCount(0);
  });

  test("T-23 playback failure does not contaminate a new occurrence of the same level", async ({ app, page }) => {
    await app.launch({
      audio: "mock", reducedMotion: "reduce", clock: true,
      audioPlayOutcomes: { "cat-0.wav": "unavailable" },
    });
    await page.getByRole("button", { name: "Let's spell!" }).click();
    await place(page, 0);
    await expect(page.getByText(soundNotice, { exact: true })).toBeVisible();
    await page.evaluate(() => { window.__browserHarness.playOutcomes = {}; });
    await place(page, 1);
    await place(page, 2, false);
    await page.clock.runFor(1301);
    expect((await snapshot(page)).occurrence_counter).toBe(2);
    await expect(page.getByText(soundNotice, { exact: true })).toHaveCount(0);
  });

  test("T-23 an unresolved prior-occurrence preload cannot overwrite a complete destination", async ({ app, page }) => {
    await app.launch({
      audio: "mock", reducedMotion: "reduce", clock: true,
      audioOutcomes: { "cat-1.wav": "pending" }, audioPlayOutcomes: { "cat-1.wav": "played" },
    });
    await expect.poll(() => page.evaluate(() => window.__browserHarness.events
      .filter((event) => event.type === "load").length)).toBe(5);
    await page.clock.runFor(4000);
    await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
    const pending = await page.evaluate(() => {
      const loads = window.__browserHarness.events.filter((event) => event.type === "load" && event.path.endsWith("cat-1.wav"));
      window.__browserHarness.outcomes = {};
      return loads.at(-1)!;
    });
    await page.getByRole("button", { name: "Let's spell!" }).click();
    await place(page, 0);
    await place(page, 1);
    await place(page, 2, false);
    await page.clock.runFor(1301);
    expect((await snapshot(page)).occurrence_counter).toBe(2);
    await expect(page.getByText(soundNotice, { exact: true })).toHaveCount(0);
    await page.evaluate((event) => window.__browserHarness.emitAudio(event.path, "error", event.id), pending);
    await page.clock.runFor(4000);
    await expect(page.getByText(soundNotice, { exact: true })).toHaveCount(0);
  });

  test("T-22/T-23 autoplay rejection offers Enable sound and gesture recovery without a missing-media notice", async ({ app, page }) => {
    await app.launch({ audio: "mock", clock: true, reducedMotion: "reduce", audioPlayOutcomes: { "cat.wav": "blocked" } });
    expect(await plays(page)).toEqual([]);
    await page.getByRole("button", { name: "Let's spell!" }).click();
    await page.getByRole("button", { name: "Hear the word" }).click();
    await expect(page.getByRole("button", { name: "Enable sound" })).toBeVisible();
    await expect(page.getByText(soundNotice, { exact: true })).toHaveCount(0);
    await page.evaluate(() => { window.__browserHarness.playOutcomes = {}; });
    await page.getByRole("button", { name: "Enable sound" }).click();
    await expect(page.getByRole("button", { name: "Enable sound" })).toHaveCount(0);
    await page.getByRole("button", { name: "Hear the word" }).click();
    await page.clock.runFor(51);
    expect((await plays(page)).filter((path) => path === "cat.wav")).toHaveLength(2);
    await expect(page.getByText(soundNotice, { exact: true })).toHaveCount(0);
    await place(page, 0);
  });

  for (const saved of [false, true]) {
    for (const motion of ["reduce", "no-preference"] as const) {
      test(`T-22 replay stays visible and gated in ${saved ? "saved" : "new"} ${motion} preview, mute and feedback`, async ({ app, page }) => {
        await app.launch({
          audio: "mock", clock: true, reducedMotion: motion,
          savedProgress: saved ? snapshotFixture("partial") : undefined,
        });
        const replay = page.getByRole("button", { name: "Hear the word" });
        const sound = () => page.getByRole("button", { name: /^Sound (on|off)$/ });
        await expect(replay).toBeVisible();
        await expect(replay).toBeDisabled();
        const disabledStyle = await replay.evaluate((element) => {
          const button = element as HTMLButtonElement;
          button.focus();
          const style = getComputedStyle(button);
          return {
            focused: document.activeElement === button,
            background: style.backgroundColor,
            color: style.color,
          };
        });
        expect(disabledStyle).toEqual({ focused: false, background: "rgb(229, 231, 235)", color: "rgb(75, 85, 99)" });
        await page.getByRole("button", { name: saved ? "Keep going!" : "Let's spell!" }).focus();
        await page.keyboard.press("Tab");
        await expect(sound()).toBeFocused();
        expect(await plays(page)).toEqual([]);
        for (const viewport of acceptanceViewports) {
          await page.setViewportSize(viewport);
          const before = await replayLayout(page);
          await sound().click();
          await expect(replay).toBeDisabled();
          expect(await replayLayout(page)).toEqual(before);
          await sound().click();
          await expect(replay).toBeDisabled();
          expect(await replayLayout(page)).toEqual(before);
        }
        await page.getByRole("button", { name: saved ? "Keep going!" : "Let's spell!" }).click();
        await expect(replay).toBeEnabled();
        expect(await replay.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(23, 78, 166)");
        await sound().click();
        await expect(replay).toBeDisabled();
        await sound().click();
        await expect(replay).toBeEnabled();
        if (motion === "no-preference") {
          await page.emulateMedia({ reducedMotion: "reduce" });
          await page.clock.runFor(1);
        }
        await place(page, saved ? 1 : 0, false);
        await expect(replay).toBeDisabled();
        await sound().click();
        await sound().click();
        await expect(replay).toBeDisabled();
        await page.clock.runFor(301);
        await expect(replay).toBeEnabled();
        await sound().click();
        await page.reload();
        await expect(page.getByRole("button", { name: "Keep going!" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Sound off" })).toBeVisible();
        await expect(replay).toBeDisabled();
        expect(await plays(page)).toEqual([]);
      });
    }
  }
});
