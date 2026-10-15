import { describe, expect, test } from "bun:test";
import { buildScene, createGraph, createScene, createPoint, draftRenderPoints, sceneCurves } from "../src/lib/plotting/scene";
import { sceneFromJson, sceneToJson } from "../src/lib/plotting/scene-json";
import { usePlotStore } from "../src/lib/plotting/store";
import { AXIS_INTERSECTION_TARGETS, pointSourceColor } from "../src/lib/plotting/intersection-targets";

function setup() {
  const graph = createGraph(2);
  graph.math.expression = "x^2-1";
  return buildScene({ ...createScene(), graphs: [graph] }).scene;
}

describe("пересечения с осями", () => {
  function hits(expression: string, kind: "explicit" | "implicit" = "explicit", axis = "axis:y=0", domainFrom = "", domainTo = "") {
    const graph = createGraph(1);
    graph.math = { ...graph.math, kind, expression, equation: expression, domainFrom, domainTo };
    const result = buildScene({ ...createScene(), graphs: [graph], points: [
      createPoint(1, { mode: "intersection", graphId: graph.id, graphIdB: axis }),
    ] }).scene;
    return result.points[0].built ?? [];
  }

  test("находит касание параболы между дискретными вершинами и не дублирует его", () => {
    const found = hits("(x-0.123)^2");
    expect(found).toHaveLength(1);
    expect(found[0].x).toBeCloseTo(0.123, 8);
    expect(found[0].y).toBe(0);
  });
  test("находит несколько касаний и обычное пересечение вместе", () => {
    const found = hits("(x+1.123)^2*(x-0.123)^2*(x-2.123)");
    expect(found).toHaveLength(3);
    [-1.123, 0.123, 2.123].forEach((x, i) => expect(found[i].x).toBeCloseTo(x, 7));
  });
  test("не считает близкий минимум или асимптоту пересечением", () => {
    expect(hits("(x-0.123)^2+0.00000001")).toHaveLength(0);
    expect(hits("1/(x-0.123)")).toHaveLength(0);
    expect(hits("sign(x-0.123)")).toHaveLength(0);
  });
  test("неявная окружность касается обеих осей между узлами сетки", () => {
    for (const [axis, equation, x, y] of [
      ["axis:y=0", "(x-0.123)^2+(y-1)^2=1", 0.123, 0],
      ["axis:x=0", "(x-1)^2+(y-0.123)^2=1", 0, 0.123],
    ] as const) {
      const found = hits(equation, "implicit", axis);
      expect(found).toHaveLength(1);
      expect(found[0].x).toBeCloseTo(x, 7);
      expect(found[0].y).toBeCloseTo(y, 7);
    }
  });
  test("касание вне заданного промежутка не появляется, на его краю находится", () => {
    expect(hits("(x-0.123)^2", "explicit", "axis:y=0", "1", "3")).toHaveLength(0);
    expect(hits("(x-0.123)^2", "explicit", "axis:y=0", "0.123", "3")).toHaveLength(1);
  });
  test("касание гладкого графика по опорам и вершина ломаной находятся", () => {
    for (const kind of ["qualitative", "piecewise-linear"] as const) {
      const graph = createGraph(1);
      graph.math = { ...graph.math, kind, extendEnds: false, anchors: [
        { x: "-1", y: "1", kind: "plain" }, { x: "0.123", y: "0", kind: "min" }, { x: "2", y: "1", kind: "plain" },
      ] };
      const scene = buildScene({ ...createScene(), graphs: [graph], points: [
        createPoint(1, { mode: "intersection", graphId: graph.id, graphIdB: "axis:y=0" }),
      ] }).scene;
      expect(scene.points[0].built).toHaveLength(1);
      expect(scene.points[0].built?.[0].x).toBeCloseTo(0.123, 7);
    }
  });
  test("кусочная функция не включает выколотый край и находит внутреннее касание", () => {
    const graph = createGraph(1);
    graph.math = { ...graph.math, kind: "piecewise", pieces: [{ expression: "(x-0.123)^2", from: "0.123", to: "3", includeFrom: false, includeTo: true }] };
    const run = () => buildScene({ ...createScene(), graphs: [graph], points: [
      createPoint(1, { mode: "intersection", graphId: graph.id, graphIdB: "axis:y=0" }),
    ] }).scene.points[0].built ?? [];
    expect(run()).toHaveLength(0);
    graph.math.pieces[0].from = "-1";
    expect(run()).toHaveLength(1);
  });
  test("автоматические оси дают точки без дополнительных графиков", () => {
    let scene = setup();
    expect(AXIS_INTERSECTION_TARGETS.map((axis) => axis.equation)).toEqual(["x=0", "y=0"]);
    scene = buildScene({ ...scene, points: AXIS_INTERSECTION_TARGETS.map((axis, index) =>
      createPoint(index + 1, { mode: "intersection", graphId: scene.graphs[0].id, graphIdB: axis.id }),
    ) }).scene;
    expect(scene.graphs).toHaveLength(1);
    expect(sceneCurves(scene)).toHaveLength(1);
    expect(scene.points[0].built?.[0].x).toBe(0);
    expect(scene.points[0].built?.[0].y).toBeCloseTo(-1, 3);
    expect(scene.points[1].built).toHaveLength(2);
    expect(scene.points[1].built?.map((p) => p.y)).toEqual([0, 0]);
    expect(scene.points[1].built?.[0].x).toBeCloseTo(-1, 3);
    expect(scene.points[1].built?.[1].x).toBeCloseTo(1, 3);
  });

  test("цвет графика применяется при любом порядке выбора, включая предпросмотр", () => {
    const scene = setup();
    for (const reverse of [false, true]) {
      const math = { ...createPoint(1).math, mode: "intersection" as const,
        graphId: reverse ? "axis:y=0" : scene.graphs[0].id,
        graphIdB: reverse ? scene.graphs[0].id : "axis:y=0" };
      expect(pointSourceColor(scene, math)).toBe(scene.graphs[0].style.color);
      expect(draftRenderPoints(scene, math).map((p) => p.color)).toEqual([
        scene.graphs[0].style.color, scene.graphs[0].style.color,
      ]);
      usePlotStore.setState({ scene, pointDraft: math });
      usePlotStore.getState().commitPointDraft();
      expect(usePlotStore.getState().scene.points.map((p) => p.style.color)).toEqual([
        scene.graphs[0].style.color, scene.graphs[0].style.color,
      ]);
    }
  });

  test("отдельные пересечения остаются связанными и не дублируются при перестроении и загрузке", () => {
    const scene = setup();
    usePlotStore.setState({ scene, pointDraft: { ...createPoint(1).math, mode: "intersection",
      graphId: scene.graphs[0].id, graphIdB: "axis:y=0" } });
    usePlotStore.getState().commitPointDraft();
    usePlotStore.getState().updateGraphMath(scene.graphs[0].id, { expression: "x^2-4" });
    usePlotStore.getState().buildGraph(scene.graphs[0].id);
    const rebuilt = usePlotStore.getState().scene;
    expect(rebuilt.points.map((p) => p.built?.length)).toEqual([1, 1]);
    expect(rebuilt.points[0].built?.[0].x).toBeCloseTo(-2, 3);
    expect(rebuilt.points[1].built?.[0].x).toBeCloseTo(2, 3);
    const restored = buildScene(sceneFromJson(sceneToJson(rebuilt))).scene;
    expect(restored.graphs).toHaveLength(1);
    expect(restored.points.map((p) => p.math.graphIdB)).toEqual(["axis:y=0", "axis:y=0"]);
    expect(restored.points.map((p) => p.built)).toEqual(rebuilt.points.map((p) => p.built));
  });
});