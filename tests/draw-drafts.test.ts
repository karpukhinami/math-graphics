import { describe, expect, test } from "bun:test";
import { expandLineDraft } from "../src/lib/plotting/ai/draft-line";
import { expandPlaneDraft } from "../src/lib/plotting/ai/draft-plane";
import { mergeAiScene } from "../src/lib/plotting/ai/merge-scene";
import { validatePlotAnalysisJson } from "../src/lib/plotting/ai/validate-analysis";
import { validatePlotSceneJson } from "../src/lib/plotting/ai/validate-scene";
import { buildLineScene } from "../src/lib/plotting/line/scene";
import { buildScene, scenePoints } from "../src/lib/plotting/scene";

const planeDraft = {
  axes: { xMin: "-3", xMax: "6", yMin: "-3", yMax: "9" },
  graphs: [
    { id: "g1", type: "explicit", expression: "y = x^2 - 2*x" },
    { id: "g2", type: "explicit", expression: "x + 4" },
  ],
  points: [
    { type: "intersection", graphs: ["g1", "g2"], labels: ["A", "B"] },
    { type: "onGraph", graph: "g2", x: "4", dropToXAxis: true, dropToYAxis: true, labelOnAxes: true },
  ],
};

describe("plane draft → scene", () => {
  test("fills technical fields in code and keeps the model's content", () => {
    const { scene, errors } = expandPlaneDraft(planeDraft);
    expect(errors).toEqual([]);
    const s = scene as Record<string, any>;
    expect(s.space).toBe("plane");
    expect(s.xAxis.gridStep).toBe("1");
    expect(s.axisScaleMode).toBe("equal");
    expect(s.grid.visible).toBe(true);
    expect(s.graphs[0].math.expression).toBe("x^2 - 2*x");
    expect(s.graphs[0].style.colorGroup).toBe(1);
    expect(s.graphs[1].style.colorGroup).toBe(2);
    expect(s.points[0].math.graphId).toBe(s.graphs[0].id);
    expect(s.points[0].math.graphIdB).toBe(s.graphs[1].id);
    expect(s.points[1].style).toMatchObject({
      projectX: true,
      projectY: true,
      labelProjectionX: true,
      labelProjectionY: true,
      showCoords: false,
    });
  });

  test("the intersection is found by the tool and labelled per solution", () => {
    const { scene } = expandPlaneDraft(planeDraft);
    expect(validatePlotSceneJson({ scene }, "plane")).toEqual({ valid: true, errors: [] });

    const built = buildScene(mergeAiScene(scene)).scene;
    const solutions = built.points[0].built!;
    expect(solutions.map((p) => [Math.round(p.x), Math.round(p.y)])).toEqual(
      expect.arrayContaining([
        [-1, 3],
        [4, 8],
      ]),
    );
    const labels = scenePoints(built).map((p) => p.label);
    expect(labels.filter((l) => l === "A" || l === "B")).toHaveLength(2);
  });

  test("reports unknown graph references and points outside the axes", () => {
    const { errors } = expandPlaneDraft({
      axes: { xMin: "-1", xMax: "1", yMin: "-1", yMax: "1" },
      graphs: [{ id: "g1", type: "explicit", expression: "x" }],
      points: [
        { type: "onGraph", graph: "g9", x: "0" },
        { type: "coords", x: "5", y: "0" },
      ],
    });
    expect(errors.some((e) => e.includes("g9"))).toBe(true);
    expect(errors.some((e) => e.includes("вне пределов"))).toBe(true);
  });

  test("graph through points becomes a point-defined graph with anchors", () => {
    const { scene, errors } = expandPlaneDraft({
      axes: { xMin: "-5", xMax: "5", yMin: "-5", yMax: "5" },
      graphs: [
        {
          id: "g1",
          type: "points",
          connect: "segments",
          through: [
            { x: "-2", y: "-1" },
            { x: "0", y: "3", extremum: "max" },
            { x: "3", y: "1" },
          ],
        },
      ],
      points: [{ type: "graphPoint", graph: "g1", index: 2, label: "M" }],
    });
    expect(errors).toEqual([]);
    const s = scene as Record<string, any>;
    expect(s.graphs[0].math.kind).toBe("piecewise-linear");
    expect(s.graphs[0].math.anchors[1].kind).toBe("max");
    expect(s.points[0].math).toMatchObject({ mode: "anchor", anchorIndex: 1 });
    expect(validatePlotSceneJson({ scene }, "plane").valid).toBe(true);
  });

  test("wide ranges switch to independent axis scales", () => {
    const { scene } = expandPlaneDraft({
      axes: { xMin: "0", xMax: "10", yMin: "0", yMax: "1000" },
      graphs: [{ id: "g1", type: "explicit", expression: "x^3" }],
    });
    expect((scene as { axisScaleMode: string }).axisScaleMode).toBe("independent");
  });
});

describe("line draft → scene", () => {
  test("several lines, hatch direction and strictness come from the draft", () => {
    const { scene, errors } = expandLineDraft({
      rows: [
        { sets: [{ type: "interval", from: "-2", to: "3" }] },
        { sets: [{ type: "ray", direction: "right", boundary: "1", open: false }] },
        {
          sets: [{ type: "interval", from: "1", to: "3", fromOpen: false }],
          points: [{ x: "2", label: "A" }],
        },
      ],
    });
    expect(errors).toEqual([]);
    const line = (scene as Record<string, any>).line;
    expect(line.axisRowCount).toBe(3);
    expect(line.sets.map((s: any) => s.axisRow)).toEqual([0, 1, 2]);
    expect(line.sets[1].math).toMatchObject({ kind: "ray", rayOp: ">=", rayBoundary: "1" });
    expect(line.sets[1].style.display).toBe("hatchRight");
    expect(line.sets[2].math).toMatchObject({ leftOp: "<=", rightOp: "<" });
    expect(line.ticks.majorVisible).toBe(false);
    expect(Number(line.axis.min)).toBeLessThan(-2);
    expect(Number(line.axis.max)).toBeGreaterThan(3);
    expect(validatePlotSceneJson({ scene }, "line")).toEqual({ valid: true, errors: [] });

    const built = buildLineScene(mergeAiScene(scene).line!);
    expect(built.line.axisRowCount).toBe(3);
  });

  test("infinite interval becomes a ray; boundary duplicates of sets are dropped", () => {
    const { scene, errors } = expandLineDraft({
      rows: [
        {
          sets: [{ type: "interval", from: "-inf", to: "2", toOpen: false }],
          points: [{ x: "2", label: "B" }, { x: "0", label: "C" }, { x: "0" }],
        },
      ],
    });
    expect(errors).toEqual([]);
    const line = (scene as Record<string, any>).line;
    expect(line.sets[0].math).toMatchObject({ kind: "ray", rayOp: "<=", rayBoundary: "2" });
    expect(line.sets[0].style.display).toBe("hatchLeft");
    expect(line.points).toHaveLength(1);
    expect(line.points[0].math.coordinate).toBe("0");
    expect(validatePlotSceneJson({ scene }, "line").valid).toBe(true);
  });

  test("lines that carry only points keep their separate rows", () => {
    const { scene } = expandLineDraft({
      rows: [{ points: [{ x: "1", label: "A" }] }, { points: [{ x: "3", label: "B" }] }],
    });
    const merged = mergeAiScene(scene).line!;
    expect(merged.axisRowCount).toBe(2);
    expect(merged.points.map((p) => p.axisRow)).toEqual([0, 1]);
    expect((scene as Record<string, any>).line.ticks.majorVisible).toBe(true);
  });

  test("accepts a bare single-line draft and union notation", () => {
    const { scene, errors } = expandLineDraft({
      sets: [{ type: "set", notation: "(-inf; -2] ; [1; 3)" }],
    });
    expect(errors).toEqual([]);
    expect(validatePlotSceneJson({ scene }, "line").valid).toBe(true);
  });

  test("reports unusable sets", () => {
    const { errors } = expandLineDraft({ rows: [{ sets: [{ type: "ray", boundary: "2" }] }] });
    expect(errors.some((e) => e.includes("direction"))).toBe(true);
  });
});

describe("analysis result", () => {
  test("draw scenario requires an explicit plan and keeps reasoning separate", () => {
    const ok = validatePlotAnalysisJson(
      {
        reasoning: "Решаем…",
        canDraw: true,
        sceneType: "plane",
        drawPlan: "1. Оси: x от -3 до 6.\n2. График y = x^2.",
      },
      { requireDrawPlan: true },
    );
    expect(ok.sceneType).toBe("plane");
    expect(ok.analysisText).toBe("Решаем…");
    expect(ok.drawPlan).toContain("График y = x^2");

    expect(() =>
      validatePlotAnalysisJson(
        { reasoning: "Решаем…", canDraw: true, sceneType: "line" },
        { requireDrawPlan: true },
      ),
    ).toThrow("drawPlan");

    expect(
      validatePlotAnalysisJson({ analysisText: "Нельзя", canDraw: false }, { requireDrawPlan: true })
        .canDraw,
    ).toBe(false);
  });
});
