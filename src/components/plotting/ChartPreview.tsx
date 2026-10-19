/** Превью диаграммы (ECharts, ленивый импорт — безопасно для SSR). */
import { useEffect, useRef } from "react";
import type { StatDecoJson } from "@/lib/plotting/chart";
import { buildStatDecoOption } from "@/lib/plotting/chart";

export function ChartPreview({ chart }: { chart: StatDecoJson }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let instance: { dispose: () => void; resize: () => void } | null = null;
    const { option, error } = buildStatDecoOption(chart);
    if (error) return;

    void import("echarts").then((echarts) => {
      if (disposed || !hostRef.current) return;
      instance = echarts.init(hostRef.current, undefined, { renderer: "canvas" });
      instance.setOption(option, true);
    });

    const observer = new ResizeObserver(() => instance?.resize());
    observer.observe(host);

    return () => {
      disposed = true;
      observer.disconnect();
      instance?.dispose();
    };
  }, [chart]);

  const { error } = buildStatDecoOption(chart);
  if (error) {
    return <p className="p-8 text-center text-sm text-muted-foreground">{error}</p>;
  }
  return <div ref={hostRef} className="h-[420px] w-full" />;
}
