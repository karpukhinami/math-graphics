/** Типы и контракты режима ИИ-рисования на странице Plotting. */

/** Что анализировать в сценарии «Нарисовать по заданию» — зарезервировано. */
export type PlotAiScenario = "draw" | "reproduce" | "analog";

export type PlotSceneType = "plane" | "line" | "space";

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

export interface PlotGenerateAnalogResult {
  newTaskText: string;
  scene: unknown;
}

export type PlotGenerateResult = PlotGenerateSceneResult | PlotGenerateAnalogResult;

export interface PlotSceneValidation {
  valid: boolean;
  errors: string[];
}
