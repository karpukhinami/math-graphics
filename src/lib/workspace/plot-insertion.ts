import type { PlotScene } from "../plotting/types";
import type { StatDecoJson } from "../plotting/chart/types";

export interface WorkspacePlotImage { src: string; scene?: PlotScene; charts?: StatDecoJson[] }

export function plotInsertionImages(src: string, scene: PlotScene, beautifiedSrc?: string | null, charts?: StatDecoJson[]) {
  const images: WorkspacePlotImage[] = [charts?.length ? { src, charts: structuredClone(charts) } : { src, scene }];
  if (beautifiedSrc) images.push({ src: beautifiedSrc });
  return images;
}

export function insertPlotImageTokens(text: string, ids: string[], position = text.length) {
  const tokens = ids.map((id) => `\n![Чертёж](plot:${id})\n`).join("");
  return text.slice(0, position) + tokens + text.slice(position);
}