/**
 * Сохранение/загрузка пространственной сцены: только пользовательские параметры,
 * без топологии тела, координат вершин и вычисленных полей fit/geometry.
 */
import type { PlotScene } from "../types";
import { DEFAULT_SPACE_VIEW } from "./camera";
import {
  createFigureFromInput,
  createSpaceLine,
  createSpacePlane,
  createSpacePoint,
  createSpaceSceneData,
  defaultParallelepipedConstraints,
  defaultPyramidConstraints,
  defaultPrismConstraints,
  figureVertexInputString,
  DEFAULT_SPACE_APPEARANCE,
} from "./scene";
import type {
  ParallelepipedConstraints,
  PrismConstraints,
  PyramidConstraints,
  SpaceAppearance,
  SpaceFigureConstraints,
  SpaceLine,
  SpaceLineDefinition,
  SpaceLineStyle,
  SpacePlane,
  SpacePlaneDefinition,
  SpacePlaneStyle,
  SpacePoint,
  SpacePointDefinition,
  SpacePointStyle,
  SpaceSceneData,
  SpaceShapeKind,
  SpaceViewParams,
} from "./types";

/** Фрагмент JSON сцены «Пространство» (без figure и без runtime-полей). */
export interface SpaceSceneDataJson {
  shapeKind: SpaceShapeKind | null;
  baseVerticesInput: string;
  figureConstraints: SpaceFigureConstraints;
  /** На момент выгрузки фигура была построена на canvas. */
  figureBuilt: boolean;
  points: Array<{
    id: string;
    index: number;
    label: string;
    definition: SpacePointDefinition;
    style: SpacePointStyle;
    built: boolean;
  }>;
  lines: Array<{
    id: string;
    index: number;
    label: string;
    definition: SpaceLineDefinition;
    style: SpaceLineStyle;
    built: boolean;
  }>;
  planes: Array<{
    id: string;
    index: number;
    label: string;
    definition: SpacePlaneDefinition;
    style: SpacePlaneStyle;
    built: boolean;
  }>;
  view: SpaceViewParamsJson;
  appearance: SpaceAppearance;
}

/** Параметры вида без авто-fit и устаревших полей, выводимых из constraints. */
export type SpaceViewParamsJson = Pick<
  SpaceViewParams,
  | "scale"
  | "yaw"
  | "pitch"
  | "depthLength"
  | "heightLength"
  | "scaleX"
  | "scaleY"
  | "visibilityMode"
  | "planeFillByDepth"
  | "showPlaneIntersections"
  | "planeFillDepthMode"
  | "showRotationEllipse"
  | "showViewConvergenceRays"
  | "pointLabelsUseEdgeColor"
  | "renderGrayscale"
>;

function stripViewForExport(view: SpaceViewParams): SpaceViewParamsJson {
  return {
    scale: view.scale,
    yaw: view.yaw,
    pitch: view.pitch ?? 0,
    depthLength: view.depthLength,
    heightLength: view.heightLength,
    scaleX: view.scaleX,
    scaleY: view.scaleY,
    visibilityMode: view.visibilityMode,
    planeFillByDepth: view.planeFillByDepth,
    showPlaneIntersections: view.showPlaneIntersections,
    planeFillDepthMode: view.planeFillDepthMode,
    showRotationEllipse: view.showRotationEllipse,
    showViewConvergenceRays: view.showViewConvergenceRays,
    pointLabelsUseEdgeColor: view.pointLabelsUseEdgeColor,
    renderGrayscale: view.renderGrayscale,
  };
}

function mergeViewFromJson(partial: Partial<SpaceViewParamsJson>, base: SpaceViewParams): SpaceViewParams {
  return {
    ...base,
    ...partial,
    fitScale: undefined,
    fitCx: undefined,
    fitCy: undefined,
  };
}

function normalizeConstraints(
  shapeKind: SpaceShapeKind | null,
  raw: unknown,
): SpaceFigureConstraints {
  const o = (raw ?? {}) as Partial<SpaceFigureConstraints>;
  if (shapeKind === "pyramid") {
    const d = defaultPyramidConstraints();
    const p = o as Partial<PyramidConstraints>;
    return {
      apexOnCenter: p.apexOnCenter ?? d.apexOnCenter,
      equilateral: p.equilateral ?? d.equilateral,
      badAngleDeg: p.badAngleDeg ?? d.badAngleDeg,
    };
  }
  if (shapeKind === "prism") {
    const d = defaultPrismConstraints();
    const p = o as Partial<PrismConstraints>;
    return {
      straight: p.straight ?? d.straight,
      equilateral: p.equilateral ?? d.equilateral,
      badAngleDeg: p.badAngleDeg ?? d.badAngleDeg,
    };
  }
  const d = defaultParallelepipedConstraints();
  const pp = o as Partial<ParallelepipedConstraints>;
  return {
    rectangular: pp.rectangular ?? d.rectangular,
    equilateral: pp.equilateral ?? d.equilateral,
    badAngleDeg: pp.badAngleDeg ?? d.badAngleDeg,
  };
}

function resolveShapeKind(raw: Record<string, unknown>): SpaceShapeKind | null {
  const k = raw.shapeKind;
  if (k === "parallelepiped" || k === "pyramid" || k === "prism") return k;
  const fig = raw.figure as { kind?: string } | null | undefined;
  if (fig?.kind === "parallelepiped" || fig?.kind === "pyramid" || fig?.kind === "prism") return fig.kind;
  return null;
}

function resolveBaseVerticesInput(raw: Record<string, unknown>, shapeKind: SpaceShapeKind | null): string {
  const text = String(raw.baseVerticesInput ?? "").trim();
  if (text) return text;
  const fig = raw.figure as SpaceSceneData["figure"];
  if (!fig) return "";
  try {
    return figureVertexInputString(fig);
  } catch {
    return "";
  }
}

function figureWasBuilt(raw: Record<string, unknown>): boolean {
  if (typeof raw.figureBuilt === "boolean") return raw.figureBuilt;
  return raw.figure != null;
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function diffObject<T extends object>(value: T, base: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (v === undefined) continue;
    if (!sameJson(v, (base as Record<string, unknown>)[key])) out[key] = v;
  }
  return out as Partial<T>;
}

/** Убрать из определения точки значения, которые конструктор вычисляет сам. */
function compactPointDefinition(def: SpacePointDefinition): SpacePointDefinition {
  if (def.kind === "onFace" && def.placement === "center") {
    const { faceU: _u, faceV: _v, ...rest } = def;
    return rest as SpacePointDefinition;
  }
  if (def.kind === "onLine" && def.ratioMode === "explicit") {
    const { lineParam: _t, ...rest } = def;
    return rest as SpacePointDefinition;
  }
  if (def.kind === "onLine" && def.ratioMode === "auto") {
    const { ratioA: _a, ratioB: _b, ...rest } = def;
    return rest as SpacePointDefinition;
  }
  return def;
}

function restorePointDefinition(def: SpacePointDefinition): SpacePointDefinition {
  if (def.kind === "onFace") return { ...def, faceU: def.faceU ?? 0.5, faceV: def.faceV ?? 0.5 };
  if (def.kind === "onLine") {
    return { ...def, ratioA: def.ratioA ?? 1, ratioB: def.ratioB ?? 1, lineParam: def.lineParam as number };
  }
  return def;
}

/**
 * Выгрузка: только ввод пользователя. Без figure, geometry, errors; стиль, вид и
 * оформление — только отличия от значений по умолчанию; label/built — если не по умолчанию.
 */
export function serializeSpaceSceneData(data: SpaceSceneData): SpaceSceneDataJson {
  const baseVerticesInput =
    data.baseVerticesInput.trim() ||
    (data.figure ? figureVertexInputString(data.figure) : "");
  const common = (o: { id: string; index: number; label: string; built: boolean }) => ({
    id: o.id,
    index: o.index,
    ...(o.label ? { label: o.label } : {}),
    ...(o.built ? {} : { built: false }),
  });

  return {
    shapeKind: data.shapeKind,
    baseVerticesInput,
    figureConstraints: { ...data.figureConstraints },
    figureBuilt: data.figure != null,
    points: data.points.map((p) => ({
      ...common(p),
      definition: compactPointDefinition(p.definition),
      style: diffObject(p.style, createSpacePoint(p.index, p.definition).style),
    })),
    lines: data.lines.map((l) => ({
      ...common(l),
      definition: l.definition,
      style: diffObject(l.style, createSpaceLine(l.index, l.definition).style),
    })),
    planes: data.planes.map((pl) => ({
      ...common(pl),
      definition: pl.definition,
      style: diffObject(pl.style, createSpacePlane(pl.index, pl.definition).style),
    })),
    view: diffObject(stripViewForExport(data.view), stripViewForExport(DEFAULT_SPACE_VIEW)),
    appearance: diffObject(data.appearance, DEFAULT_SPACE_APPEARANCE),
  } as unknown as SpaceSceneDataJson;
}

/** Загрузка: восстанавливает figure из ввода и constraints, затем объекты по id. */
export function deserializeSpaceSceneData(raw: unknown): SpaceSceneData {
  const base = createSpaceSceneData();
  if (!raw || typeof raw !== "object") return base;

  const o = raw as Record<string, unknown>;
  const shapeKind = resolveShapeKind(o);
  const figureConstraints = normalizeConstraints(shapeKind, o.figureConstraints ?? (o.figure as { constraints?: unknown })?.constraints);
  const baseVerticesInput = resolveBaseVerticesInput(o, shapeKind);
  const wantFigure = figureWasBuilt(o);

  let figure = null as SpaceSceneData["figure"];
  let figureDirty = false;
  if (wantFigure && shapeKind && baseVerticesInput) {
    const created = createFigureFromInput(shapeKind, baseVerticesInput, figureConstraints);
    if (created.figure) {
      figure = created.figure;
      figureDirty = false;
    } else {
      figureDirty = true;
    }
  } else if (wantFigure) {
    figureDirty = true;
  }

  const pointsRaw = Array.isArray(o.points) ? o.points : [];
  const linesRaw = Array.isArray(o.lines) ? o.lines : [];
  const planesRaw = Array.isArray(o.planes) ? o.planes : [];

  const viewRaw = (o.view ?? {}) as Partial<SpaceViewParamsJson>;
  const appearanceRaw = (o.appearance ?? {}) as Partial<SpaceAppearance>;

  return {
    shapeKind,
    baseVerticesInput,
    figureConstraints,
    figureDirty,
    figure,
    points: pointsRaw.map((p, i) => restoreSpacePoint(p as SpaceSceneDataJson["points"][number], i)),
    lines: linesRaw.map((l, i) => restoreSpaceLine(l as SpaceSceneDataJson["lines"][number], i)),
    planes: planesRaw.map((pl, i) => restoreSpacePlane(pl as SpaceSceneDataJson["planes"][number], i)),
    view: mergeViewFromJson(viewRaw, base.view),
    appearance: { ...base.appearance, ...appearanceRaw },
  };
}

/** Импорт space3d из JSON (новый или legacy с полным figure). */
export function importSpaceSceneFromJson(raw: unknown): SpaceSceneData {
  return deserializeSpaceSceneData(raw);
}
