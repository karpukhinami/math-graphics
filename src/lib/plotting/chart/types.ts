/** Типы внутреннего JSON диаграммы («стат-деко»), перенесённые из проекта инфографики. */

export type StatDecoChartType =
  | "bar"
  | "line"
  | "area"
  | "pie"
  | "scatter"
  | "histogram"
  | "radar"
  | "funnel"
  | "treemap"
  | "waterfall"
  | "boxplot";

export type StatDecoColorMode = "same" | "similar" | "different";

/** Таблица по столбцам: первый элемент каждого столбца — его заголовок. */
export type StatDecoColumn = Array<string | number | null>;

export interface StatDecoDataStatus {
  canRender: boolean;
  reason: string;
}

/** Соответствие ролей номерам столбцов; нужно только там, где роли не позиционные. */
export interface StatDecoMapping {
  label?: number;
  category?: number;
  value?: number;
  type?: number;
  parent?: number;
  x?: number;
  y?: number;
  size?: number;
}

/** Категориальные подсказки отрисовки, выбранные моделью (никогда не пиксели/проценты). */
export interface StatDecoRendering {
  orientation?: "vertical" | "horizontal";
  seriesLayout?: "grouped" | "stacked" | "stacked100" | "overlay";
  barWidth?: "narrow" | "medium" | "wide";
  categoryGap?: "narrow" | "medium" | "wide";
  seriesGap?: "narrow" | "medium" | "wide";
  volume?: boolean;
  headroom?: "small" | "medium" | "large";
  showValues?: boolean;
  colorMode?: StatDecoColorMode;
  chartSize?: "small" | "medium" | "large";
  sliceGap?: "none" | "narrow" | "medium" | "wide";
  innerHole?: "none" | "small" | "medium" | "large";
  lineWidth?: "thin" | "medium" | "thick";
  lineShape?: "straight" | "smooth";
  pointSize?: "none" | "small" | "medium" | "large";
}

export interface StatDecoJson {
  kind: "stat-deco";
  sourceMode: "text";
  topic: string;
  subject: string | null;
  grade: string | null;
  chartType: StatDecoChartType;
  title: string;
  summary: string;
  dataStatus: StatDecoDataStatus;
  data: { columns: StatDecoColumn[] };
  mapping: StatDecoMapping;
  rendering: StatDecoRendering;
  warnings: string[];
}
