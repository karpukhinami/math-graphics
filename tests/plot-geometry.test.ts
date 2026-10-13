import { describe, expect, test } from "bun:test";
import { resolveGeometry } from "../src/lib/plotting/render";
import { createScene } from "../src/lib/plotting/scene";

function equalScene(xMin: string, xMax: string, yMin: string, yMax: string) {
  const scene = createScene();
  scene.axisScaleMode = "equal";
  scene.xAxis = { ...scene.xAxis, min: xMin, max: xMax };
  scene.yAxis = { ...scene.yAxis, min: yMin, max: yMax };
  return scene;
}

describe("equal-scale geometry", () => {
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
