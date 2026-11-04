export type AudioCueResult = "played" | "unavailable" | "blocked" | "muted";

const reportedFailures = new Set<string>();
let queue: Promise<AudioCueResult> = Promise.resolve("played");
let queueBusy = false;
let audioContext: AudioContext | null = null;
let unlockFailureReported = false;
let audioSuspended = false;
const activeCues = new Set<{ pause: () => void; resume: () => void }>();

export function suspendAudioCues(): void {
  audioSuspended = true;
  for (const cue of activeCues) cue.pause();
}

export function resumeAudioCues(): void {
  audioSuspended = false;
  for (const cue of activeCues) cue.resume();
}

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
    let suspended = audioSuspended;
    let remainingTimeoutMs = 4000;
    let timeoutStartedAt: number | null = null;
    let timeout: number | null = null;

    function finish(result: AudioCueResult) {
      if (settled) return;
      settled = true;
      if (timeout !== null) window.clearTimeout(timeout);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      activeCues.delete(cue);
      audio.pause();
      if (result === "unavailable") reportFailure(path);
      resolve(result);
    }

    function onEnded() {
      if (!suspended) finish("played");
    }

    function onError() { finish("unavailable"); }

    function startPlayback() {
      if (settled || suspended) return;
      timeoutStartedAt = performance.now();
      timeout = window.setTimeout(() => finish("unavailable"), remainingTimeoutMs);
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
    }

    const cue = {
      pause() {
        if (settled || suspended) return;
        suspended = true;
        if (timeout !== null && timeoutStartedAt !== null) {
          remainingTimeoutMs = Math.max(0, remainingTimeoutMs - (performance.now() - timeoutStartedAt));
          window.clearTimeout(timeout);
          timeout = null;
          timeoutStartedAt = null;
        }
        audio.pause();
      },
      resume() {
        if (settled || !suspended) return;
        suspended = false;
        startPlayback();
      },
    };

    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener("error", onError, { once: true });
    activeCues.add(cue);
    if (!suspended) startPlayback();
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
