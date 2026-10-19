/** Состояние страницы plotting. UI меняет только сцену; сцена — единый контракт. */
import { createEmptyChart, normalizeChart } from "@/lib/plotting/chart/editor";
import { create } from "zustand";
import {
  EMPTY_POINT_MATH,
  buildScene,
  createGraph,
  createPoint,
  createScene,
  createSpacePlotScene,
  migrateAxisImport,
  solvePointMath,
} from "./scene";
import { evaluateNumber } from "./math-expr";
import { pointSourceColor } from "./intersection-targets";
import { niceStep } from "./ticks";
import type {
  AxisScaleMode,
  AxisSpec,
  GraphMath,
  GraphStyle,
  GridSpec,
  PlotAppearance,
  PlotAspectRatio,
  PlotScene,
  PointMath,
  PointStyle,
  SceneGraph,
  ScenePoint,
} from "./types";
import {
  buildLineScene,
  buildSetMath,
  buildLinePoint,
  createLinePoint,
  createLineScene,
  createSet,
  removeSetFromLine,
  syncSetFromBoundaryPoint,
} from "./line/scene";
import { filterAiLinePoints, normalizeLineAxisRows } from "./line/import-ai";
import { mergeAiScene } from "./ai/merge-scene";
import { sceneFromJson } from "./scene-json";
import type {
  LineAxisSpec,
  LinePointStyle,
  LineSceneData,
  LineTickSettings,
  SceneLinePoint,
  SceneSet,
  SetMath,
  SetStyle,
} from "./line/types";
import {
  buildSpaceSceneData,
  createAuxiliaryLineForPoint,
  createDerivedPoints,
  createFigureFromInput,
  figureVertexInputString,
  resolvePointLabelInput,
  defaultParallelepipedConstraints,
  defaultPyramidConstraints,
  defaultPrismConstraints,
  createPlaneIntersectionEndpoints,
  createSpaceLine,
  createSpacePlane,
  createSpacePoint,
  derivedLineChoices,
  derivedPointChoices,
  nextFreePointLabel,
  reindexSpace,
} from "./space/scene";
import type {
  LinearVisualKind,
  LineRegion,
  SpaceFigureConstraints,
  PointOnLineDefinition,
  SpaceLine,
  SpaceLineDefinition,
  SpacePlane,
  SpacePlaneDefinition,
  SpacePoint,
  SpaceSceneData,
  SpaceShapeKind,
} from "./space/types";
import { clampRegionParam, defaultLineParam } from "./space/build";
import { refreshPyramidVertices } from "./space/pyramid";
import { refreshPrismVertices } from "./space/prism";
import { deserializeSpaceSceneData } from "./space/serialize";

export interface SpacePointDraft {
  mode: "onLine" | "onFace" | "linePlaneIntersection" | "fromConstruction";
  label: string;
  pointAId: string;
  pointBId: string;
  region: LineRegion;
  ratioMode: "auto" | "explicit";
  ratioA: number;
  ratioB: number;
  lineParam: number;
  faceId: string;
  placement: "arbitrary" | "center";
  lineId: string;
  planeId: string;
  derivedId: string;
}

export interface SpaceLineDraft {
  kind: "twoPoints" | "planeIntersection" | "fromConstruction";
  visualKind: LinearVisualKind;
  aId: string;
  bId: string;
  planeAId: string;
  planeBId: string;
  derivedId: string;
}

export interface SpacePlaneDraft {
  definition: SpacePlaneDefinition;
}

export type PlotInputMode = "manual" | "ai";
export type PlotSpaceTab = "line" | "plane" | "space" | "chart";

export interface BuildStatus {
  built: number;
  errors: string[];
  at: number;
}

interface PlotStore {
  scene: PlotScene;
  /** Invalidates previews and in-flight work from previous sessions. */
  sessionVersion: number;
  startSession: (mode?: PlotInputMode) => void;
  inputMode: PlotInputMode;
  spaceTab: PlotSpaceTab;
  status: BuildStatus | null;
  /** Черновик добавляемой точки: живёт вне сцены до нажатия «Отметить». */
  pointDraft: PointMath | null;
  pointDraftError: string | null;
  /** Черновик множества на прямой. */
  setDraft: SceneSet | null;
  setDraftError: string | null;
  /** Черновик самостоятельной точки на прямой. */
  linePointDraft: SceneLinePoint | null;
  linePointDraftError: string | null;
  spacePointDraft: SpacePointDraft | null;
  spacePointDraftError: string | null;
  spaceLineDraft: SpaceLineDraft | null;
  spaceLineDraftError: string | null;
  spacePlaneDraft: SpacePlaneDraft | null;
  spacePlaneDraftError: string | null;
  /** Текущий активный ряд оси для новых объектов. */
  activeAxisRow: number;
  setInputMode: (mode: PlotInputMode) => void;
  setSpaceTab: (tab: PlotSpaceTab) => void;
  updateLineAxis: (patch: Partial<LineAxisSpec>) => void;
  updateLineTicks: (patch: Partial<LineTickSettings>) => void;
  startSetDraft: (createNewAxis?: boolean) => void;
  updateSetDraft: (patch: Partial<SceneSet>) => void;
  updateSetDraftMath: (patch: Partial<SetMath>) => void;
  cancelSetDraft: () => void;
  commitSetDraft: () => void;
  updateSetMath: (id: string, patch: Partial<SetMath>) => void;
  updateSetStyle: (id: string, patch: Partial<SetStyle>) => void;
  buildSet: (id: string) => void;
  removeSet: (id: string) => void;
  startLinePointDraft: () => void;
  updateLinePointDraft: (patch: Partial<SceneLinePoint>) => void;
  updateLinePointDraftMath: (patch: Partial<SceneLinePoint["math"]>) => void;
  updateLinePointDraftStyle: (patch: Partial<LinePointStyle>) => void;
  cancelLinePointDraft: () => void;
  commitLinePointDraft: () => void;
  updateLinePointMath: (id: string, patch: Partial<SceneLinePoint["math"]>) => void;
  updateLinePointStyle: (id: string, patch: Partial<LinePointStyle>) => void;
  setAllLinePerpendiculars: (enabled: boolean) => void;
  buildLinePointItem: (id: string) => void;
  removeLinePoint: (id: string) => void;
  updateAxis: (axis: "xAxis" | "yAxis", patch: Partial<AxisSpec>) => void;
  updateAxisScale: (patch: {
    axisScaleMode?: AxisScaleMode;
    plotAspectRatio?: PlotAspectRatio;
  }) => void;
  updateGrid: (patch: Partial<GridSpec>) => void;
  updateAppearance: (patch: Partial<PlotAppearance>) => void;
  resetAppearance: () => void;
  addGraph: () => void;
  updateGraphMath: (id: string, patch: Partial<GraphMath>) => void;
  /** Удаляет опорную точку и сдвигает ссылки точек сцены на последующие опорные. */
  removeGraphAnchor: (id: string, index: number) => void;
  updateGraphStyle: (id: string, patch: Partial<GraphStyle>) => void;
  removeGraph: (id: string) => void;
  startPointDraft: () => void;
  updatePointDraft: (patch: Partial<PointMath>) => void;
  cancelPointDraft: () => void;
  commitPointDraft: () => void;
  /** Сразу создаёт пустую точку на плоскости; дальше она живёт как обычная карточка. */
  addPoint: () => void;
  updatePointMath: (id: string, patch: Partial<PointMath>) => void;
  updatePointStyle: (id: string, patch: Partial<PointStyle>) => void;
  togglePointSolution: (id: string, index: number, show: boolean) => void;
  updateSolutionStyle: (id: string, index: number, patch: Partial<PointStyle>) => void;
  removePoint: (id: string) => void;
  addCustomColor: (color: string) => void;
  buildGraph: (id: string) => void;
  buildPoint: (id: string) => void;
  buildAll: () => void;
  commitInputs: () => void;
  importScene: (raw: unknown) => void;
  importAiScene: (raw: unknown) => void;
  /** Диаграммы (режим chart, ручной и ИИ); живут вне PlotScene, рисуются друг под другом. */
  charts: import("@/lib/plotting/chart").StatDecoJson[];
  /** Принять диаграммы от ИИ: дополняются значениями по умолчанию для плашки. */
  setCharts: (charts: import("@/lib/plotting/chart").StatDecoJson[]) => void;
  addChart: () => void;
  updateChart: (index: number, chart: import("@/lib/plotting/chart").StatDecoJson) => void;
  removeChart: (index: number) => void;
  resetScene: () => void;
  setSpaceShapeKind: (kind: SpaceShapeKind) => void;
  setSpaceBaseInput: (input: string) => void;
  buildSpaceFigure: () => void;
  updateSpaceConstraints: (patch: Partial<SpaceFigureConstraints>) => void;
  updateSpaceView: (patch: Partial<SpaceSceneData["view"]>) => void;
  startSpacePointDraft: () => void;
  updateSpacePointDraft: (patch: Partial<SpacePointDraft>) => void;
  cancelSpacePointDraft: () => void;
  commitSpacePointDraft: () => void;
  buildSpacePoint: (id: string) => void;
  updateSpacePoint: (id: string, patch: Partial<SpacePoint>) => void;
  updateSpacePointStyle: (id: string, patch: Partial<SpacePoint["style"]>) => void;
  updateSpacePointOnLine: (id: string, patch: Partial<PointOnLineDefinition>) => void;
  removeSpacePoint: (id: string) => void;
  startSpaceLineDraft: () => void;
  updateSpaceLineDraft: (patch: Partial<SpaceLineDraft>) => void;
  cancelSpaceLineDraft: () => void;
  commitSpaceLineDraft: () => void;
  buildSpaceLine: (id: string) => void;
  updateSpaceLine: (id: string, patch: Partial<SpaceLine>) => void;
  updateSpaceLineStyle: (id: string, patch: Partial<SpaceLine["style"]>) => void;
  removeSpaceLine: (id: string) => void;
  startSpacePlaneDraft: () => void;
  updateSpacePlaneDraft: (patch: Partial<SpacePlaneDraft>) => void;
  cancelSpacePlaneDraft: () => void;
  commitSpacePlaneDraft: () => void;
  buildSpacePlane: (id: string) => void;
  updateSpacePlane: (id: string, patch: Partial<SpacePlane>) => void;
  updateSpacePlaneStyle: (id: string, patch: Partial<SpacePlane["style"]>) => void;
  removeSpacePlane: (id: string) => void;
}

function patchSpaceData(
  state: PlotStore,
  updater: (data: SpaceSceneData) => SpaceSceneData,
): Partial<PlotStore> {
  const data = state.scene.space3d;
  if (!data) return {};
  return { scene: { ...state.scene, space3d: updater(data) } };
}

function applySpaceBuild(scene: PlotScene): { scene: PlotScene; status: BuildStatus } {
  const data = scene.space3d;
  if (!data) {
    return {
      scene,
      status: { built: 0, errors: ["Пространственная сцена не инициализирована."], at: Date.now() },
    };
  }
  const report = buildSpaceSceneData(data);
  return {
    scene: { ...scene, space3d: report.data },
    status: { built: report.built, errors: report.errors, at: Date.now() },
  };
}

/** Rebuild committed inputs only; drafts stay outside the construction. */
function rebuildPlotScene(scene: PlotScene): { scene: PlotScene; status: BuildStatus } {
  if (scene.space === "space") return applySpaceBuild(scene);
  if (scene.space === "line" && scene.line) {
    const report = buildLineScene(scene.line);
    return {
      scene: { ...scene, line: report.line },
      status: { built: report.built, errors: report.errors, at: Date.now() },
    };
  }
  const report = buildScene(scene);
  return {
    scene: report.scene,
    status: { built: report.built, errors: report.errors, at: Date.now() },
  };
}

function withSpaceData(
  state: PlotStore,
  updater: (data: SpaceSceneData) => SpaceSceneData,
): Partial<PlotStore> {
  const data = state.scene.space3d;
  if (!data) return {};
  const next = updater(data);
  return applySpaceBuild({ ...state.scene, space3d: next });
}

function reindex<T extends { index: number }>(items: T[]): T[] {
  return items.map((item, position) => ({ ...item, index: position + 1 }));
}

function axisBounds(min: string, max: string): { min: number; max: number } | null {
  try {
    const lo = evaluateNumber(min);
    const hi = evaluateNumber(max);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || !(hi > lo)) return null;
    return { min: lo, max: hi };
  } catch {
    return null;
  }
}

function autoGridStepForAxis(axis: AxisSpec): string {
  const bounds = axisBounds(axis.min, axis.max);
  // Пустой шаг = «авто»: рисовальщик сам подбирает niceStep по пределам оси.
  return axisBounds(axis.min, axis.max) ? "" : axis.gridStep;
}

function commitImportedScene(
  set: (partial: Partial<PlotStore> | ((state: PlotStore) => Partial<PlotStore>)) => void,
  scene: PlotScene,
): void {
  if (scene.space === "space" && scene.space3d) {
    const report = buildSpaceSceneData(scene.space3d);
    set({
      scene: { ...scene, space3d: report.data },
      spaceTab: "space",
      status: { built: report.built, errors: report.errors, at: Date.now() },
      pointDraft: null,
      pointDraftError: null,
      setDraft: null,
      setDraftError: null,
      linePointDraft: null,
      linePointDraftError: null,
      spacePointDraft: null,
      spacePointDraftError: null,
      spaceLineDraft: null,
      spaceLineDraftError: null,
      spacePlaneDraft: null,
      spacePlaneDraftError: null,
    });
    return;
  }
  if (scene.space === "line" && scene.line) {
    const report = buildLineScene(scene.line);
    set({
      scene: { ...scene, line: report.line },
      spaceTab: "line",
      status: { built: report.built, errors: report.errors, at: Date.now() },
      pointDraft: null,
      pointDraftError: null,
      setDraft: null,
      setDraftError: null,
      linePointDraft: null,
      linePointDraftError: null,
    });
    return;
  }
  const report = buildScene(scene);
  // Заготовки решений (подписи/видимость по номеру) не должны рисоваться, если точка не построилась.
  const points = report.scene.points.map((point) =>
    point.error && point.built?.some((solution) => solution.displayX === "")
      ? { ...point, built: null }
      : point,
  );
  set({
    scene: { ...report.scene, points },
    status: { built: report.built, errors: report.errors, at: Date.now() },
    pointDraft: null,
    pointDraftError: null,
  });
}

function freshSession(spaceTab: PlotSpaceTab, sessionVersion: number): Partial<PlotStore> {
  return {
    sessionVersion, spaceTab,
    scene: spaceTab === "line" ? createLineScene() : spaceTab === "space" ? createSpacePlotScene() : createScene(),
    status: null, activeAxisRow: 0,
    pointDraft: null, pointDraftError: null,
    setDraft: null, setDraftError: null,
    linePointDraft: null, linePointDraftError: null,
    spacePointDraft: null, spacePointDraftError: null,
    spaceLineDraft: null, spaceLineDraftError: null,
    spacePlaneDraft: null, spacePlaneDraftError: null,
    charts: spaceTab === "chart" ? [createEmptyChart()] : [],
  };
}

export const usePlotStore = create<PlotStore>((set, get) => ({
  sessionVersion: 0,
  scene: createScene(),
  inputMode: "manual",
  spaceTab: "plane",
  status: null,
  pointDraft: null,
  pointDraftError: null,
  setDraft: null,
  setDraftError: null,
  linePointDraft: null,
  linePointDraftError: null,
  spacePointDraft: null,
  spacePointDraftError: null,
  spaceLineDraft: null,
  spaceLineDraftError: null,
  spacePlaneDraft: null,
  spacePlaneDraftError: null,
  activeAxisRow: 0,
  charts: [],
  setCharts: (charts) => set({ charts: charts.map(normalizeChart) }),
  addChart: () => set((state) => ({ charts: [...state.charts, createEmptyChart()] })),
  updateChart: (index, chart) =>
    set((state) => ({ charts: state.charts.map((c, i) => (i === index ? chart : c)) })),
  removeChart: (index) => set((state) => ({ charts: state.charts.filter((_, i) => i !== index) })),

  startPointDraft: () => set({ pointDraft: { ...EMPTY_POINT_MATH }, pointDraftError: null }),

  updatePointDraft: (patch) =>
    set((state) => ({
      pointDraft: state.pointDraft ? { ...state.pointDraft, ...patch } : state.pointDraft,
      pointDraftError: null,
    })),

  cancelPointDraft: () => set({ pointDraft: null, pointDraftError: null }),

  commitPointDraft: () => {
    const state = get();
    const draft = state.pointDraft;
    if (!draft) return;
    try {
      const solutions = solvePointMath(state.scene, draft);
      // Цвет по умолчанию: точка на графике (в т.ч. из опорных точек) берёт цвет
      // своего графика, точка на пересечении — цвет первого выбранного графика.
      const sourceColor = pointSourceColor(state.scene, draft);
      // Каждое найденное решение становится отдельной плашкой точки.
      const created = solutions.map(
        (solution, position) =>
          ({
            ...createPoint(
              state.scene.points.length + position + 1,
              {
                ...draft,
                ...(draft.mode === "intersection" ? { intersectionIndex: position } : {}),
              },
              {
                open: Boolean(solution.style?.open),
                ...(sourceColor ? { color: sourceColor } : {}),
              },
            ),
            built: [{ ...solution, show: true, style: undefined }],
            dirty: false,
            error: null,
          }) as ScenePoint,
      );

      set({
        scene: { ...state.scene, points: [...state.scene.points, ...created] },
        pointDraft: null,
        pointDraftError: null,
      });
    } catch (error) {
      set({ pointDraftError: (error as Error).message });
    }
  },

  startSession: (inputMode = "manual") =>
    set((state) => ({ ...freshSession("plane", state.sessionVersion + 1), inputMode })),

  setInputMode: (inputMode) =>
    set((state) => state.inputMode === inputMode ? state : {
      ...freshSession(state.spaceTab, state.sessionVersion + 1), inputMode,
    }),

  setSpaceTab: (spaceTab) =>
    set((state) => state.spaceTab === spaceTab ? state :
      freshSession(spaceTab, state.sessionVersion + 1)),

  updateLineAxis: (patch) =>
    set((state) => {
      if (!state.scene.line) return state;
      return rebuildPlotScene({
        ...state.scene,
        line: { ...state.scene.line, axis: { ...state.scene.line.axis, ...patch } },
      });
    }),

  updateLineTicks: (patch) =>
    set((state) => {
      if (!state.scene.line) return state;
      return {
        scene: {
          ...state.scene,
          line: { ...state.scene.line, ticks: { ...state.scene.line.ticks, ...patch } },
        },
      };
    }),

  startSetDraft: (createNewAxis = false) => {
    const state = get();
    const line = state.scene.line;
    if (!line) return;
    let axisRow = state.activeAxisRow;
    if (createNewAxis) {
      axisRow = line.axisRowCount;
    }
    const draft = createSet(line.sets.length + 1, axisRow);
    set({ setDraft: draft, setDraftError: null });
  },

  updateSetDraft: (patch) =>
    set((state) =>
      state.setDraft ? { setDraft: { ...state.setDraft, ...patch }, setDraftError: null } : state,
    ),

  updateSetDraftMath: (patch) =>
    set((state) =>
      state.setDraft
        ? {
            setDraft: {
              ...state.setDraft,
              math: { ...state.setDraft.math, ...patch },
              dirty: true,
              error: null,
            },
            setDraftError: null,
          }
        : state,
    ),

  cancelSetDraft: () => set({ setDraft: null, setDraftError: null }),

  commitSetDraft: () => {
    const state = get();
    const draft = state.setDraft;
    const line = state.scene.line;
    if (!draft || !line) return;
    const result = buildSetMath(line, { ...draft, dirty: true });
    if (result.set.error) {
      set({ setDraftError: result.set.error });
      return;
    }
    const sets = [...line.sets, result.set];
    const axisRowCount = Math.max(line.axisRowCount, result.line.axisRowCount);
    set({
      scene: {
        ...state.scene,
        line: { ...result.line, sets, axisRowCount },
      },
      setDraft: null,
      setDraftError: null,
      activeAxisRow: draft.axisRow,
    });
  },

  updateSetMath: (id, patch) =>
    set((state) => {
      if (!state.scene.line) return state;
      return rebuildPlotScene({
        ...state.scene,
        line: {
          ...state.scene.line,
          sets: state.scene.line.sets.map((set) =>
            set.id === id
              ? { ...set, math: { ...set.math, ...patch }, dirty: true, error: null }
              : set,
          ),
        },
      });
    }),

  updateSetStyle: (id, patch) =>
    set((state) => {
      if (!state.scene.line) return state;
      const line = state.scene.line;
      const sets = line.sets.map((set) => {
        if (set.id !== id) return set;
        const next = { ...set, style: { ...set.style, ...patch } };
        return next;
      });
      let points = line.points;
      if (patch.color) {
        points = points.map((point) =>
          point.math.sourceSetId === id && !point.style.colorManual
            ? { ...point, style: { ...point.style, color: patch.color! } }
            : point,
        );
      }
      return { scene: { ...state.scene, line: { ...line, sets, points } } };
    }),

  buildSet: (id) => {
    const state = get();
    const line = state.scene.line;
    if (!line) return;
    const targetSet = line.sets.find((item) => item.id === id);
    if (!targetSet) return;
    const result = buildSetMath(line, { ...targetSet, dirty: true });
    const sets = line.sets.map((item) => (item.id === id ? result.set : item));
    set({
      scene: {
        ...state.scene,
        line: { ...result.line, sets },
      },
      status: result.set.error
        ? {
            built: 0,
            errors: [`Множество ${targetSet.index}: ${result.set.error}`],
            at: Date.now(),
          }
        : { built: 1, errors: [], at: Date.now() },
    });
  },

  removeSet: (id) =>
    set((state) => {
      if (!state.scene.line) return state;
      return {
        scene: {
          ...state.scene,
          line: removeSetFromLine(state.scene.line, id),
        },
      };
    }),

  startLinePointDraft: () => {
    const state = get();
    const line = state.scene.line;
    if (!line) return;
    const draft = createLinePoint(line.points.length + 1, state.activeAxisRow);
    set({ linePointDraft: draft, linePointDraftError: null });
  },

  updateLinePointDraft: (patch) =>
    set((state) =>
      state.linePointDraft
        ? { linePointDraft: { ...state.linePointDraft, ...patch }, linePointDraftError: null }
        : state,
    ),

  updateLinePointDraftMath: (patch) =>
    set((state) =>
      state.linePointDraft
        ? {
            linePointDraft: {
              ...state.linePointDraft,
              math: { ...state.linePointDraft.math, ...patch },
              dirty: true,
            },
            linePointDraftError: null,
          }
        : state,
    ),

  updateLinePointDraftStyle: (patch) =>
    set((state) =>
      state.linePointDraft
        ? {
            linePointDraft: {
              ...state.linePointDraft,
              style: { ...state.linePointDraft.style, ...patch },
            },
          }
        : state,
    ),

  cancelLinePointDraft: () => set({ linePointDraft: null, linePointDraftError: null }),

  commitLinePointDraft: () => {
    const state = get();
    const draft = state.linePointDraft;
    const line = state.scene.line;
    if (!draft || !line) return;
    const result = buildLinePoint(line, { ...draft, dirty: true });
    if (result.point.error) {
      set({ linePointDraftError: result.point.error });
      return;
    }
    set({
      scene: {
        ...state.scene,
        line: { ...line, points: [...line.points, result.point] },
      },
      linePointDraft: null,
      linePointDraftError: null,
    });
  },

  updateLinePointMath: (id, patch) =>
    set((state) => {
      if (!state.scene.line) return state;
      return rebuildPlotScene({
        ...state.scene,
        line: {
          ...state.scene.line,
          points: state.scene.line.points.map((point) =>
            point.id === id && !point.locked
              ? { ...point, math: { ...point.math, ...patch }, dirty: true, error: null }
              : point,
          ),
        },
      });
    }),

  updateLinePointStyle: (id, patch) =>
    set((state) => {
      if (!state.scene.line) return state;
      let line = state.scene.line;
      let points = line.points.map((point) => {
        if (point.id !== id) return point;
        const style = {
          ...point.style,
          ...patch,
          colorManual: patch.color !== undefined ? true : point.style.colorManual,
        };
        return { ...point, style };
      });
      const point = points.find((p) => p.id === id);
      if (point && patch.open !== undefined && point.locked) {
        line = syncSetFromBoundaryPoint({ ...line, points }, point, patch.open);
        points = line.points.map((p) =>
          p.id === id ? { ...p, style: { ...p.style, open: patch.open! } } : p,
        );
      }
      return { scene: { ...state.scene, line: { ...line, points } } };
    }),

  setAllLinePerpendiculars: (enabled) =>
    set((state) => {
      const line = state.scene.line;
      if (!line?.points.length) return state;
      return {
        scene: {
          ...state.scene,
          line: {
            ...line,
            points: line.points.map((point) => ({
              ...point,
              style: { ...point.style, perpendicular: enabled },
            })),
          },
        },
      };
    }),

  buildLinePointItem: (id) => {
    const state = get();
    const line = state.scene.line;
    if (!line) return;
    const point = line.points.find((item) => item.id === id);
    if (!point) return;
    const result = buildLinePoint(line, { ...point, dirty: true });
    const points = line.points.map((item) => (item.id === id ? result.point : item));
    set({
      scene: { ...state.scene, line: { ...line, points } },
      status: result.point.error
        ? { built: 0, errors: [`Точка ${point.index}: ${result.point.error}`], at: Date.now() }
        : { built: 1, errors: [], at: Date.now() },
    });
  },

  removeLinePoint: (id) =>
    set((state) => {
      if (!state.scene.line) return state;
      const point = state.scene.line.points.find((p) => p.id === id);
      if (point?.locked) return state;
      return {
        scene: {
          ...state.scene,
          line: {
            ...state.scene.line,
            points: reindex(state.scene.line.points.filter((p) => p.id !== id)) as SceneLinePoint[],
          },
        },
      };
    }),

  updateAxis: (axis, patch) =>
    set((state) => {
      let nextAxis: AxisSpec = { ...state.scene[axis], ...patch };

      if (
        state.scene.axisScaleMode === "independent" &&
        (patch.min !== undefined || patch.max !== undefined)
      ) {
        nextAxis = { ...nextAxis, gridStep: autoGridStepForAxis(nextAxis) };
      }

      const scene = { ...state.scene, [axis]: nextAxis } as PlotScene;
      if (patch.name !== undefined) {
        scene.graphs = scene.graphs.map((graph) => ({ ...graph, dirty: true }));
      }
      return rebuildPlotScene(scene);
    }),

  updateAxisScale: (patch) =>
    set((state) => {
      const nextMode = patch.axisScaleMode ?? state.scene.axisScaleMode;
      let scene: PlotScene = {
        ...state.scene,
        axisScaleMode: nextMode,
        plotAspectRatio: patch.plotAspectRatio ?? state.scene.plotAspectRatio,
      };

      if (patch.axisScaleMode === "independent") {
        scene = {
          ...scene,
          xAxis: { ...scene.xAxis, gridStep: autoGridStepForAxis(scene.xAxis) },
          yAxis: { ...scene.yAxis, gridStep: autoGridStepForAxis(scene.yAxis) },
        };
      }

      return rebuildPlotScene(scene);
    }),

  updateGrid: (patch) =>
    set((state) => ({ scene: { ...state.scene, grid: { ...state.scene.grid, ...patch } } })),

  updateAppearance: (patch) =>
    set((state) => ({
      scene: { ...state.scene, appearance: { ...state.scene.appearance, ...patch } },
    })),

  resetAppearance: () =>
    set((state) => ({
      scene: {
        ...state.scene,
        appearance: {
          ...(state.scene.space === "line"
            ? createLineScene().appearance
            : createScene().appearance),
        },
      },
    })),

  addGraph: () =>
    set((state) => ({
      scene: {
        ...state.scene,
        graphs: [...state.scene.graphs, createGraph(state.scene.graphs.length + 1)],
      },
    })),

  updateGraphMath: (id, patch) =>
    set((state) =>
      rebuildPlotScene({
        ...state.scene,
        graphs: state.scene.graphs.map((graph) =>
          graph.id === id
            ? { ...graph, math: { ...graph.math, ...patch }, dirty: true, error: null }
            : graph,
        ),
      }),
    ),

  removeGraphAnchor: (id, index) =>
    set((state) =>
      rebuildPlotScene({
        ...state.scene,
        graphs: state.scene.graphs.map((graph) =>
          graph.id === id
            ? {
                ...graph,
                math: {
                  ...graph.math,
                  anchors: graph.math.anchors.filter((_item, position) => position !== index),
                },
                dirty: true,
                error: null,
              }
            : graph,
        ),
        points: state.scene.points.map((point) => {
          const ref = point.math.anchorIndex;
          if (point.math.graphId !== id || ref === null || ref < index) return point;
          const anchorIndex = ref === index ? null : ref - 1;
          return { ...point, math: { ...point.math, anchorIndex }, dirty: true };
        }),
      }),
    ),

  updateGraphStyle: (id, patch) =>
    set((state) => ({
      scene: {
        ...state.scene,
        graphs: state.scene.graphs.map((graph) =>
          graph.id === id ? { ...graph, style: { ...graph.style, ...patch } } : graph,
        ),
      },
    })),

  removeGraph: (id) =>
    set((state) =>
      rebuildPlotScene({
        ...state.scene,
        graphs: reindex(state.scene.graphs.filter((graph) => graph.id !== id)) as SceneGraph[],
        points: state.scene.points.map((point) =>
          point.math.graphId === id || point.math.graphIdB === id
            ? {
                ...point,
                math: {
                  ...point.math,
                  graphId: point.math.graphId === id ? null : point.math.graphId,
                  graphIdB: point.math.graphIdB === id ? null : point.math.graphIdB,
                },
                dirty: true,
              }
            : point,
        ),
      }),
    ),

  updatePointMath: (id, patch) =>
    set((state) =>
      rebuildPlotScene({
        ...state.scene,
        points: state.scene.points.map((point) =>
          point.id === id
            ? { ...point, math: { ...point.math, ...patch }, dirty: true, error: null }
            : point,
        ),
      }),
    ),

  updatePointStyle: (id, patch) =>
    set((state) => ({
      scene: {
        ...state.scene,
        points: state.scene.points.map((point) =>
          point.id === id ? { ...point, style: { ...point.style, ...patch } } : point,
        ),
      },
    })),

  togglePointSolution: (id, index, show) =>
    set((state) => ({
      scene: {
        ...state.scene,
        points: state.scene.points.map((point) =>
          point.id === id && point.built
            ? {
                ...point,
                built: point.built.map((solution, position) =>
                  position === index ? { ...solution, show } : solution,
                ),
              }
            : point,
        ),
      },
    })),

  updateSolutionStyle: (id, index, patch) =>
    set((state) => ({
      scene: {
        ...state.scene,
        points: state.scene.points.map((point) =>
          point.id === id && point.built
            ? {
                ...point,
                built: point.built.map((solution, position) =>
                  position === index
                    ? { ...solution, style: { ...(solution.style ?? {}), ...patch } }
                    : solution,
                ),
              }
            : point,
        ),
      },
    })),

  removePoint: (id) =>
    set((state) => ({
      scene: {
        ...state.scene,
        points: reindex(state.scene.points.filter((point) => point.id !== id)) as ScenePoint[],
      },
    })),

  addCustomColor: (color) =>
    set((state) =>
      state.scene.customColors.includes(color)
        ? state
        : { scene: { ...state.scene, customColors: [...state.scene.customColors, color] } },
    ),

  buildGraph: (id) => {
    const report = buildScene(get().scene, { graphId: id });
    set({
      scene: report.scene,
      status: { built: report.built, errors: report.errors, at: Date.now() },
    });
  },

  buildPoint: (id) => {
    const report = buildScene(get().scene, { pointId: id });
    set({
      scene: report.scene,
      status: { built: report.built, errors: report.errors, at: Date.now() },
    });
  },

  commitInputs: () => {
    const state = get();
    if (state.scene.space3d?.figureDirty) state.buildSpaceFigure();
  },

  buildAll: () => {
    const scene = get().scene;
    if (scene.space === "line" && scene.line) {
      const report = buildLineScene(scene.line);
      set({
        scene: { ...scene, line: report.line },
        status: { built: report.built, errors: report.errors, at: Date.now() },
      });
      return;
    }
    if (scene.space === "space" && scene.space3d) {
      const result = applySpaceBuild(scene);
      set({ scene: result.scene, status: result.status });
      return;
    }
    const report = buildScene(scene);
    set({
      scene: report.scene,
      status: { built: report.built, errors: report.errors, at: Date.now() },
    });
  },

  importScene: (raw) => {
    commitImportedScene(set, sceneFromJson(raw));
  },

  importAiScene: (raw) => {
    set({ charts: [] });
    commitImportedScene(set, mergeAiScene(raw));
  },

  resetScene: () =>
    set((state) => freshSession(state.spaceTab, state.sessionVersion + 1)),

  setSpaceShapeKind: (kind) =>
    set((state) =>
      patchSpaceData(state, (data) => ({
        ...data,
        shapeKind: kind,
        figure: null,
        figureDirty: false,
        baseVerticesInput: "",
        figureConstraints:
          kind === "pyramid"
            ? defaultPyramidConstraints()
            : kind === "prism"
              ? defaultPrismConstraints()
              : kind === "parallelepiped"
                ? defaultParallelepipedConstraints()
                : data.figureConstraints,
      })),
    ),

  setSpaceBaseInput: (input) =>
    set((state) =>
      patchSpaceData(state, (data) => ({
        ...data,
        baseVerticesInput: input,
        figureDirty: data.figure ? true : data.figureDirty,
      })),
    ),

  buildSpaceFigure: () => {
    const state = get();
    const data = state.scene.space3d;
    if (!data?.shapeKind) return;
    const { figure, error } = createFigureFromInput(
      data.shapeKind,
      data.baseVerticesInput,
      data.figureConstraints,
    );
    if (!figure) {
      set({ status: { built: 0, errors: [error ?? "Ошибка создания фигуры."], at: Date.now() } });
      return;
    }
    const result = applySpaceBuild({
      ...state.scene,
      space3d: {
        ...data,
        figure,
        baseVerticesInput: figureVertexInputString(figure),
        figureDirty: false,
      },
    });
    set({ scene: result.scene, status: result.status });
  },

  updateSpaceConstraints: (patch) => {
    const state = get();
    const data = state.scene.space3d;
    if (!data) return;
    const figureConstraints: SpaceFigureConstraints = {
      ...data.figureConstraints,
      ...patch,
    };
    if (!data.figure) {
      set((s) => patchSpaceData(s, (d) => ({ ...d, figureConstraints })));
      return;
    }

    let figure = { ...data.figure, constraints: { ...figureConstraints } } as typeof data.figure;
    if (figure.kind === "pyramid") {
      figure = refreshPyramidVertices(figure);
    } else if (figure.kind === "prism") {
      figure = refreshPrismVertices(figure);
    }
    const result = applySpaceBuild({
      ...state.scene,
      space3d: {
        ...data,
        figureConstraints,
        figure,
        baseVerticesInput: figureVertexInputString(figure),
        figureDirty: false,
      },
    });
    set({ scene: result.scene, status: result.status });
  },

  updateSpaceView: (patch) =>
    set((state) =>
      patchSpaceData(state, (data) => ({
        ...data,
        view: { ...data.view, ...patch },
      })),
    ),

  startSpacePointDraft: () => {
    const data = get().scene.space3d;
    if (!data?.figure) return;
    const verts = data.figure.vertices;
    const firstLineId = data.figure.edges[0]?.id ?? data.lines.find((line) => line.built)?.id ?? "";
    const firstPlaneId =
      data.figure.faces[0]?.id ?? data.planes.find((plane) => plane.built)?.id ?? "";
    const firstDerivedId = derivedPointChoices(data)[0]?.id ?? "";
    set({
      spacePointDraft: {
        mode: "onLine",
        label: "",
        pointAId: verts[0]!.id,
        pointBId: verts[3]!.id,
        region: "between",
        ratioMode: "auto",
        ratioA: 1,
        ratioB: 2,
        lineParam: defaultLineParam("between"),
        faceId: data.figure.faces[0]!.id,
        placement: "arbitrary",
        lineId: firstLineId,
        planeId: firstPlaneId,
        derivedId: firstDerivedId,
      },
      spacePointDraftError: null,
    });
  },

  updateSpacePointDraft: (patch) =>
    set((state) => ({
      spacePointDraft: state.spacePointDraft
        ? { ...state.spacePointDraft, ...patch }
        : state.spacePointDraft,
      spacePointDraftError: null,
    })),

  cancelSpacePointDraft: () => set({ spacePointDraft: null, spacePointDraftError: null }),

  commitSpacePointDraft: () => {
    const state = get();
    const draft = state.spacePointDraft;
    const data = state.scene.space3d;
    if (!draft || !data?.figure) return;

    if (draft.mode === "fromConstruction") {
      const choice = derivedPointChoices(data).find((item) => item.id === draft.derivedId);
      if (!choice) {
        set({ spacePointDraftError: "Выберите доступное построение." });
        return;
      }
      const additions = createDerivedPoints(data, choice);
      if (!additions.length) {
        set({ spacePointDraftError: "Это построение больше недоступно." });
        return;
      }
      const result = applySpaceBuild({
        ...state.scene,
        space3d: { ...data, points: [...data.points, ...additions] },
      });
      set({
        scene: result.scene,
        status: result.status,
        spacePointDraft: null,
        spacePointDraftError: null,
      });
      return;
    }

    const definition =
      draft.mode === "onLine"
        ? ({
            kind: "onLine" as const,
            pointAId: draft.pointAId,
            pointBId: draft.pointBId,
            region: draft.region,
            ratioMode: draft.ratioMode,
            ratioA: draft.ratioA,
            ratioB: draft.ratioB,
            lineParam: draft.lineParam,
          } satisfies PointOnLineDefinition)
        : draft.mode === "onFace"
          ? {
              kind: "onFace" as const,
              faceId: draft.faceId,
              placement: draft.placement,
              faceU: 0.35,
              faceV: 0.35,
            }
          : {
              kind: "linePlaneIntersection" as const,
              lineId: draft.lineId,
              planeId: draft.planeId,
            };

    let lines = data.lines;
    if (definition.kind === "onLine") {
      const aux = createAuxiliaryLineForPoint(data, definition);
      if (aux) lines = [...lines, aux];
    }

    const label = draft.label.trim()
      ? resolvePointLabelInput(draft.label, data, data.figure)
      : nextFreePointLabel(data, data.figure);
    const point = createSpacePoint(data.points.length + 1, definition, label);
    point.built = true;

    const result = applySpaceBuild({
      ...state.scene,
      space3d: { ...data, points: [...data.points, point], lines },
    });
    set({
      scene: result.scene,
      status: result.status,
      spacePointDraft: null,
      spacePointDraftError: null,
    });
  },

  buildSpacePoint: (id) => {
    const state = get();
    const data = state.scene.space3d;
    if (!data?.figure) return;
    const target = data.points.find((p) => p.id === id);
    if (!target) return;
    let lines = data.lines;
    if (target.definition.kind === "onLine") {
      const aux = createAuxiliaryLineForPoint(data, target.definition);
      if (aux) lines = [...lines, aux];
    }
    const result = applySpaceBuild({
      ...state.scene,
      space3d: {
        ...data,
        lines,
        points: data.points.map((p) => (p.id === id ? { ...p, built: true, dirty: true } : p)),
      },
    });
    set({ scene: result.scene, status: result.status });
  },

  updateSpacePoint: (id, patch) =>
    set((state) =>
      withSpaceData(state, (data) => ({
        ...data,
        points: data.points.map((p) => (p.id === id ? { ...p, ...patch, dirty: true } : p)),
      })),
    ),

  updateSpacePointStyle: (id, patch) =>
    set((state) =>
      patchSpaceData(state, (data) => ({
        ...data,
        points: data.points.map((p) =>
          p.id === id ? { ...p, style: { ...p.style, ...patch } } : p,
        ),
      })),
    ),

  updateSpacePointOnLine: (id, patch) =>
    set((state) =>
      withSpaceData(state, (data) => ({
        ...data,
        points: data.points.map((p) => {
          if (p.id !== id || p.definition.kind !== "onLine") return p;
          let def: PointOnLineDefinition = { ...p.definition, ...patch };
          if (patch.region !== undefined && patch.lineParam === undefined) {
            def = {
              ...def,
              region: patch.region,
              lineParam: defaultLineParam(patch.region),
              ratioMode: "auto",
            };
          }
          if (patch.lineParam !== undefined) {
            def.lineParam = clampRegionParam(def.region, patch.lineParam);
            def.ratioMode = "auto";
          }
          return { ...p, definition: def, dirty: true };
        }),
      })),
    ),

  removeSpacePoint: (id) =>
    set((state) =>
      withSpaceData(state, (data) => ({
        ...data,
        points: reindexSpace(data.points.filter((p) => p.id !== id)),
      })),
    ),

  startSpaceLineDraft: () => {
    const data = get().scene.space3d;
    if (!data?.figure) return;
    const verts = data.figure.vertices;
    const faces = data.figure.faces;
    const firstDerivedId = derivedLineChoices(data)[0]?.id ?? "";
    set({
      spaceLineDraft: {
        kind: "twoPoints",
        visualKind: "segment",
        aId: verts[0]!.id,
        bId: verts[3]!.id,
        planeAId: faces.find((f) => f.id === "f-left")?.id ?? faces[0]!.id,
        planeBId: faces.find((f) => f.id === "f-back")?.id ?? faces[1]!.id,
        derivedId: firstDerivedId,
      },
      spaceLineDraftError: null,
    });
  },

  updateSpaceLineDraft: (patch) =>
    set((state) => ({
      spaceLineDraft: state.spaceLineDraft
        ? { ...state.spaceLineDraft, ...patch }
        : state.spaceLineDraft,
      spaceLineDraftError: null,
    })),

  cancelSpaceLineDraft: () => set({ spaceLineDraft: null, spaceLineDraftError: null }),

  commitSpaceLineDraft: () => {
    const state = get();
    const draft = state.spaceLineDraft;
    const data = state.scene.space3d;
    if (!draft || !data?.figure) return;
    if (draft.kind === "fromConstruction" && !draft.derivedId) {
      set({ spaceLineDraftError: "Выберите доступное построение." });
      return;
    }
    if (draft.kind === "twoPoints" && draft.aId === draft.bId) {
      set({ spaceLineDraftError: "Выберите две различные точки." });
      return;
    }
    if (draft.kind === "planeIntersection" && draft.planeAId === draft.planeBId) {
      set({ spaceLineDraftError: "Выберите две различные плоскости." });
      return;
    }
    const derivedChoice =
      draft.kind === "fromConstruction"
        ? derivedLineChoices(data).find((item) => item.id === draft.derivedId)
        : null;
    if (draft.kind === "fromConstruction" && !derivedChoice) {
      set({ spaceLineDraftError: "Это построение больше недоступно." });
      return;
    }
    const definition: SpaceLineDefinition =
      draft.kind === "twoPoints"
        ? { kind: "twoPoints", aId: draft.aId, bId: draft.bId }
        : {
            kind: "planeIntersection",
            planeAId: derivedChoice?.planeAId ?? draft.planeAId,
            planeBId: derivedChoice?.planeBId ?? draft.planeBId,
          };
    const line = createSpaceLine(data.lines.length + 1, definition, "");
    line.style.visualKind = draft.visualKind;
    line.built = true;
    let lines = [...data.lines, line];
    let points = data.points;
    if (draft.kind === "planeIntersection" || draft.kind === "fromConstruction") {
      const endpoints = createPlaneIntersectionEndpoints({ ...data, lines }, line);
      if (endpoints.length) {
        points = [...points, ...endpoints];
      }
      if (line.definition.kind === "planeIntersection") {
        const pairKey = [line.definition.planeAId, line.definition.planeBId].sort().join(":");
        const pairPoints = points
          .filter(
            (point) =>
              point.definition.kind === "planeIntersectionBoundary" &&
              [point.definition.planeAId, point.definition.planeBId].sort().join(":") === pairKey,
          )
          .sort((a, b) => {
            if (
              a.definition.kind !== "planeIntersectionBoundary" ||
              b.definition.kind !== "planeIntersectionBoundary"
            )
              return 0;
            return a.definition.endpoint - b.definition.endpoint;
          });
        line.definition = {
          ...line.definition,
          endpointAId: pairPoints[0]?.id,
          endpointBId: pairPoints[1]?.id,
        };
      }
      lines = [...data.lines, line];
    }
    const result = applySpaceBuild({
      ...state.scene,
      space3d: { ...data, points, lines },
    });
    set({
      scene: result.scene,
      status: result.status,
      spaceLineDraft: null,
      spaceLineDraftError: null,
    });
  },

  buildSpaceLine: (id) => {
    const state = get();
    const data = state.scene.space3d;
    if (!data?.figure) return;
    const result = applySpaceBuild({
      ...state.scene,
      space3d: {
        ...data,
        lines: data.lines.map((l) =>
          l.id === id ? { ...l, built: true, dirty: true, label: "" } : l,
        ),
      },
    });
    set({ scene: result.scene, status: result.status });
  },

  updateSpaceLine: (id, patch) =>
    set((state) =>
      withSpaceData(state, (data) => ({
        ...data,
        lines: data.lines.map((l) => (l.id === id ? { ...l, ...patch, dirty: true } : l)),
      })),
    ),

  updateSpaceLineStyle: (id, patch) =>
    set((state) =>
      withSpaceData(state, (data) => ({
        ...data,
        lines: data.lines.map((l) =>
          l.id === id
            ? { ...l, style: { ...l.style, ...patch }, dirty: patch.visualKind ? true : l.dirty }
            : l,
        ),
      })),
    ),

  removeSpaceLine: (id) =>
    set((state) =>
      withSpaceData(state, (data) => ({
        ...data,
        lines: reindexSpace(data.lines.filter((l) => l.id !== id)),
      })),
    ),

  startSpacePlaneDraft: () => {
    const data = get().scene.space3d;
    if (!data?.figure) return;
    const verts = data.figure.vertices;
    set({
      spacePlaneDraft: {
        definition: {
          kind: "threePoints",
          aId: verts[0]!.id,
          bId: verts[1]!.id,
          cId: verts[2]!.id,
        },
      },
      spacePlaneDraftError: null,
    });
  },

  updateSpacePlaneDraft: (patch) =>
    set((state) => ({
      spacePlaneDraft: state.spacePlaneDraft
        ? {
            ...state.spacePlaneDraft,
            ...patch,
            definition: patch.definition ?? state.spacePlaneDraft.definition,
          }
        : state.spacePlaneDraft,
      spacePlaneDraftError: null,
    })),

  cancelSpacePlaneDraft: () => set({ spacePlaneDraft: null, spacePlaneDraftError: null }),

  commitSpacePlaneDraft: () => {
    const state = get();
    const draft = state.spacePlaneDraft;
    const data = state.scene.space3d;
    if (!draft || !data?.figure) return;
    const def = draft.definition;
    if (def.kind === "threePoints" && new Set([def.aId, def.bId, def.cId]).size < 3) {
      set({ spacePlaneDraftError: "Выберите три различные точки." });
      return;
    }
    if (def.kind === "twoLines" && def.lineAId === def.lineBId) {
      set({ spacePlaneDraftError: "Выберите две различные прямые." });
      return;
    }
    if (def.kind === "lineParallelToLine" && def.throughLineId === def.parallelToLineId) {
      set({ spacePlaneDraftError: "Выберите две различные прямые." });
      return;
    }
    const plane = createSpacePlane(data.planes.length + 1, def, "");
    plane.built = true;
    const result = applySpaceBuild({
      ...state.scene,
      space3d: { ...data, planes: [...data.planes, plane] },
    });
    set({
      scene: result.scene,
      status: result.status,
      spacePlaneDraft: null,
      spacePlaneDraftError: null,
    });
  },

  buildSpacePlane: (id) => {
    const state = get();
    const data = state.scene.space3d;
    if (!data?.figure) return;
    const result = applySpaceBuild({
      ...state.scene,
      space3d: {
        ...data,
        planes: data.planes.map((p) => (p.id === id ? { ...p, built: true, dirty: true } : p)),
      },
    });
    set({ scene: result.scene, status: result.status });
  },

  updateSpacePlane: (id, patch) =>
    set((state) =>
      withSpaceData(state, (data) => ({
        ...data,
        planes: data.planes.map((p) => (p.id === id ? { ...p, ...patch, dirty: true } : p)),
      })),
    ),

  updateSpacePlaneStyle: (id, patch) =>
    set((state) =>
      withSpaceData(state, (data) => ({
        ...data,
        planes: data.planes.map((p) =>
          p.id === id ? { ...p, style: { ...p.style, ...patch } } : p,
        ),
      })),
    ),

  removeSpacePlane: (id) =>
    set((state) =>
      withSpaceData(state, (data) => ({
        ...data,
        planes: reindexSpace(data.planes.filter((p) => p.id !== id)),
      })),
    ),
}));
