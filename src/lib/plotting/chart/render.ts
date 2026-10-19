/** Человекочитаемое представление JSON диаграммы: тип + таблица данных (Markdown). */
import type { StatDecoJson } from "./types";
import { formatNum } from "./data";

export const CHART_TYPE_LABELS: Record<StatDecoJson["chartType"], string> = {
  bar: "Столбчатая диаграмма",
  line: "Линейная диаграмма",
  area: "Диаграмма с областями",
  pie: "Круговая диаграмма",
  scatter: "Диаграмма рассеяния",
  histogram: "Гистограмма распределения",
  radar: "Лепестковая диаграмма",
  funnel: "Воронка",
  treemap: "Плиточная диаграмма (treemap)",
  waterfall: "Каскадная диаграмма",
  boxplot: "Ящик с усами",
};

function cell(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  return typeof v === "number" ? formatNum(v) : String(v);
}

/** Данные по столбцам → Markdown-таблица (строки = наблюдения). */
export function statDecoTableMarkdown(json: StatDecoJson): string {
  const cols = json.data.columns;
  if (!cols.length) return "_Данных нет._";
  const rowCount = Math.max(...cols.map((c) => c.length - 1));
  const head = `| ${cols.map((c) => cell(c[0])).join(" | ")} |`;
  const sep = `| ${cols.map(() => "---").join(" | ")} |`;
  const rows: string[] = [];
  for (let i = 0; i < rowCount; i += 1) {
    rows.push(`| ${cols.map((c) => cell(c[i + 1])).join(" | ")} |`);
  }
  return [head, sep, ...rows].join("\n");
}

/** Текст результата анализа для режима диаграммы: тип, замечания и таблица. */
export function renderStatDecoJson(json: StatDecoJson): string {
  const parts: string[] = [];
  parts.push(`**Тип диаграммы:** ${CHART_TYPE_LABELS[json.chartType]}`);
  if (json.summary) parts.push(json.summary);
  if (!json.dataStatus.canRender) {
    parts.push(`> **Диаграмма не может быть построена.** ${json.dataStatus.reason || ""}`.trim());
  }
  parts.push(statDecoTableMarkdown(json));
  if (json.warnings.length) {
    parts.push(json.warnings.map((w) => `- ${w}`).join("\n"));
  }
  return parts.join("\n\n");
}
