/**
 * Ручное редактирование диаграмм. Формат хранения — тот же StatDecoJson, что
 * возвращает ИИ: ответ модели только дополняется значениями по умолчанию.
 */
import type { StatDecoChartType, StatDecoColumn, StatDecoJson, StatDecoRendering } from "./types";
import { validateStatDecoJson } from "./validate";
import { renderStatDecoChartPng } from "./chart-png";

/** Значения по умолчанию для полей плашки, которых ИИ может не прислать. */
export const DEFAULT_CHART_RENDERING: Required<
  Pick<StatDecoRendering, "orientation" | "seriesLayout" | "showValues" | "showGrid" | "colorMode" | "lineShape" | "innerHole">
> = {
  orientation: "vertical",
  seriesLayout: "grouped",
  showValues: false,
  showGrid: false,
  colorMode: "different",
  lineShape: "straight",
  innerHole: "none",
};

export function createEmptyChart(chartType: StatDecoChartType = "bar"): StatDecoJson {
  return {
    kind: "stat-deco",
    sourceMode: "text",
    topic: "",
    subject: null,
    grade: null,
    chartType,
    title: "",
    summary: "",
    dataStatus: { canRender: true, reason: "" },
    data: {
      columns: [
        ["Категория", "А", "Б", "В"],
        ["Значение", 3, 5, 2],
      ],
    },
    mapping: {},
    rendering: { ...DEFAULT_CHART_RENDERING },
    warnings: [],
  };
}

/** Ответ ИИ → расширенная версия для плашки (недостающие поля — по умолчанию). */
export function normalizeChart(raw: StatDecoJson): StatDecoJson {
  return {
    ...raw,
    title: raw.title ?? "",
    mapping: raw.mapping ?? {},
    warnings: raw.warnings ?? [],
    data: { columns: raw.data?.columns?.length ? raw.data.columns.map((c) => [...c]) : createEmptyChart().data.columns },
    rendering: { ...DEFAULT_CHART_RENDERING, ...(raw.rendering ?? {}) },
  };
}

/** Для отрисовки: сбрасываем пометку «нельзя построить», если в таблице есть данные. */
export function chartForRender(chart: StatDecoJson): StatDecoJson {
  try {
    const v = validateStatDecoJson(chart);
    return { ...v, dataStatus: { canRender: true, reason: "" } };
  } catch {
    return chart;
  }
}

export function chartRowCount(columns: StatDecoColumn[]): number {
  return Math.max(0, ...columns.map((c) => c.length - 1));
}

/** Число ячейки: пусто → null, иначе число (запятая допустима) или исходный текст. */
export function parseCell(text: string, numeric: boolean): string | number | null {
  const t = text.trim();
  if (!t) return null;
  if (!numeric) return t;
  const n = Number(t.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : t;
}

export function setCell(columns: StatDecoColumn[], col: number, row: number, value: string | number | null): StatDecoColumn[] {
  return columns.map((c, i) => {
    if (i !== col) return c;
    const next = [...c];
    while (next.length <= row) next.push(null);
    next[row] = value;
    return next;
  });
}

export function addRow(columns: StatDecoColumn[]): StatDecoColumn[] {
  const rows = chartRowCount(columns);
  return columns.map((c) => {
    const next = [...c];
    while (next.length < rows + 1) next.push(null);
    next.push(null);
    return next;
  });
}

export function removeRow(columns: StatDecoColumn[], row: number): StatDecoColumn[] {
  return columns.map((c) => c.filter((_, i) => i !== row + 1));
}

export function addSeries(columns: StatDecoColumn[]): StatDecoColumn[] {
  const rows = chartRowCount(columns);
  return [...columns, [`Ряд ${columns.length}`, ...Array.from({ length: rows }, () => null)]];
}

export function removeColumn(columns: StatDecoColumn[], col: number): StatDecoColumn[] {
  return columns.filter((_, i) => i !== col);
}

/** Очистить все ячейки данных, заголовки столбцов сохраняются. */
export function clearCells(columns: StatDecoColumn[]): StatDecoColumn[] {
  return columns.map((c) => [c[0] ?? "", ...c.slice(1).map(() => null)]);
}

/**
 * Задать размер таблицы разом: `rows` строк данных и `cols` столбцов.
 * Существующие значения в пределах нового размера сохраняются.
 */
export function resizeTable(columns: StatDecoColumn[], rows: number, cols: number): StatDecoColumn[] {
  const r = Math.max(1, Math.min(50, Math.round(rows)));
  const c = Math.max(2, Math.min(12, Math.round(cols)));
  return Array.from({ length: c }, (_, ci) => {
    const old = columns[ci];
    const header = old?.[0] ?? (ci === 0 ? "Категория" : `Ряд ${ci}`);
    return [header, ...Array.from({ length: r }, (_, ri) => old?.[ri + 1] ?? null)];
  });
}

/** Несколько диаграмм → одна PNG, диаграммы друг под другом. */
export async function renderChartsPng(charts: StatDecoJson[]): Promise<string | null> {
  const pngs = (await Promise.all(charts.map((c) => renderStatDecoChartPng(chartForRender(c))))).filter(
    (s): s is string => !!s,
  );
  if (pngs.length <= 1) return pngs[0] ?? null;
  const images = await Promise.all(
    pngs.map(
      (src) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        }),
    ),
  );
  const width = Math.max(...images.map((i) => i.width));
  const height = images.reduce((s, i) => s + i.height, 0);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  let y = 0;
  for (const img of images) {
    ctx.drawImage(img, (width - img.width) / 2, y);
    y += img.height;
  }
  return canvas.toDataURL("image/png");
}
