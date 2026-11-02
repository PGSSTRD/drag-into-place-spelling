export type AudioCueResult = "played" | "unavailable" | "blocked" | "muted";

const reportedFailures = new Set<string>();
let queue: Promise<AudioCueResult> = Promise.resolve("played");
let queueBusy = false;
let audioContext: AudioContext | null = null;
let unlockFailureReported = false;

export function playAudioCue(path: string, muted: boolean): Promise<AudioCueResult> {
  if (muted) return Promise.resolve("muted");
  if (!queueBusy) return startQueuedCue(path).catch(() => {
    reportFailure(path);
    return "unavailable";
  });
  const result = queue.then(() => startQueuedCue(path));
  queue = result.catch(() => "unavailable");
  return result.catch(() => {
    reportFailure(path);
    return "unavailable";
  });
}

export async function areAudioCuesAvailable(paths: string[], timeoutMs = 4000): Promise<boolean> {
  const results = await Promise.allSettled(paths.map((path) => checkOne(path, timeoutMs)));
  return results.every((result) => result.status === "fulfilled" && result.value);
}

export async function unlockAudio(): Promise<boolean> {
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
    return audioContext.state !== "suspended";
  } catch {
    reportUnlockFailure();
    return false;
  }
}

function checkOne(path: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let audio: HTMLAudioElement;
    try {
      audio = new Audio();
      audio.preload = "auto";
      audio.src = new URL(path, document.baseURI).href;
    } catch {
      reportFailure(path);
      resolve(false);
      return;
    }

    let settled = false;
    const timeout = window.setTimeout(() => finish(false), timeoutMs);

    function finish(available: boolean) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("error", onError);
      audio.pause();
      if (!available) reportFailure(path);
      resolve(available);
    }

    function onCanPlay() { finish(true); }
    function onError() { finish(false); }

    audio.addEventListener("canplay", onCanPlay, { once: true });
    audio.addEventListener("error", onError, { once: true });
    try {
      audio.load();
    } catch {
      finish(false);
    }
  });
}

function playOne(path: string): Promise<AudioCueResult> {
  return new Promise((resolve) => {
    let audio: HTMLAudioElement;
    try {
      const url = new URL(path, document.baseURI).href;
      audio = new Audio(url);
    } catch {
      reportFailure(path);
      resolve("unavailable");
      return;
    }
    let settled = false;
    const timeout = window.setTimeout(() => finish("unavailable"), 4000);

    function finish(result: AudioCueResult) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.pause();
      if (result === "unavailable") reportFailure(path);
      resolve(result);
    }

    function onEnded() { finish("played"); }
    function onError() { finish("unavailable"); }

    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener("error", onError, { once: true });
    try {
      audio.play().catch((reason: unknown) => {
        if (isPlaybackBlocked(reason)) {
          finish("blocked");
        } else {
          finish("unavailable");
        }
      });
    } catch {
      finish("unavailable");
    }
  });
}

function isPlaybackBlocked(reason: unknown): boolean {
  return reason instanceof DOMException && reason.name === "NotAllowedError";
}

function startQueuedCue(path: string): Promise<AudioCueResult> {
  queueBusy = true;
  const result = playOne(path).finally(() => {
    queueBusy = false;
  });
  queue = result.catch(() => "unavailable");
  return result;
}

function reportFailure(path: string) {
  if (reportedFailures.has(path)) return;
  reportedFailures.add(path);
  console.warn("AUDIO_UNAVAILABLE", path);
}

function reportUnlockFailure() {
  if (unlockFailureReported) return;
  unlockFailureReported = true;
  console.warn("AUDIO_UNAVAILABLE");
}
