import { createFileRoute } from "@tanstack/react-router";
import { PlotWorkbench } from "@/components/plotting/PlotWorkbench";
import { usePlotStore } from "@/lib/plotting/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Plotting — конструктор математических чертежей" },
      {
        name: "description",
        content:
          "Конструктор математических чертежей: числовая прямая, координатная плоскость, пространственные фигуры, ИИ-построение и экспорт в SVG или PNG.",
      },
      { property: "og:title", content: "Plotting — конструктор математических чертежей" },
      {
        property: "og:description",
        content:
          "Постройте числовую прямую или координатную плоскость, затем выгрузите чертёж в SVG или PNG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlottingPage,
});

function PlottingPage() {
  const inputMode = usePlotStore((state) => state.inputMode);
  const spaceTab = usePlotStore((state) => state.spaceTab);
  const subtitle =
    inputMode === "ai"
      ? "ИИ-режим: анализ материала и построение чертежа."
      : spaceTab === "line"
        ? "Конструктор чертежей на числовой прямой."
        : spaceTab === "space"
          ? "Конструктор пространственных чертежей."
          : "Конструктор математических чертежей на координатной плоскости.";
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col p-4 lg:p-6">
        <PlotWorkbench
          title={
            <>
              <h1 className="text-2xl font-semibold tracking-tight">Plotting</h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </>
          }
        />
      </div>
    </div>
  );
}
