import { readdir } from "node:fs/promises";
import { extname, resolve } from "node:path";

export async function resolveExactCase(basePath: string, relativePath: string): Promise<string | null> {
  let current = basePath;
  for (const segment of relativePath.split("/")) {
    let names: string[];
    try {
      names = await readdir(current);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
      throw error;
    }
    if (!names.includes(segment)) return null;
    current = resolve(current, segment);
  }
  return current;
}

export function hasExpectedFormat(path: string, bytes: Buffer): boolean {
  switch (extname(path).toLowerCase()) {
    case ".svg":
      return bytes.toString("utf8").trimStart().startsWith("<svg") ||
        /^<\?xml[^>]*>\s*<svg/.test(bytes.toString("utf8").trimStart());
    case ".png":
      return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case ".jpg":
    case ".jpeg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
    case ".webp":
      return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    case ".mp3":
      return bytes.toString("ascii", 0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
    case ".wav":
      return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WAVE";
    case ".woff2":
      return bytes.toString("ascii", 0, 4) === "wOF2";
    default:
      return false;
  }
}
