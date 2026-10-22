import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { validateContentPack } from "../src/domain/content";

const root = process.cwd();
const levelsPath = resolve(root, "content/lang/english/levels.json");

try {
  const pack = validateContentPack(JSON.parse(await readFile(levelsPath, "utf8")) as unknown);
  const paths = new Set<string>(["assets/audios/incorrect.wav", "assets/fonts/reader.woff2"]);
  for (const level of pack.levels) {
    paths.add(level.image_path);
    paths.add(level.word_audio_path);
    for (const path of level.letter_audio_paths) paths.add(path);
  }
  const issues: string[] = [];
  let licenses: { assets?: Array<{ path?: string; creator?: string; license?: string; source?: string; notes?: string }> } = {};
  try {
    licenses = JSON.parse(await readFile(resolve(root, "content/licenses.json"), "utf8")) as typeof licenses;
  } catch {
    issues.push("content/licenses.json is missing or invalid JSON");
  }
  const licensedPaths = new Set(
    licenses.assets
      ?.filter((asset) => asset.path && asset.creator && asset.license && asset.source && asset.notes)
      .map((asset) => asset.path) ?? [],
  );

  for (const path of paths) {
    if (!licensedPaths.has(path)) issues.push(`${path} has no complete license record`);
    const assetPath = await resolveExactCase(resolve(root, "content"), path);
    if (!assetPath) {
      issues.push(`${path} is missing or has incorrect path casing`);
      continue;
    }
    try {
      const bytes = await readFile(assetPath);
      if (!hasExpectedFormat(path, bytes)) issues.push(`${path} does not match its declared media format`);
    } catch (error) {
      if (error instanceof Error) issues.push(`${path} could not be read`);
    }
  }
  if (issues.length) {
    console.error(`CONTENT_INVALID:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log(`Validated ${pack.levels.length} ${pack.language} level(s).`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "CONTENT_INVALID");
  process.exitCode = 1;
}

async function resolveExactCase(basePath: string, relativePath: string): Promise<string | null> {
  let current = basePath;
  for (const segment of relativePath.split("/")) {
    let names: string[];
    try {
      names = await readdir(current);
    } catch {
      return null;
    }
    if (!names.includes(segment)) return null;
    current = resolve(current, segment);
  }
  return current;
}

function hasExpectedFormat(path: string, bytes: Buffer): boolean {
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
