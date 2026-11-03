import type { Page } from "@playwright/test";

export type AudioOutcome = "played" | "unavailable" | "blocked" | "pending";
export interface RuntimeOptions {
  seed?: number;
  audio?: "real" | "mock";
  audioOutcomes?: Record<string, AudioOutcome>;
  bridge?: "absent" | "recording" | "throwing";
  storage?: "normal" | "read-denied" | "write-denied";
  stallContentXHR?: boolean;
  savedProgress?: unknown;
  savedMute?: boolean;
}

interface BrowserHarness {
  seed: number;
  randomValues: number[];
  events: Array<{ type: string; path: string; id?: number }>;
  messages: string[];
  outcomes: Record<string, AudioOutcome>;
  network: Array<{ api: string; url: string }>;
  emitAudio: (path: string, type: "canplay" | "ended" | "error", id?: number) => void;
}

declare global {
  interface Window {
    __browserHarness: BrowserHarness;
  }
}

export async function installRuntime(page: Page, options: RuntimeOptions): Promise<void> {
  await page.addInitScript((config) => {
    const seed = config.seed ?? 12345;
    const randomValues: number[] = [];
    let randomState = seed >>> 0;
    Math.random = () => {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      const value = randomState / 4294967296;
      randomValues.push(value);
      return value;
    };
    const uuidKey = "browser-harness:uuid-count";
    const storeUuid = Storage.prototype.setItem.bind(sessionStorage);
    let uuidCount = Number(sessionStorage.getItem(uuidKey) ?? "0");
    crypto.randomUUID = () => {
      storeUuid(uuidKey, String(++uuidCount));
      return `00000000-0000-4000-8000-${uuidCount.toString(16).padStart(12, "0")}`;
    };
    const elements = new Set<HTMLMediaElement>();
    const elementIds = new WeakMap<HTMLMediaElement, number>();
    const state: BrowserHarness = {
      seed,
      randomValues,
      events: [],
      messages: [],
      outcomes: config.audioOutcomes ?? {},
      network: [],
      emitAudio(path, type, id) {
        for (const element of elements) {
          if (new URL(element.src).pathname.endsWith(path) && (id === undefined || elementIds.get(element) === id)) {
            element.dispatchEvent(new Event(type));
          }
        }
      },
    };
    window.__browserHarness = state;
    const recordNetwork = (api: string, url: string | URL) => {
      const attempt = { api, url: new URL(url, document.baseURI).href };
      state.network.push(attempt);
      console.debug("__browserHarnessNetwork", JSON.stringify(attempt));
    };
    const fetch = window.fetch;
    window.fetch = function (input, init) {
      recordNetwork("fetch", input instanceof Request ? input.url : input);
      return fetch.call(this, input, init);
    };
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, async: boolean = true, username: string | null = null, password: string | null = null) {
      recordNetwork("xhr", url);
      open.call(this, method, url, async, username, password);
    };
    const beacon = navigator.sendBeacon;
    navigator.sendBeacon = function (url, data) {
      recordNetwork("beacon", url);
      return beacon.call(this, url, data);
    };
    const NativeWebSocket = window.WebSocket;
    window.WebSocket = class extends NativeWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        recordNetwork("websocket", url);
        super(url, protocols);
      }
    };
    const NativeEventSource = window.EventSource;
    window.EventSource = class extends NativeEventSource {
      constructor(url: string | URL, init?: EventSourceInit) {
        recordNetwork("eventsource", url);
        super(url, init);
      }
    };
    if (config.stallContentXHR) {
      const urls = new WeakMap<XMLHttpRequest, string>();
      const open = XMLHttpRequest.prototype.open;
      const send = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (method: string, url: string | URL, async: boolean = true, username: string | null = null, password: string | null = null) {
        urls.set(this, new URL(url, document.baseURI).pathname);
        open.call(this, method, url, async, username, password);
      };
      XMLHttpRequest.prototype.send = function (body) {
        const path = urls.get(this);
        if (path?.endsWith("/lang/english/levels.json")) {
          state.events.push({ type: "xhr-stalled", path });
          return;
        }
        send.call(this, body);
      };
    }
    if (config.bridge !== "absent" && config.bridge !== undefined) {
      window.ReactNativeWebView = {
        postMessage(message: string) {
          state.messages.push(message);
          if (config.bridge === "throwing") throw new Error("Injected bridge failure");
        },
      };
    }

    const user = new URLSearchParams(location.search).get("cr_user_id") || "guest";
    const prefix = `drag-into-place:v1:${encodeURIComponent(user)}:english`;
    // Seed once per tab, so reload tests observe the application's own writes.
    const marker = `${prefix}:fixture-seeded`;
    if ((config.savedProgress !== undefined || config.savedMute !== undefined) && !sessionStorage.getItem(marker)) {
      if (config.savedProgress !== undefined) {
        localStorage.setItem(prefix, typeof config.savedProgress === "string"
          ? config.savedProgress : JSON.stringify(config.savedProgress));
      }
      if (config.savedMute !== undefined) localStorage.setItem(`${prefix}:settings`, JSON.stringify({ muted: config.savedMute }));
      sessionStorage.setItem(marker, "true");
    }
    if (config.storage === "read-denied") {
      Storage.prototype.getItem = () => { throw new DOMException("Injected read failure", "SecurityError"); };
    }
    if (config.storage === "write-denied") {
      Storage.prototype.setItem = () => { throw new DOMException("Injected write failure", "QuotaExceededError"); };
    }
    if (config.audio !== "mock") return;

    const sources = new WeakMap<HTMLMediaElement, string>();
    const endTimers = new WeakMap<HTMLMediaElement, number>();
    const NativeAudio = window.Audio;
    Object.defineProperty(HTMLMediaElement.prototype, "src", {
      configurable: true,
      get(this: HTMLMediaElement) { return sources.get(this) ?? ""; },
      set(this: HTMLMediaElement, value: string) { sources.set(this, new URL(value, document.baseURI).href); },
    });
    window.Audio = class extends NativeAudio {
      constructor(src?: string) {
        super();
        if (src !== undefined) this.src = src;
      }
    };
    const pathOf = (audio: HTMLMediaElement) => new URL(audio.src).pathname;
    const outcomeOf = (audio: HTMLMediaElement) => {
      const path = pathOf(audio);
      return Object.entries(state.outcomes).find(([suffix]) => path.endsWith(suffix))?.[1] ?? "played";
    };
    const record = (audio: HTMLMediaElement, type: string) => {
      elements.add(audio);
      if (!elementIds.has(audio)) elementIds.set(audio, elements.size);
      state.events.push({ type, path: pathOf(audio), id: elementIds.get(audio) });
    };
    HTMLMediaElement.prototype.load = function () {
      record(this, "load");
      const outcome = outcomeOf(this);
      if (outcome !== "pending") queueMicrotask(() => this.dispatchEvent(new Event(outcome === "unavailable" ? "error" : "canplay")));
    };
    HTMLMediaElement.prototype.play = function () {
      record(this, "play");
      const outcome = outcomeOf(this);
      if (outcome === "blocked") return Promise.reject(new DOMException("Injected autoplay block", "NotAllowedError"));
      if (outcome === "unavailable") return Promise.reject(new DOMException("Injected media failure", "NotSupportedError"));
      if (outcome === "played") {
        endTimers.set(this, window.setTimeout(() => {
          record(this, "ended");
          this.dispatchEvent(new Event("ended"));
        }, 50));
      }
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      record(this, "pause");
      window.clearTimeout(endTimers.get(this));
    };
  }, options);
}
