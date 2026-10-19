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

const SCENE_ALIASES: Record<string, PlotSceneType> = {
  plane: "plane", "coordinate plane": "plane", coordinate_plane: "plane", "координатная плоскость": "plane", плоскость: "plane",
  line: "line", "number line": "line", number_line: "line", numberline: "line", "числовая прямая": "line", прямая: "line",
  space: "space", "3d": "space", пространство: "space",
  chart: "chart", diagram: "chart", диаграмма: "chart",
};

function parseSceneType(value: unknown, stageData?: Record<string, unknown>): PlotSceneType {
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (SCENE_ALIASES[key]) return SCENE_ALIASES[key];
  // Тип не указан, но данные диаграммы на месте — это диаграмма.
  if (!key && stageData?.chart) return "chart";
  throw new Error('Поле sceneType должно быть "plane", "line", "space" или "chart"');
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
  // Модель иногда оборачивает ответ: { "result": { … } } или [ { … } ].
  let source = Array.isArray(value) && value.length === 1 ? value[0] : value;
  if (source && typeof source === "object" && !Array.isArray(source)) {
    const keys = Object.keys(source);
    const inner = (source as Record<string, unknown>)[keys[0]];
    if (keys.length === 1 && inner && typeof inner === "object" && !Array.isArray(inner) && "canDraw" in inner) source = inner;
  }
  const root = asObject(source, "корень");
  const canDraw = root.canDraw === "false" ? false : Boolean(root.canDraw);
  // `reasoning` — имя поля в сценарии «draw»; `analysisText` остаётся для остальных сценариев.
  const reasoningRaw = root.reasoning ?? root.analysisText ?? root.analysis ?? "";
  const analysisText = asString(planToString(reasoningRaw) || (typeof reasoningRaw === "string" ? reasoningRaw : ""), "reasoning");
  const drawPlan = planToString(root.drawPlan);

  if (!canDraw) {
    return {
      canDraw: false,
      analysisText: analysisText || "Построить изображение средствами инструмента нельзя.",
      drawPlan: drawPlan || undefined,
      stageData: {},
    };
  }

  const stageDataRaw = root.stageData;
  const stageData: Record<string, unknown> =
    stageDataRaw && typeof stageDataRaw === "object" && !Array.isArray(stageDataRaw)
      ? { ...(stageDataRaw as Record<string, unknown>) }
      : {};
  // Данные диаграммы иногда кладут в корень, а не в stageData.chart.
  if (!stageData.chart && root.chart && typeof root.chart === "object") stageData.chart = root.chart;
  const sceneType = parseSceneType(root.sceneType, stageData);

  // Диаграмма: вместо плана построения анализ отдаёт таблицу данных в stageData.chart.
  if (options.requireDrawPlan && sceneType !== "chart" && drawPlan.length < 10) {
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
