import { validateContentPack } from "../domain/content";

export function loadContentPack(timeoutMs = 10_000): Promise<ReturnType<typeof validateContentPack>> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const url = new URL("lang/english/levels.json", document.baseURI);
    const timer = window.setTimeout(() => {
      request.abort();
      reject(new Error("BOOT_TIMEOUT"));
    }, timeoutMs);
    request.open("GET", url.href);
    request.responseType = "text";
    request.onload = () => {
      window.clearTimeout(timer);
      if ((request.status !== 0 && request.status !== 200) || !request.responseText) {
        reject(new Error("CONTENT_INVALID: unable to load the English content pack"));
        return;
      }
      try {
        resolve(validateContentPack(JSON.parse(request.responseText) as unknown));
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("CONTENT_INVALID: unable to load the English content pack"));
    };
    request.ontimeout = () => {
      window.clearTimeout(timer);
      reject(new Error("BOOT_TIMEOUT"));
    };
    request.timeout = timeoutMs;
    request.send();
  });
}
