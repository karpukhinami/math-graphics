import { callTextForJson } from "@/lib/ai/client";
import { buildSourceTextForPrompt } from "./source-files";
import {
  analysisSchemaHint,
  buildAnalyzePrompt,
  buildGeneratePrompt,
  buildGenerateRetrySuffix,
  generateSchemaHint,
} from "./prompts";
import type {
  PlotAiScenario,
  PlotAnalysisResult,
  PlotGenerateAnalogResult,
  PlotGenerateSceneResult,
  PlotSceneType,
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
}): Promise<PlotAnalysisResult> {
  const sourceText = buildSourceTextForPrompt(opts.manualText, opts.uploadedSourceText);
  const prompt = buildAnalyzePrompt({
    scenario: opts.scenario,
    sourceText,
  });
  const images = opts.attachedImages.length ? opts.attachedImages : undefined;

  return callTextForJson({
    model: opts.model,
    prompt,
    label: `plot-analyze-${opts.scenario}`,
    schemaHint: analysisSchemaHint(),
    images,
    parse: validatePlotAnalysisJson,
  });
}

export async function generatePlotScene(opts: {
  model: string;
  scenario: PlotAiScenario;
  manualText: string;
  uploadedSourceText: string;
  attachedImages: string[];
  analysis: PlotAnalysisResult;
  userRefinements: string;
}): Promise<PlotGenerateSceneResult | PlotGenerateAnalogResult> {
  const sceneType = opts.analysis.sceneType;
  if (!sceneType) {
    throw new Error("Анализ не содержит sceneType");
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
