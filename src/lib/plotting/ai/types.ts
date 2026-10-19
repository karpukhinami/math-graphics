/** Типы и контракты режима ИИ-рисования на странице Plotting. */

/** Что анализировать в сценарии «Нарисовать по заданию» — зарезервировано. */
export type PlotAiScenario = "draw" | "reproduce" | "analog" | "task";

/** Сценарии «описание → черновик → сцена»: «draw» — главная страница, «task» — редактор заданий. */
export function isPlanScenario(s: PlotAiScenario): s is "draw" | "task" {
  return s === "draw" || s === "task";
}

export type PlotSceneType = "plane" | "line" | "space" | "chart";

export interface PlotAnalysisResult {
  canDraw: boolean;
  /** Тип сцены, определённый на первом этапе; от него зависит ветка второго этапа. */
  sceneType?: PlotSceneType;
  /**
   * Рассуждения модели (Markdown + LaTeX). Показываются пользователю и нужны для отладки;
   * в сценарии «draw» на второй этап не передаются.
   */
  analysisText: string;
  /**
   * Итог анализа: однозначная инструкция, что именно нужно построить (со всеми данными).
   * Сценарий «draw»: единственный вход второго этапа для прямой и плоскости.
   */
  drawPlan?: string;
  /** Структурированные данные (для space и сценариев reproduce/analog). */
  stageData: Record<string, unknown>;
}

export interface PlotGenerateSceneResult {
  scene: unknown;
}

/** Результат «Нарисовать» для диаграммы: второй этап без LLM, данные уже в анализе. */
export interface PlotGenerateChartResult {
  chart: import("@/lib/plotting/chart").StatDecoJson;
}

export function isChartResult(r: unknown): r is PlotGenerateChartResult {
  return !!r && typeof r === "object" && "chart" in r;
}

export interface PlotGenerateAnalogResult {
  newTaskText: string;
  scene: unknown;
}

export type PlotGenerateResult = PlotGenerateSceneResult | PlotGenerateAnalogResult;

export interface PlotSceneValidation {
  valid: boolean;
  errors: string[];
}
