import { describe, expect, test } from "bun:test";
import { expandLineDraft } from "../src/lib/plotting/ai/draft-line";
import { mergeAiScene } from "../src/lib/plotting/ai/merge-scene";
import { buildLineScene, createSet, createLineSceneData } from "../src/lib/plotting/line/scene";
import { renderLineSvg } from "../src/lib/plotting/line/render";
import { sceneFromJson, sceneToJson } from "../src/lib/plotting/scene-json";

describe("построение множеств сохраняет и границы, и визуализацию", () => {
  test("ИИ-интервал −2 < x < 2 получает штриховку и две выколотые границы", () => {
    const scene = mergeAiScene(expandLineDraft({ rows: [{ sets: [{ type: "interval", from: "-2", to: "2", fromOpen: true, toOpen: true }] }] }).scene);
    if (!scene.line) throw new Error("Нет прямой");
    const report = buildLineScene(scene.line);
    expect(report.errors).toEqual([]);
    expect(report.line.sets[0].built?.parts).toEqual([{ left: -2, right: 2, leftInclusive: false, rightInclusive: false }]);
    expect(report.line.sets[0].dirty).toBe(false);
    expect(report.line.sets[0].kindLocked).toBe(true);
    expect(report.line.points.map((p) => [p.built?.x, p.style.open])).toEqual([[-2, true], [2, true]]);
    const svg = renderLineSvg({ ...scene, line: report.line });
    expect(svg?.match(/stroke-width="2" stroke-linecap="butt"/g)?.length).toBeGreaterThan(0);
    expect(buildLineScene(report.line).built).toBe(0);
    const restored = sceneFromJson(sceneToJson({ ...scene, line: report.line }));
    if (!restored.line) throw new Error("Нет загруженной прямой");
    expect(buildLineScene(restored.line).line.sets[0].built?.parts).toEqual(report.line.sets[0].built?.parts);
  });

  test("несколько множеств сохраняют результаты, ошибки и границы независимо", () => {
    const line = createLineSceneData();
    const interval = createSet(1, 0);
    interval.math = { ...interval.math, left: "-2", right: "2" };
    const ray = createSet(2, 0);
    ray.math = { ...ray.math, kind: "ray", rayBoundary: "3", rayOp: ">=" };
    const invalid = createSet(3, 0);
    invalid.math = { ...invalid.math, left: "bad", right: "2" };
    line.sets = [interval, ray, invalid];
    const report = buildLineScene(line);
    expect(report.built).toBe(2);
    expect(report.errors.length).toBe(1);
    expect(report.line.sets[1].built?.parts[0].right).toBe(Infinity);
    expect(report.line.sets[2].error).toBeTruthy();
    expect(report.line.points.map((p) => p.built?.x)).toEqual([-2, 2, 3]);
    expect(line.sets[0].built).toBeNull();
  });
});