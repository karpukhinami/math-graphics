import { describe, expect, test } from "bun:test";
import { createEmptyChart } from "../src/lib/plotting/chart/editor";
import { plotBeautifyChartContext, plotBeautifySourceKey } from "../src/lib/plotting/beautify-source";
describe("исходник художественной рисовки", () => {
  test("диаграмма доступна для рисовки без SVG", () => {
    expect(plotBeautifySourceKey(null, [createEmptyChart()])).not.toBeNull();
  });
  test("пустой режим диаграмм не использует старый SVG", () => {
    expect(plotBeautifySourceKey("old-svg", [])).toBeNull();
  });
  test("изменение значения диаграммы сбрасывает прежнюю рисовку", () => {
    const chart = createEmptyChart();
    const before = plotBeautifySourceKey(null, [chart]);
    chart.data.columns[1][1] = 17;
    expect(plotBeautifySourceKey(null, [chart])).not.toBe(before);
  });
  test("настройки диаграммы тоже входят в исходник", () => {
    const chart = createEmptyChart();
    const before = plotBeautifySourceKey(null, [chart]);
    chart.rendering.volume = true;
    expect(plotBeautifySourceKey(null, [chart])).not.toBe(before);
  });
  test("исходник графика определяется только переданным committed SVG", () => {
    expect(plotBeautifySourceKey("committed-svg", null)).toBe("committed-svg");
    expect(plotBeautifySourceKey(null, null)).toBeNull();
  });
  test("контекст сохраняет тему и точные данные всех диаграмм", () => {
    const chart = createEmptyChart();
    chart.topic = "Лесные животные";
    chart.title = "Численность";
    const context = JSON.parse(plotBeautifyChartContext([chart, { ...chart, title: "Второй" }]));
    expect(context).toHaveLength(2);
    expect(context[0].topic).toBe("Лесные животные");
    expect(context[0].title).toBe("Численность");
    expect(context[0].data.columns).toEqual([["Категория", "А", "Б", "В"], ["Значение", 3, 5, 2]]);
    expect(context[1].title).toBe("Второй");
    expect(context[0].rendering).toBeUndefined();
  });
});