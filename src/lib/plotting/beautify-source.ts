import type { StatDecoJson } from "./chart/types";

/** Identity follows committed input, not transient point drafts or screen layout. */
export function plotBeautifySourceKey(svg: string | null, charts: StatDecoJson[] | null): string | null {
  return charts ? (charts.length ? `charts:${JSON.stringify(charts)}` : null) : svg;
}

/** Context is inspiration only; the PNG remains the geometric reference. */
export function plotBeautifyChartContext(charts: StatDecoJson[]): string {
  return JSON.stringify(charts.map(({ topic, subject, grade, title, summary, chartType, data }) => ({
    topic, subject, grade, title, summary, chartType, data,
  })));
}