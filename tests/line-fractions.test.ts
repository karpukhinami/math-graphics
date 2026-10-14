import { describe, expect, test } from "bun:test";
import { lineNumericLabel, lineTickLabel, linePrefersFractions } from "../src/lib/plotting/line/numeric-labels";
import { buildLineScene, createLineScene, createLinePoint, createSet, syncSetFromBoundaryPoint } from "../src/lib/plotting/line/scene";
import { expandLineDraft } from "../src/lib/plotting/ai/draft-line";
import { mergeAiScene } from "../src/lib/plotting/ai/merge-scene";
import { sceneToJson, sceneFromJson } from "../src/lib/plotting/scene-json";

describe("точные дроби на прямой", () => {
  test("дробный шаг даёт точные подписи засечек без ограничения знаменателя", () => {
    const line = createLineScene().line;
    line.axis.min = "-1/37";
    line.axis.majorStep = "1/37";
    expect(lineTickLabel(line, 2)).toEqual({ display: "1/37", latex: "\\frac{1}{37}" });
    expect(lineTickLabel(line, 38).display).toBe("1");
    expect(lineTickLabel(line, 1, 2).latex).toBe("-\\frac{1}{74}");
  });
  test("без обыкновенных дробей конечные десятичные значения не округляются", () => {
    expect(lineNumericLabel("0.123456789012345").display).toBe("0,123456789012345");
    expect(lineNumericLabel("0.125").display).toBe("0,125");
    expect(lineNumericLabel("1/3", false).latex).toBe("\\frac{1}{3}");
  });
  test("дробь в пользовательских данных переключает остальные дробные подписи", () => {
    const line = createLineScene().line;
    const point = createLinePoint(1, 0);
    point.math.coordinate = "1/37";
    line.points = [point];
    line.axis.min = "0";
    line.axis.majorStep = "0.25";
    expect(linePrefersFractions(line)).toBe(true);
    expect(lineTickLabel(line, 1).latex).toBe("\\frac{1}{4}");
  });
  test("границы интервала сохраняют точные выражения при построении и изменении открытости", () => {
    const line = createLineScene().line;
    const set = createSet(1, 0);
    set.math.left = "1/37";
    set.math.right = "5/37";
    line.sets = [set];
    const built = buildLineScene(line).line;
    expect(built.points[0].math.coordinate).toBe("1/37");
    expect(built.points[0].built?.latex).toBe("\\frac{1}{37}");
    const changed = syncSetFromBoundaryPoint(built, built.points[0], false);
    expect(changed.sets[0].math.left).toBe("1/37");
    expect(changed.sets[0].math.right).toBe("5/37");
  });
  test("явный дробный шаг ИИ и дроби переживают JSON, без шага остаётся 1", () => {
    const draft = { axis: { step: "1/3" }, rows: [{ points: [{ x: "5/37" }] }] };
    const expanded = expandLineDraft(draft);
    expect(expanded.errors).toEqual([]);
    const restored = sceneFromJson(sceneToJson(mergeAiScene(expanded.scene)));
    expect(restored.line?.axis.majorStep).toBe("1/3");
    expect(restored.line?.points[0].math.coordinate).toBe("5/37");
    const defaultScene = mergeAiScene(expandLineDraft({ rows: draft.rows }).scene);
    expect(defaultScene.line?.axis.majorStep).toBe("1");
  });
  test("некорректный дробный шаг ИИ отвергается", () => {
    for (const step of ["1/0", "0", "-1/3"]) {
      expect(expandLineDraft({ axis: { step }, rows: [{ points: [{ x: "1/3" }] }] }).errors.length).toBeGreaterThan(0);
    }
  });
});