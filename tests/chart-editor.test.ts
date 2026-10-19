import { describe, expect, test } from "bun:test";
import { addRow, addSeries, createEmptyChart, normalizeChart, parseCell, removeRow, setCell, validateStatDecoJson } from "@/lib/plotting/chart";
import { usePlotStore } from "@/lib/plotting/store";

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
});
