import type { CustomSeriesOption, CustomSeriesRenderItem, CustomSeriesRenderItemReturn } from "echarts";
import { darken, lighten, statDecoTheme } from "./colors";
import { formatNum } from "./data";

type Point = number[];
export interface PrismDatum { start: number; end: number; color: string; label?: number }

/** Three explicit faces share the same exact start/end coordinates as flat bars. */
export function prismSeries(name: string, data: PrismDatum[], horizontal: boolean, widthFraction: number, offset = 0, showValues = false): CustomSeriesOption {
  const renderItem: CustomSeriesRenderItem = (params, api) => {
    const item = data[params.dataIndex];
    if (!item || item.start === item.end) return null;
    const category = params.dataIndex;
    const start = api.coord(horizontal ? [item.start, category] : [category, item.start]);
    const end = api.coord(horizontal ? [item.end, category] : [category, item.end]);
    const size = api.size?.(horizontal ? [0, 1] : [1, 0]);
    const slot = Array.isArray(size) ? Math.abs(size[horizontal ? 1 : 0]) : 30;
    const width = slot * widthFraction;
    const dx = Math.min(12, width * 0.3);
    const dy = -dx * 0.65;
    const center = start[horizontal ? 1 : 0] + slot * offset;
    const x0 = horizontal ? Math.min(start[0], end[0]) : center - width / 2;
    const x1 = horizontal ? Math.max(start[0], end[0]) : center + width / 2;
    const y0 = horizontal ? center - width / 2 : Math.min(start[1], end[1]);
    const y1 = horizontal ? center + width / 2 : Math.max(start[1], end[1]);
    const face = (points: Point[], color: string) => ({ type: "polygon" as const, shape: { points }, style: { fill: color, stroke: color, lineWidth: 0.5 } });
    const children: NonNullable<Extract<CustomSeriesRenderItemReturn, { type: "group" }>>["children"] = [
      face([[x1, y1], [x1 + dx, y1 + dy], [x1 + dx, y0 + dy], [x1, y0]], darken(item.color, 0.14)),
      face([[x0, y0], [x0 + dx, y0 + dy], [x1 + dx, y0 + dy], [x1, y0]], lighten(item.color, 0.16)),
      face([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], item.color),
    ];
    if (showValues) children.push({
      type: "text", style: { text: formatNum(item.label ?? item.end - item.start), x: horizontal ? x1 + dx + 5 : center + dx / 2, y: horizontal ? center : y0 + dy - 5, align: horizontal ? "left" : "center", verticalAlign: horizontal ? "middle" : "bottom", fill: statDecoTheme().ink, font: "600 13px sans-serif" },
    });
    return { type: "group", children };
  };
  return {
    type: "custom", name, renderItem, clip: false, itemStyle: { color: data[0]?.color },
    dimensions: ["category", "start", "end"],
    encode: horizontal ? { x: [1, 2], y: 0, tooltip: 2 } : { x: 0, y: [1, 2], tooltip: 2 },
    data: data.map((item, i) => ({ value: [i, item.start, item.end], itemStyle: { color: item.color } })),
    z: 3,
  };
}

/** An elliptical top and extruded curved walls, including an optional hole. */
export function volumePieSeries(categories: string[], values: number[], colors: string[], outer: number, hole: number, showValues: boolean, measure: (text: string) => number): CustomSeriesOption {
  const total = values.reduce((sum, v) => sum + Math.max(0, v), 0);
  const renderItem: CustomSeriesRenderItem = (_params, api) => {
    const cx = api.getWidth() / 2;
    const cy = api.getHeight() * 0.53;
    const rx = Math.min(api.getWidth() * 0.4, api.getHeight() * outer * 0.62);
    const ry = rx * 0.52;
    const depth = Math.min(30, rx * 0.18);
    const point = (a: number, radius = 1, down = 0): Point => [cx + Math.cos(a) * rx * radius, cy + Math.sin(a) * ry * radius + down];
    const arc = (a: number, b: number, radius = 1, down = 0) => Array.from({ length: Math.max(2, Math.ceil((b - a) * 30)) + 1 }, (_, i, arr) => point(a + (b - a) * i / (arr.length - 1), radius, down));
    const walls: NonNullable<Extract<CustomSeriesRenderItemReturn, { type: "group" }>>["children"] = [];
    const tops: typeof walls = [];
    const labels: typeof walls = [];
    const polygon = (points: Point[], fill: string) => ({ type: "polygon" as const, shape: { points }, style: { fill, stroke: fill, lineWidth: 0.5 } });
    let angle = -Math.PI / 2;
    categories.forEach((name, i) => {
      const sweep = total ? Math.max(0, values[i]) / total * Math.PI * 2 : 0;
      const end = angle + sweep;
      if (!sweep) return;
      const color = colors[i];
      // Only the front-facing half of the outside wall is visible.
      for (let turn = -1; turn <= 1; turn++) {
        const a = Math.max(angle, turn * Math.PI * 2);
        const b = Math.min(end, turn * Math.PI * 2 + Math.PI);
        if (b > a) walls.push(polygon([...arc(a, b), ...arc(a, b, 1, depth).reverse()], darken(color, 0.16)));
        if (hole) {
          const ia = Math.max(angle, turn * Math.PI * 2 - Math.PI);
          const ib = Math.min(end, turn * Math.PI * 2);
          if (ib > ia) walls.push(polygon([...arc(ia, ib, hole), ...arc(ia, ib, hole, depth).reverse()], darken(color, 0.2)));
        }
      }
      tops.push(polygon([...arc(angle, end), ...(hole ? arc(angle, end, hole).reverse() : [[cx, cy]])], color));
      if (showValues) {
        const middle = (angle + end) / 2;
        const [x, y] = point(middle, 1.15);
        labels.push({ type: "text", style: { text: `${name}\n${formatNum(values[i])}`, x, y: y + (Math.sin(middle) > 0 ? depth : -6), align: Math.cos(middle) > 0.1 ? "left" : Math.cos(middle) < -0.1 ? "right" : "center", verticalAlign: Math.sin(middle) > 0 ? "top" : "bottom", fill: statDecoTheme().ink, font: "13px sans-serif", lineHeight: 16, width: Math.min(measure(name), api.getWidth() * 0.22), overflow: "break" } });
      }
      angle = end;
    });
    return { type: "group", children: [...walls, ...tops, ...labels] };
  };
  return { type: "custom", coordinateSystem: "none", renderItem, data: [0], silent: true };
}