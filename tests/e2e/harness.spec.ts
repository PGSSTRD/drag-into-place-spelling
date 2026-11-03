import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test, expect } from "./support/app";
import { contentFixtures, malformedJson, snapshotFixture } from "../fixtures/browser-content";

test("H-01 production boot, local font and real synthetic media", async ({ app, page }) => {
  await app.launch();
  await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
  await expect(page.locator(".slot")).toHaveCount(3);
  expect(await page.evaluate(() => localStorage.getItem("harness-isolation-probe"))).toBeNull();
  await page.evaluate(() => localStorage.setItem("harness-isolation-probe", "owned"));
  const media = await page.evaluate(async () => {
    await document.fonts.ready;
    const loadedFont = [...document.fonts].some((font) => font.family === "Lexend" && font.status === "loaded");
    const data = await new Promise<ArrayBuffer>((done, reject) => {
      const request = new XMLHttpRequest();
      request.open("GET", "lang/english/audios/cat.wav");
      request.responseType = "arraybuffer";
      request.onload = () => {
        if (request.response instanceof ArrayBuffer) done(request.response);
        else reject(new Error("Fixture WAV response is not a buffer"));
      };
      request.onerror = () => reject(new Error("Fixture WAV load failed"));
      request.send();
    });
    const context = new AudioContext();
    try {
      const decoded = await context.decodeAudioData(data);
      return { duration: decoded.duration, framesPerSecond: decoded.sampleRate, loadedFont };
    } finally {
      await context.close();
    }

  });
  expect(media.duration).toBeCloseTo(0.1, 3);
  expect(media.framesPerSecond).toBeGreaterThan(0);
  expect(media.loadedFont).toBe(true);
  await page.getByRole("button", { name: "Let's spell!" }).click();
  expect(await page.evaluate(() => new Promise<string>((done, reject) => {
    const audio = new Audio(new URL("lang/english/audios/cat.wav", document.baseURI).href);
    const watchdog = setTimeout(() => reject(new Error("Real fixture playback did not end")), 4000);
    audio.onended = () => { clearTimeout(watchdog); done("ended"); };
    audio.onerror = () => { clearTimeout(watchdog); reject(new Error("Real fixture playback failed")); };
    audio.play().catch(reject);
  }))).toBe("ended");
});

for (const fixture of ["F-02", "F-03", "F-04-single", "F-04-cycle", "F-11"] as const) {
  test(`H-02 ${fixture} stages independently and reaches preview`, async ({ app, page }) => {
    await app.launch({ fixture, audio: "mock", reducedMotion: "reduce" });
    await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
    const staged = JSON.parse(await readFile(resolve(app.root, "lang", "english", "levels.json"), "utf8")) as unknown;
    if (fixture !== "F-11") expect(staged).toEqual(contentFixtures[fixture]);
    expect(await page.evaluate(() => localStorage.getItem("harness-isolation-probe"))).toBeNull();
  });
}

test("H-03 seeded RNG, UUID, monotonic clock, bridge and controlled media", async ({ app, page }) => {
  await app.launch({ seed: 12345, audio: "mock", bridge: "recording", clock: true });
  await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
  expect(await page.evaluate(() => window.__browserHarness.randomValues.slice(0, 3))).toEqual([
    0.02040268573909998, 0.01654784823767841, 0.5431557944975793,
  ]);
  expect(await page.evaluate(() => [crypto.randomUUID(), crypto.randomUUID()])).toEqual([
    "00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002",
  ]);
  const before = await page.evaluate(() => performance.now());
  await page.clock.runFor(301);
  expect(await page.evaluate(() => performance.now()) - before).toBe(301);
  expect(await page.evaluate(async () => {
    window.ReactNativeWebView?.postMessage?.("harness-probe");
    const state = window.__browserHarness;
    const audio = new Audio(new URL("lang/english/audios/cat.wav", document.baseURI).href);
    state.outcomes["cat.wav"] = "blocked";
    let rejected = "";
    try { await audio.play(); } catch (error) { rejected = error instanceof DOMException ? error.name : String(error); }
    state.outcomes["cat.wav"] = "unavailable";
    let unavailable = "";
    try { await audio.play(); } catch (error) { unavailable = error instanceof DOMException ? error.name : String(error); }
    state.outcomes["cat.wav"] = "pending";
    let ended = false;
    audio.onended = () => { ended = true; };
    await audio.play();
    const beforeEmit = ended;
    state.emitAudio("cat.wav", "ended");
    return { rejected, unavailable, beforeEmit, ended, messages: state.messages };
  })).toEqual({
    rejected: "NotAllowedError", unavailable: "NotSupportedError", beforeEmit: false,
    ended: true, messages: ["harness-probe"],
  });
  expect(await page.evaluate(async () => {
    const audio = new Audio(new URL("lang/english/audios/only-in-mock.wav", document.baseURI).href);
    await audio.play();
    return audio.getAttribute("src");
  })).toBeNull();
  await page.clock.runFor(49);
  expect(await page.evaluate(() => window.__browserHarness.events.filter((event) => event.type === "ended"))).toHaveLength(0);
  await page.clock.runFor(1);
  expect(await page.evaluate(() => window.__browserHarness.events.filter((event) => event.type === "ended"))).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
  expect(await page.evaluate(() => crypto.randomUUID())).toBe("00000000-0000-4000-8000-000000000003");
});

test("H-04 snapshots seed once, survive reload and cannot leak across contexts", async ({ app, page }) => {
  await app.launch({ audio: "mock", savedProgress: snapshotFixture("partial"), savedMute: true });
  await expect(page.getByRole("button", { name: "Keep going!" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Space 1 of 3, C, locked", exact: true })).toBeDisabled();
  await page.evaluate(() => localStorage.setItem("harness-isolation-probe", "owned"));
  await page.reload();
  await expect(page.getByRole("button", { name: "Keep going!" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("harness-isolation-probe"))).toBe("owned");
});

test("H-05 malformed content fixture reaches recoverable error", async ({ app, page }) => {
  await app.launch({ rawContent: malformedJson.truncated });
  await expect(page.getByRole("button", { name: "Try loading again" })).toBeVisible();
  await expect(page.getByText("Try again. Error code: CONTENT_INVALID", { exact: true })).toBeVisible();
});

test("H-06 staged missing/corrupt assets do not change production output", async ({ app, page }) => {
  await app.launch({
    audio: "mock",
    removeFiles: ["assets/images/cat.svg"],
    corruptFiles: ["lang/english/audios/cat.wav"],
  });
  await expect(page.getByRole("button", { name: "Try loading again" })).toBeVisible();
  expect(await readFile(resolve(app.root, "lang", "english", "audios", "cat.wav"), "utf8")).toBe("corrupt fixture");
  expect(await readFile(resolve("dist", "lang", "english", "levels.json"), "utf8")).toContain('"content_version": "1.4.1"');
});

test("H-07 XHR stall injection is installed before boot on both transports", async ({ app, page }) => {
  await app.launch({ stallContentXHR: true, clock: true });
  expect(await page.evaluate(() => window.__browserHarness.events.filter((event) => event.type === "xhr-stalled"))).toHaveLength(1);
});

for (const storage of ["read-denied", "write-denied"] as const) {
  test(`H-08 ${storage} and throwing bridge probes are observable`, async ({ app, page }) => {
    await app.launch({ audio: "mock", storage, bridge: "throwing" });
    await expect(page.getByRole("button", { name: "Let's spell!" })).toBeVisible();
    expect(await page.evaluate((mode) => {
      let storageError = "";
      let bridgeError = "";
      try {
        if (mode === "read-denied") localStorage.getItem("probe");
        else localStorage.setItem("probe", "owned");
      } catch (error) { storageError = error instanceof DOMException ? error.name : String(error); }
      try { window.ReactNativeWebView?.postMessage?.("probe"); }
      catch (error) { bridgeError = error instanceof Error ? error.message : String(error); }
      return { storageError, bridgeError, messages: window.__browserHarness.messages };
    }, storage)).toEqual({
      storageError: storage === "read-denied" ? "SecurityError" : "QuotaExceededError",
      bridgeError: "Injected bridge failure", messages: ["probe"],
    });
  });
}

test.describe("mobile touch driver", () => {
  test.use({ hasTouch: true, viewport: { width: 320, height: 568 } });
  test("H-09 touch and reduced-motion setup can activate Start", async ({ app, page }) => {
    await app.launch({ audio: "mock", reducedMotion: "reduce" });
    const start = page.getByRole("button", { name: "Let's spell!" });
    await expect(start).toBeVisible();
    expect(await page.evaluate(() => ({
      touch: navigator.maxTouchPoints > 0,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      width: innerWidth,
    }))).toEqual({ touch: true, reducedMotion: true, width: 320 });
    await start.tap();
    await expect(start).toBeHidden();
  });
});

test("H-10 keyboard driver can activate Start", async ({ app, page }) => {
  await app.launch({ audio: "mock", reducedMotion: "reduce" });
  const start = page.getByRole("button", { name: "Let's spell!" });
  await start.focus();
  await page.keyboard.press("Enter");
  await expect(start).toBeHidden();
});
