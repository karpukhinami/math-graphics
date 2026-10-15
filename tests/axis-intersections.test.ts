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