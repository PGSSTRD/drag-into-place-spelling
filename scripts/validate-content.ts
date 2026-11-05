import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateContentPack } from "../src/domain/content";
import { hasExpectedFormat, resolveExactCase } from "./content-assets";

const root = process.cwd();
const levelsPath = resolve(root, "content/lang/english/levels.json");

try {
  const pack = validateContentPack(JSON.parse(await readFile(levelsPath, "utf8")) as unknown);
  const paths = new Set<string>(["assets/audios/incorrect.wav", "assets/fonts/lexend-v26-latin-regular.woff2"]);
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
