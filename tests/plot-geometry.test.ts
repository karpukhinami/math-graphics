import { describe, expect, test } from "bun:test";
import { axisNamePositions, labeledMarks, markValues, resolveGeometry } from "../src/lib/plotting/render";
import { createScene } from "../src/lib/plotting/scene";

function equalScene(xMin: string, xMax: string, yMin: string, yMax: string) {
  const scene = createScene();
  scene.axisScaleMode = "equal";
  scene.xAxis = { ...scene.xAxis, min: xMin, max: xMax };
  scene.yAxis = { ...scene.yAxis, min: yMin, max: yMax };
  return scene;
}

describe("equal-scale geometry", () => {
  for (const [min, max, expected] of [
    ["-8", "-2", [-3]],
    ["-8", "0", [0, -1]],
    ["2", "8", [3]],
    ["0", "8", [0, 1]],
    ["-8", "8", [0, 1]],
    ["-8", "-2.5", [-3]],
    ["2.5", "8", [3]],
  ] as const) {
    test(`первое деление ${min}…${max} не на другой оси и обязательно подписано`, () => {
      const scene = equalScene(min, max, min, max);
      const g = resolveGeometry(scene);
      if (!g) throw new Error("Геометрия отсутствует");
      const x = markValues(scene.xAxis, Number(min), Number(max), 1);
      const y = markValues(scene.yAxis, Number(min), Number(max), 1);
      expect(x).toEqual([...expected]);
      expect(y).toEqual([...expected]);
      const labels = labeledMarks(g, scene, scene.appearance, x, y);
      for (const value of expected.filter((n) => n !== 0)) {
        expect(labels.x).toContain(value);
        expect(labels.y).toContain(value);
      }
    });
  }
  for (const [name, bounds, extendX, extendY] of [
    ["отрицательная x", ["-8", "-2", "-3", "5"], true, false],
    ["отрицательная y", ["-3", "5", "-8", "-2"], false, true],
    ["обе отрицательные", ["-8", "-2", "-6", "-1"], true, true],
    ["ноль на границе", ["-8", "0", "-6", "0"], true, true],
    ["обе положительные", ["2", "8", "1", "6"], false, false],
  ] as const) {
    test(`${name}: продолжение на половину ячейки, пределы неизменны`, () => {
      const scene = equalScene(...bounds);
      scene.xAxis.gridStep = "2";
      scene.yAxis.gridStep = "1";
      for (const mode of ["equal", "independent"] as const) {
        scene.axisScaleMode = mode;
        const g = resolveGeometry(scene);
        if (!g) throw new Error("Геометрия отсутствует");
        expect([g.xMin, g.xMax, g.yMin, g.yMax]).toEqual(bounds.map(Number));
        expect(g.axisEndX - g.right).toBeCloseTo(extendX ? (g.sx(2) - g.sx(0)) / 2 : 0, 8);
        expect(g.top - g.axisEndY).toBeCloseTo(extendY ? (g.sy(0) - g.sy(1)) / 2 : 0, 8);
        expect(g.gridRight).toBe(g.axisEndX);
        expect(g.gridTop).toBe(g.axisEndY);
        expect(g.axisEndX).toBeLessThan(g.canvasWidth);
        expect(g.axisEndY).toBeGreaterThan(0);
        const positions = axisNamePositions(g, scene, scene.appearance);
        if (extendX) expect(positions.x.x).toBeGreaterThan(g.yAxisX);
        if (extendY) expect(positions.y.y).toBeLessThan(g.xAxisY);
      }
    });
  }
  test("новая ручная плоскость подписывает 0 и первое деление по обеим осям", () => {
    const scene = createScene();
    expect(scene.xAxis.markRule).toBe("zeroAndFirst");
    expect(scene.yAxis.markRule).toBe("zeroAndFirst");
  });
  test("a tall chart keeps the configured canvas and is centered, not stretched", () => {
    const scene = equalScene("-0.5", "1.5", "-0.5", "2.8");
    const g = resolveGeometry(scene)!;

    expect(g.canvasWidth).toBe(scene.appearance.width);
    expect(g.canvasHeight).toBe(scene.appearance.height);

    // Один масштаб по обеим осям.
    const scaleX = (g.right - g.left) / (g.xMax - g.xMin);
    const scaleY = (g.bottom - g.top) / (g.yMax - g.yMin);
    expect(scaleX).toBeCloseTo(scaleY, 6);

    // Высота (бОльшая сторона) вписана в полотно, ширина — уже полотна.
    expect(g.bottom - g.top).toBeLessThanOrEqual(g.canvasHeight);
    expect(g.right - g.left).toBeLessThan(g.canvasWidth * 0.7);

    // Чертёж по центру полотна.
    expect(g.left).toBeCloseTo(g.canvasWidth - g.right, 6);
  });

  test("a wide chart is limited by width and centered vertically", () => {
    const scene = equalScene("-5", "5", "-1", "1");
    const g = resolveGeometry(scene)!;

    expect(g.canvasWidth).toBe(scene.appearance.width);
    expect(g.canvasHeight).toBe(scene.appearance.height);
    expect((g.right - g.left) / 10).toBeCloseTo((g.bottom - g.top) / 2, 6);
    expect(g.top).toBeCloseTo(g.canvasHeight - g.bottom, 6);
    expect(g.bottom - g.top).toBeLessThan(g.canvasHeight / 2);
  });

  test("a square chart fills the available area", () => {
    const scene = equalScene("-5", "5", "-5", "5");
    const g = resolveGeometry(scene)!;
    expect(g.right - g.left).toBeCloseTo(g.bottom - g.top, 6);
    expect(g.bottom - g.top).toBeGreaterThan(g.canvasHeight * 0.8);
  });
});
