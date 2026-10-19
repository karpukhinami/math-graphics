import { describe, expect, test } from "bun:test";
import { expandPlaneDraft } from "../src/lib/plotting/ai/draft-plane";
import { validatePlotAnalysisJson } from "../src/lib/plotting/ai/validate-analysis";
import { validateDrawDraft } from "../src/lib/plotting/ai/pipeline";

describe("мягкая починка ответов модели", () => {
  test("пересечение с осью Ox становится целью axis:y=0 без нового графика", () => {
    const r = expandPlaneDraft({
      axes: { xMin: "-5", xMax: "5", yMin: "-5", yMax: "5" },
      graphs: [{ id: "g1", type: "explicit", expression: "x^2 - 4" }],
      points: [{ type: "intersection", graphs: ["g1", "Ox"] }],
    });
    expect(r.errors).toEqual([]);
    const scene = r.scene as { graphs: unknown[]; points: Array<{ math: { graphIdB: string } }> };
    expect(scene.graphs.length).toBe(1);
    expect(scene.points[0].math.graphIdB).toBe("axis:y=0");
  });

  test("анализ: тип сцены синонимом и данные диаграммы в корне", () => {
    const a = validatePlotAnalysisJson({ canDraw: true, sceneType: "Diagram", reasoning: "x", chart: { kind: "stat-deco" } });
    expect(a.sceneType).toBe("chart");
    expect(a.stageData.chart).toBeTruthy();
  });

  test("анализ в обёртке { result: {...} } читается", () => {
    const a = validatePlotAnalysisJson({ result: { canDraw: false, reasoning: "нельзя" } });
    expect(a.canDraw).toBe(false);
    expect(a.analysisText).toBe("нельзя");
  });

  test("последняя попытка: точка вне поля не мешает отдать чертёж", () => {
    const draft = {
      axes: { xMin: "-5", xMax: "5", yMin: "-5", yMax: "5" },
      graphs: [{ id: "g1", type: "explicit", expression: "x" }],
      points: [{ type: "coords", x: "9", y: "1", label: "A" }],
    };
    expect(validateDrawDraft(draft, "plane").valid).toBe(false);
    expect(validateDrawDraft(draft, "plane", false, true).valid).toBe(true);
  });
});
