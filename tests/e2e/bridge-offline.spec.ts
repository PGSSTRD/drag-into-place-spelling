import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "./support/app";
import { auditOutput } from "../../scripts/audit-output";

type Envelope = {
  type: string;
  payload: {
    payload_id: string; cr_user_id: string; sub_app_id: string; payload_version: number;
    collection: string; timestamp: string;
    data: { type: string; lang: string; tier: string; level_id?: number; attempts?: number; duration_ms?: number; score?: number; max_score?: number };
  };
};

async function messages(page: Page): Promise<Envelope[]> {
  return page.evaluate(() => window.__browserHarness.messages.map((message) => JSON.parse(message)));
}

async function complete(page: Page) {
  for (let index = 0; index < 3; index++) {
    await page.locator(`.tile[data-tile-id="t:${index}"]`).click();
    await page.clock.runFor(1);
    await page.locator(`[data-slot-index="${index}"]`).click();
    await page.clock.runFor(index === 2 ? 1201 : 301);
  }
}

test.describe("stage 7: bridge and emitted offline output", () => {
  for (const uuid of ["seeded", "native", "no-randomUUID", "no-crypto"] as const) {
    test(`T-24/T-25 records exact milestones and fresh UUIDs with ${uuid}`, async ({ app, page }) => {
      await app.launch({ audio: "mock", reducedMotion: "reduce", clock: true, bridge: "recording", uuid });
      expect(await messages(page)).toEqual([]);
      await page.getByRole("button", { name: "Let's spell!" }).click();
      await page.clock.runFor(1000);
      expect((await messages(page)).map((event) => event.payload.data.type)).toEqual(["session_started"]);
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.clock.runFor(5000);
      await page.getByRole("button", { name: "Close" }).click();
      await complete(page);
      await complete(page);
      const recorded = await messages(page);
      expect(recorded).toHaveLength(3);
      expect(recorded.map((event) => event.payload.data.type)).toEqual(["session_started", "level_completed", "level_completed"]);
      expect(new Set(recorded.map((event) => event.payload.payload_id)).size).toBe(3);
      for (const event of recorded) {
        expect(Object.keys(event)).toEqual(["type", "payload"]);
        expect(Object.keys(event.payload).sort()).toEqual(["collection", "cr_user_id", "data", "payload_id", "payload_version", "sub_app_id", "timestamp"]);
        expect(event.type).toBe("cr_event");
        expect(event.payload).toMatchObject({
          collection: "user_sessions_data", payload_version: 1, sub_app_id: "dev-drag-into-place", cr_user_id: "browser-fixture",
        });
        expect(event.payload.payload_id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
        expect(event.payload.timestamp).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
        expect(new Date(event.payload.timestamp).toISOString()).toBe(event.payload.timestamp);
        expect(event.payload.data).toMatchObject({ lang: "english", tier: "great" });
        expect(Buffer.byteLength(JSON.stringify(event), "utf8")).toBeLessThan(65_536);
        if (event.payload.data.type === "session_started") expect(Object.keys(event.payload.data).sort()).toEqual(["lang", "tier", "type"]);
        else {
          expect(Object.keys(event.payload.data).sort()).toEqual(["attempts", "duration_ms", "lang", "level_id", "max_score", "score", "tier", "type"]);
          expect(event.payload.data).toMatchObject({ level_id: 1, attempts: 3, score: 3, max_score: 3 });
          expect(event.payload.data.duration_ms).toBeGreaterThanOrEqual(0);
          expect(event.payload.data.duration_ms).toBeLessThan(2000);
        }
      }
      expect(await page.evaluate(() => window.__browserHarness.network.filter((entry) => ["beacon", "websocket", "eventsource"].includes(entry.api)))).toEqual([]);
    });
  }

  test("T-24 honors exact encoded user routing and an absent user stays empty", async ({ app, page }) => {
    await app.launch({ audio: "mock", bridge: "recording", reducedMotion: "reduce" });
    const url = new URL(app.url);
    url.searchParams.set("cr_user_id", "synthetic/é namespace");
    await page.goto(url.href);
    await page.getByRole("button", { name: "Let's spell!" }).click();
    expect((await messages(page))[0].payload.cr_user_id).toBe("synthetic/é namespace");
    url.searchParams.delete("cr_user_id");
    await page.goto(url.href);
    await page.getByRole("button", { name: "Let's spell!" }).click();
    expect((await messages(page))[0].payload.cr_user_id).toBe("");
  });

  for (const bridge of ["absent", "throwing"] as const) {
    test(`T-25 ${bridge} bridge never blocks play or retries a milestone`, async ({ app, page }) => {
      const warnings: string[] = [];
      page.on("console", (message) => { if (message.type() === "warning") warnings.push(message.text()); });
      await app.launch({ audio: "mock", reducedMotion: "reduce", clock: true, bridge });
      await page.getByRole("button", { name: "Let's spell!" }).click();
      await complete(page);
      await page.clock.runFor(10000);
      await expect(page.locator(".slot.locked")).toHaveCount(0);
      expect((await messages(page)).length).toBe(bridge === "absent" ? 0 : 2);
      expect(warnings.filter((code) => code === "BRIDGE_FAILED")).toHaveLength(bridge === "absent" ? 0 : 1);
      expect(warnings.filter((code) => /BRIDGE|EVENT_INVALID/.test(code))).toHaveLength(bridge === "absent" ? 0 : 1);
    });
  }

  test("T-25 oversized outbound events diagnose once without posting or blocking play", async ({ app, page }) => {
    const warnings: string[] = [];
    page.on("console", (message) => { if (message.type() === "warning") warnings.push(message.text()); });
    await app.launch({ audio: "mock", reducedMotion: "reduce", clock: true, bridge: "recording" });
    const url = new URL(app.url);
    url.searchParams.set("cr_user_id", "x".repeat(66000));
    await page.evaluate((href) => history.replaceState(null, "", href), url.href);
    await page.getByRole("button", { name: "Let's spell!" }).click();
    await complete(page);
    expect(await messages(page)).toEqual([]);
    expect(warnings.filter((code) => code === "EVENT_INVALID")).toHaveLength(1);
    await expect(page.getByRole("button", { name: "Hear the word" })).toBeEnabled();
    expect(await page.locator("main").innerText()).not.toContain("xxx");
  });

  test("T-26 audits and natively decodes the authored emitted media and local font", async ({ app, page }) => {
    test.setTimeout(30000);
    await app.launch({ fixture: "F-11", audio: "mock" });
    const result = await auditOutput(app.root);
    expect(result).toMatchObject({ media: 26, contentVersion: "1.4.1" });
    const pack = JSON.parse(await readFile(resolve(app.root, "lang", "english", "levels.json"), "utf8")) as {
      levels: Array<{ image_path: string; word_audio_path: string; letter_audio_paths: string[] }>;
    };
    const decoded = await page.evaluate(async (levels) => {
      const context = new AudioContext();
      const audioPaths = ["assets/audios/incorrect.wav", ...levels.flatMap((level) => [level.word_audio_path, ...level.letter_audio_paths])];
      try {
        const durations = await Promise.all(audioPaths.map(async (path) => {
          const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("GET", path);
            xhr.responseType = "arraybuffer";
            xhr.onload = () => xhr.response instanceof ArrayBuffer ? resolve(xhr.response) : reject(new Error("Missing audio buffer"));
            xhr.onerror = () => reject(new Error(`Unable to load ${path}`));
            xhr.send();
          });
          return (await context.decodeAudioData(bytes)).duration;
        }));
        const images = await Promise.all(levels.map((level) => new Promise<number>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image.naturalWidth);
          image.onerror = () => reject(new Error(`Unable to decode ${level.image_path}`));
          image.src = level.image_path;
        })));
        await document.fonts.ready;
        return { durations, images, font: [...document.fonts].some((font) => font.family === "Lexend" && font.status === "loaded") };
      } finally { await context.close(); }
    }, pack.levels);
    expect(decoded.durations).toHaveLength(21);
    expect(decoded.durations.every((duration) => duration > 0)).toBe(true);
    expect(decoded.images).toHaveLength(4);
    expect(decoded.images.every((width) => width > 0)).toBe(true);
    expect(decoded.font).toBe(true);
    await test.info().attach("emitted-asset-audit", { body: JSON.stringify(result), contentType: "application/json" });
  });

  test("T-26 the emitted audit rejects network APIs, external refs, maps, wrong case and corrupt media", async ({ app }) => {
    await app.launch({ audio: "mock" });
    const probe = resolve(app.root, "audit-probe.js");
    for (const source of [
      'fetch("https://example.invalid/data")', 'new Audio("/remote.wav")',
      'navigator.serviceWorker.register("./sw.js")', 'caches.open("runtime")',
      'new WebSocket("wss://example.invalid")', 'import "./Missing.js"',
      'const statsig = {};', '//# sourceMappingURL=hidden.map',
    ]) {
      await writeFile(probe, source);
      await expect(auditOutput(app.root)).rejects.toThrow("OUTPUT_INVALID");
    }
    await writeFile(probe, "");
    const imagePath = resolve(app.root, "assets", "images", "cat.svg");
    const image = await readFile(imagePath);
    await writeFile(imagePath, "not an SVG");
    await expect(auditOutput(app.root)).rejects.toThrow("wrong media format");
    await writeFile(imagePath, image);
    const contentPath = resolve(app.root, "lang", "english", "levels.json");
    const content = await readFile(contentPath, "utf8");
    await writeFile(contentPath, content.replace("assets/images/cat.svg", "assets/images/CAT.svg"));
    await expect(auditOutput(app.root)).rejects.toThrow("wrong-case media");
    await writeFile(contentPath, content);
    const htmlPath = resolve(app.root, "index.html");
    const html = await readFile(htmlPath, "utf8");
    await writeFile(htmlPath, `${html}<script src="https://example.invalid/sdk.js"></script>`);
    await expect(auditOutput(app.root)).rejects.toThrow("non-relative runtime reference");
    await writeFile(htmlPath, html);
    await expect(auditOutput(app.root)).resolves.toMatchObject({ contentVersion: "1.0.0" });
  });
});
