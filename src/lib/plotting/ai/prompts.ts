/** Сборка промптов режима ИИ-рисования из отдельных файлов. */
import sharedSourceRules from "@/lib/plotting/ai/templates/shared-source-rules.txt?raw";
import analysisPrecisionRules from "@/lib/plotting/ai/templates/analysis-precision-rules.txt?raw";
import analysisStructureRules from "@/lib/plotting/ai/templates/analysis-structure-rules.txt?raw";
import mathNotationRules from "@/lib/plotting/ai/templates/math-notation-rules.txt?raw";
import lineFractionRules from "@/lib/plotting/ai/templates/line-fraction-rules.txt?raw";
import analyzeDraw from "@/lib/plotting/ai/templates/analyze-draw.txt?raw";
import analyzeReproduce from "@/lib/plotting/ai/templates/analyze-reproduce.txt?raw";
import analyzeAnalog from "@/lib/plotting/ai/templates/analyze-analog.txt?raw";
import generateScene from "@/lib/plotting/ai/templates/generate-scene.txt?raw";
import generateDrawPlane from "@/lib/plotting/ai/templates/generate-draw-plane.txt?raw";
import generateDrawLine from "@/lib/plotting/ai/templates/generate-draw-line.txt?raw";
import taskAnalyze from "@/lib/plotting/ai/templates/task-analyze.txt?raw";
import taskGeneratePlane from "@/lib/plotting/ai/templates/task-generate-plane.txt?raw";
import taskGenerateLine from "@/lib/plotting/ai/templates/task-generate-line.txt?raw";
import generateAnalog from "@/lib/plotting/ai/templates/generate-analog.txt?raw";
import schemaPlaneRaw from "@/lib/plotting/ai/templates/schema-plane.txt?raw";
import schemaLineRaw from "@/lib/plotting/ai/templates/schema-line.txt?raw";
import schemaSpaceAiRaw from "@/lib/plotting/ai/templates/schema-space-ai.txt?raw";
import spaceFiguresGuide from "@/lib/plotting/ai/templates/space-figures-guide.txt?raw";
import spaceConstructionsGuide from "@/lib/plotting/ai/templates/space-constructions-guide.txt?raw";
import lineSetsRules from "@/lib/plotting/ai/templates/line-sets-rules.txt?raw";
import colorGroupsRules from "@/lib/plotting/ai/templates/color-groups.txt?raw";
import techDraftPlaneRaw from "@/lib/plotting/ai/templates/tech-draft-plane.txt?raw";
import techDraftLineRaw from "@/lib/plotting/ai/templates/tech-draft-line.txt?raw";
import techPlanRules from "@/lib/plotting/ai/templates/tech-plan-rules.txt?raw";
import jsonOutputRules from "@/lib/plotting/ai/templates/json-output-rules.txt?raw";
import analogTaskAnalyze from "@/lib/plotting/ai/templates/analog-task-analyze.txt?raw";
import analogTaskVariants from "@/lib/plotting/ai/templates/analog-task-variants.txt?raw";
import requestTaskAnalyze from "@/lib/plotting/ai/templates/request-task-analyze.txt?raw";
import analogTaskGenerate from "@/lib/plotting/ai/templates/analog-task-generate.txt?raw";
import type { PlotAiScenario, PlotAnalysisResult, PlotSceneType } from "./types";

const schemaLine = schemaLineRaw
  .replaceAll("{{LINE_SETS_RULES}}", lineSetsRules)
  .replaceAll("{{COLOR_GROUPS_RULES}}", colorGroupsRules)
  .replaceAll("{{MATH_NOTATION_RULES}}", mathNotationRules) + "\n\n" + lineFractionRules;

const schemaPlane = schemaPlaneRaw
  .replaceAll("{{COLOR_GROUPS_RULES}}", colorGroupsRules)
  .replaceAll("{{MATH_NOTATION_RULES}}", mathNotationRules);

const schemaSpace = schemaSpaceAiRaw
  .replaceAll("{{SPACE_FIGURES_GUIDE}}", spaceFiguresGuide)
  .replaceAll("{{SPACE_CONSTRUCTIONS_GUIDE}}", spaceConstructionsGuide)
  .replaceAll("{{MATH_NOTATION_RULES}}", mathNotationRules);

/**
 * Общие технические блоки: схемы черновиков и правила плана. Сценарные шаблоны только
 * подставляют их, поэтому изменение блока применяется ко всем сценариям сразу.
 */
export const techDraftPlane = techDraftPlaneRaw
  .replaceAll("{{MATH_NOTATION_RULES}}", mathNotationRules)
  .replaceAll("{{JSON_OUTPUT_RULES}}", jsonOutputRules);
export const techDraftLine = techDraftLineRaw
  .replaceAll("{{MATH_NOTATION_RULES}}", mathNotationRules)
  .replaceAll("{{JSON_OUTPUT_RULES}}", jsonOutputRules);

function withTechBlocks(template: string): string {
  return template
    .replaceAll("{{TECH_PLAN_RULES}}", techPlanRules.replaceAll("{{ANALYSIS_STRUCTURE_RULES}}", analysisStructureRules))
    .replaceAll("{{TECH_DRAFT_PLANE}}", techDraftPlane)
    .replaceAll("{{TECH_DRAFT_LINE}}", techDraftLine);
}

function withAnalysisRules(prompt: string): string {
  const structured = prompt.includes(analysisStructureRules) ? prompt : prompt + "\n\n" + analysisStructureRules;
  return structured + "\n\n" + analysisPrecisionRules;
}

function injectShared(template: string, sourceText: string): string {
  const shared = sharedSourceRules.replaceAll("{{SOURCE_TEXT}}", sourceText || "(материал не передан)");
  return withTechBlocks(template).replaceAll("{{SHARED_SOURCE_RULES}}", shared) + "\n\n" + lineFractionRules;
}

export function buildAnalyzePrompt(opts: {
  scenario: PlotAiScenario;
  sourceText: string;
  userRefinements?: string;
}): string {
  const { scenario, sourceText } = opts;
  if (scenario === "task") {
    const refinements = opts.userRefinements?.trim() || "(нет)";
    const source = sourceText.trim() || "(текста задания нет)";
    return withAnalysisRules(withTechBlocks(taskAnalyze)
      .replaceAll("{{SOURCE_TEXT}}", () => source)
      .replaceAll("{{USER_REFINEMENTS}}", () => refinements) + "\n\n" + lineFractionRules);
  }
  let template: string;
  switch (scenario) {
    case "draw":
      template = analyzeDraw;
      break;
    case "reproduce":
      template = analyzeReproduce.replaceAll(
        "{{USER_REFINEMENTS}}",
        () => opts.userRefinements?.trim() || "(нет)",
      );
      break;
    case "analog":
      template = analyzeAnalog;
      break;
  }
  return withAnalysisRules(injectShared(template, sourceText));
}

export function buildGeneratePrompt(opts: {
  scenario: PlotAiScenario;
  sourceText: string;
  analysis: PlotAnalysisResult;
  userRefinements: string;
  sceneType: PlotSceneType;
}): string {
  const { scenario, sourceText, analysis, userRefinements, sceneType } = opts;
  const schema =
    sceneType === "line" ? schemaLine : sceneType === "space" ? schemaSpace : schemaPlane;
  const space = sceneType === "line" ? "line" : sceneType === "space" ? "space" : "plane";
  const analysisJson = JSON.stringify(analysis, null, 2);
  const refinements = userRefinements.trim() || "(нет — используй только анализ)";

  const template = scenario === "analog" ? generateAnalog : generateScene;
  return injectShared(template, sourceText)
    .replaceAll("{{ANALYSIS_JSON}}", analysisJson)
    .replaceAll("{{USER_REFINEMENTS}}", refinements)
    .replaceAll("{{SCENE_SCHEMA}}", schema)
    .replaceAll("{{SCENE_TYPE_SPACE}}", space);
}

/** Сценарий «draw»: ветки с урезанными схемами существуют только для прямой и плоскости. */
export type PlotDrawBranchType = Exclude<PlotSceneType, "space">;

export function isDrawBranchType(sceneType: PlotSceneType): sceneType is PlotDrawBranchType {
  return sceneType === "line" || sceneType === "plane";
}

/**
 * Промпт второго этапа «draw» для прямой или плоскости.
 * Получает только итог анализа (drawPlan) и пожелания пользователя — без рассуждений и без исходника.
 */
export function buildDrawScenePrompt(opts: {
  sceneType: PlotDrawBranchType;
  drawPlan: string;
  userRefinements: string;
  /** «task» — шаблоны редактора заданий (пожелания уже учтены в плане первого этапа). */
  variant?: "draw" | "task";
}): string {
  const template =
    opts.variant === "task"
      ? opts.sceneType === "line" ? taskGenerateLine : taskGeneratePlane
      : opts.sceneType === "line" ? generateDrawLine : generateDrawPlane;
  const refinements = opts.userRefinements.trim() || "(нет — используй только план построения)";
  const plan = opts.drawPlan.trim();
  // Функции-заменители: символы «$» в плане и пожеланиях (LaTeX) не должны читаться как шаблоны replace.
  return (withTechBlocks(template)
    .replaceAll("{{DRAW_PLAN}}", () => plan)
    .replaceAll("{{USER_REFINEMENTS}}", () => refinements)
    .replaceAll("{{MATH_NOTATION_RULES}}", mathNotationRules)) + (opts.sceneType === "line" ? "\n\n" + lineFractionRules : "");
}

export function buildDrawRetrySuffix(validationErrors: string[]): string {
  return `

ПРЕДЫДУЩИЙ ОТВЕТ СОДЕРЖАЛ ОШИБКИ.
Ошибки проверки:
${validationErrors.map((e) => `- ${e}`).join("\n")}

Верни исправленный JSON, строго по схеме из задания и в соответствии с планом построения. Только JSON, без пояснений.`;
}

export function drawSchemaHint(sceneType: PlotDrawBranchType): string {
  return sceneType === "line"
    ? '{ axis?: { min?, max?, name?, step? (только явно запрошенный шаг, строка "1/3") }, ticks?: "none"|"all", rows: [ { sets: [ { type: "interval"|"ray"|"set", … } ], points: [ { x, label?, open? } ] } ] }'
    : '{ axes: { xMin, xMax, yMin, yMax }, graphs: [ { id, type: "explicit"|"implicit"|"piecewise"|"points", … } ], points: [ { type: "coords"|"onGraph"|"intersection"|"graphPoint", … } ] }';
}

export function buildGenerateRetrySuffix(validationErrors: string[]): string {
  return `

ПРЕДЫДУЩИЙ ОТВЕТ СОДЕРЖАЛ НЕКОРРЕКТНЫЙ JSON-СЦЕНЫ.
Ошибки проверки:
${validationErrors.map((e) => `- ${e}`).join("\n")}

Верни исправленный JSON, полностью соответствующий схеме и пригодный для рендерера. Только JSON, без пояснений.`;
}

export function analysisSchemaHint(scenario: PlotAiScenario = "draw"): string {
  if (scenario === "draw" || scenario === "task") {
    return `JSON с полями: reasoning (string — подробный анализ по единой структуре), canDraw (boolean), sceneType ("plane"|"line"|"space" если canDraw), drawPlan (string — самодостаточный перечень построений по той же структуре, если canDraw), stageData (object, заполняется только для "space").`;
  }
  return `JSON с полями: canDraw (boolean), sceneType ("plane"|"line"|"space" если canDraw), analysisText (string), stageData (object).`;
}

export function generateSchemaHint(scenario: PlotAiScenario, sceneType?: PlotSceneType): string {
  const sceneHint =
    sceneType === "space"
      ? '{ "version": 1, "space": "space", "space3d": { shapeKind, baseVerticesInput, figureConstraints, view?, points?, lines?, planes? } }'
      : "PlotScene; цвета — colorGroup 1–6 в style";
  return scenario === "analog"
    ? `{ "newTaskText": string, "scene": ${sceneHint} }`
    : `{ "scene": ${sceneHint} }`;
}

/** «Аналог по скриншоту», этап 1: распознавание и шаблон аналога (без конкретных чисел). */
export function buildAnalogTaskAnalyzePrompt(userRefinements: string): string {
  const refinements = userRefinements.trim() || "(нет)";
  return withAnalysisRules(withTechBlocks(analogTaskAnalyze).replaceAll("{{USER_REFINEMENTS}}", () => refinements) +
    "\n\n" + lineFractionRules);
}

/** «Задание по запросу», этап 1: идея и шаблон по свободному описанию (дальше — как у аналога). */
export function buildRequestTaskAnalyzePrompt(request: string): string {
  return withAnalysisRules(withTechBlocks(requestTaskAnalyze).replaceAll("{{USER_REQUEST}}", () => request.trim() || "(пусто)") +
    "\n\n" + lineFractionRules);
}

/** «Аналог по скриншоту», этап 2: N конкретных вариантов с планами чертежей по шаблону. */
export function buildAnalogTaskVariantsPrompt(opts: {
  count: number;
  originalText: string;
  template: unknown;
  sceneType: PlotDrawBranchType | null;
  figures: Array<{ id: string; placement: string; optionIndex: number | null; role: string }>;
  taskType: "input" | "choice";
  userRefinements: string;
  /** "screenshot" — исходник во вложении; "request" — идея по текстовому запросу. */
  source?: "screenshot" | "request";
}): string {
  const fromShot = opts.source !== "request";
  const note = fromShot
    ? "Исходный скриншот — во вложении: сверяй с ним видимость элементов. Ниже «исходник» — это он."
    : "Скриншота нет: задание придумано по запросу учителя. Ниже «исходник» — это образец задания из шаблона, а видимость определяется только полем template.visibility.";
  const figs = opts.figures.length
    ? opts.figures.map((f) => `- ${f.id}: ${f.placement === "option" ? `в варианте ответа №${(f.optionIndex ?? 0) + 1}` : "в тексте"} — ${f.role}`).join("\n")
    : "(чертежей нет)";
  return withAnalysisRules(withTechBlocks(analogTaskVariants)
    .replaceAll("{{COUNT}}", String(opts.count))
    .replaceAll("{{TASK_TYPE}}", opts.taskType)
    .replaceAll("{{SCENE_TYPE}}", opts.sceneType ?? "—")
    .replaceAll("{{SOURCE_NOTE}}", note)
    .replaceAll("{{ORIGINAL_TITLE}}", fromShot ? "ИСХОДНОЕ ЗАДАНИЕ (распознано на первом этапе)" : "ОБРАЗЕЦ ЗАДАНИЯ (первый этап)")
    .replaceAll("{{ORIGINAL_TEXT}}", () => opts.originalText || "(нет)")
    .replaceAll("{{TEMPLATE}}", () => JSON.stringify(opts.template, null, 2))
    .replaceAll("{{FIGURES}}", () => figs)
    .replaceAll("{{USER_REFINEMENTS}}", () => opts.userRefinements.trim() || "(нет)") +
    (opts.sceneType === "line" ? "\n\n" + lineFractionRules : ""));
}

/** «Аналог по скриншоту», этап 3: все однотипные чертежи одного варианта одним запросом. */
export function buildAnalogTaskGeneratePrompt(
  sceneType: PlotDrawBranchType,
  figures: Array<{ id: string; drawPlan: string }>,
): string {
  const plans = figures.map((f) => `── ЧЕРТЁЖ ${f.id} ──\n${f.drawPlan.trim()}`).join("\n\n");
  return analogTaskGenerate
    .replaceAll("{{SCENE_TYPE_NAME}}", sceneType === "line" ? "числовая прямая" : "координатная плоскость")
    .replaceAll("{{TECH_DRAFT}}", sceneType === "line" ? techDraftLine : techDraftPlane)
    .replaceAll("{{FIGURE_PLANS}}", () => plans) + (sceneType === "line" ? "\n\n" + lineFractionRules : "");
}
