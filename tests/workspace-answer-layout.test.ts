import { describe, expect, test } from "bun:test";
import { allAnswersAreImages, answerColumnCount } from "../src/lib/workspace/answer-layout";

describe("раскладка ответов-картинок", () => {
  test("доступна только когда все ответы представлены картинками", () => {
    expect(allAnswersAreImages([{ text: "", imageId: "a" }, { text: " ", imageId: "b" }])).toBe(true);
    expect(allAnswersAreImages([{ text: "", imageId: "a" }, { text: "" }])).toBe(false);
    expect(allAnswersAreImages([{ text: "Текст", imageId: "a" }])).toBe(false);
    expect(allAnswersAreImages([])).toBe(false);
  });
  test("вертикально — одна колонка", () => { expect(answerColumnCount("vertical", 4)).toBe(1); });
  test("горизонтально — все четыре ответа подряд", () => { expect(answerColumnCount("horizontal", 4)).toBe(4); });
  test("2×2 — две колонки", () => { expect(answerColumnCount("grid", 4)).toBe(2); });
});