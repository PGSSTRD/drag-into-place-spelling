import { describe, expect, it } from "vitest";
import { validateContentPack } from "../src/domain/content";

const pack = {
  schema_version: 1,
  content_version: "1.0.0",
  language: "english",
  levels: [{
    level_id: 1,
    target_word: "cat",
    letters: ["C", "A", "T"],
    foils: ["B"],
    image_path: "assets/images/cat.svg",
    word_audio_path: "lang/english/audios/cat.wav",
    letter_audio_paths: ["lang/english/audios/cat-0.wav", "lang/english/audios/cat-1.wav", "lang/english/audios/cat-2.wav"],
    image_alt: "A cat",
  }],
};

describe("content validation", () => {
  it("accepts a valid English pack", () => {
    expect(validateContentPack(pack)).toEqual(pack);
  });

  it("rejects duplicate tile letters that do not match the target", () => {
    const invalid = structuredClone(pack);
    invalid.levels[0].letters = ["C", "C", "T"];
    expect(() => validateContentPack(invalid)).toThrow("/levels/0/letters");
  });

  it("rejects encoded traversal paths", () => {
    const invalid = structuredClone(pack);
    invalid.levels[0].image_path = "assets/images/%2e%2e/cat.svg";
    expect(() => validateContentPack(invalid)).toThrow("/levels/0/image_path");
  });
});
