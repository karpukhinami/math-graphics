import { describe, expect, test } from "bun:test";
import { chartGridScale } from "@/lib/plotting/chart/grid-scale";
import { wrapCategoryLabel } from "@/lib/plotting/chart/category-labels";
import { prismSeries, volumePieSeries } from "@/lib/plotting/chart/volume";
import { buildStatDecoOption, createEmptyChart, validateStatDecoJson } from "@/lib/plotting/chart";
import { PLOT_PALETTE } from "@/lib/plotting/shared";
import * as echarts from "echarts";

describe("линейная диаграмма с повторяющимся временем", () => {
  test("сохраняет пять наблюдений и обе подписи «6 утра» на разных позициях", () => {
    const labels = ["6 утра", "12 дня", "6 вечера", "12 ночи", "6 утра"];
    const values = [10, 18, 15, 8, 11];
    const chart = validateStatDecoJson({
      ...createEmptyChart(), chartType: "line",
      data: { columns: [["Время", ...labels], ["Температура", ...values]] },
    });
    const { option } = buildStatDecoOption(chart);
    expect(option.xAxis).toMatchObject({ type: "category", data: labels });
    expect(option.series).toMatchObject([{ type: "line", data: values }]);
    const rendered = echarts.init(null, undefined, { renderer: "svg", ssr: true, width: 900, height: 500 });
    try {
      rendered.setOption(option);
      const svg = rendered.renderToSVGString();
      const repeatedLabels = [...svg.matchAll(/<text\b[^>]*\btransform="translate\(([^ ]+) [^)]+\)"[^>]*>6 утра<\/text>/g)];
      expect(repeatedLabels).toHaveLength(2);
      expect(repeatedLabels[0]?.[1]).not.toBe(repeatedLabels[1]?.[1]);
    } finally {
      rendered.dispose();
    }
  });
});

describe("автоматическая сетка", () => {
  test("максимум 30 на линии не получает дополнительного запаса", () => {
    expect(chartGridScale([30, 26, 22, 18, 14, 10])).toEqual({ min: 0, max: 30, interval: 5 });
  });
  test("максимум 31 дотягивается только до следующей линии 35", () => {
    expect(chartGridScale([31, 26])).toEqual({ min: 0, max: 35, interval: 5 });
  });
  test("3–8 линий и допустимые кратные во всех порядках величины", () => {
    for (const max of [0.003, 0.7, 1, 7, 12, 30, 51, 100, 201, 1000, 70000]) {
      const scale = chartGridScale([max]);
      const lines = Math.round((scale.max - scale.min) / scale.interval) + 1;
      expect(lines).toBeGreaterThanOrEqual(3);
      expect(lines).toBeLessThanOrEqual(8);
      expect(scale.max).toBeGreaterThanOrEqual(max);
      expect(scale.max - max).toBeLessThan(scale.interval + 1e-9);
      const normalized = Number((scale.interval / 10 ** Math.floor(Math.log10(scale.interval))).toFixed(8));
      expect([1, 2, 2.5, 5]).toContain(normalized);
    }
  });
  test("запас и максимум от ИИ не меняют сетку", () => {
    const ai = validateStatDecoJson({ ...createEmptyChart(), max: 999, yAxis: { max: 999 }, data: { columns: [["Предмет", "Физика"], ["Учеников", 30]] }, rendering: { showGrid: true, headroom: "large", max: 999 } });
    expect(buildStatDecoOption(ai).option.yAxis).toMatchObject({ max: 30, interval: 5 });
    expect(ai.rendering).not.toHaveProperty("max");
  });
  test("накопленные столбцы используют сумму, а не максимум отдельного ряда", () => {
    const c = createEmptyChart();
    c.data.columns = [["А", "Б"], ["Ряд 1", 30], ["Ряд 2", 20]];
    c.rendering = { showGrid: true, seriesLayout: "stacked" };
    expect(buildStatDecoOption(c).option.yAxis).toMatchObject({ max: 50, interval: 10 });
  });
});

describe("перенос слов", () => {
  const measure = (text: string) => text.length * 7;
  test("предпочитает пробел между русскими словами", () => {
    expect(wrapCategoryLabel("Физическая культура", 100, measure)).toBe("Физическая\nкультура");
  });
  test("длинное слово переносится только по русским слогам с дефисом", () => {
    expect(wrapCategoryLabel("Информатика", 60, measure)).toBe("Информа-\nтика");
  });
});

describe("объём сохраняет данные и палитру", () => {
  test("каждая категория сохраняет отдельный цвет палитры", () => {
    const c = createEmptyChart();
    c.rendering = { volume: true, colorMode: "different" };
    const series = buildStatDecoOption(c).option.series as Array<{ data: Array<{ itemStyle: { color: string } }> }>;
    expect(series[0].data.map((d) => d.itemStyle.color)).toEqual(PLOT_PALETTE.slice(0, 3));
  });
  test("призма имеет три грани, её передняя грань сохраняет цвет", () => {
    const series = prismSeries("Ряд", [{ start: 0, end: 30, color: PLOT_PALETTE[2] }], false, 0.6);
    const render = series.renderItem as Function;
    const result = render({ dataIndex: 0 }, { coord: ([x, y]: number[]) => [x * 100 + 50, 300 - y * 5], size: () => [100, 5] });
    expect(result.children).toHaveLength(3);
    expect(result.children[2].style.fill).toBe(PLOT_PALETTE[2]);
    expect(result.children[0].shape.points[1][0]).toBeGreaterThan(result.children[0].shape.points[0][0]);
  });
  test("наклонённый круг имеет цветные секторы и боковые стенки", () => {
    const series = volumePieSeries(["А", "Б"], [3, 7], PLOT_PALETTE.slice(0, 2), 0.65, 0, false, (t) => t.length * 7);
    const render = series.renderItem as Function;
    const result = render({}, { getWidth: () => 700, getHeight: () => 420 });
    expect(result.children.length).toBeGreaterThan(2);
    expect(result.children.slice(-2).map((p: { style: { fill: string } }) => p.style.fill)).toEqual(PLOT_PALETTE.slice(0, 2));
  });
});