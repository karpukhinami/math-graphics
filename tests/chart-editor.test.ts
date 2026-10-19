import { describe, expect, test } from "bun:test";
import { addRow, addSeries, buildStatDecoOption, clearCells, createEmptyChart, normalizeChart, parseCell, removeRow, resizeTable, setCell, validateStatDecoJson } from "@/lib/plotting/chart";
import { usePlotStore } from "@/lib/plotting/store";
import { generatePlotScene } from "@/lib/plotting/ai/pipeline";

async function generateAiChart(rendering: Record<string, unknown> = {}) {
  const result = await generatePlotScene({
    model: "unused", scenario: "draw", manualText: "", uploadedSourceText: "",
    attachedImages: [], userRefinements: "",
    analysis: { canDraw: true, sceneType: "chart", analysisText: "", stageData: {
      chart: { chartType: "bar", title: "Опрос", rendering,
        data: { columns: [["Ответ", "Да", "Нет"], ["Голосов", 7, 3]] } },
    } },
  });
  if (!("chart" in result)) throw new Error("Ожидалась диаграмма");
  usePlotStore.getState().setCharts([result.chart]);
  return usePlotStore.getState().charts[0];
}

describe("начальные настройки диаграмм от ИИ", () => {
  test("сетка включена даже при устаревшем showGrid=false в ответе", async () => {
    const chart = await generateAiChart({ showGrid: false });
    expect(chart.rendering.showGrid).toBe(true);
    const axis = (buildStatDecoOption(chart).option as { yAxis: { splitLine: { show: boolean } } }).yAxis;
    expect(axis.splitLine.show).toBe(true);
  });
  test("объёмность выключена даже при volume=true в ответе", async () => {
    expect((await generateAiChart({ volume: true })).rendering.volume).toBe(false);
  });
  test("значения показаны, если ИИ не прислал showValues", async () => {
    const chart = await generateAiChart();
    expect(chart.rendering.showValues).toBe(true);
  });
  test("заголовок и названия данных сохраняются", async () => {
    const chart = await generateAiChart();
    expect(chart.title).toBe("Опрос");
    expect(chart.data.columns).toEqual([["Ответ", "Да", "Нет"], ["Голосов", 7, 3]]);
  });
  test("ручные правки после ИИ не сбрасываются обычной проверкой", async () => {
    const chart = await generateAiChart();
    const edited = normalizeChart(validateStatDecoJson({ ...chart,
      rendering: { ...chart.rendering, showGrid: false, volume: true, showValues: false },
    }));
    expect(edited.rendering.showGrid).toBe(false);
    expect(edited.rendering.volume).toBe(true);
    expect(edited.rendering.showValues).toBe(false);
  });
});

describe("ручные диаграммы", () => {
  test("ответ ИИ без оформления дополняется значениями по умолчанию", () => {
    const ai = validateStatDecoJson({ chartType: "pie", title: "Опрос", data: { columns: [["Ответ", "Да", "Нет"], ["Голосов", 7, 3]] } });
    const c = normalizeChart({ ...ai, rendering: {} });
    expect(c.rendering.showValues).toBe(false);
    expect(c.rendering.innerHole).toBe("none");
    expect(c.data.columns[1]).toEqual(["Голосов", 7, 3]);
  });
  test("ИИ-диаграмма попадает в плашку как первая из списка", () => {
    usePlotStore.getState().setCharts([createEmptyChart("line")]);
    expect(usePlotStore.getState().charts.map((c) => c.chartType)).toEqual(["line"]);
  });
  test("строки и ряды добавляются по столбцам", () => {
    let cols = createEmptyChart().data.columns;
    cols = addRow(cols);
    expect(cols[0].length).toBe(5);
    cols = addSeries(cols);
    expect(cols.length).toBe(3);
    expect(cols[2].length).toBe(5);
    cols = removeRow(addRow(cols), 0);
    expect(cols[1][1]).toBe(5);
  });
  test("ячейка с запятой — число", () => {
    expect(parseCell("2,5", true)).toBe(2.5);
    expect(setCell([["a", "x"]], 0, 1, "y")).toEqual([["a", "y"]]);
  });
  test("очистка стирает данные, но сохраняет заголовки", () => {
    const cols = clearCells(createEmptyChart().data.columns);
    expect(cols[0][0]).toBe("Категория");
    expect(cols[1][0]).toBe("Значение");
    expect(cols[1].slice(1)).toEqual([null, null, null]);
  });
  test("сетка меняет размер таблицы разом, сохраняя данные", () => {
    const cols = resizeTable(createEmptyChart().data.columns, 5, 3);
    expect(cols.length).toBe(3);
    expect(cols[0].length).toBe(6);
    expect(cols[1][1]).toBe(3);
    expect(cols[2][0]).toBe("Ряд 2");
    const small = resizeTable(cols, 2, 2);
    expect(small.length).toBe(2);
    expect(small[0]).toEqual(["Категория", "А", "Б"]);
  });
  test("тумблер «Ось и сетка» включает видимую ось с сеткой и красивым максимумом", () => {
    const chart = createEmptyChart("bar");
    chart.data.columns = [["Предмет", "Математика", "Физика"], ["Учеников", 12, 7]];
    const off = buildStatDecoOption(chart);
    const yOff = (off.option as { yAxis: { show: boolean } }).yAxis;
    expect(yOff.show).toBe(false);
    chart.rendering.showGrid = true;
    const on = buildStatDecoOption(chart);
    const yOn = (on.option as { yAxis: { show?: boolean; max?: number; name?: string; splitLine: { show: boolean } } }).yAxis;
    expect(yOn.show).not.toBe(false);
    expect(yOn.splitLine.show).toBe(true);
    expect(yOn.max).toBe(12);
    expect(yOn.name).toBe("Учеников");
  });
  test("несколько рядов: легенда появляется автоматически, ряды разных цветов", () => {
    const chart = createEmptyChart("bar");
    chart.data.columns = [
      ["Город", "Москва", "Казань"],
      ["2024", 5, 3],
      ["2025", 8, 6],
    ];
    chart.rendering.colorMode = "same";
    const { option } = buildStatDecoOption(chart);
    const legend = (option as { legend?: { data: string[] } }).legend;
    expect(legend?.data).toEqual(["2024", "2025"]);
    const series = (option as { series: Array<{ itemStyle: { color: string } }> }).series;
    expect(series[0].itemStyle.color).not.toBe(series[1].itemStyle.color);
  });
});
