import { describe, expect, test } from "bun:test";
import { buildScene, createGraph, createPoint, createScene, sceneCurves, scenePoints } from "../src/lib/plotting/scene";
import { renderPlotSvg } from "../src/lib/plotting/render";
import { sceneFromJson, sceneToJson } from "../src/lib/plotting/scene-json";
import { buildLineScene, createLineScene, createSet } from "../src/lib/plotting/line/scene";
import { renderLineSvg } from "../src/lib/plotting/line/render";
import { buildSpaceSceneData } from "../src/lib/plotting/space/scene";
import { deserializeSpaceSceneData, serializeSpaceSceneData } from "../src/lib/plotting/space/serialize";
import { renderSpaceSvg } from "../src/lib/plotting/space/render";
import type { PlotScene } from "../src/lib/plotting/types";

const svgOf = (scene: PlotScene) => renderPlotSvg(scene, sceneCurves(scene), scenePoints(scene));
const roundTrip = (scene: PlotScene) => sceneFromJson(JSON.parse(JSON.stringify(sceneToJson(scene))));

function planeScene() {
  const scene = createScene();
  const parabola = createGraph(1);
  parabola.math.expression = "x^2 - 2";
  const line = createGraph(2);
  line.math.expression = "x";
  const cross = createPoint(1, { mode: "intersection", graphId: parabola.id, graphIdB: line.id });
  const onGraph = createPoint(2, { mode: "onGraph", graphId: parabola.id, x: "1" }, { label: "M" });
  let built = buildScene({ ...scene, graphs: [parabola, line], points: [cross, onGraph] }).scene;
  // Два решения пересечения: первое подписано A, второе скрыто.
  built = {
    ...built,
    points: built.points.map((p, i) =>
      i === 0 ? { ...p, built: [{ ...p.built![0], style: { label: "A" } }, { ...p.built![1], show: false }] } : p,
    ),
  };
  return built;
}

describe("compact scene JSON", () => {
  test("plane: dependent coordinates and built curves are not stored", () => {
    const json = JSON.stringify(sceneToJson(planeScene()));
    expect(json).not.toContain("segments");
    expect(json).not.toContain('"built"');
    expect(json).not.toContain('"y":"');
    expect(json).toContain('"solutions":[{"style":{"label":"A"}},{"show":false}]');
  });

  test("plane: reload gives the same picture, including per-solution labels", () => {
    const original = planeScene();
    const restored = buildScene(roundTrip(original)).scene;
    expect(svgOf(restored)).toBe(svgOf(original));
    expect(scenePoints(restored).map((p) => p.label)).toEqual(["A", "M"]);
  });

  test("plane: grid step equal to the automatic one is saved as auto", () => {
    const scene = { ...planeScene(), xAxis: { ...planeScene().xAxis, gridStep: "1" } };
    const json = sceneToJson(scene) as { xAxis: Record<string, unknown> };
    expect(json.xAxis.gridStep).toBeUndefined();
    const custom = { ...scene, xAxis: { ...scene.xAxis, gridStep: "0.5" } };
    expect((sceneToJson(custom) as { xAxis: Record<string, unknown> }).xAxis.gridStep).toBe("0.5");
  });

  test("line: boundary points are rebuilt and keep manual labels", () => {
    const base = createLineScene() as PlotScene;
    const set = createSet(1, 0);
    set.math = { ...set.math, kind: "interval", left: "-1", right: "3" };
    let line = buildLineScene({ ...base.line!, sets: [set] }).line;
    line = { ...line, points: line.points.map((p, i) => (i === 0 ? { ...p, style: { ...p.style, label: "P" } } : p)) };
    const original = { ...base, line };
    const json = sceneToJson(original) as { line: { points: unknown[] } };
    expect(json.line.points.length).toBe(1);
    const restored = roundTrip(original);
    const rebuilt = { ...restored, line: buildLineScene(restored.line!).line };
    expect(rebuilt.line!.points.length).toBe(2);
    expect(renderLineSvg(rebuilt)).toBe(renderLineSvg(original));
  });

  test("space: figure with a midpoint reloads to the same picture", () => {
    const data = buildSpaceSceneData(
      deserializeSpaceSceneData({ shapeKind: "pyramid", baseVerticesInput: "SABC", figureBuilt: true }),
    ).data;
    const again = buildSpaceSceneData(
      deserializeSpaceSceneData(JSON.parse(JSON.stringify(serializeSpaceSceneData(data)))),
    ).data;
    expect(data.figure).not.toBeNull();
    expect(renderSpaceSvg(again)).toBe(renderSpaceSvg(data));
  });

  test("legacy full JSON still loads", () => {
    const original = planeScene();
    const restored = buildScene(sceneFromJson(JSON.parse(JSON.stringify(original)))).scene;
    expect(svgOf(restored)).toBe(svgOf(original));
  });
});

describe("axis caption", () => {
  test("словесная подпись оси сохраняется и загружается, переменная не меняется", () => {
    const scene = createScene("plane");
    scene.axisScaleMode = "independent";
    scene.xAxis = { ...scene.xAxis, name: "t", label: "время", min: "0", max: "10" };
    const json = sceneToJson(scene) as Record<string, any>;
    expect(json.xAxis.label).toBe("время");
    expect(json.xAxis.name).toBe("t");
    const loaded = sceneFromJson(json);
    expect(loaded.xAxis.label).toBe("время");
    expect(loaded.xAxis.name).toBe("t");
    expect(loaded.yAxis.label ?? "").toBe("");
  });
});
