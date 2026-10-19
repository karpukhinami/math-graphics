/**
 * Офф-скрин рендер диаграммы в PNG (data URL) — для скачивания и вставки в задание,
 * независимо от того, открыто ли превью.
 */
import type { StatDecoJson } from "./types";
import { buildStatDecoOption } from "./echarts-option";

interface EchartsLike {
  setOption: (option: unknown, notMerge: boolean) => void;
  dispose: () => void;
  getDataURL: (opts: { type: string; pixelRatio: number; backgroundColor?: string }) => string;
}

export async function renderStatDecoChartPng(statDeco: StatDecoJson): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const { option, error } = buildStatDecoOption(statDeco);
  if (error) return null;

  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = "1200px";
  host.style.height = "800px";
  document.body.appendChild(host);

  let chart: EchartsLike | null = null;
  try {
    const echarts = await import("echarts");
    const { option: sizedOption } = buildStatDecoOption(statDeco, {
      width: 1200,
      measureText: (text, font) => echarts.format.getTextRect(text, font).width,
    });
    chart = echarts.init(host, undefined, {
      renderer: "canvas",
      devicePixelRatio: 2,
    }) as unknown as EchartsLike;
    chart.setOption(sizedOption, true);
    return chart.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: option.backgroundColor as string | undefined,
    });
  } catch {
    return null;
  } finally {
    chart?.dispose();
    host.remove();
  }
}
