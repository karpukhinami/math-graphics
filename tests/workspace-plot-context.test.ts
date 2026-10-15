import { describe, expect, test } from "bun:test";
import { previousParagraph, textGenerationSource, textInsertionPosition, withoutPlotImages, cropRect } from "../src/lib/workspace/plot-context";
import { insertPlotImageTokens } from "../src/lib/workspace/plot-insertion";

describe("workspace plot context", () => {
  test("image insertion follows the selected text without replacing it", () => {
    const text = "До Выделено После";
    expect(insertPlotImageTokens(text, ["image"], textInsertionPosition(text, 11))).toBe("До Выделено\n![Чертёж](plot:image)\n После");
  });
  test("without selection image insertion stays at the cursor", () => {
    expect(textInsertionPosition("ДоПосле", 2)).toBe(2);
    expect(textInsertionPosition("ДоПосле")).toBe(7);
  });
  test("text generation uses all selected text across paragraph boundaries without trimming", () => {
    const selected = " $y=x^2$\n\nТочка A при x=2. ";
    const text = "До выделения\n\n" + selected + "\n\nПосле выделения";
    const start = text.indexOf(selected);
    expect(textGenerationSource(text, start, start + selected.length)).toBe(selected);
  });
  test("text generation without selection uses the previous paragraph", () => {
    const text = "Первый абзац\n\nПостройте $y=x^2$.\n\nСледующий абзац";
    const cursor = text.indexOf("Следующий");
    expect(textGenerationSource(text, cursor, cursor)).toBe("Постройте $y=x^2$.");
  });
  test("takes the preceding paragraph, not the whole text block", () => {
    const text = "Первый абзац\n\nПостройте $y=x^2$.\n\nСледующий абзац";
    expect(previousParagraph(text, text.indexOf("Следующий"))).toBe("Постройте $y=x^2$.");
  });
  test("uses only the text before the insertion cursor", () => {
    expect(previousParagraph("Первый\n\nВторой и третий", 14)).toBe("Второй");
  });
  test("empty text starts empty", () => { expect(previousParagraph("", 0)).toBe(""); });
  test("task source excludes image tokens and preserves LaTeX", () => {
    expect(withoutPlotImages("$x^2$\n![Чертёж](plot:abc)\nНайти x")).toBe("$x^2$\n\nНайти x");
  });
  test("crop selection supports reversed dragging", () => {
    expect(cropRect({ x: 0.75, y: 0.75 }, { x: 0.25, y: 0.25 })).toEqual({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
  });
  test("crop selection cannot extend outside the image", () => {
    expect(cropRect({ x: -1, y: -1 }, { x: 2, y: 2 })).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
});
