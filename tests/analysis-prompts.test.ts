import { describe, expect, test } from "bun:test";
import precisionRules from "../src/lib/plotting/ai/templates/analysis-precision-rules.txt?raw";
import structureRules from "../src/lib/plotting/ai/templates/analysis-structure-rules.txt?raw";
import {
  buildAnalyzePrompt,
  buildAnalogTaskAnalyzePrompt,
  buildRequestTaskAnalyzePrompt,
  buildAnalogTaskVariantsPrompt,
  buildDrawScenePrompt,
  buildAnalogTaskGeneratePrompt,
  buildGeneratePrompt,
} from "../src/lib/plotting/ai/prompts";

const analysisPrompts = () => [
  ...(["draw", "task", "reproduce", "analog"] as const).map((scenario) =>
    buildAnalyzePrompt({ scenario, sourceText: "Парабола y = x^2", userRefinements: "Вершина (0; 0)" }),
  ),
  buildAnalogTaskAnalyzePrompt("Гипербола"),
  buildRequestTaskAnalyzePrompt("Синусоида"),
  buildAnalogTaskVariantsPrompt({
    count: 2, originalText: "Исходник", template: {}, sceneType: "plane",
    figures: [], taskType: "input", userRefinements: "",
  }),
];

const paragraphs = precisionRules.trim().split("\n");

describe("общие математические правила анализа", () => {
  test("каждый сценарий анализа получает одну общую структуру подробного перечня построений", () => {
    const sections = ["РАЗМЕРНОСТЬ:", "ПОСТРОИТЬ:", "ПОДПИСАТЬ:", "ОСИ:", "ОФОРМЛЕНИЕ:", "ОГРАНИЧЕНИЯ:"];
    let previousIndex = -1;
    for (const section of sections) {
      const index = structureRules.indexOf(section);
      expect(index).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }
    for (const prompt of analysisPrompts()) {
      expect(prompt.split(structureRules)).toHaveLength(2);
      expect(prompt).not.toMatch(/\{\{[A-Z_]+\}\}/);
      expect(prompt).not.toContain("все рассуждения и решение (Markdown + LaTeX)");
      expect(prompt).not.toContain("краткие ответы на вопросы 1–7");
    }
  });

  test("общая структура сохраняет зависимости, видимость и параметрические шаблоны", () => {
    for (const prompt of analysisPrompts()) {
      expect(prompt).toContain("Вычисляемые координаты зависимых точек в drawPlan НЕ дублируй");
      expect(prompt).toContain("НЕ придумывай конкретные числа будущих вариантов");
      expect(prompt).toContain("не добавляй поля");
      expect(prompt).toContain("каждый конкретный drawPlan относится только к своему чертежу");
    }
  });

  test("распознавание семейства и формула прежде интерполяции во всех сценариях", () => {
    const rules = paragraphs.slice(1, 4);
    expect(rules).toHaveLength(3);
    for (const prompt of analysisPrompts()) {
      for (const rule of rules) expect(prompt).toContain(rule);
      expect(prompt).not.toContain("формула не дана, но нужен конкретный вид → ПРЕДПОЧТИТЕЛЬНО по точкам");
    }
  });

  test("приоритет экстремумов и узлов сетки перед дополнительными опорами во всех сценариях", () => {
    const rule = paragraphs[4];
    expect(rule?.startsWith("4.")).toBe(true);
    for (const prompt of analysisPrompts()) expect(prompt).toContain(rule ?? "MISSING_RULE");
  });

  test("конкретные уравнения и координаты передаются до рисования с сохранением связей и шаблонов", () => {
    const rules = paragraphs.slice(5, 8);
    expect(rules).toHaveLength(3);
    for (const prompt of analysisPrompts()) {
      for (const rule of rules) expect(prompt).toContain(rule);
      expect(prompt.split(precisionRules)).toHaveLength(2);
      expect(prompt).not.toMatch(/\{\{[A-Z_]+\}\}/);
    }
  });

  test("этап рисования не получает повторного задания анализа", () => {
    const prompts = [
      buildDrawScenePrompt({ sceneType: "plane", drawPlan: "y = x^2", userRefinements: "" }),
      buildAnalogTaskGeneratePrompt("plane", [{ id: "fig1", drawPlan: "y = x^2" }]),
      buildGeneratePrompt({ scenario: "reproduce", sourceText: "", sceneType: "plane",
        analysis: { canDraw: true, analysisText: "y = x^2", stageData: {} }, userRefinements: "" }),
    ];
    for (const prompt of prompts) expect(prompt).not.toContain(precisionRules);
  });

  test("техническая часть объясняет построение функции на промежутке, а не на всём поле", () => {
    const planeDraw = buildDrawScenePrompt({
      sceneType: "plane",
      drawPlan: "y = sqrt(x) на промежутке 0 ≤ x < 4",
      userRefinements: "",
    });
    expect(planeDraw).toContain("ПОСТРОЕНИЕ НА ПРОМЕЖУТКЕ");
    expect(planeDraw).toContain("Вне этого промежутка линия не появляется");
    expect(planeDraw).toContain('"domain"');
    const planeScene = buildGeneratePrompt({
      scenario: "reproduce",
      sourceText: "",
      sceneType: "plane",
      analysis: { canDraw: true, analysisText: "y = sqrt(x)", stageData: {} },
      userRefinements: "",
    });
    expect(planeScene).toContain("domainFrom/domainTo");
    expect(planeScene).toContain("вне него линия не рисуется");
  });
});