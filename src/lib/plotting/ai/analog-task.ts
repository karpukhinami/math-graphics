/**
 * «Аналог по скриншоту»:
 * этап 1 — распознавание и шаблон аналога (что сохраняется, что меняется, чертежи и видимость);
 * этап 2 — N конкретных вариантов с планами чертежей одним запросом (чтобы варианты различались);
 * этап 3 — чертежи каждого варианта одним запросом, разворачиваются кодом как в «task».
 */
import { callTextForJson } from "@/lib/ai/client";
import {
  buildAnalogTaskAnalyzePrompt,
  buildAnalogTaskGeneratePrompt,
  buildAnalogTaskVariantsPrompt,
  buildRequestTaskAnalyzePrompt,
  buildDrawRetrySuffix,
  type TaskFigureSceneType,
} from "./prompts";
import { validateDrawDraft } from "./pipeline";
import { validateAiChartJson } from "@/lib/plotting/chart";

export type FigurePlacement = "text" | "option";
export interface AnalogFigurePlan { id: string; placement: FigurePlacement; drawPlan: string }
export interface AnalogOption { text: string; correct: boolean; figure: string | null }
/** Один конкретный вариант (результат этапа 2). */
export interface AnalogTaskAnalysis {
  reasoning: string;
  originalText: string;
  canDraw: boolean;
  sceneType: TaskFigureSceneType | null;
  task: { type: "input" | "choice"; text: string; answer: string; options: AnalogOption[] };
  figures: AnalogFigurePlan[];
}
export interface AnalogFigureSlot { id: string; placement: FigurePlacement; optionIndex: number | null; role: string }
/** Шаблон аналога (результат этапа 1). */
export interface AnalogTemplate {
  reasoning: string;
  originalText: string;
  canDraw: boolean;
  sceneType: TaskFigureSceneType | null;
  template: {
    type: "input" | "choice";
    optionCount: number;
    pattern: string;
    mustPreserve: string[];
    mayChange: string[];
    answerRule: string;
    visibility: string;
  };
  figures: AnalogFigureSlot[];
}

export const MAX_ANALOG_COUNT = 5;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : str(v) ? [str(v)] : []);
const planText = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").join("\n") : str(v)).trim();

export function parseAnalogTemplate(value: unknown): AnalogTemplate {
  if (!value || typeof value !== "object") throw new Error("Ответ анализа должен быть объектом");
  const root = value as Record<string, unknown>;
  const t = (root.template ?? {}) as Record<string, unknown>;
  const type = t.type === "choice" ? "choice" : "input";
  const pattern = str(t.pattern).trim();
  if (!pattern) throw new Error("Поле template.pattern обязательно: обобщённый текст задания");
  const optionCount = type === "choice" ? Math.round(Number(t.optionCount)) : 0;
  if (type === "choice" && !(optionCount >= 2)) throw new Error("Для задания с выбором template.optionCount должен быть не меньше 2");
  const rawFigures = Array.isArray(root.figures) ? root.figures : [];
  const figures: AnalogFigureSlot[] = rawFigures.map((f, i) => {
    const r = (f ?? {}) as Record<string, unknown>;
    const placement: FigurePlacement = r.placement === "option" && type === "choice" ? "option" : "text";
    const idx = Number(r.optionIndex);
    return {
      id: str(r.id).trim() || `fig${i + 1}`,
      placement,
      optionIndex: placement === "option" && Number.isInteger(idx) ? idx : null,
      role: str(r.role).trim(),
    };
  });
  if (new Set(figures.map((f) => f.id)).size !== figures.length) throw new Error("id чертежей в figures должны быть разными");
  const errors: string[] = [];
  const usedIdx = new Set<number>();
  for (const f of figures) {
    if (f.placement !== "option") continue;
    if (f.optionIndex === null || f.optionIndex < 0 || f.optionIndex >= optionCount) errors.push(`Чертёж ${f.id}: optionIndex должен быть от 0 до ${optionCount - 1}`);
    else if (usedIdx.has(f.optionIndex)) errors.push(`Два чертежа в варианте №${f.optionIndex + 1}`);
    else usedIdx.add(f.optionIndex);
  }
  if (errors.length) throw new Error(errors.join("; "));
  const sceneType = root.sceneType === "line" ? "line" : root.sceneType === "plane" ? "plane" : root.sceneType === "chart" ? "chart" : null;
  return {
    reasoning: str(root.reasoning),
    originalText: str(root.originalText),
    canDraw: root.canDraw !== false && figures.length > 0 && sceneType !== null,
    sceneType,
    template: {
      type, optionCount, pattern,
      mustPreserve: strList(t.mustPreserve), mayChange: strList(t.mayChange),
      answerRule: str(t.answerRule), visibility: str(t.visibility),
    },
    figures,
  };
}

/** Разбор и проверка согласованности одного варианта (метки, варианты, id). */
export function parseAnalogTaskAnalysis(value: unknown): AnalogTaskAnalysis {
  if (!value || typeof value !== "object") throw new Error("Вариант должен быть объектом");
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
  if (type === "choice" && !options.some((o) => o.correct)) throw new Error("Не отмечен правильный вариант ответа");
  const sceneType = root.sceneType === "line" ? "line" : root.sceneType === "plane" ? "plane" : root.sceneType === "chart" ? "chart" : null;
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

/** Привязывает вариант этапа 2 к слотам шаблона: тип, число вариантов, места чертежей задаёт шаблон. */
export function parseAnalogVariant(value: unknown, tpl: AnalogTemplate): AnalogTaskAnalysis {
  const r = (value ?? {}) as Record<string, unknown>;
  const t = (r.task ?? {}) as Record<string, unknown>;
  const plans = new Map<string, unknown>();
  (Array.isArray(r.figures) ? r.figures : []).forEach((f) => {
    const x = (f ?? {}) as Record<string, unknown>;
    plans.set(str(x.id).trim(), x.drawPlan);
  });
  let options = Array.isArray(t.options) ? t.options.map((o) => ({ ...((o ?? {}) as Record<string, unknown>) })) : [];
  if (tpl.template.type === "choice") {
    if (options.length !== tpl.template.optionCount) throw new Error(`Нужно ровно ${tpl.template.optionCount} вариантов ответа, получено ${options.length}`);
    // Места чертежей-вариантов фиксированы шаблоном.
    options = options.map((o, i) => ({ ...o, figure: tpl.figures.find((f) => f.placement === "option" && f.optionIndex === i)?.id ?? null }));
  }
  const missing = tpl.canDraw ? tpl.figures.filter((f) => planText(plans.get(f.id)).length < 10).map((f) => f.id) : [];
  if (missing.length) throw new Error(`Нет плана чертежей: ${missing.join(", ")}`);
  return parseAnalogTaskAnalysis({
    reasoning: r.reasoning,
    originalText: tpl.originalText,
    canDraw: tpl.canDraw,
    sceneType: tpl.sceneType,
    task: { type: tpl.template.type, text: t.text, answer: t.answer, options },
    figures: tpl.figures.map((f) => ({ id: f.id, placement: f.placement, drawPlan: plans.get(f.id) })),
  });
}

export async function analyzeAnalogTask(opts: { model: string; image: string; userRefinements: string }): Promise<AnalogTemplate> {
  return callTextForJson({
    model: opts.model,
    prompt: buildAnalogTaskAnalyzePrompt(opts.userRefinements),
    label: "analog-task-analyze",
    schemaHint: '{ reasoning, originalText, canDraw, sceneType: "plane"|"line"|"chart", template: { type, optionCount, pattern, mustPreserve, mayChange, answerRule, visibility }, figures: [{ id, placement, optionIndex, role }] }',
    images: [opts.image],
    parse: parseAnalogTemplate,
  });
}

/** «Задание по запросу», этап 1: тот же шаблон, но по тексту учителя, без картинки. */
export async function analyzeRequestTask(opts: { model: string; request: string }): Promise<AnalogTemplate> {
  return callTextForJson({
    model: opts.model,
    prompt: buildRequestTaskAnalyzePrompt(opts.request),
    label: "request-task-analyze",
    schemaHint: '{ reasoning, originalText, canDraw, sceneType: "plane"|"line"|"chart", template: { type, optionCount, pattern, mustPreserve, mayChange, answerRule, visibility }, figures: [{ id, placement, optionIndex, role }] }',
    parse: parseAnalogTemplate,
  });
}

/** Этап 2: count конкретных вариантов одним запросом. */
export async function generateAnalogVariants(opts: {
  model: string; image?: string; template: AnalogTemplate; count: number; userRefinements: string;
}): Promise<AnalogTaskAnalysis[]> {
  const { template: tpl } = opts;
  const count = Math.min(MAX_ANALOG_COUNT, Math.max(1, Math.round(opts.count)));
  return callTextForJson({
    model: opts.model,
    prompt: buildAnalogTaskVariantsPrompt({
      count, originalText: tpl.originalText, template: tpl.template, sceneType: tpl.sceneType,
      figures: tpl.canDraw ? tpl.figures : [], taskType: tpl.template.type, userRefinements: opts.userRefinements,
      source: opts.image ? "screenshot" : "request",
    }),
    label: "analog-task-variants",
    schemaHint: '{ variants: [ { reasoning, task: { type, text, answer, options: [{ text, correct, figure }] }, figures: [{ id, drawPlan }] } ] }',
    images: opts.image ? [opts.image] : undefined,
    parse: (v) => {
      // Корень может прийти массивом; лишние варианты отбрасываем.
      const raw = Array.isArray(v) ? v : (v as { variants?: unknown })?.variants;
      const list = (Array.isArray(raw) ? raw : []).slice(0, count);
      if (!list.length) throw new Error(`Нужно ровно ${count} вариантов задания, получено 0`);
      const parsed: AnalogTaskAnalysis[] = [];
      const errors: string[] = [];
      list.forEach((item, i) => {
        try { parsed.push(parseAnalogVariant(item, tpl)); }
        catch (e) { errors.push(`Вариант ${i + 1}: ${e instanceof Error ? e.message : e}`); }
      });
      // Хотя бы один корректный вариант — отдаём результат, а не ошибку целиком.
      if (!parsed.length) throw new Error(errors.join("; "));
      return parsed;
    },
  });
}

/** Этап 3: полные сцены одного варианта по id чертежа (для importAiScene). */
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
      byId.set(str(r.id) || analysis.figures[i]?.id || "", sceneType === "chart" ? r.chart ?? r.scene ?? r : r.scene ?? r);
    });
    const scenes: Record<string, unknown> = {};
    const errors: string[] = [];
    for (const f of analysis.figures) {
      const draft = byId.get(f.id);
      if (draft === undefined) { errors.push(`Нет чертежа ${f.id}`); continue; }
      if (sceneType === "chart") {
        try { scenes[f.id] = { charts: [validateAiChartJson(draft)] }; }
        catch (error) { errors.push(`${f.id}: ${error instanceof Error ? error.message : error}`); }
        continue;
      }
      const res = validateDrawDraft(draft, sceneType, true);
      if (res.valid) scenes[f.id] = res.scene;
      else errors.push(...res.errors.map((e) => `${f.id}: ${e}`));
    }
    return { scenes, errors };
  };
  const first = await attempt();
  if (!first.errors.length) return first.scenes;
  // Повтор: удавшиеся с первого раза чертежи сохраняем, недостающие берём из второй попытки.
  const second = await attempt(buildDrawRetrySuffix(first.errors)).catch(() => ({ scenes: {}, errors: first.errors }));
  const scenes = { ...second.scenes, ...first.scenes };
  if (!Object.keys(scenes).length) throw new Error(`Не удалось построить чертежи:\n${second.errors.join("\n")}`);
  return scenes;
}
