export function preloadImage(path: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const cancel = () => finish(new Error("BOOT_TIMEOUT"));
    function finish(error?: Error) {
      image.onload = image.onerror = null;
      signal.removeEventListener("abort", cancel);
      if (error) reject(error);
      else resolve();
    }
    image.onload = () => finish();
    image.onerror = () => finish(new Error(`CONTENT_INVALID: image unavailable: ${path}`));
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) {
      cancel();
      return;
    }
    image.src = new URL(path, document.baseURI).href;
  });
}

export async function preloadFont(): Promise<void> {
  let timer: number | undefined;
  try {
    const faces = await Promise.race([
      document.fonts.load("16px Lexend"),
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error("Font load timed out")), 4000);
      }),
    ]);
    if (!faces.length) throw new Error("Lexend is unavailable");
  } catch (error) {
    console.warn("FONT_UNAVAILABLE", error instanceof Error ? error.message : String(error));
  } finally {
    window.clearTimeout(timer);
  }
}
