import { describe, expect, test } from "bun:test";
import { CHART_COLOR_CHOICES, changeChartColor, paletteShades, resolveColors, similarAvailable, statDecoTheme } from "@/lib/plotting/chart/colors";
import { PLOT_PALETTE, PLOT_PALETTE_GROUPS } from "@/lib/plotting/shared";

describe("цвета диаграмм из палитры чертежей", () => {
  test("после шести основных цветов повторяем их без новых оттенков", () => {
    expect(resolveColors(statDecoTheme(), "different", 8)).toEqual([...PLOT_PALETTE, ...PLOT_PALETTE.slice(0, 2)]);
  });
  test("выбор оттенка в третьей строке обновляет весь цикл и сохраняет выбранную строку", () => {
    const rendering = changeChartColor({ colorMode: "similar", customColors: ["#29A2E5"] }, 2, "#B878EF");
    const colors = resolveColors(statDecoTheme(), "similar", 7, rendering.customColors);
    expect(colors).toEqual(["#9050C7", "#A464DB", "#B878EF", "#6E25B9", "#8239CD", "#9050C7", "#A464DB"]);
  });
  test("смена цвета во второй строке same меняет все строки", () => {
    const rendering = changeChartColor({ colorMode: "same" }, 1, "#FF3C8A");
    expect(resolveColors(statDecoTheme(), "same", 3, rendering.customColors)).toEqual(["#FF3C8A", "#FF3C8A", "#FF3C8A"]);
  });
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
