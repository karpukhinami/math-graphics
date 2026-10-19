import { describe, expect, test } from "bun:test";
import {
  buildStatDecoOption,
  renderStatDecoJson,
  resolveColors,
  statDecoTableMarkdown,
  statDecoTheme,
  validateStatDecoJson,
} from "@/lib/plotting/chart";
import { PLOT_PALETTE } from "@/lib/plotting/shared";
import { validatePlotAnalysisJson } from "@/lib/plotting/ai/validate-analysis";

const SAMPLE = {
  kind: "stat-deco",
  sourceMode: "text",
  topic: "Опрос класса",
  chartType: "bar",
  title: "Любимые предметы",
  summary: "Результаты опроса 25 учеников",
  dataStatus: { canRender: true, reason: "" },
  data: {
    columns: [
      ["Предмет", "Математика", "Русский", "Физкультура"],
      ["Учеников", 10, 7, 8],
    ],
  },
  mapping: {},
  rendering: { colorMode: "different" },
  warnings: [],
};

describe("validateStatDecoJson", () => {
  test("принимает корректный JSON и сохраняет данные", () => {
    const json = validateStatDecoJson(SAMPLE);
    expect(json.chartType).toBe("bar");
    expect(json.data.columns[1]).toEqual(["Учеников", 10, 7, 8]);
    expect(json.dataStatus.canRender).toBe(true);
  });

  test("прочерки в числовом столбце становятся нулями", () => {
    const json = validateStatDecoJson({
      ...SAMPLE,
      data: { columns: [["Год", "2023", "2024"], ["Значение", 5, "—"]] },
    });
    expect(json.data.columns[1]).toEqual(["Значение", 5, 0]);
  });

  test("без данных canRender=false даже при declaredOk", () => {
    const json = validateStatDecoJson({ ...SAMPLE, data: { columns: [] } });
    expect(json.dataStatus.canRender).toBe(false);
  });

  test("неизвестный тип диаграммы сводится к bar с замечанием", () => {
    const json = validateStatDecoJson({ ...SAMPLE, chartType: "пузырьковая3d" });
    expect(json.chartType).toBe("bar");
    expect(json.warnings.length).toBeGreaterThan(0);
  });
});

describe("palette", () => {
  test("цвета диаграмм берутся из палитры чертежей", () => {
    const theme = statDecoTheme();
    expect(theme.primary).toBe(PLOT_PALETTE[0]);
    expect(theme.distinct).toEqual([...PLOT_PALETTE]);
    const colors = resolveColors(theme, "different", 3);
    expect(colors).toEqual(PLOT_PALETTE.slice(0, 3));
  });

  test("режим same даёт один цвет", () => {
    const colors = resolveColors(statDecoTheme(), "same", 4);
    expect(new Set(colors).size).toBe(1);
  });
});

describe("option + markdown", () => {
  test("строит опцию ECharts для столбчатой диаграммы", () => {
    const { option, error } = buildStatDecoOption(validateStatDecoJson(SAMPLE));
    expect(error).toBeUndefined();
    expect((option.series as unknown[]).length).toBe(1);
  });

  test("таблица Markdown содержит заголовки и значения", () => {
    const md = statDecoTableMarkdown(validateStatDecoJson(SAMPLE));
    expect(md).toContain("| Предмет | Учеников |");
    expect(md).toContain("| Математика | 10 |");
  });

  test("текст анализа называет тип диаграммы по-русски", () => {
    const text = renderStatDecoJson(validateStatDecoJson(SAMPLE));
    expect(text).toContain("Столбчатая диаграмма");
  });
});

describe("анализ ИИ", () => {
  test("sceneType chart принимается без drawPlan", () => {
    const result = validatePlotAnalysisJson(
      {
        canDraw: true,
        sceneType: "chart",
        reasoning: "В тексте табличные данные без графиков",
        stageData: { chart: SAMPLE },
      },
      { requireDrawPlan: true },
    );
    expect(result.sceneType).toBe("chart");
    expect(result.stageData.chart).toBeTruthy();
  });

  test("для plane без drawPlan по-прежнему ошибка", () => {
    expect(() =>
      validatePlotAnalysisJson(
        { canDraw: true, sceneType: "plane", reasoning: "x" },
        { requireDrawPlan: true },
      ),
    ).toThrow();
  });
});
