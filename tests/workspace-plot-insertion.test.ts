import { describe, expect, test } from "bun:test";
import { plotInsertionImages, insertPlotImageTokens } from "../src/lib/workspace/plot-insertion";
import type { PlotScene } from "../src/lib/plotting/types";
import { createEmptyChart } from "../src/lib/plotting/chart";

describe("beautified plot insertion", () => {
  const scene = { space: "plane" } as PlotScene;
  test("inserts both images, original first, with editable scene only on original", () => {
    expect(plotInsertionImages("original-svg", scene, "beautified-png")).toEqual([
      { src: "original-svg", scene }, { src: "beautified-png" },
    ]);
  });
  test("without beautification inserts only the original", () => {
    expect(plotInsertionImages("original-svg", scene, null)).toEqual([{ src: "original-svg", scene }]);
  });
  test("диаграмма сохраняет все настройки для повторного редактирования только у оригинала", () => {
    const chart = createEmptyChart("bar");
    chart.rendering = { ...chart.rendering, valueAxisLabel: "тыс. чел.", showGrid: true, volume: true, showValues: false, orientation: "horizontal", seriesLayout: "stacked", colorMode: "similar" };
    chart.data.columns = [["Город", "А", "Б"], ["2010", 10, 20], ["2025", 15, 25]];
    const images = plotInsertionImages("chart-png", scene, "art-png", [chart]);
    expect(images[0].charts).toEqual([chart]);
    expect(images[0].scene).toBeUndefined();
    expect(images[1]).toEqual({ src: "art-png" });
    chart.rendering.valueAxisLabel = "Изменено";
    expect(images[0].charts?.[0].rendering.valueAxisLabel).toBe("тыс. чел.");
  });
  test("inserts both tokens together at the cursor without reversing them", () => {
    expect(insertPlotImageTokens("ДоПосле", ["original", "beautified"], 2)).toBe(
      "До\n![Чертёж](plot:original)\n\n![Чертёж](plot:beautified)\nПосле",
    );
  });
});