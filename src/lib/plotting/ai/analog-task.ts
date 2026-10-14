/**
 * «Аналог по скриншоту»: этап 1 — распознавание и аналог с планами чертежей,
 * этап 2 — все однотипные чертежи одним запросом, каждый разворачивается кодом как в «task».
 */
import { callTextForJson } from "@/lib/ai/client";
import { buildAnalogTaskAnalyzePrompt, buildAnalogTaskGeneratePrompt, buildDrawRetrySuffix, type PlotDrawBranchType } from "./prompts";
import { validateDrawDraft } from "./pipeline";

export type FigurePlacement = "text" | "option";
export interface AnalogFigurePlan { id: string; placement: FigurePlacement; drawPlan: string }
export interface AnalogOption { text: string; correct: boolean; figure: string | null }
export interface AnalogTaskAnalysis {
  reasoning: string;
  originalText: string;
  canDraw: boolean;
  sceneType: PlotDrawBranchType | null;
  task: { type: "input" | "choice"; text: string; answer: string; options: AnalogOption[] };
  figures: AnalogFigurePlan[];
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const planText = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").join("\n") : str(v)).trim();

/** Разбор и проверка согласованности ответа первого этапа (метки, варианты, id). */
export function parseAnalogTaskAnalysis(value: unknown): AnalogTaskAnalysis {
  if (!value || typeof value !== "object") throw new Error("Ответ анализа должен быть объектом");
  const root = value as Record<string, unknown>;
  const t = (root.task ?? {}) as Record<string, unknown>;
  const type = t.type === "choice" ? "choice" : "input";
  const text = str(t.text).trim();
  if (!text) throw new Error("Поле task.text обязательно: текст нового задания");
  const rawFigures = Array.isArray(root.figures) ? root.figures : [];
  const figures: AnalogFigurePlan[] = rawFigures.map((f, i) => {
    const r = (f ?? {}) as Record<string, unknown>;
    return { id: str(r.id).trim() || `fig${i + 1}`, placement: r.placement === "option" ? "option" : "text", drawPlan: planText(r.drawPlan) };
  });
  const ids = new Set(figures.map((f) => f.id));
  if (ids.size !== figures.length) throw new Error("id чертежей в figures должны быть разными");
  const options: AnalogOption[] = type === "choice" && Array.isArray(t.options)
    ? t.options.map((o) => {
        const r = (o ?? {}) as Record<string, unknown>;
        const figure = str(r.figure).trim();
        return { text: str(r.text), correct: r.correct === true, figure: figure && ids.has(figure) ? figure : null };
      })
    : [];
  if (type === "choice" && options.length < 2) throw new Error("Для задания с выбором нужно не меньше двух вариантов");
  const sceneType = root.sceneType === "line" ? "line" : root.sceneType === "plane" ? "plane" : null;
  const canDraw = root.canDraw !== false && figures.length > 0 && sceneType !== null;
  if (canDraw) {
    const errors: string[] = [];
    for (const f of figures) {
      if (f.drawPlan.length < 10) errors.push(`Нет плана чертежа ${f.id}`);
      if (f.placement === "option" && !options.some((o) => o.figure === f.id)) errors.push(`Чертёж ${f.id} не указан ни в одном варианте`);
    }
    if (errors.length) throw new Error(errors.join("; "));
  }
  return { reasoning: str(root.reasoning ?? root.analysisText), originalText: str(root.originalText), canDraw, sceneType, task: { type, text, answer: str(t.answer), options }, figures };
}

export async function analyzeAnalogTask(opts: { model: string; image: string; userRefinements: string }): Promise<AnalogTaskAnalysis> {
  return callTextForJson({
    model: opts.model,
    prompt: buildAnalogTaskAnalyzePrompt(opts.userRefinements),
    label: "analog-task-analyze",
    schemaHint: '{ reasoning, originalText, canDraw, sceneType: "plane"|"line", task: { type: "input"|"choice", text, answer, options: [{ text, correct, figure }] }, figures: [{ id, placement: "text"|"option", drawPlan }] }',
    images: [opts.image],
    parse: parseAnalogTaskAnalysis,
  });
}

/** Этап 2: возвращает полные сцены по id чертежа (для importAiScene). */
export async function generateAnalogFigures(opts: { model: string; analysis: AnalogTaskAnalysis }): Promise<Record<string, unknown>> {
  const { analysis } = opts;
  if (!analysis.canDraw || !analysis.sceneType || !analysis.figures.length) return {};
  const sceneType = analysis.sceneType;
  const base = buildAnalogTaskGeneratePrompt(sceneType, analysis.figures);
  const attempt = async (suffix = "") => {
    const raw = await callTextForJson({
      model: opts.model,
      prompt: base + suffix,
      label: "analog-task-generate",
      schemaHint: '{ "figures": [ { "id": "fig1", "scene": { … } } ] }',
      parse: (v) => v,
    });
    const list = Array.isArray((raw as { figures?: unknown })?.figures) ? (raw as { figures: unknown[] }).figures : [];
    const byId = new Map<string, unknown>();
    list.forEach((item, i) => {
      const r = (item ?? {}) as Record<string, unknown>;
      byId.set(str(r.id) || analysis.figures[i]?.id || "", r.scene ?? r);
    });
    const scenes: Record<string, unknown> = {};
    const errors: string[] = [];
    for (const f of analysis.figures) {
      const draft = byId.get(f.id);
      if (draft === undefined) { errors.push(`Нет чертежа ${f.id}`); continue; }
      const res = validateDrawDraft(draft, sceneType, true);
      if (res.valid) scenes[f.id] = res.scene;
      else errors.push(...res.errors.map((e) => `${f.id}: ${e}`));
    }
    return { scenes, errors };
  };
  let result = await attempt();
  if (result.errors.length) result = await attempt(buildDrawRetrySuffix(result.errors));
  if (result.errors.length) throw new Error(`Не удалось построить чертежи:\n${result.errors.join("\n")}`);
  return result.scenes;
}
