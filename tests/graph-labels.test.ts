import { describe, expect, test } from "bun:test";
import { graphCaption } from "../src/lib/plotting/graph-labels";
import { layoutLabels } from "../src/lib/plotting/label-layout";
import { buildScene, createGraph, createScene, sceneCurves, scenePoints } from "../src/lib/plotting/scene";
import { sceneFromJson, sceneToJson } from "../src/lib/plotting/scene-json";
import { renderPlotSvg } from "../src/lib/plotting/render";

describe("graph caption rules", () => {
  test("name mode uses the real name and current axis variables", () => {
    const scene = createScene();
    scene.xAxis.name = "t"; scene.yAxis.name = "s";
    const graph = createGraph(1, "qualitative");
    graph.style = { ...graph.style, label: "φ", labelMode: "name" };
    expect(graphCaption(graph, scene)).toBe("s = φ(t)");
    graph.style.label = "";
    expect(graphCaption(graph, scene)).toBeNull();
  });
  test("equation mode uses explicit or implicit input, not an invented equation", () => {
    const scene = createScene(); const graph = createGraph(1);
    graph.style.labelMode = "equation"; graph.math.expression = "x^2";
    expect(graphCaption(graph, scene)).toBe("y = x²");
    graph.math.kind = "implicit"; graph.math.equation = "x^2+y^2=4";
    expect(graphCaption(graph, scene)).toBe("x² + y² = 4");
    graph.math.kind = "piecewise-linear";
    expect(graphCaption(graph, scene)).toBeNull();
  });
  test("old scenes and hidden or unbuilt graphs have no captions", () => {
    const scene = createScene(); const graph = createGraph(1);
    graph.style.label = "f"; graph.math.expression = "x"; scene.graphs = [graph];
    expect(graphCaption(graph, scene)).toBeNull();
    graph.style.labelMode = "name";
    expect(sceneCurves(scene)).toEqual([]);
    const built = buildScene(scene).scene;
    expect(sceneCurves(built)[0]?.caption).toBe("y = f(x)");
    built.graphs[0].style.visible = false;
    expect(sceneCurves(built)).toEqual([]);
  });
  test("JSON keeps the selected mode but recomputes geometry after loading", () => {
    const scene = createScene(); const graph = createGraph(1);
    graph.math.expression = "x"; graph.style.label = "f"; graph.style.labelMode = "name";
    scene.graphs = [graph];
    const built = buildScene(scene).scene; const json = sceneToJson(built);
    const saved = (json.graphs as Array<Record<string, unknown>>)[0];
    expect(saved.style).toEqual({ label: "f", labelMode: "name" });
    expect(saved.built).toBeUndefined();
    const loaded = buildScene(sceneFromJson(json)).scene;
    expect(sceneCurves(loaded)[0]?.caption).toBe("y = f(x)");
    expect(renderPlotSvg(loaded, sceneCurves(loaded), scenePoints(loaded))).toBe(renderPlotSvg(built, sceneCurves(built), scenePoints(built)));
  });
  test("curve labels can move to another anchor to avoid occupied regions", () => {
    const [placed] = layoutLabels([{ id: "g", anchorX: 50, anchorY: 50, anchors: [[50, 50], [250, 50]], width: 60, height: 20, gap: 12 }],
      [{ kind: "label", rect: { x: 0, y: 0, width: 150, height: 150 } }], { x: 0, y: 0, width: 400, height: 200 });
    expect(placed.rect.x).toBeGreaterThan(150);
  });
});