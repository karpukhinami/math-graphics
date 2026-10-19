import { describe, expect, test } from "bun:test";
import { CHART_COLOR_CHOICES, paletteShades, resolveColors, similarAvailable, statDecoTheme } from "@/lib/plotting/chart/colors";
import { PLOT_PALETTE, PLOT_PALETTE_GROUPS } from "@/lib/plotting/shared";

describe("цвета диаграмм из палитры чертежей", () => {
  test("набор цветов на выбор не содержит посторонних", () => {
    const allowed = new Set([...PLOT_PALETTE, ...PLOT_PALETTE_GROUPS.flatMap((g) => g.colors)]);
    for (const color of CHART_COLOR_CHOICES) expect(allowed.has(color)).toBe(true);
    for (const main of PLOT_PALETTE) expect(CHART_COLOR_CHOICES).toContain(main);
  });

  test("у оттенков одного цвета меньше 3 — режим не предлагаем", () => {
    expect(similarAvailable("#FF9935")).toBe(false);
    expect(similarAvailable("#6366F1")).toBe(false);
    expect(similarAvailable("#29A2E5")).toBe(true);
  });

  test("столбцов больше, чем оттенков, — оттенки повторяются по кругу", () => {
    const shades = paletteShades("#FF9935")!;
    const colors = resolveColors(statDecoTheme(), "similar", 5, ["#FF9935"]);
    expect(colors).toEqual([shades[0], shades[1], shades[0], shades[1], shades[0]]);
  });

  test("базовый цвет оттенков совпадает с выбранным", () => {
    const colors = resolveColors(statDecoTheme(), "similar", 1, ["#B878EF"]);
    expect(colors).toEqual(["#B878EF"]);
  });
});
