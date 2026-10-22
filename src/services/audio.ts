const reportedFailures = new Set<string>();
let queue: Promise<boolean> = Promise.resolve(true);
let queueBusy = false;
let audioContext: AudioContext | null = null;
let unlockFailureReported = false;

export function playAudioCue(path: string, muted: boolean): Promise<boolean> {
  if (muted) return Promise.resolve(true);
  if (!queueBusy) return startQueuedCue(path).catch(() => {
    reportFailure(path);
    return false;
  });
  const result = queue.then(() => startQueuedCue(path));
  queue = result.catch(() => false);
  return result.catch(() => {
    reportFailure(path);
    return false;
  });
}

export function unlockAudio(): void {
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(reportUnlockFailure);
    }
  } catch {
    reportUnlockFailure();
  }
}

function playOne(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    let audio: HTMLAudioElement;
    try {
      const url = new URL(path, document.baseURI).href;
      audio = new Audio(url);
    } catch {
      reportFailure(path);
      resolve(false);
      return;
    }
    let settled = false;
    const timeout = window.setTimeout(() => finish(true), 4000);

    function finish(failed: boolean) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.pause();
      if (failed) reportFailure(path);
      resolve(!failed);
    }

    function onEnded() { finish(false); }
    function onError() { finish(true); }

    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener("error", onError, { once: true });
    try {
      audio.play().catch(() => finish(true));
    } catch {
      finish(true);
    }
  });
}

function startQueuedCue(path: string): Promise<boolean> {
  queueBusy = true;
  const result = playOne(path).finally(() => {
    queueBusy = false;
  });
  queue = result.catch(() => false);
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
