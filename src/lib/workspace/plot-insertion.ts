import type { PlotScene } from "../plotting/types";

export function plotInsertionImages(src: string, scene: PlotScene, beautifiedSrc?: string | null) {
  const images: { src: string; scene?: PlotScene }[] = [{ src, scene }];
  if (beautifiedSrc) images.push({ src: beautifiedSrc });
  return images;
}

export function insertPlotImageTokens(text: string, ids: string[], position = text.length) {
  const tokens = ids.map((id) => `\n![Чертёж](plot:${id})\n`).join("");
  return text.slice(0, position) + tokens + text.slice(position);
}