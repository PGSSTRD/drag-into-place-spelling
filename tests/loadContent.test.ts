import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadContentPack } from "../src/services/loadContent";
import { contentFixtures } from "./fixtures/browser-content";

const body = JSON.stringify(contentFixtures["F-01"]);

class MockXHR {
  static instances: MockXHR[] = [];
  status = 0;
  response: unknown = body;
  responseText = body;
  responseType = "";
  timeout = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  abort = vi.fn();
  open = vi.fn();
  send = vi.fn();
  constructor() { MockXHR.instances.push(this); }
}

describe("protocol-aware bounded content loading", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockXHR.instances = [];
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    vi.stubGlobal("document", { baseURI: "file:///fixture/index.html" });
    vi.stubGlobal("XMLHttpRequest", MockXHR);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  for (const status of [0, 200]) {
    it(`accepts nonempty text from local XHR status ${status}`, async () => {
      const result = loadContentPack();
      const request = MockXHR.instances[0];
      request.status = status;
      request.onload?.();
      await expect(result).resolves.toEqual(contentFixtures["F-01"]);
      expect(request.responseType).toBe("text");
      expect(request.open).toHaveBeenCalledWith("GET", "file:///fixture/lang/english/levels.json");
    });
  }

  for (const variant of ["status", "empty", "type", "error"] as const) {
    it(`rejects local XHR ${variant} without partial content`, async () => {
      const result = loadContentPack();
      const assertion = expect(result).rejects.toThrow("CONTENT_INVALID");
      const request = MockXHR.instances[0];
      if (variant === "status") request.status = 404;
      if (variant === "empty") request.responseText = "";
      if (variant === "type") request.response = new ArrayBuffer(4);
      if (variant === "error") request.onerror?.();
      else request.onload?.();
      await assertion;
    });
  }

  it("times out exactly at 10 seconds and ignores captured late XHR callbacks", async () => {
    const result = loadContentPack();
    const assertion = expect(result).rejects.toThrow("BOOT_TIMEOUT");
    const request = MockXHR.instances[0];
    const late = request.onload;
    await vi.advanceTimersByTimeAsync(9999);
    expect(request.abort).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(request.abort).toHaveBeenCalledOnce();
    late?.();
    expect(request.onload).toBeNull();
  });

  it("cancels a local generation when its owner aborts", async () => {
    const controller = new AbortController();
    const result = loadContentPack(10000, controller.signal);
    const assertion = expect(result).rejects.toThrow("BOOT_TIMEOUT");
    controller.abort();
    await assertion;
    expect(MockXHR.instances[0].abort).toHaveBeenCalledOnce();
  });

  it("uses fetch for HTTP, validates the complete response and never creates XHR", async () => {
    vi.stubGlobal("document", { baseURI: "http://localhost/index.html" });
    const fetch = vi.fn().mockResolvedValue(new Response(body));
    vi.stubGlobal("fetch", fetch);
    await expect(loadContentPack()).resolves.toEqual(contentFixtures["F-01"]);
    expect(fetch.mock.calls[0][0].href).toBe("http://localhost/lang/english/levels.json");
    expect(MockXHR.instances).toHaveLength(0);
  });

  for (const response of [new Response(body, { status: 500 }), new Response("")]) {
    it(`rejects HTTP ${response.status} ${response.body ? "response" : "empty body"}`, async () => {
      vi.stubGlobal("document", { baseURI: "http://localhost/" });
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response.clone()));
      await expect(loadContentPack()).rejects.toThrow("CONTENT_INVALID");
    });
  }

  it("aborts a pending HTTP request at the deadline", async () => {
    vi.stubGlobal("document", { baseURI: "http://localhost/" });
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url: URL, init: RequestInit) => new Promise<Response>((_, reject) => {
      signal = init.signal ?? undefined;
      signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));
    const result = loadContentPack();
    const assertion = expect(result).rejects.toThrow("BOOT_TIMEOUT");
    await vi.advanceTimersByTimeAsync(9999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(signal?.aborted).toBe(true);
  });
});
