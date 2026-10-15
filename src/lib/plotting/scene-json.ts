/**
 * Компактный JSON сцены (формат version 2).
 *
 * Принцип: в файле хранится только то, что ввёл пользователь или ИИ.
 * Всё, что конструктор вычисляет сам (построенные кривые, координаты зависимых
 * точек, граничные точки множеств, номера, цвета по умолчанию, авто-шаг сетки,
 * значения оформления по умолчанию), не записывается и пересчитывается при загрузке.
 * Отсутствующее поле = «авто» (значение по умолчанию или вычисленное кодом).
 *
 * Загрузка понимает и старый полный формат (version 1): лишние поля игнорируются
 * или пересчитываются.
 */
import { createGraph, createPoint, createScene, createSpacePlotScene, migrateAxisImport } from "./scene";
import { resolveGeometry } from "./render";
import { DEFAULT_APPEARANCE } from "./shared";
import { createLinePoint, createLineScene, createSet } from "./line/scene";
import { normalizeLineAxisRows } from "./line/import-ai";
import { DEFAULT_LINE_TICKS, LINE_APPEARANCE_OVERRIDES } from "./line/types";
import type { LineSceneData, SceneLinePoint, SceneSet, SetMath } from "./line/types";
import { deserializeSpaceSceneData, serializeSpaceSceneData } from "./space/serialize";
import type {
  AxisSpec,
  GraphMath,
  GridSpec,
  PlotScene,
  PointMath,
  PointSolution,
  PointStyle,
  SceneGraph,
  ScenePoint,
} from "./types";

export type SceneJson = Record<string, unknown>;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Только поля, отличающиеся от значений по умолчанию. */
export function diffFields<T extends object>(value: T, base: T, skip: string[] = []): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (skip.includes(key) || v === undefined) continue;
    if (!same(v, (base as Record<string, unknown>)[key])) out[key] = v;
  }
  return out as Partial<T>;
}

function putIf(target: Record<string, unknown>, key: string, value: unknown) {
  if (value === undefined || value === null || value === "") return;
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) return;
  if (Array.isArray(value) && value.length === 0) return;
  target[key] = value;
}

/* ───────────── Плоскость: выгрузка ───────────── */

function axisJson(scene: PlotScene, key: "xAxis" | "yAxis"): Record<string, unknown> {
  const axis = scene[key];
  const out: Record<string, unknown> = { name: axis.name, min: axis.min, max: axis.max };
  putIf(out, "unit", axis.unit);
  // Шаг сетки: не храним, если он совпадает с тем, что конструктор подставит сам («авто»).
  const actual = resolveGeometry(scene);
  const auto = resolveGeometry({ ...scene, [key]: { ...axis, gridStep: "" } });
  const gridField = key === "xAxis" ? "gridStepX" : "gridStepY";
  const labelField = key === "xAxis" ? "xStep" : "yStep";
  const gridIsAuto = !axis.gridStep.trim() || (actual && auto && Math.abs(actual[gridField] - auto[gridField]) < 1e-12);
  if (!gridIsAuto) out.gridStep = axis.gridStep;
  const labelIsAuto =
    !axis.labelStep.trim() || (actual && Math.abs(actual[labelField] - actual[gridField]) < 1e-12);
  if (!labelIsAuto) out.labelStep = axis.labelStep;
  if (axis.labelFormat !== "number") out.labelFormat = axis.labelFormat;
  if (axis.markRule !== "all") out.markRule = axis.markRule;
  if (axis.markRule === "selected") putIf(out, "selectedMarks", axis.selectedMarks);
  return out;
}

function graphMathJson(math: GraphMath): Record<string, unknown> {
  const out: Record<string, unknown> = { kind: math.kind };
  switch (math.kind) {
    case "explicit":
      out.expression = math.expression;
      break;
    case "implicit":
      out.equation = math.equation;
      break;
    case "piecewise":
      out.pieces = math.pieces;
      break;
    case "qualitative":
    case "piecewise-linear":
      out.anchors = math.anchors;
      if (math.extendEnds === false) out.extendEnds = false;
      break;
    case "parametric":
      putIf(out, "xExpression", math.xExpression);
      putIf(out, "yExpression", math.yExpression);
      break;
  }
  putIf(out, "domainFrom", math.domainFrom);
  putIf(out, "domainTo", math.domainTo);
  return out;
}

function graphJson(graph: SceneGraph, position: number): Record<string, unknown> {
  const out: Record<string, unknown> = { id: graph.id, math: graphMathJson(graph.math) };
  putIf(out, "style", diffFields(graph.style, createGraph(position + 1).style));
  return out;
}

function pointMathJson(math: PointMath, scene: PlotScene): Record<string, unknown> {
  switch (math.mode) {
    case "plane":
      return { mode: "plane", x: math.x, y: math.y };
    case "intersection":
      return { mode: "intersection", graphId: math.graphId, graphIdB: math.graphIdB,
        ...(math.intersectionIndex === undefined ? {} : { intersectionIndex: math.intersectionIndex }) };
    case "anchor":
      return { mode: "anchor", graphId: math.graphId, anchorIndex: math.anchorIndex };
    case "onGraph": {
      const graph = scene.graphs.find((g) => g.id === math.graphId);
      const byAnchor =
        math.anchorIndex !== null &&
        (graph?.math.kind === "qualitative" || graph?.math.kind === "piecewise-linear");
      return byAnchor
        ? { mode: "onGraph", graphId: math.graphId, anchorIndex: math.anchorIndex }
        : { mode: "onGraph", graphId: math.graphId, x: math.x };
    }
  }
}

/**
 * Индивидуальные настройки решений (несколько точек пересечения, несколько точек
 * графика при одном x). Координаты не храним — только show/style по номеру решения.
 */
function solutionsJson(point: ScenePoint, scene: PlotScene): Array<Record<string, unknown>> {
  const piecewise =
    point.math.mode === "onGraph" &&
    scene.graphs.find((g) => g.id === point.math.graphId)?.math.kind === "piecewise";
  const list = (point.built ?? []).map((solution) => {
    const out: Record<string, unknown> = {};
    if (solution.show === false) out.show = false;
    const style = { ...(solution.style ?? {}) } as Partial<PointStyle>;
    // У кусочной функции открытость решения задаёт сам конструктор.
    if (piecewise) delete style.open;
    for (const [k, v] of Object.entries(style)) {
      if (same(v, (point.style as unknown as Record<string, unknown>)[k])) delete (style as Record<string, unknown>)[k];
    }
    putIf(out, "style", style);
    return out;
  });
  while (list.length && Object.keys(list[list.length - 1]).length === 0) list.pop();
  return list;
}

function pointJson(point: ScenePoint, scene: PlotScene): Record<string, unknown> {
  const out: Record<string, unknown> = { id: point.id, math: pointMathJson(point.math, scene) };
  const style = diffFields(point.style, createPoint(1).style);
  if (style.labelPlacement === "auto") delete style.labelPlacement;
  putIf(out, "style", style);
  putIf(out, "solutions", solutionsJson(point, scene));
  return out;
}

function sharedHeader(scene: PlotScene, defaults: PlotScene): SceneJson {
  const out: SceneJson = { version: 2, space: scene.space };
  if (scene.axisScaleMode !== defaults.axisScaleMode) out.axisScaleMode = scene.axisScaleMode;
  if (scene.plotAspectRatio !== defaults.plotAspectRatio) out.plotAspectRatio = scene.plotAspectRatio;
  putIf(out, "appearance", diffFields(scene.appearance, defaults.appearance));
  putIf(out, "customColors", scene.customColors);
  return out;
}

/* ───────────── Прямая: выгрузка ───────────── */

function setMathJson(math: SetMath): Record<string, unknown> {
  if (math.kind === "interval")
    return { kind: "interval", left: math.left, right: math.right, leftOp: math.leftOp, rightOp: math.rightOp };
  if (math.kind === "ray") return { kind: "ray", rayOp: math.rayOp, rayBoundary: math.rayBoundary };
  return { kind: "freeform", freeformInput: math.freeformInput };
}

function setJson(set: SceneSet, position: number): Record<string, unknown> {
  const out: Record<string, unknown> = { id: set.id };
  if (set.axisRow) out.axisRow = set.axisRow;
  out.math = setMathJson(set.math);
  putIf(out, "style", diffFields(set.style, createSet(position + 1, 0).style));
  return out;
}

/** Граничная точка множества создаётся конструктором; храним только ручные правки оформления. */
function linePointJson(point: SceneLinePoint): Record<string, unknown> | null {
  const base = createLinePoint(1, 0).style;
  if (point.math.sourceSetId) {
    const skip = ["open", ...(point.style.colorManual ? [] : ["color", "colorManual"])];
    const style = diffFields(point.style, base, skip);
    if (!Object.keys(style).length) return null;
    return {
      ...(point.axisRow ? { axisRow: point.axisRow } : {}),
      math: { sourceSetId: point.math.sourceSetId, boundaryKey: point.math.boundaryKey },
      style,
    };
  }
  const out: Record<string, unknown> = {};
  if (point.axisRow) out.axisRow = point.axisRow;
  out.math = { coordinate: point.math.coordinate };
  putIf(out, "style", diffFields(point.style, base));
  return out;
}

function lineJson(line: LineSceneData): Record<string, unknown> {
  const out: Record<string, unknown> = { axis: line.axis };
  putIf(out, "ticks", diffFields(line.ticks, DEFAULT_LINE_TICKS));
  if (line.axisRowCount > 1) out.axisRowCount = line.axisRowCount;
  out.sets = line.sets.map(setJson);
  out.points = line.points.map(linePointJson).filter(Boolean);
  return out;
}

/** Выгрузка сцены в компактный JSON. */
export function sceneToJson(scene: PlotScene): SceneJson {
  if (scene.space === "line" && scene.line) {
    const out = sharedHeader(scene, createLineScene() as PlotScene);
    out.line = lineJson(scene.line);
    return out;
  }
  if (scene.space === "space" && scene.space3d) {
    const out = sharedHeader(scene, createSpacePlotScene());
    out.space3d = serializeSpaceSceneData(scene.space3d);
    return out;
  }
  const defaults = createScene();
  const out = sharedHeader({ ...scene, space: "plane" }, defaults);
  out.xAxis = axisJson(scene, "xAxis");
  out.yAxis = axisJson(scene, "yAxis");
  if (scene.grid.visible !== defaults.grid.visible) out.grid = { visible: scene.grid.visible };
  out.graphs = scene.graphs.map(graphJson);
  out.points = scene.points.map((p) => pointJson(p, scene));
  return out;
}

/* ───────────── Загрузка ───────────── */

/**
 * Заготовки решений: buildPoint переносит show/style по номеру решения из прежнего
 * built и подставляет вычисленные координаты. Принимает и новый `solutions`,
 * и старый полный `built`.
 */
function solutionStubs(raw: Record<string, unknown>): PointSolution[] | null {
  const list = (Array.isArray(raw.solutions) ? raw.solutions : Array.isArray(raw.built) ? raw.built : null) as
    | Array<{ show?: boolean; style?: Partial<PointStyle> }>
    | null;
  if (!list?.length) return null;
  return list.map((item) => ({
    x: 0,
    y: 0,
    displayX: "",
    displayY: "",
    show: item?.show !== false,
    style: item?.style && Object.keys(item.style).length ? { ...item.style } : undefined,
  }));
}

type RawScene = Omit<Partial<PlotScene>, "grid" | "line"> & {
  grid?: Partial<GridSpec> & { followAxisStep?: boolean; stepX?: string; stepY?: string };
  space3d?: unknown;
  line?: Partial<LineSceneData> | null;
};

function planeFromJson(input: RawScene): PlotScene {
  const base = createScene();
  const legacyGrid = input.grid ?? {};
  return {
    ...base,
    axisScaleMode: input.axisScaleMode ?? base.axisScaleMode,
    plotAspectRatio: input.plotAspectRatio ?? base.plotAspectRatio,
    xAxis: migrateAxisImport({ ...base.xAxis, gridStep: "" }, (input.xAxis ?? {}) as Partial<AxisSpec>, legacyGrid.stepX ?? ""),
    yAxis: migrateAxisImport({ ...base.yAxis, gridStep: "" }, (input.yAxis ?? {}) as Partial<AxisSpec>, legacyGrid.stepY ?? ""),
    grid: { visible: legacyGrid.visible ?? base.grid.visible },
    appearance: { ...base.appearance, ...(input.appearance ?? {}) },
    graphs: (input.graphs ?? []).map((graph, position) => {
      const fresh = createGraph(position + 1);
      return {
        ...fresh,
        id: graph.id ?? fresh.id,
        index: position + 1,
        math: { ...fresh.math, ...graph.math },
        style: { ...fresh.style, ...graph.style },
        built: null,
        dirty: true,
        error: null,
      };
    }),
    points: (input.points ?? []).map((point, position) => {
      const fresh = createPoint(position + 1);
      return {
        ...fresh,
        id: point.id ?? fresh.id,
        index: position + 1,
        math: { ...fresh.math, ...point.math },
        style: { ...fresh.style, ...point.style },
        built: solutionStubs(point as unknown as Record<string, unknown>),
        dirty: true,
        error: null,
      };
    }),
    tangents: input.tangents ?? [],
    customColors: input.customColors ?? [],
    line: null,
    space3d: null,
    version: 1,
    space: "plane",
  };
}

function lineFromJson(input: RawScene): PlotScene {
  const defaults = createLineScene() as PlotScene;
  const lineBase = defaults.line!;
  const rawLine = normalizeLineAxisRows({
    ...(input.line ?? {}),
    axisRowCount: input.line?.axisRowCount ?? lineBase.axisRowCount,
    sets: input.line?.sets ?? [],
    points: input.line?.points ?? [],
  });
  return {
    ...defaults,
    axisScaleMode: input.axisScaleMode ?? defaults.axisScaleMode,
    plotAspectRatio: input.plotAspectRatio ?? defaults.plotAspectRatio,
    appearance: { ...DEFAULT_APPEARANCE, ...LINE_APPEARANCE_OVERRIDES, ...(input.appearance ?? {}) },
    customColors: input.customColors ?? [],
    line: {
      ...lineBase,
      axis: { ...lineBase.axis, ...(rawLine.axis ?? {}) },
      ticks: { ...lineBase.ticks, ...(rawLine.ticks ?? {}) },
      axisRowCount: rawLine.axisRowCount ?? 1,
      sets: (rawLine.sets ?? []).map((set, position) => {
        const fresh = createSet(position + 1, set.axisRow ?? 0);
        return {
          ...fresh,
          id: set.id ?? fresh.id,
          math: { ...fresh.math, ...set.math },
          style: { ...fresh.style, ...set.style },
          kindLocked: false,
          built: null,
          dirty: true,
          error: null,
        };
      }),
      points: (rawLine.points ?? []).map((point, position) => {
        const fresh = createLinePoint(position + 1, point.axisRow ?? 0);
        const boundary = Boolean(point.math?.sourceSetId);
        return {
          ...fresh,
          math: { ...fresh.math, ...point.math },
          style: { ...fresh.style, ...point.style },
          built: null,
          dirty: true,
          error: null,
          // Граничные точки пересоздаёт и синхронизирует сам конструктор.
          locked: boundary,
        };
      }),
    },
    version: 1,
    space: "line",
  };
}

/** Сцена из JSON (новый компактный или старый полный формат); построение — отдельно. */
export function sceneFromJson(raw: unknown): PlotScene {
  const input = (raw ?? {}) as RawScene;
  const isLine = input.space === "line";
  const isSpace = input.space === "space" || (input.space3d != null && typeof input.space3d === "object" && !isLine);
  if (isSpace) {
    const defaults = createSpacePlotScene();
    return {
      ...defaults,
      axisScaleMode: input.axisScaleMode ?? defaults.axisScaleMode,
      plotAspectRatio: input.plotAspectRatio ?? defaults.plotAspectRatio,
      appearance: { ...defaults.appearance, ...(input.appearance ?? {}) },
      customColors: input.customColors ?? [],
      space3d: deserializeSpaceSceneData(input.space3d ?? {}),
    };
  }
  return isLine ? lineFromJson(input) : planeFromJson(input);
}
