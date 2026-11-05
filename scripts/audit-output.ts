import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, posix, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { validateContentPack } from "../src/domain/content";
import { hasExpectedFormat, resolveExactCase } from "./content-assets";

export async function auditOutput(root: string): Promise<{ files: number; media: number; contentVersion: string }> {
  const issues: string[] = [];
  const files: string[] = [];
  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) issues.push(`${relative(root, file)}: symlink is not allowed`);
      else if (entry.isDirectory()) await walk(file);
      else files.push(file);
    }
  }
  await walk(root);
  async function checkReference(owner: string, raw: string) {
    if (raw.startsWith("#")) return;
    if (/^(?:\/|[a-z][a-z\d+.-]*:)/i.test(raw) || /[\\?#]/.test(raw)) {
      issues.push(`${relative(root, owner)}: non-relative runtime reference ${raw}`);
      return;
    }
    const target = resolve(dirname(owner), decodeURIComponent(raw));
    const local = relative(root, target).split(sep).join("/");
    if (local.startsWith("../") || !await resolveExactCase(root, local)) {
      issues.push(`${relative(root, owner)}: missing or wrong-case reference ${raw}`);
    }
  }
  for (const file of files) {
    if (file.endsWith(".map")) issues.push(`${relative(root, file)}: source map`);
    const extension = extname(file);
    if (![".html", ".js", ".css", ".svg"].includes(extension)) continue;
    const text = await readFile(file, "utf8");
    if (/sourceMappingURL\s*=/.test(text)) issues.push(`${relative(root, file)}: source map directive`);
    if (extension === ".html" || extension === ".svg") {
      for (const match of text.matchAll(/\b(?:src|href|xlink:href)\s*=\s*["']([^"']+)["']/g)) await checkReference(file, match[1]);
    }
    if (extension === ".css") {
      for (const match of text.matchAll(/(?:url\(\s*["']?([^"')\s]+)|@import\s+["']([^"']+))/g)) await checkReference(file, match[1] ?? match[2]);
    }
    if (extension === ".js") {
      if (/\b(?:statsig|firebase|mixpanel|googletagmanager|google-analytics|rive_fallback\.wasm)\b/i.test(text)) {
        issues.push(`${relative(root, file)}: forbidden SDK/runtime marker`);
      }
      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
      const visit = (node: ts.Node) => {
        if (ts.isIdentifier(node) && ["serviceWorker", "caches", "WebSocket", "EventSource"].includes(node.text)) {
          issues.push(`${relative(root, file)}: forbidden runtime API ${node.text}`);
        }
        if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && node.arguments) {
          const target = node.expression.getText(source);
          const first = node.arguments[0];
          if (first && ts.isStringLiteralLike(first) && /(?:fetch|open|Audio|URL|import)$/.test(target) &&
            /^(?:\/|https?:|wss?:)/i.test(first.text)) {
            issues.push(`${relative(root, file)}: external/root-relative runtime call ${first.text}`);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      for (const match of text.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g)) await checkReference(file, match[1]);
    }
  }
  const pack = validateContentPack(JSON.parse(await readFile(resolve(root, "lang", "english", "levels.json"), "utf8")) as unknown);
  const media = new Set(["assets/audios/incorrect.wav", "assets/fonts/lexend-v26-latin-regular.woff2"]);
  for (const level of pack.levels) {
    for (const asset of [level.image_path, level.word_audio_path, ...level.letter_audio_paths]) media.add(asset);
  }
  const licenses = JSON.parse(await readFile(resolve(root, "licenses.json"), "utf8")) as {
    assets: Array<{ path: string; creator: string; license: string; source: string; notes: string }>;
  };
  for (const asset of media) {
    const file = await resolveExactCase(root, asset);
    if (!file) issues.push(`${asset}: missing or wrong-case media`);
    else if (!hasExpectedFormat(asset, await readFile(file))) issues.push(`${asset}: wrong media format`);
    const records = licenses.assets.filter((entry) => entry.path === asset);
    if (records.length !== 1 || !records.every((entry) => entry.creator && entry.license && entry.source && entry.notes)) {
      issues.push(`${asset}: requires exactly one complete license record`);
    }
  }
  if (!await resolveExactCase(root, "assets/fonts/OFL-Lexend.txt")) issues.push("Missing Lexend OFL notice");
  const cssFiles = files.filter((file) => file.endsWith(".css"));
  const fontReferences: string[] = [];
  for (const file of cssFiles) {
    const css = await readFile(file, "utf8");
    for (const match of css.matchAll(/url\(["']?([^"')]+\.woff2)["']?\)/g)) {
      const asset = posix.normalize(posix.join(relative(root, dirname(file)).split(sep).join("/"), match[1]));
      const exact = await resolveExactCase(root, asset);
      if (exact && hasExpectedFormat(asset, await readFile(exact))) fontReferences.push(asset);
    }
  }
  if (!fontReferences.some((asset) => /lexend/i.test(asset))) issues.push("No valid emitted Lexend CSS reference");
  if (issues.length) throw new Error(`OUTPUT_INVALID:\n${[...new Set(issues)].map((issue) => `- ${issue}`).join("\n")}`);
  return { files: files.length, media: media.size, contentVersion: pack.content_version };
}
