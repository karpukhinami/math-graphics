/** Сборка промптов режима ИИ-рисования из отдельных файлов. */
import sharedSourceRules from "@/lib/plotting/ai/templates/shared-source-rules.txt?raw";
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
import type { PlotAiScenario, PlotAnalysisResult, PlotSceneType } from "./types";

const schemaLine = schemaLineRaw
  .replaceAll("{{LINE_SETS_RULES}}", lineSetsRules)
  .replaceAll("{{COLOR_GROUPS_RULES}}", colorGroupsRules);

const schemaPlane = schemaPlaneRaw.replaceAll("{{COLOR_GROUPS_RULES}}", colorGroupsRules);

const schemaSpace = schemaSpaceAiRaw
  .replaceAll("{{SPACE_FIGURES_GUIDE}}", spaceFiguresGuide)
  .replaceAll("{{SPACE_CONSTRUCTIONS_GUIDE}}", spaceConstructionsGuide);

function injectShared(template: string, sourceText: string): string {
  const shared = sharedSourceRules.replaceAll("{{SOURCE_TEXT}}", sourceText || "(материал не передан)");
  return template.replaceAll("{{SHARED_SOURCE_RULES}}", shared);
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
    return taskAnalyze
      .replaceAll("{{SOURCE_TEXT}}", () => source)
      .replaceAll("{{USER_REFINEMENTS}}", () => refinements);
  }
  let template: string;
  switch (scenario) {
    case "draw":
      template = analyzeDraw;
      break;
    case "reproduce":
      template = analyzeReproduce;
      break;
    case "analog":
      template = analyzeAnalog;
      break;
  }
  return injectShared(template, sourceText);
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
  return template
    .replaceAll("{{DRAW_PLAN}}", () => plan)
    .replaceAll("{{USER_REFINEMENTS}}", () => refinements);
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
    ? '{ axis?: { min?, max?, name? }, ticks?: "none"|"all", rows: [ { sets: [ { type: "interval"|"ray"|"set", … } ], points: [ { x, label?, open? } ] } ] }'
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
    return `JSON с полями: reasoning (string — рассуждения), canDraw (boolean), sceneType ("plane"|"line"|"space" если canDraw), drawPlan (string — явный вывод, что именно построить, если canDraw), stageData (object, заполняется только для "space").`;
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
