import type { ContentPack, Level } from "../../src/domain/content";
import { createEventEnvelope } from "../../src/services/bridge";

export const acceptanceViewports = [
  { width: 320, height: 568 }, { width: 568, height: 320 },
  { width: 768, height: 1024 }, { width: 1024, height: 768 },
  { width: 566, height: 600 }, { width: 800, height: 400 },
];

function level(id: number, word: string, foils: string[]): Level {
  return {
    level_id: id,
    target_word: word,
    letters: [...word.toUpperCase()],
    foils,
    image_path: `assets/images/${word}.svg`,
    image_alt: `Synthetic test picture for ${word}`,
    word_audio_path: `lang/english/audios/${word}.wav`,
    letter_audio_paths: [...word].map((_, index) => `lang/english/audios/${word}-${index}.wav`),
  };
}

function pack(levels: Level[]): ContentPack {
  return { schema_version: 1, content_version: "1.0.0", language: "english", levels };
}

export const contentFixtures = {
  "F-01": pack([level(1, "cat", ["B", "D"])]),
  "F-02": pack([level(1, "book", ["A", "Z"])]),
  "F-03": pack([level(1, "a", ["B", "C", "D", "F"]), level(2, "elephant", ["B", "C", "D", "F"])]),
  "F-04-single": pack([level(1, "cat", ["B", "D"])]),
  "F-04-cycle": pack([level(1, "cat", ["B", "D"]), level(2, "dog", ["A", "B"]), level(3, "bird", ["A", "C"])]),
} satisfies Record<string, ContentPack>;

export type ContentFixture = keyof typeof contentFixtures | "F-11";

export interface InvalidContentFixture {
  name: string;
  field: string;
  value: unknown;
}

function invalid(name: string, field: string, change: (value: ContentPack) => void): InvalidContentFixture {
  const value = structuredClone(contentFixtures["F-01"]);
  change(value);
  return { name, field, value };
}

export const invalidContentFixtures: InvalidContentFixture[] = [
  { name: "legacy-array", field: "/", value: contentFixtures["F-01"].levels },
  invalid("schema-version", "/schema_version", (p) => { Object.assign(p, { schema_version: 2 }); }),
  invalid("empty-pack", "/levels", (p) => { p.levels = []; }),
  invalid("duplicate-id", "/levels/1/level_id", (p) => { p.levels.push(structuredClone(p.levels[0])); }),
  invalid("unsafe-id", "/levels/0/level_id", (p) => { p.levels[0].level_id = Number.MAX_SAFE_INTEGER + 1; }),
  invalid("zero-id", "/levels/0/level_id", (p) => { p.levels[0].level_id = 0; }),
  invalid("empty-word", "/levels/0/target_word", (p) => { p.levels[0].target_word = ""; }),
  invalid("long-word", "/levels/0/target_word", (p) => { p.levels[0].target_word = "elephants"; }),
  invalid("non-roman", "/levels/0/target_word", (p) => { p.levels[0].target_word = "c4t"; }),
  invalid("letter-count", "/levels/0/letters", (p) => { p.levels[0].letters.pop(); }),
  invalid("letter-case", "/levels/0/letters", (p) => { p.levels[0].letters[0] = "c"; }),
  invalid("letter-multiset", "/levels/0/letters", (p) => { p.levels[0].letters[1] = "C"; }),
  invalid("overlapping-foil", "/levels/0/foils", (p) => { p.levels[0].foils = ["C"]; }),
  invalid("excess-foils", "/levels/0/foils", (p) => { p.levels[0].foils = ["B", "D", "F", "G", "H"]; }),
  invalid("letter-audio-count", "/levels/0/letter_audio_paths", (p) => { p.levels[0].letter_audio_paths.pop(); }),
  invalid("missing-field", "/levels/0", (p) => { Reflect.deleteProperty(p.levels[0], "image_alt"); }),
  invalid("unknown-field", "/levels/0", (p) => { Object.assign(p.levels[0], { extra: true }); }),
  invalid("pack-language", "/language", (p) => { Object.assign(p, { language: "french" }); }),
  invalid("content-version", "/content_version", (p) => { p.content_version = "invalid"; }),
  invalid("wrong-type", "/levels/0/foils", (p) => { Object.assign(p.levels[0], { foils: "B" }); }),
];

export const unsafePaths = [
  "/root/cat.svg", "https://example.invalid/cat.svg", "C:\\cat.svg",
  "assets/images/../cat.svg", "assets/images/%2e%2e/cat.svg",
  "assets/images/%2Fcat.svg", "assets/images/%5ccat.svg",
  "assets\\images\\cat.svg", "assets/images/cat.svg?query=1",
  "assets/images/cat.svg#fragment", "assets/images/%zz.svg",
];

export const unsafePathFixtures = unsafePaths.map((path) =>
  invalid(path, "/levels/0/image_path", (p) => { p.levels[0].image_path = path; }),
);

export const assetFaultFixtures = {
  "missing-image": { removeFiles: ["assets/images/cat.svg"] },
  "missing-font": { missingFont: true },
  "corrupt-audio": { corruptFiles: ["lang/english/audios/cat.wav"] },
  "wrong-case": { image_path: "assets/images/CAT.svg" },
  "missing-file": { image_path: "assets/images/missing.svg" },
  "wrong-png-format": { path: "assets/images/cat.png", data: '<svg xmlns="http://www.w3.org/2000/svg"/>' },
};

// These are inputs in the current implementation's format, not a normative
// resolution of the occurrence-counter/completion-phase specification gap.
export function snapshotFixture(kind: "partial" | "completed" | "stale" | "stale-schema" | "duplicate" | "wrong-letter" | "bad-hint" | "bad-tile") {
  const snapshot = {
    schema_version: 1,
    content_version: "1.0.0",
    tier: "great",
    level_id: 1,
    slots: ["t:0", null, null] as Array<string | null>,
    removedFoilIds: [] as string[],
    revealedHints: [] as number[],
    attempts: 1,
    phase: "playing",
    completion_recorded: false,
    elapsed_ms: 1000,
    cycleIds: [1],
    currentCycleIndex: 0,
  };
  if (kind === "completed") Object.assign(snapshot, {
    slots: ["t:0", "t:1", "t:2"], attempts: 3, phase: "completing", completion_recorded: true,
  });
  if (kind === "stale") snapshot.content_version = "0.0.0";
  if (kind === "stale-schema") snapshot.schema_version = 2;
  if (kind === "duplicate") snapshot.slots = ["t:0", "t:0", null];
  if (kind === "wrong-letter") snapshot.slots = ["t:1", null, null];
  if (kind === "bad-hint") snapshot.revealedHints = [3];
  if (kind === "bad-tile") snapshot.slots = ["t:3", null, null];
  return snapshot;
}

export const malformedJson = { truncated: '{"schema_version":', empty: "", corruptSnapshot: "{broken" };

export function bridgeEnvelopeFixture() {
  const envelope = createEventEnvelope(
    { type: "session_started", lang: "english", tier: "great" },
    "?cr_user_id=browser-fixture",
    new Date("2026-01-01T00:00:00Z"),
    "00000000-0000-4000-8000-000000000001",
  );
  if (!envelope) throw new Error("Cannot construct bridge fixture");
  return envelope;
}

export function bridgeEnvelopeAtBytes(bytes: number): string {
  const envelope = bridgeEnvelopeFixture();
  envelope.payload.sub_app_id = "";
  const overhead = new TextEncoder().encode(JSON.stringify(envelope)).length;
  if (!Number.isSafeInteger(bytes) || bytes < overhead) throw new Error(`Invalid fixture envelope size: ${bytes}`);
  envelope.payload.sub_app_id = "x".repeat(bytes - overhead);
  return JSON.stringify(envelope);
}

export const invalidBridgeEnvelope = {
  ...bridgeEnvelopeFixture(), payload: { ...bridgeEnvelopeFixture().payload, payload_id: "not-a-uuid" },
};

export const duplicateBridgeMessages = [JSON.stringify(bridgeEnvelopeFixture()), JSON.stringify(bridgeEnvelopeFixture())];

export function syntheticWave(frequency = 440): Buffer {
  const rate = 8000;
  const samples = 800;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) buffer.writeInt16LE(Math.round(1000 * Math.sin(2 * Math.PI * frequency * i / rate)), 44 + i * 2);
  return buffer;
}
