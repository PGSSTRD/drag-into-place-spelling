import { validateContentPack } from "../domain/content";

export async function loadContentPack(timeoutMs = 10_000, signal?: AbortSignal): Promise<ReturnType<typeof validateContentPack>> {
  const url = new URL("lang/english/levels.json", document.baseURI);
  if (url.protocol !== "file:") {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = window.setTimeout(cancel, timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("CONTENT_INVALID: unable to load the English content pack");
      const text = await response.text();
      if (controller.signal.aborted) throw new Error("BOOT_TIMEOUT");
      if (!text) throw new Error("CONTENT_INVALID: empty English content pack");
      return validateContentPack(JSON.parse(text) as unknown);
    } catch (error) {
      if (controller.signal.aborted) throw new Error("BOOT_TIMEOUT");
      throw error;
    } finally {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    }
  }
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    let settled = false;
    const cancel = () => finish(new Error("BOOT_TIMEOUT"));
    const timer = window.setTimeout(cancel, timeoutMs);
    function finish(error?: unknown, text?: string) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      request.onload = request.onerror = request.ontimeout = null;
      request.abort();
      if (error) {
        reject(error);
        return;
      }
      try {
        if (typeof text !== "string") throw new Error("CONTENT_INVALID: expected text content");
        resolve(validateContentPack(JSON.parse(text) as unknown));
      } catch (reason) {
        reject(reason);
      }
    }
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) {
      cancel();
      return;
    }
    request.open("GET", url.href);
    request.responseType = "text";
    request.onload = () => {
      if ((request.status !== 0 && request.status !== 200) || typeof request.response !== "string" || !request.responseText) {
        finish(new Error("CONTENT_INVALID: unable to load the English content pack"));
        return;
      }
      finish(undefined, request.responseText);
    };
    request.onerror = () => finish(new Error("CONTENT_INVALID: unable to load the English content pack"));
    request.ontimeout = cancel;
    request.timeout = timeoutMs;
    request.send();
  });
}
