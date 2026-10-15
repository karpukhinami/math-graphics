import type { BuiltGraph, PlotScene, PointMath } from "./types";

/** Служебные цели пересечения, не графики сцены. */
export const AXIS_INTERSECTION_TARGETS = [
  { id: "axis:x=0", equation: "x=0" },
  { id: "axis:y=0", equation: "y=0" },
] as const;

export function isAxisIntersectionTarget(id: string | null): boolean {
  return AXIS_INTERSECTION_TARGETS.some((axis) => axis.id === id);
}

export function intersectionAxisGraph(id: string | null, bounds: { xMin: number; xMax: number; yMin: number; yMax: number }): BuiltGraph | null {
  if (id === "axis:x=0") return { segments: [[[0, bounds.yMin], [0, bounds.yMax]]] };
  if (id === "axis:y=0") return { segments: [[[bounds.xMin, 0], [bounds.xMax, 0]]] };
  return null;
}

/** Ось может быть выбрана первой: цвет всегда берётся от настоящего графика. */
export function pointSourceColor(scene: PlotScene, math: PointMath): string | undefined {
  if (math.mode === "plane") return undefined;
  const ids = math.mode === "intersection" ? [math.graphId, math.graphIdB] : [math.graphId];
  return ids.map((id) => scene.graphs.find((graph) => graph.id === id)?.style.color).find((color) => color !== undefined);
}