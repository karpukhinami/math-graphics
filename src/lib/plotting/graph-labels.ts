/** Содержимое подписи графика; размещение всегда вычисляется заново. */
import { equationLatex, expressionLatex, parseExpression } from "./math-expr";
import type { PlotScene, SceneGraph } from "./types";

const SUPER = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const SUB = "₀₁₂₃₄₅₆₇₈₉";

function mathText(raw: string, variables: string[]): string {
  return parseExpression(raw, variables).normalized
    .replace(/\blog\(([^,()]+),\s*(\d+)\)/g, (_match, argument: string, base: string) =>
      `log${Array.from(base, (digit) => SUB[Number(digit)]).join("")}(${argument.trim()})`)
    .replace(/\s*\^\s*(-?\d+)\b(?![\w.])/g, (_match, exponent: string) =>
      Array.from(exponent, (digit) => digit === "-" ? "⁻" : SUPER[Number(digit)]).join(""))
    .replace(/\bpi\b/g, "π")
    .replace(/\bsqrt\(/g, "√(")
    .replace(/\s*\*\s*/g, "·")
    .replace(/-/g, "−");
}

export function graphCaption(graph: SceneGraph, scene: Pick<PlotScene, "xAxis" | "yAxis">): string | null {
  const mode = graph.style.labelMode ?? "none";
  const x = scene.xAxis.name.trim() || "x";
  const y = scene.yAxis.name.trim() || "y";
  if (mode === "custom") return graph.style.customLabel?.trim() || null;
  if (mode === "name") {
    const name = graph.style.label.trim();
    return name ? `${y} = ${name}(${x})` : null;
  }
  if (mode !== "equation") return null;
  try {
    if (graph.math.kind === "explicit") return `${y} = ${mathText(graph.math.expression, [x])}`;
    if (graph.math.kind === "implicit") {
      const sides = graph.math.equation.split("=");
      if (sides.length !== 2) return null;
      return `${mathText(sides[0], [x, y])} = ${mathText(sides[1], [x, y])}`;
    }
  } catch {
    // Незавершённый ввод не должен ломать уже построенный чертёж.
  }
  return null;
}

/** Equations retain full LaTeX instead of Unicode approximations used in summaries. */
export function graphCaptionLatex(graph: SceneGraph, scene: Pick<PlotScene, "xAxis" | "yAxis">): string | null {
  if (graph.style.labelMode !== "equation") return null;
  const x = scene.xAxis.name.trim() || "x";
  const y = scene.yAxis.name.trim() || "y";
  try {
    if (graph.math.kind === "explicit") return `${y} = ${expressionLatex(graph.math.expression, [x])}`;
    if (graph.math.kind === "implicit") return equationLatex(graph.math.equation, [x, y]);
  } catch { /* Incomplete edits must not break a built graph. */ }
  return null;
}