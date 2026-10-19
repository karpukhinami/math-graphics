/**
 * stat-deco JSON  →  ECharts option.
 *
 * The internal JSON is deliberately library-agnostic; this is the only place
 * that knows about ECharts, so the chart library can be swapped without
 * touching the prompt, the ContentSummary shape or the validator.
 */
import type { EChartsOption } from "echarts";
import type { StatDecoJson } from "./types";
import { resolveColors, statDecoTheme, waterfallColors } from "./colors";
import { chartGridScale } from "./grid-scale";
import { wrapCategoryLabel } from "./category-labels";
import { prismSeries, volumePieSeries } from "./volume";
import {
  formatNum,
  histogramBins,
  isNumericColumn,
  numericBody,
  firstNumericColumnIndex,
  toBoxplotStats,
  toCategorySeries,
  toScatterPoints,
  toTreemapNodes,
  toWaterfallSteps,
} from "./data";

/* ---------- categorical → numeric coefficients (from the prototype) ---------- */

const BAR_WIDTH = { narrow: 0.46, medium: 0.64, wide: 0.82 } as const;
const CATEGORY_GAP = { narrow: 0.08, medium: 0.16, wide: 0.25 } as const;
const SERIES_GAP = { narrow: 0.04, medium: 0.08, wide: 0.14 } as const;
const HEADROOM = { small: 0.12, medium: 0.25, large: 0.4 } as const;
const LINE_WIDTH = { thin: 2, medium: 4, thick: 7 } as const;
const POINT_RADIUS = { none: 0, small: 4, medium: 7, large: 10 } as const;
const PIE_RADIUS = { small: 0.53, medium: 0.65, large: 0.78 } as const;
const INNER_HOLE = { none: 0, small: 0.26, medium: 0.43, large: 0.58 } as const;
const SLICE_GAP_DEG = { none: 0, narrow: 2.2, medium: 5, wide: 8 } as const;

function axisMaxWithHeadroom(values: number[], headroom: keyof typeof HEADROOM = "medium"): number | undefined {
  const max = Math.max(0, ...values.filter((v) => Number.isFinite(v)));
  if (!max) return undefined;
  const fraction = HEADROOM[headroom];
  return Math.ceil((max / (1 - fraction)) * 100) / 100;
}

type SeriesList = NonNullable<EChartsOption["series"]>;

export interface StatDecoOptionResult {
  option: EChartsOption;
  /** Filled when the data cannot produce a meaningful chart. */
  error?: string;
}

export function buildStatDecoOption(
  json: StatDecoJson,
  layout: { width: number; height?: number; measureText: (text: string, font: string) => number } = {
    width: 848,
    measureText: (text) => Array.from(text).length * 7.5,
  },
): StatDecoOptionResult {
  const theme = statDecoTheme();
  const r = json.rendering;
  const showValues = r.showValues !== false;
  const fontFamily = '"SB Sans Text", ui-sans-serif, system-ui, sans-serif';

  const base: EChartsOption = {
    backgroundColor: theme.background,
    animation: false,
    textStyle: { color: theme.ink, fontFamily },
    title: {
      text: wrapCategoryLabel(json.title || "", Math.max(100, layout.width - 32), (text) => layout.measureText(text, `700 22px ${fontFamily}`)),
      left: "center",
      top: 8,
      textStyle: { color: theme.header, fontSize: 22, fontWeight: 700, fontFamily },
    },
    grid: { left: 48, right: 40, top: 72, bottom: 56, containLabel: true },
    tooltip: { trigger: "item" },
  };

  const labelStyle = {
    show: showValues,
    color: theme.ink,
    fontSize: 13,
    fontWeight: 600 as const,
    fontFamily,
  };

  const measureLabel = (text: string) => layout.measureText(text, `13px ${fontFamily}`);
  const labelWidth = Math.min(136, Math.max(80, layout.width * 0.22));
  const chartGrid = (categories: string[], horizontal: boolean, legend = false) => {
    const wrapped = categories.map((text) => wrapCategoryLabel(text, labelWidth, measureLabel));
    const measured = Math.max(0, ...wrapped.flatMap((text) => text.split("\n").map(measureLabel)));
    return horizontal
      ? { left: Math.ceil(measured) + 18, right: 36, top: 72, bottom: legend ? 94 : 68, containLabel: false }
      : { left: 18, right: 36, top: 72, bottom: legend ? 72 : 32, containLabel: true };
  };
  const catAxis = (categories: string[], horizontal = true) => {
    const slotWidth = Math.max(1, (layout.width - 88) / Math.max(categories.length, 1) - 12);
    return ({
    type: "category" as const,
    data: categories,
    axisLine: { lineStyle: { color: theme.ink } },
    axisTick: { show: false },
    axisLabel: {
      color: theme.ink,
      fontSize: 13,
      fontFamily,
      // Every category must be labelled: never drop or hide labels.
      interval: 0,
      hideOverlap: false,
      rotate: 0,
      formatter: (text: string) => wrapCategoryLabel(text, horizontal ? slotWidth : labelWidth, measureLabel),
      lineHeight: 15,
      margin: 10,
    },
    // Reference charts intentionally omit the measuring grid.
    splitLine: { show: false },
    });
  };


  /**
   * Ось значений. По тумблеру «Ось и сетка» — видимая ось с подписями делений,
   * тонкой серой сеткой и подписью оси (без стрелки); иначе ось скрыта.
   */
  const showGrid = r.showGrid === true;
  const valueAxis = (values: number[], name?: string, horizontal = false) => {
    const max = axisMaxWithHeadroom(values, r.headroom ?? "medium");
    if (!showGrid) {
      return { type: "value" as const, max, show: false, splitLine: { show: false } };
    }
    return {
      type: "value" as const,
      ...chartGridScale(values, r.gridStep),
      name: name ? wrapCategoryLabel(name, horizontal ? Math.max(100, layout.width - labelWidth - 72) : Math.min(210, layout.width * 0.45), measureLabel) : "",
      nameLocation: horizontal ? "middle" as const : "end" as const,
      nameGap: horizontal ? 36 : 12,
      nameTextStyle: { color: theme.ink, fontSize: 13, fontFamily, fontWeight: 600 as const, align: horizontal ? "center" as const : "left" as const },
      axisLine: { show: true, lineStyle: { color: theme.muted } },
      axisTick: { show: false },
      axisLabel: {
        color: theme.ink,
        fontSize: 12,
        fontFamily,
        formatter: (v: number) => formatNum(v),
      },
      splitLine: { show: true, lineStyle: { color: theme.muted, opacity: 0.3, width: 1 } },
    };
  };

  /** Independent caption, never a series name from the table. */
  const valueAxisName = (): string | undefined => {
    return r.valueAxisLabel?.trim() || undefined;
  };

  switch (json.chartType) {
    /* ------------------------------- bar ------------------------------- */
    case "bar": {
      const { categories, series } = toCategorySeries(json);
      if (!categories.length || !series.length) return emptyResult(base, "Нет категорий или числовых рядов");
      const stacked = r.seriesLayout === "stacked" || r.seriesLayout === "stacked100";
      const normalize = r.seriesLayout === "stacked100";
      // Несколько рядов: каждый ряд своего цвета, чтобы легенда читалась.
      const barMode = series.length > 1 && (r.colorMode ?? "different") === "same" ? "different" : r.colorMode;
      const colors = resolveColors(theme, barMode, series.length > 1 ? series.length : categories.length, r.customColors);
      const widthFraction = BAR_WIDTH[r.barWidth ?? "medium"];
      const perBar = series.length > 1 && !stacked ? widthFraction / series.length : widthFraction;
      const totals = categories.map((_, i) =>
        series.reduce<number>((acc, s) => acc + (s.values[i] ?? 0), 0),
      );
      const horizontal = r.orientation === "horizontal";

      const echSeries = series.map((s, si) => ({
        type: "bar" as const,
        name: s.name,
        stack: stacked ? "total" : undefined,
        barWidth: `${Math.round(perBar * 100)}%`,
        barCategoryGap: `${Math.round(CATEGORY_GAP[r.categoryGap ?? "medium"] * 100)}%`,
        barGap: `${Math.round(SERIES_GAP[r.seriesGap ?? "medium"] * 100)}%`,
        itemStyle: { color: series.length > 1 ? colors[si] : ((p: { dataIndex: number }) => colors[p.dataIndex % colors.length]), borderRadius: 2 },
        label: {
          ...labelStyle,
          position: horizontal ? ("right" as const) : ("top" as const),
          formatter: (p: { value: number }) => formatNum(Number(p.value)),
        },
        data: s.values.map((v, i) =>
          normalize && totals[i] ? Math.round(((v ?? 0) / totals[i]) * 1000) / 10 : (v ?? null),
        ),
      }));

      const maxValues = stacked ? totals : series.flatMap((s) => s.values.map((v) => v ?? 0));
      const axisValues = normalize ? [100] : maxValues;
      const renderedSeries = r.volume ? series.map((s, si) => prismSeries(s.name, s.values.map((v, i) => {
        const endValue = normalize && totals[i] ? (v ?? 0) / totals[i] * 100 : v ?? 0;
        const start = stacked ? series.slice(0, si).reduce((sum, prev) => {
          const value = prev.values[i] ?? 0;
          return sum + (normalize && totals[i] ? value / totals[i] * 100 : value);
        }, 0) : 0;
        return { start, end: start + endValue, color: series.length > 1 ? colors[si] : colors[i], label: endValue };
      }), horizontal, perBar * 0.82, stacked ? 0 : (si - (series.length - 1) / 2) * perBar, showValues)) : echSeries;

      return {
        option: {
          ...base,
          legend: legendFor(series, theme),
          grid: chartGrid(categories, horizontal, series.length > 1),
          xAxis: horizontal ? valueAxis(axisValues, valueAxisName(), true) : catAxis(categories),
          yAxis: horizontal ? catAxis(categories, false) : valueAxis(axisValues, valueAxisName()),
          series: renderedSeries as SeriesList,
        },
      };
    }

    /* --------------------------- line / area --------------------------- */
    case "line":
    case "area": {
      const { categories, series } = toCategorySeries(json);
      if (!categories.length || !series.length) return emptyResult(base, "Нет категорий или числовых рядов");
      const isArea = json.chartType === "area";
      const stacked = r.seriesLayout === "stacked" || r.seriesLayout === "stacked100";
      const normalize = r.seriesLayout === "stacked100";
      const lineMode = series.length > 1 && (r.colorMode ?? "different") === "same" ? "different" : r.colorMode;
      const colors = resolveColors(theme, lineMode, Math.max(series.length, 1), r.customColors);
      const radius = POINT_RADIUS[r.pointSize ?? (isArea ? "none" : "medium")];
      const totals = categories.map((_, i) => series.reduce<number>((a, s) => a + (s.values[i] ?? 0), 0));

      const echSeries = series.map((s, si) => ({
        type: "line" as const,
        name: s.name,
        smooth: r.lineShape === "smooth",
        stack: stacked ? "total" : undefined,
        symbol: radius ? ("circle" as const) : ("none" as const),
        symbolSize: radius * 2,
        lineStyle: { width: LINE_WIDTH[r.lineWidth ?? "medium"], color: colors[si] },
        itemStyle: { color: theme.surface, borderColor: colors[si], borderWidth: 3 },
        areaStyle: isArea ? { color: colors[si], opacity: 0.62 } : undefined,
        label: {
          ...labelStyle,
          position: "top" as const,
          formatter: (p: { value: number }) => formatNum(Number(p.value)),
        },
        data: s.values.map((v, i) =>
          normalize && totals[i] ? Math.round(((v ?? 0) / totals[i]) * 1000) / 10 : (v ?? null),
        ),
      }));

      const axisValues = normalize ? [100] : stacked ? totals : series.flatMap((s) => s.values.map((v) => v ?? 0));

      return {
        option: {
          ...base,
          legend: legendFor(series, theme),
          grid: chartGrid(categories, false, series.length > 1),
          xAxis: { ...catAxis(categories), boundaryGap: false },
          yAxis: valueAxis(axisValues, valueAxisName()),
          series: echSeries as SeriesList,
        },
      };
    }

    /* -------------------------------- pie ------------------------------ */
    case "pie": {
      const { categories, series } = toCategorySeries(json);
      if (!categories.length || !series.length) return emptyResult(base, "Нет категорий или значений");
      const values = series[0].values;
      const colors = resolveColors(theme, r.colorMode ?? "different", categories.length, r.customColors);
      const outer = PIE_RADIUS[r.chartSize ?? "medium"];
      const hole = INNER_HOLE[r.innerHole ?? "none"];
      const total = values.reduce<number>((a, v) => a + (v ?? 0), 0);
      if (r.volume) return { option: { ...base, grid: undefined, series: [volumePieSeries(categories, values.map((v) => v ?? 0), colors, outer, hole, showValues, measureLabel)] } };
      return {
        option: {
          ...base,
          grid: undefined,
          series: ([
            {
              type: "pie",
              radius: [`${Math.round(outer * hole * 100)}%`, `${Math.round(outer * 100)}%`],
              center: ["50%", "54%"],
              padAngle: SLICE_GAP_DEG[r.sliceGap ?? "none"],
              avoidLabelOverlap: true,
              minAngle: 2,
              itemStyle: { borderColor: theme.background, borderWidth: 0 },
              label: {
                show: showValues,
                color: theme.ink,
                fontSize: 13,
                fontFamily,
                // Full category names: wrap instead of the default ellipsis.
                overflow: "break",
                width: 150,
                lineHeight: 16,
                bleedMargin: 2,
                edgeDistance: 6,
                formatter: (p: { name: string; value: number }) =>
                  `${p.name} · ${formatNum(Number(p.value))}`,
              },
              labelLine: { show: showValues, length: 12, length2: 14, lineStyle: { color: theme.ink } },
              labelLayout: { hideOverlap: false },

              data: categories.map((name, i) => ({
                name,
                value: values[i] ?? 0,
                itemStyle: { color: colors[i] },
              })),
            },
          ] as SeriesList),
          graphic:
            hole > 0 && showValues
              ? [
                  {
                    type: "text",
                    left: "center",
                    top: "51%",
                    style: {
                      text: formatNum(total),
                      fill: theme.header,
                      font: "700 24px sans-serif",
                    },
                  },
                ]
              : undefined,
        },
      };
    }

    /* ------------------------------ scatter ---------------------------- */
    case "scatter": {
      const { xName, points } = toScatterPoints(json);
      const yName = valueAxisName();
      if (!points.length) return emptyResult(base, "Не найдены пары числовых координат");
      const radius = POINT_RADIUS[r.pointSize ?? "medium"] || 7;
      const hasSize = points.some((p) => typeof p.size === "number");
      const maxSize = Math.max(...points.map((p) => p.size ?? 0), 1);
      const colors = resolveColors(theme, r.colorMode, points.length, r.customColors);
      const single = (r.colorMode ?? "same") === "same";
      return {
        option: {
          ...base,
          grid: { left: 48, right: 36, top: 72, bottom: 68, containLabel: true },
          xAxis: showGrid ? valueAxis(points.map((p) => p.x), xName, true) : { type: "value", name: xName, nameLocation: "middle", nameGap: 28, splitLine: { show: false } },
          yAxis: showGrid ? valueAxis(points.map((p) => p.y), yName) : { type: "value", name: yName, splitLine: { show: false } },
          series: ([
            {
              type: "scatter",
              symbolSize: (val: unknown, params: { dataIndex: number }) => {
                const p = points[params.dataIndex];
                if (!hasSize || !p?.size) return radius * 2;
                return radius * 2 * (0.5 + p.size / maxSize);
              },
              label: {
                ...labelStyle,
                position: "top" as const,
                formatter: (p: { dataIndex: number }) => points[p.dataIndex]?.label ?? "",
              },
              data: points.map((p, i) => ({
                value: [p.x, p.y],
                name: p.label,
                itemStyle: { color: single ? theme.primary : colors[i] },
              })),
            },
          ] as SeriesList),
        },
      };
    }

    /* ----------------------------- histogram --------------------------- */
    case "histogram": {
      const cols = json.data.columns;
      const valIdx = json.mapping.value ?? firstNumericColumnIndex(json);
      const raw = numericBody(cols[valIdx]).filter((v): v is number => v != null);
      const { labels, counts } = histogramBins(raw);
      if (!labels.length) return emptyResult(base, "Нет числовых наблюдений для распределения");
      const colors = resolveColors(theme, r.colorMode ?? "same", labels.length, r.customColors);
      const horizontal = r.orientation === "horizontal";
      if (r.volume) return { option: { ...base, grid: chartGrid(labels, horizontal), xAxis: horizontal ? valueAxis(counts, valueAxisName(), true) : catAxis(labels), yAxis: horizontal ? catAxis(labels, false) : valueAxis(counts, valueAxisName()), series: [prismSeries("Частота", counts.map((v, i) => ({ start: 0, end: v, color: colors[i] })), horizontal, BAR_WIDTH[r.barWidth ?? "wide"] * 0.82, 0, showValues)] } };
      return {
        option: {
          ...base,
          grid: chartGrid(labels, horizontal),
          xAxis: horizontal ? valueAxis(counts, valueAxisName(), true) : catAxis(labels),
          yAxis: horizontal ? catAxis(labels, false) : valueAxis(counts, valueAxisName()),
          series: ([
            {
              type: "bar",
              // Histogram bins touch each other.
              barCategoryGap: "0%",
              barWidth: `${Math.round(BAR_WIDTH[r.barWidth ?? "wide"] * 100)}%`,
              itemStyle: { color: (p: { dataIndex: number }) => colors[p.dataIndex % colors.length] },
              label: { ...labelStyle, position: horizontal ? "right" as const : "top" as const },
              data: counts,
            },
          ] as SeriesList),
        },
      };
    }

    /* ------------------------------- radar ----------------------------- */
    case "radar": {
      const { categories, series } = toCategorySeries(json);
      if (!categories.length || !series.length) return emptyResult(base, "Нет показателей для радара");
      const colors = resolveColors(theme, r.colorMode ?? "different", series.length, r.customColors);
      const allValues = series.flatMap((s) => s.values.map((v) => v ?? 0));
      const max = axisMaxWithHeadroom(allValues, "small");
      const radius = POINT_RADIUS[r.pointSize ?? "small"];
      return {
        option: {
          ...base,
          grid: undefined,
          legend: legendFor(series, theme),
          radar: {
            indicator: categories.map((name) => ({ name, max })),
            center: ["50%", "56%"],
            radius: "64%",
            axisName: { color: theme.ink, fontFamily },
            splitLine: { lineStyle: { color: theme.muted, opacity: 0.5 } },
            splitArea: { show: false },
            axisLine: { lineStyle: { color: theme.muted, opacity: 0.6 } },
          },
          series: series.map((s, si) => ({
            type: "radar" as const,
            name: s.name,
            symbol: radius ? ("circle" as const) : ("none" as const),
            symbolSize: radius * 2,
            lineStyle: { width: LINE_WIDTH[r.lineWidth ?? "medium"], color: colors[si] },
            itemStyle: { color: colors[si] },
            areaStyle: { color: colors[si], opacity: 0.22 },
            label: { ...labelStyle },
            data: [{ value: s.values.map((v) => v ?? 0), name: s.name }],
          })) as SeriesList,
        },
      };
    }

    /* ------------------------------- funnel ---------------------------- */
    case "funnel": {
      const { categories, series } = toCategorySeries(json);
      if (!categories.length || !series.length) return emptyResult(base, "Нет этапов воронки");
      const values = series[0].values;
      const colors = resolveColors(theme, r.colorMode ?? "similar", categories.length, r.customColors);
      return {
        option: {
          ...base,
          grid: undefined,
          series: ([
            {
              type: "funnel",
              // Row order is meaningful and must be preserved.
              sort: "none",
              left: "12%",
              right: "12%",
              top: 72,
              bottom: 32,
              gap: 4,
              label: {
                show: true,
                position: "inside",
                color: theme.ink,
                fontFamily,
                formatter: (p: { name: string; value: number }) =>
                  showValues ? `${p.name} · ${formatNum(Number(p.value))}` : p.name,
              },
              data: categories.map((name, i) => ({
                name,
                value: values[i] ?? 0,
                itemStyle: { color: colors[i], borderWidth: 0 },
              })),
            },
          ] as SeriesList),
        },
      };
    }

    /* ------------------------------ treemap ---------------------------- */
    case "treemap": {
      const nodes = toTreemapNodes(json);
      if (!nodes.length) return emptyResult(base, "Нет категорий для treemap");
      const colors = resolveColors(theme, r.colorMode ?? "different", nodes.length, r.customColors);
      return {
        option: {
          ...base,
          grid: undefined,
          series: ([
            {
              type: "treemap",
              top: 68,
              left: 16,
              right: 16,
              bottom: 16,
              roam: false,
              breadcrumb: { show: false },
              nodeClick: false,
              itemStyle: { borderColor: theme.background, borderWidth: 3, gapWidth: 3 },
              label: {
                show: true,
                color: theme.ink,
                fontFamily,
                formatter: (p: { name: string; value: number }) =>
                  showValues ? `${p.name}\n${formatNum(Number(p.value))}` : p.name,
              },
              data: nodes.map((n, i) => ({ ...n, itemStyle: { color: colors[i] } })),
            },
          ] as SeriesList),
        },
      };
    }

    /* ----------------------------- waterfall --------------------------- */
    case "waterfall": {
      const steps = toWaterfallSteps(json);
      if (!steps.length) return emptyResult(base, "Нет шагов для waterfall");
      const roles = waterfallColors(theme);
      const horizontal = r.orientation === "horizontal";
      const names = steps.map((s) => s.name);
      const axisValues = steps.flatMap((s) => [s.base, s.base + s.span]);
      const series = [
        {
          type: "bar" as const,
          stack: "wf",
          silent: true,
          itemStyle: { color: "transparent" },
          data: steps.map((s) => s.base),
        },
        {
          type: "bar" as const,
          stack: "wf",
          barWidth: `${Math.round(BAR_WIDTH[r.barWidth ?? "medium"] * 100)}%`,
          barCategoryGap: `${Math.round(CATEGORY_GAP[r.categoryGap ?? "medium"] * 100)}%`,
          label: {
            ...labelStyle,
            position: horizontal ? ("right" as const) : ("top" as const),
            formatter: (p: { dataIndex: number }) => formatNum(steps[p.dataIndex].value),
          },
          data: steps.map((s) => ({
            value: s.span,
            itemStyle: { color: roles[s.role], borderRadius: 2 },
          })),
        },
      ];
      return {
        option: {
          ...base,
          grid: chartGrid(names, horizontal),
          xAxis: horizontal ? valueAxis(axisValues, valueAxisName(), true) : catAxis(names),
          yAxis: horizontal ? catAxis(names, false) : valueAxis(axisValues, valueAxisName()),
          series: r.volume ? [prismSeries("Изменение", steps.map((s) => ({ start: s.base, end: s.base + s.span, color: roles[s.role], label: s.value })), horizontal, BAR_WIDTH[r.barWidth ?? "medium"] * 0.82, 0, showValues)] : series as SeriesList,
        },
      };
    }

    /* ------------------------------ boxplot ---------------------------- */
    case "boxplot": {
      const stats = toBoxplotStats(json);
      if (!stats.length) return emptyResult(base, "Нет наблюдений для «ящика с усами»");
      const colors = resolveColors(theme, r.colorMode ?? "same", stats.length, r.customColors);
      const horizontal = r.orientation === "horizontal";
      const names = stats.map((s) => s.name);
      const boxes = stats.map((s, i) => ({
        value: [s.min, s.q1, s.median, s.q3, s.max],
        itemStyle: { color: colors[i], borderColor: theme.ink, borderWidth: 2 },
      }));
      const outliers = stats.flatMap((s, i) => s.outliers.map((v) => (horizontal ? [v, i] : [i, v])));
      const allValues = stats.flatMap((s) => [s.min, s.max, ...s.outliers]);
      const axisValues = allValues;
      return {
        option: {
          ...base,
          grid: chartGrid(names, horizontal),
          xAxis: horizontal ? valueAxis(axisValues, valueAxisName(), true) : catAxis(names),
          yAxis: horizontal ? catAxis(names, false) : valueAxis(axisValues, valueAxisName()),
          series: ([
            {
              type: "boxplot",
              data: boxes,
              label: { ...labelStyle },
            },
            {
              type: "scatter",
              symbolSize: 8,
              itemStyle: { color: theme.spot },
              data: outliers,
            },
          ] as SeriesList),
        },
      };
    }

    default:
      return emptyResult(base, "Неизвестный тип диаграммы");
  }
}

/* ------------------------------ helpers ------------------------------ */

function emptyResult(base: EChartsOption, error: string): StatDecoOptionResult {
  return { option: base, error };
}

function legendFor(
  series: Array<{ name: string }>,
  theme: { ink: string },
): EChartsOption["legend"] {
  if (series.length < 2) return undefined;
  return {
    bottom: 8,
    itemGap: 18,
    textStyle: { color: theme.ink, fontSize: 13 },
    data: series.map((s) => s.name),
  };
}

