import Ajv, { type JSONSchemaType } from "ajv";

export interface Level {
  level_id: number;
  target_word: string;
  letters: string[];
  foils: string[];
  image_path: string;
  word_audio_path: string;
  letter_audio_paths: string[];
  image_alt: string;
}

export interface ContentPack {
  schema_version: 1;
  content_version: string;
  language: "english";
  levels: Level[];
}

const levelSchema: JSONSchemaType<Level> = {
  type: "object",
  properties: {
    level_id: { type: "integer", minimum: 1 },
    target_word: { type: "string", pattern: "^[a-z]{1,8}$" },
    letters: {
      type: "array",
      items: { type: "string", pattern: "^[A-Z]$" },
    },
    foils: {
      type: "array",
      items: { type: "string", pattern: "^[A-Z]$" },
      maxItems: 4,
    },
    image_path: { type: "string", minLength: 1 },
    word_audio_path: { type: "string", minLength: 1 },
    letter_audio_paths: {
      type: "array",
      items: { type: "string", minLength: 1 },
    },
    image_alt: { type: "string", minLength: 1 },
  },
  required: [
    "level_id",
    "target_word",
    "letters",
    "foils",
    "image_path",
    "word_audio_path",
    "letter_audio_paths",
    "image_alt",
  ],
  additionalProperties: false,
};

const packSchema: JSONSchemaType<ContentPack> = {
  type: "object",
  properties: {
    schema_version: { type: "integer", const: 1 },
    content_version: {
      type: "string",
      pattern: "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$",
    },
    language: { type: "string", const: "english" },
    levels: {
      type: "array",
      minItems: 1,
      items: levelSchema,
    },
  },
  required: ["schema_version", "content_version", "language", "levels"],
  additionalProperties: false,
};

const validatePack = new Ajv({ allErrors: true }).compile(packSchema);
const safeInteger = Number.isSafeInteger;

export function validateContentPack(input: unknown): ContentPack {
  if (!validatePack(input)) {
    const details = (validatePack.errors ?? [])
      .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
      .join("; ");
    throw new Error(`CONTENT_INVALID: ${details}`);
  }

  const ids = new Set<number>();
  for (const [index, level] of input.levels.entries()) {
    const prefix = `/levels/${index}`;
    if (!safeInteger(level.level_id)) {
      throw new Error(`CONTENT_INVALID: ${prefix}/level_id must be a safe integer`);
    }
    if (ids.has(level.level_id)) {
      throw new Error(`CONTENT_INVALID: ${prefix}/level_id is duplicated`);
    }
    ids.add(level.level_id);

    const expected = [...level.target_word.toUpperCase()].sort().join("");
    if (
      level.letters.length !== level.target_word.length ||
      [...level.letters].sort().join("") !== expected
    ) {
      throw new Error(`CONTENT_INVALID: ${prefix}/letters must match the target word`);
    }
    if (level.letter_audio_paths.length !== level.target_word.length) {
      throw new Error(`CONTENT_INVALID: ${prefix}/letter_audio_paths must match word length`);
    }
    if (level.foils.some((foil) => level.target_word.includes(foil.toLowerCase()))) {
      throw new Error(`CONTENT_INVALID: ${prefix}/foils cannot contain target letters`);
    }

    for (const [field, paths] of [
      ["image_path", [level.image_path]],
      ["word_audio_path", [level.word_audio_path]],
      ["letter_audio_paths", level.letter_audio_paths],
    ] as const) {
      for (const path of paths) {
        if (!isSafeContentPath(path, field === "image_path" ? "assets/images/" : "lang/english/audios/")) {
          throw new Error(`CONTENT_INVALID: ${prefix}/${field} contains an unsafe path`);
        }
      }
    }
  }

  return input;
}

function isSafeContentPath(path: string, requiredPrefix: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return false;
  }
  return (
    !/%2f|%5c/i.test(path) &&
    decoded.startsWith(requiredPrefix) &&
    !decoded.includes("\\") &&
    !decoded.includes("..") &&
    !decoded.includes("?") &&
    !decoded.includes("#") &&
    !decoded.startsWith("/") &&
    !/^[a-z][a-z\d+.-]*:/i.test(decoded)
  );
}
