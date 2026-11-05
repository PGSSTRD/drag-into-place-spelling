import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { areAudioCuesAvailable, playAudioCue, setAudioMuted } from "../src/services/audio";

class MockAudio extends EventTarget {
  static unavailablePaths = new Set<string>();
  static pendingPaths = new Set<string>();
  static playError: unknown = null;
  static instances: MockAudio[] = [];
  preload = "";
  src = "";

  constructor(src?: string) {
    super();
    MockAudio.instances.push(this);
    if (src) this.src = src;
  }

  load() {
    if (MockAudio.pendingPaths.has(this.src)) return;
    queueMicrotask(() => {
      const event = MockAudio.unavailablePaths.has(this.src) ? "error" : "canplay";
      this.dispatchEvent(new Event(event));
    });
  }

  play(): Promise<void> {
    if (MockAudio.playError) return Promise.reject(MockAudio.playError);
    if (MockAudio.pendingPaths.has(this.src)) return Promise.resolve();
    queueMicrotask(() => this.dispatchEvent(new Event("ended")));
    return Promise.resolve();
  }

  pause() {}
}

describe("audio cue availability", () => {
  beforeEach(() => {
    MockAudio.unavailablePaths.clear();
    MockAudio.pendingPaths.clear();
    MockAudio.playError = null;
    MockAudio.instances = [];
    setAudioMuted(false);
    vi.stubGlobal("Audio", MockAudio);
    vi.stubGlobal("document", { baseURI: "http://localhost/" });
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reports available only when every required cue can play", async () => {
    await expect(areAudioCuesAvailable([
      "lang/english/audios/rabbit.mp3",
      "lang/english/audios/rabbit-0.mp3",
      "assets/audios/incorrect.wav",
    ])).resolves.toBe(true);

    MockAudio.unavailablePaths.add("http://localhost/lang/english/audios/rabbit-0.mp3");

    await expect(areAudioCuesAvailable([
      "lang/english/audios/rabbit.mp3",
      "lang/english/audios/rabbit-0.mp3",
      "assets/audios/incorrect.wav",
    ])).resolves.toBe(false);
  });

  it("settles the availability check when a required cue never loads", async () => {
    vi.useFakeTimers();
    MockAudio.pendingPaths.add("http://localhost/lang/english/audios/rabbit-0.mp3");

    const result = areAudioCuesAvailable([
      "lang/english/audios/rabbit.mp3",
      "lang/english/audios/rabbit-0.mp3",
    ], 25);
    await vi.advanceTimersByTimeAsync(25);

    await expect(result).resolves.toBe(false);
  });

  it("distinguishes playback-policy blocks from unavailable audio", async () => {
    MockAudio.playError = new DOMException("Playback requires a gesture", "NotAllowedError");
    await expect(playAudioCue("lang/english/audios/rabbit.mp3", false)).resolves.toBe("blocked");

    MockAudio.playError = new Error("Media decode failed");
    await expect(playAudioCue("lang/english/audios/rabbit.mp3", false)).resolves.toBe("unavailable");
  });

  it("settles a pending playback at exactly 4000 ms and ignores stale events", async () => {
    vi.useFakeTimers();
    MockAudio.pendingPaths.add("http://localhost/pending.wav");
    const finished = vi.fn();
    const result = playAudioCue("pending.wav", false).then(finished);
    await vi.advanceTimersByTimeAsync(3999);
    expect(finished).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await result;
    expect(finished).toHaveBeenCalledExactlyOnceWith("unavailable");
    MockAudio.instances[0].dispatchEvent(new Event("ended"));
    MockAudio.instances[0].dispatchEvent(new Event("error"));
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it("muting settles active and queued cues without starting more media", async () => {
    MockAudio.pendingPaths.add("http://localhost/mute-active.wav");
    const active = playAudioCue("mute-active.wav", false);
    const queued = playAudioCue("mute-queued.wav", false);
    setAudioMuted(true);
    await expect(active).resolves.toBe("muted");
    await expect(queued).resolves.toBe("muted");
    await expect(playAudioCue("mute-new.wav", false)).resolves.toBe("muted");
    expect(MockAudio.instances).toHaveLength(1);
    setAudioMuted(false);
    await expect(playAudioCue("unmuted.wav", false)).resolves.toBe("played");
  });
});
