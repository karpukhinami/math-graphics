import type { PlotAnalysisResult, PlotSceneType } from "./types";

function asString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`Поле «${field}» должно быть строкой`);
  return value;
}

function asObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Поле «${field}» должно быть объектом`);
  }
  return value as Record<string, unknown>;
}

function parseSceneType(value: unknown): PlotSceneType {
  if (value === "plane" || value === "line" || value === "space") return value;
  throw new Error('Поле sceneType должно быть "plane", "line" или "space"');
}

/** Модель может вернуть план списком строк — склеиваем в текст. */
function planToString(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .join("\n");
  }
  return typeof value === "string" ? value.trim() : "";
}

export interface ValidateAnalysisOptions {
  /** Сценарий «draw»: без явного вывода «что построить» ответ анализа не принимается. */
  requireDrawPlan?: boolean;
}

export function validatePlotAnalysisJson(
  value: unknown,
  options: ValidateAnalysisOptions = {},
): PlotAnalysisResult {
  const root = asObject(value, "корень");
  const canDraw = Boolean(root.canDraw);
  // `reasoning` — имя поля в сценарии «draw»; `analysisText` остаётся для остальных сценариев.
  const analysisText = asString(root.reasoning ?? root.analysisText ?? root.analysis ?? "", "reasoning");
  const drawPlan = planToString(root.drawPlan);

  if (!canDraw) {
    return {
      canDraw: false,
      analysisText: analysisText || "Построить изображение средствами инструмента нельзя.",
      drawPlan: drawPlan || undefined,
      stageData: {},
    };
  }

  const sceneType = parseSceneType(root.sceneType);
  const stageData = asObject(root.stageData ?? {}, "stageData");

  if (options.requireDrawPlan && drawPlan.length < 10) {
    throw new Error(
      'Поле drawPlan обязательно: сформулируй явный итог анализа — что именно нужно построить, со всеми данными',
    );
  }

  return {
    canDraw: true,
    sceneType,
    analysisText,
    drawPlan: drawPlan || undefined,
    stageData,
  };
}
