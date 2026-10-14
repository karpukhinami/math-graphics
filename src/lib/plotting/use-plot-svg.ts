/** Текущий SVG чертежа из стора — единый источник для превью и встраивания. */
import { useMemo } from "react";
import { usePlotStore } from "./store";
import { draftRenderPoints, sceneCurves, scenePoints } from "./scene";
import { renderPlotSvg } from "./render";
import { renderLineSvg } from "./line/render";
import { renderSpaceSvg } from "./space/render";
import type { PlotScene } from "./types";

type PointDraft = Parameters<typeof draftRenderPoints>[1];

/** Чистая функция: сцена → SVG (без хука; нужна для пакетной отрисовки нескольких чертежей). */
export function sceneToSvg(scene: PlotScene, pointDraft: PointDraft = null): string | null {
  if (scene.space === "line") return renderLineSvg(scene);
  if (scene.space === "space" && scene.space3d) return renderSpaceSvg(scene.space3d);
  return renderPlotSvg(scene, sceneCurves(scene), [
    ...scenePoints(scene),
    ...draftRenderPoints(scene, pointDraft),
  ]);
}

export function usePlotSvg(): string | null {
  const scene = usePlotStore((state) => state.scene);
  const pointDraft = usePlotStore((state) => state.pointDraft);
  return useMemo(() => sceneToSvg(scene, pointDraft), [scene, pointDraft]);
}
