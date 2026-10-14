/** Точные подписи прямой: арифметика дробей не проходит через округлённый number. */
import { all, create, isFraction } from "mathjs";
import { evaluateNumber, expressionLatex, normalizeInput } from "../math-expr";
import type { LineSceneData } from "./types";

let exactMath: ReturnType<typeof create> | undefined;

export function hasOrdinaryFraction(raw: string): boolean {
  return /\/|\\[dt]?frac|[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/.test(raw);
}

export function linePrefersFractions(line: LineSceneData): boolean {
  return [line.axis.min, line.axis.max, line.axis.majorStep,
    line.ticks.majorLabelAnchor, line.ticks.majorSelectedLabels,
    line.ticks.minorLabelIntervalStart,
    ...line.points.filter((p) => !p.math.sourceSetId).map((p) => p.math.coordinate),
    ...line.sets.flatMap((s) => s.math.kind === "interval" ? [s.math.left, s.math.right]
      : s.math.kind === "ray" ? [s.math.rayBoundary] : [s.math.freeformInput]),
  ].some(hasOrdinaryFraction);
}

function finiteDecimal(numerator: bigint, denominator: bigint): string | null {
  let rest = denominator;
  while (rest % 2n === 0n) rest /= 2n;
  while (rest % 5n === 0n) rest /= 5n;
  if (rest !== 1n) return null;
  let remainder = numerator % denominator;
  let out = String(numerator / denominator);
  if (remainder) out += ",";
  while (remainder) {
    remainder *= 10n;
    out += String(remainder / denominator);
    remainder %= denominator;
  }
  return out;
}

export function lineNumericLabel(raw: string, preferFractions = hasOrdinaryFraction(raw)): { display: string; latex: string } {
  const normalized = normalizeInput(raw);
  // Разрешаем только числовую арифметику; корни и π оставляем точными выражениями.
  if (/^[\d\s.eE+*/()^\-]+$/.test(normalized)) {
    try {
      exactMath ??= create(all, { number: "Fraction" });
      const value = exactMath.evaluate(normalized);
      if (isFraction(value)) {
        const n = BigInt(value.n), d = BigInt(value.d);
        const negative = BigInt(value.s) < 0n && n !== 0n;
        if (d === 1n) return { display: `${negative ? "−" : ""}${n}`, latex: `${negative ? "-" : ""}${n}` };
        const decimal = preferFractions ? null : finiteDecimal(n, d);
        if (decimal !== null) return { display: `${negative ? "−" : ""}${decimal}`, latex: `${negative ? "-" : ""}${decimal.replace(",", "{,}")}` };
        return { display: `${negative ? "−" : ""}${n}/${d}`, latex: `${negative ? "-" : ""}\\frac{${n}}{${d}}` };
      }
    } catch { /* Некорректный ввод обработает построитель. */ }
  }
  try {
    evaluateNumber(raw);
    return { display: raw, latex: expressionLatex(raw, []) };
  } catch {
    return { display: raw, latex: "" };
  }
}

/** Засечки отсчитываются от min; index относится к большим или мелким делениям. */
export function lineTickLabel(line: LineSceneData, index: number, divisions = 1) {
  return lineNumericLabel(`(${line.axis.min}) + (${index}) * (${line.axis.majorStep}) / (${divisions})`, linePrefersFractions(line));
}