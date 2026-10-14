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

import { parseAnalogTemplate, parseAnalogVariant } from "../src/lib/plotting/ai/analog-task";
import { buildAnalogTaskVariantsPrompt } from "../src/lib/plotting/ai/prompts";

const tplRaw = {
  canDraw: true, sceneType: "plane", originalText: "Исходник",
  template: { type: "choice", optionCount: 2, pattern: "Выберите график", mustPreserve: ["вид"], mayChange: ["k"], answerRule: "r", visibility: "v" },
  figures: [{ id: "fig1", placement: "option", optionIndex: 0, role: "a" }, { id: "fig2", placement: "option", optionIndex: 1, role: "b" }],
};

describe("аналог: шаблон и варианты", () => {
  test("места чертежей-вариантов задаёт шаблон, а не вариант", () => {
    const tpl = parseAnalogTemplate(tplRaw);
    const v = parseAnalogVariant({
      task: { text: "Выберите", options: [{ text: "", correct: false, figure: "fig2" }, { text: "", correct: true, figure: null }] },
      figures: [{ id: "fig1", drawPlan: plan }, { id: "fig2", drawPlan: plan }],
    }, tpl);
    expect(v.task.options.map((o) => o.figure)).toEqual(["fig1", "fig2"]);
  });

  test("вариант с другим числом ответов отвергается", () => {
    const tpl = parseAnalogTemplate(tplRaw);
    expect(() => parseAnalogVariant({ task: { text: "x", options: [{ text: "1", correct: true }] }, figures: [] }, tpl)).toThrow();
  });

  test("два чертежа в одном варианте шаблона отвергаются", () => {
    expect(() => parseAnalogTemplate({ ...tplRaw, figures: [
      { id: "fig1", placement: "option", optionIndex: 0 }, { id: "fig2", placement: "option", optionIndex: 0 }] })).toThrow();
  });

  test("промпт вариантов просит ровно N вариантов и не содержит пропусков", () => {
    const tpl = parseAnalogTemplate(tplRaw);
    const p = buildAnalogTaskVariantsPrompt({ count: 3, originalText: tpl.originalText, template: tpl.template, sceneType: "plane", figures: tpl.figures, taskType: "choice", userRefinements: "" });
    expect(p).toContain("ровно 3 элементов");
    expect(p).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });
});

import { buildRequestTaskAnalyzePrompt } from "../src/lib/plotting/ai/prompts";
describe("задание по запросу", () => {
  test("промпты первого и второго этапов без пропусков, второй этап без скриншота", () => {
    expect(buildRequestTaskAnalyzePrompt("парабола")).not.toMatch(/\{\{[A-Z_]+\}\}/);
    const tpl = parseAnalogTemplate(tplRaw);
    const p = buildAnalogTaskVariantsPrompt({ count: 2, originalText: "", template: tpl.template, sceneType: "plane", figures: tpl.figures, taskType: "choice", userRefinements: "", source: "request" });
    expect(p).toContain("Скриншота нет");
    expect(p).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });
});
