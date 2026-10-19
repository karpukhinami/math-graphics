import { callTextForJson } from "@/lib/ai/client";
import { buildSourceTextForPrompt } from "./source-files";
import {
  analysisSchemaHint,
  buildAnalyzePrompt,
  buildDrawRetrySuffix,
  buildDrawScenePrompt,
  buildGeneratePrompt,
  buildGenerateRetrySuffix,
  drawSchemaHint,
  generateSchemaHint,
  isDrawBranchType,
  type PlotDrawBranchType,
} from "./prompts";
import { expandLineDraft } from "./draft-line";
import { expandPlaneDraft } from "./draft-plane";
import { validateAiChartJson } from "@/lib/plotting/chart";
import {
  type PlotAiScenario,
  type PlotAnalysisResult,
  type PlotGenerateAnalogResult,
  type PlotGenerateChartResult,
  type PlotGenerateSceneResult,
  type PlotSceneType,
  isPlanScenario,
} from "./types";
import { validatePlotAnalysisJson } from "./validate-analysis";
import {
  extractAnalogFromGenerateResponse,
  extractSceneFromGenerateResponse,
  validatePlotSceneJson,
} from "./validate-scene";

export async function analyzePlotMaterial(opts: {
  model: string;
  scenario: PlotAiScenario;
  manualText: string;
  uploadedSourceText: string;
  attachedImages: string[];
  /** Только «task»: пожелания учитываются уже на этапе анализа. */
  userRefinements?: string;
}): Promise<PlotAnalysisResult> {
  const sourceText = buildSourceTextForPrompt(opts.manualText, opts.uploadedSourceText);
  const prompt = buildAnalyzePrompt({
    scenario: opts.scenario,
    sourceText,
    userRefinements: opts.userRefinements,
  });
  const images = opts.attachedImages.length ? opts.attachedImages : undefined;

  return callTextForJson({
    model: opts.model,
    prompt,
    label: `plot-analyze-${opts.scenario}`,
    schemaHint: analysisSchemaHint(opts.scenario),
    images,
    // «draw»: без явного вывода «что строить» (drawPlan) анализ не принимается.
    parse: (value) =>
      validatePlotAnalysisJson(value, { requireDrawPlan: isPlanScenario(opts.scenario) }),
  });
}

/**
 * Второй этап «draw» для прямой и плоскости: отдельный промпт и урезанная схема на каждую ветку.
 * Вход — только итог анализа (drawPlan); ответ модели дополняется кодом до полной сцены.
 */
async function generateDrawBranchScene(opts: {
  model: string;
  sceneType: PlotDrawBranchType;
  drawPlan: string;
  userRefinements: string;
  variant: "draw" | "task";
}): Promise<PlotGenerateSceneResult> {
  const basePrompt = buildDrawScenePrompt({
    sceneType: opts.sceneType,
    drawPlan: opts.drawPlan,
    userRefinements: opts.userRefinements,
    variant: opts.variant,
  });
  const schemaHint = drawSchemaHint(opts.sceneType);

  const attempt = async (extraSuffix = "") => {
    const draft = await callTextForJson({
      model: opts.model,
      prompt: basePrompt + extraSuffix,
      label: `plot-generate-draw-${opts.sceneType}`,
      schemaHint,
      parse: (v) => v,
    });
    return validateDrawDraft(draft, opts.sceneType, opts.variant === "task");
  };

  let result = await attempt();
  if (!result.valid) {
    result = await attempt(buildDrawRetrySuffix(result.errors));
  }
  if (!result.valid) {
    throw new Error(`Не удалось получить корректную сцену:\n${result.errors.join("\n")}`);
  }
  return { scene: result.scene };
}

/** Урезанный ответ модели → полная сцена → проверка тем же валидатором, что и раньше. */
export function validateDrawDraft(
  draft: unknown,
  sceneType: PlotDrawBranchType,
  minimalLabels = false,
): { valid: true; errors: []; scene: unknown } | { valid: false; errors: string[] } {
  try {
    const expanded = sceneType === "line"
        ? expandLineDraft(draft, { minimalLabels })
        : expandPlaneDraft(draft, { minimalLabels });
    // Ошибки содержимого черновика — сразу в повторный запрос, без построения.
    if (expanded.errors.length || expanded.scene == null) {
      return {
        valid: false,
        errors: expanded.errors.length ? expanded.errors : ["Ответ не содержит чертежа"],
      };
    }
    const { valid, errors } = validatePlotSceneJson({ scene: expanded.scene }, sceneType);
    if (!valid) return { valid: false, errors };
    return { valid: true, errors: [], scene: expanded.scene };
  } catch (e) {
    return {
      valid: false,
      errors: [e instanceof Error ? e.message : "Некорректный формат ответа"],
    };
  }
}

export async function generatePlotScene(opts: {
  model: string;
  scenario: PlotAiScenario;
  manualText: string;
  uploadedSourceText: string;
  attachedImages: string[];
  analysis: PlotAnalysisResult;
  userRefinements: string;
}): Promise<PlotGenerateSceneResult | PlotGenerateAnalogResult | PlotGenerateChartResult> {
  const sceneType = opts.analysis.sceneType;
  if (!sceneType) {
    throw new Error("Анализ не содержит sceneType");
  }

  // Диаграмма: второй этап без LLM — таблица и тип уже извлечены на анализе.
  if (sceneType === "chart") {
    const raw = (opts.analysis.stageData as Record<string, unknown>).chart;
    if (!raw) throw new Error("Анализ не содержит данных диаграммы");
    try {
      return { chart: validateAiChartJson(raw) };
    } catch (e) {
      throw new Error(`Не удалось прочитать данные диаграммы: ${e instanceof Error ? e.message : e}`);
    }
  }

  // Прямая и плоскость: своя ветка, на вход — только итог анализа. Пространство — прежний путь.
  if (isPlanScenario(opts.scenario) && isDrawBranchType(sceneType)) {
    return generateDrawBranchScene({
      model: opts.model,
      sceneType,
      drawPlan: opts.analysis.drawPlan?.trim() || opts.analysis.analysisText,
      // «task»: пожелания уже вошли в план; повторная передача провоцирует лишние подписи.
      userRefinements: opts.scenario === "task" ? "" : opts.userRefinements,
      variant: opts.scenario,
    });
  }

  const sourceText = buildSourceTextForPrompt(opts.manualText, opts.uploadedSourceText);
  const basePrompt = buildGeneratePrompt({
    scenario: opts.scenario,
    sourceText,
    analysis: opts.analysis,
    userRefinements: opts.userRefinements,
    sceneType,
  });
  const images = opts.attachedImages.length ? opts.attachedImages : undefined;
  const schemaHint = generateSchemaHint(opts.scenario, sceneType);

  async function runOnce(extraSuffix = ""): Promise<unknown> {
    return callTextForJson({
      model: opts.model,
      prompt: basePrompt + extraSuffix,
      label: `plot-generate-${opts.scenario}`,
      schemaHint,
      images,
      parse: (v) => v,
    });
  }

  let parsed = await runOnce();
  let validation = validateGenerated(parsed, opts.scenario, sceneType);

  if (!validation.valid) {
    parsed = await runOnce(buildGenerateRetrySuffix(validation.errors));
    validation = validateGenerated(parsed, opts.scenario, sceneType);
  }

  if (!validation.valid) {
    throw new Error(
      `Не удалось получить корректную сцену:\n${validation.errors.join("\n")}`,
    );
  }

  return validation.result!;
}

function validateGenerated(
  parsed: unknown,
  scenario: PlotAiScenario,
  sceneType: PlotSceneType,
): {
  valid: boolean;
  errors: string[];
  result?: PlotGenerateSceneResult | PlotGenerateAnalogResult;
} {
  try {
    if (scenario === "analog") {
      const { newTaskText, scene } = extractAnalogFromGenerateResponse(parsed);
      const { valid, errors } = validatePlotSceneJson({ scene }, sceneType);
      if (!valid) return { valid: false, errors };
      return { valid: true, errors: [], result: { newTaskText, scene } };
    }
    const scene = extractSceneFromGenerateResponse(parsed);
    const { valid, errors } = validatePlotSceneJson({ scene }, sceneType);
    if (!valid) return { valid: false, errors };
    return { valid: true, errors: [], result: { scene } };
  } catch (e) {
    return {
      valid: false,
      errors: [e instanceof Error ? e.message : "Некорректный формат ответа"],
    };
  }
}
