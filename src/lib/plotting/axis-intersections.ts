import { parseAnchors, type PlotBounds } from "./build";
import { compileEquation, compileExpression, parseBound } from "./math-expr";
import { qualitativeEvaluator } from "./qualitative";
import type { GraphMath } from "./types";

/** Ищем нули исходной функции, а не пересечения её дискретной ломаной. */
function roots(fn: (t: number) => number, from: number, to: number, extra: number[] = []): number[] {
  if (to < from) return [];
  const xs = [...new Set([from, to, ...extra.filter((x) => x >= from && x <= to),
    ...Array.from({ length: 901 }, (_, i) => from + (to - from) * i / 900)])].sort((a, b) => a - b);
  const ys = xs.map(fn);
  const found: number[] = [];
  const accept = (x: number) => {
    const y = fn(x);
    if (Number.isFinite(y) && Math.abs(y) <= 1e-12 && !found.some((v) => Math.abs(v - x) < 1e-7)) found.push(x);
  };
  for (let i = 0; i < xs.length; i++) {
    // Совпадающие участки не превращаем в сотни «пересечений».
    if (ys[i] === 0 && (xs.length === 1 || ys[i - 1] !== 0 || ys[i + 1] !== 0)) accept(xs[i]);
    if (i > 0 && Number.isFinite(ys[i - 1]) && Number.isFinite(ys[i]) && ys[i - 1] * ys[i] < 0) {
      let left = xs[i - 1], right = xs[i], fl = ys[i - 1];
      for (let k = 0; k < 80; k++) {
        const mid = (left + right) / 2;
        const fm = fn(mid);
        if (!Number.isFinite(fm)) break;
        if (fm === 0) { left = right = mid; break; }
        if (fl * fm < 0) right = mid;
        else { left = mid; fl = fm; }
      }
      accept((left + right) / 2);
    }
    if (i === 0 || i === xs.length - 1 || !Number.isFinite(ys[i]) ||
      !(Math.abs(ys[i]) < Math.abs(ys[i - 1]) && Math.abs(ys[i]) <= Math.abs(ys[i + 1]))) continue;
    // Касание не меняет знак: уточняем локальный минимум |f|.
    let left = xs[i - 1], right = xs[i + 1];
    const ratio = (Math.sqrt(5) - 1) / 2;
    let a = right - ratio * (right - left), b = left + ratio * (right - left);
    let fa = Math.abs(fn(a)), fb = Math.abs(fn(b));
    for (let k = 0; k < 90; k++) {
      if (fa <= fb) {
        right = b; b = a; fb = fa; a = right - ratio * (right - left); fa = Math.abs(fn(a));
      } else {
        left = a; a = b; fa = fb; b = left + ratio * (right - left); fb = Math.abs(fn(b));
      }
    }
    accept(fa <= fb ? a : b);
  }
  return found.sort((a, b) => a - b);
}

/** null означает тип, для которого оставляем прежний геометрический поиск. */
export function axisIntersections(math: GraphMath, axis: string, vars: { x: string; y: string }, bounds: PlotBounds): Array<{ x: number; y: number }> | null {
  const vertical = axis === "axis:x=0";
  if (!vertical && axis !== "axis:y=0") return null;
  const from = Math.max(bounds.xMin, math.domainFrom.trim() ? parseBound(math.domainFrom) : bounds.xMin);
  const to = Math.min(bounds.xMax, math.domainTo.trim() ? parseBound(math.domainTo) : bounds.xMax);
  if (math.kind === "implicit") {
    if (vertical && (from > 0 || to < 0)) return [];
    const fn = compileEquation(math.equation, [vars.x, vars.y]);
    const values = roots((t) => fn({ [vars.x]: vertical ? 0 : t, [vars.y]: vertical ? t : 0 }),
      vertical ? bounds.yMin : from, vertical ? bounds.yMax : to);
    return values.map((t) => ({ x: vertical ? 0 : t, y: vertical ? t : 0 }));
  }
  const branches: Array<{ fn: (x: number) => number; from: number; to: number; extra?: number[]; includeFrom?: boolean; includeTo?: boolean }> = [];
  const compile = (expression: string) => {
    const fn = compileExpression(expression, [vars.x]);
    return (x: number) => fn({ [vars.x]: x });
  };
  if (math.kind === "explicit") branches.push({ fn: compile(math.expression), from, to });
  else if (math.kind === "qualitative") {
    const anchors = parseAnchors(math);
    const xs = anchors.map((a) => a.x);
    branches.push({ fn: qualitativeEvaluator(anchors, math.extendEnds === false ? "linear" : "curve"),
      from: math.extendEnds === false ? Math.max(from, Math.min(...xs)) : from,
      to: math.extendEnds === false ? Math.min(to, Math.max(...xs)) : to, extra: xs });
  } else if (math.kind === "piecewise") {
    for (const p of math.pieces) branches.push({ fn: compile(p.expression),
      from: Math.max(bounds.xMin, p.from.trim() ? parseBound(p.from) : bounds.xMin),
      to: Math.min(bounds.xMax, p.to.trim() ? parseBound(p.to) : bounds.xMax),
      includeFrom: !p.from.trim() || parseBound(p.from) < bounds.xMin || p.includeFrom,
      includeTo: !p.to.trim() || parseBound(p.to) > bounds.xMax || p.includeTo });
  } else return null;
  const hits: Array<{ x: number; y: number }> = [];
  for (const branch of branches) {
    const included = (x: number) => x >= branch.from && x <= branch.to &&
      !(branch.includeFrom === false && Math.abs(x - branch.from) < 1e-9) &&
      !(branch.includeTo === false && Math.abs(x - branch.to) < 1e-9);
    if (vertical) {
      if (!included(0)) continue;
      const y = branch.fn(0);
      if (Number.isFinite(y)) hits.push({ x: 0, y });
    } else {
      hits.push(...roots(branch.fn, branch.from, branch.to, branch.extra).filter(included).map((x) => ({ x, y: 0 })));
    }
  }
  return hits.filter((p, i) => !hits.slice(0, i).some((q) => Math.abs(p.x - q.x) < 1e-7 && Math.abs(p.y - q.y) < 1e-7))
    .sort((a, b) => a.x - b.x || a.y - b.y);
}