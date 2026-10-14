import { describe, expect, test } from "bun:test";
import { buildAnalogBlock } from "../src/lib/workspace/analog-block";
import { parseAnalogTaskAnalysis } from "../src/lib/plotting/ai/analog-task";

const plan = "РАЗМЕРНОСТЬ: plane\nПОСТРОИТЬ:\n1. Явная функция y = x^2";

describe("аналог по скриншоту", () => {
  test("чертёж-вариант должен быть указан в варианте ответа", () => {
    expect(() => parseAnalogTaskAnalysis({
      canDraw: true, sceneType: "plane",
      task: { type: "choice", text: "Выберите график", options: [{ text: "", correct: true }, { text: "", correct: false }] },
      figures: [{ id: "fig1", placement: "option", drawPlan: plan }],
    })).toThrow();
  });

  test("метка [[fig1]] заменяется картинкой в тексте, чертежи вариантов попадают в варианты", () => {
    const block = buildAnalogBlock({
      task: { type: "choice", text: "Дан график [[fig1]] Какой?", answer: "", options: [
        { text: "", correct: true, figure: "fig2" }, { text: "", correct: false, figure: "fig3" }] },
      figures: [{ id: "fig1", placement: "text" }, { id: "fig2", placement: "option" }, { id: "fig3", placement: "option" }],
      built: new Set(["fig1", "fig2", "fig3"]),
      imageIdOf: (id) => `img-${id}`,
    });
    expect(block.text).toContain("![Чертёж](plot:img-fig1)");
    expect(block.options.map((o) => o.imageId)).toEqual(["img-fig2", "img-fig3"]);
  });

  test("чертёж в тексте без метки добавляется в конец", () => {
    const block = buildAnalogBlock({
      task: { type: "input", text: "Найдите f(2).", answer: "4", options: [] },
      figures: [{ id: "fig1", placement: "text" }], built: new Set(["fig1"]), imageIdOf: () => "a",
    });
    expect(block.text.trim().endsWith("![Чертёж](plot:a)")).toBe(true);
    expect(block.answer).toBe("4");
  });
});
