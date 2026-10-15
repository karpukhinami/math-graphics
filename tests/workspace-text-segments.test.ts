import { describe, expect, test } from "bun:test";
import { splitTextImages, replaceTextSegment } from "../src/lib/workspace/text-segments";

describe("inline images preserve stored text", () => {
  const text = "Первый $x^2$\n![Чертёж](plot:abc)\nВторой\n![Чертёж](plot:def)\nКонец";
  test("original and beautified image keep their positions and order", () => {
    const parts = splitTextImages(text, () => true);
    expect(parts.filter((part) => part.kind === "image").map((part) => part.imageId)).toEqual(["abc", "def"]);
    expect(parts.map((part) => text.slice(part.start, part.end)).join("")).toBe(text);
  });
  test("editing text between images leaves both references and formulas intact", () => {
    const part = splitTextImages(text, () => true)[2];
    expect(replaceTextSegment(text, part.start, part.end, "\nНовый\n")).toBe("Первый $x^2$\n![Чертёж](plot:abc)\nНовый\n![Чертёж](plot:def)\nКонец");
  });
  test("selection after an image maps back to the complete Markdown", () => {
    const part = splitTextImages(text, () => true)[2];
    expect(text.slice(part.start + 1, part.start + 7)).toBe("Второй");
  });
  test("missing images remain editable references rather than losing data", () => {
    expect(splitTextImages(text, () => false)).toEqual([{ kind: "text", key: "start", start: 0, end: text.length, text }]);
  });
});