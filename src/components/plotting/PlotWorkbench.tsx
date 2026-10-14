/**
 * Полный конструктор чертежей (ручной + ИИ-режим + превью).
 * Используется и на главной странице, и в редакторе заданий — доработки построений общие.
 */
import { useState, type ReactNode } from "react";
import { Layers, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlotPreview } from "@/components/plotting/PlotPreview";
import { PlotManualPanel } from "@/components/plotting/PlotManualPanel";
import { PlotAiPanel, type PlotAiPanelProps } from "@/components/plotting/ai/PlotAiPanel";
import { SpaceFaceDepthDebugDialog } from "@/components/plotting/space/SpaceFaceDepthDebugDialog";
import { usePlotStore } from "@/lib/plotting/store";
import { buildSpaceFaceDepthReport } from "@/lib/plotting/space/space-face-depth-report";
import type { SpaceFaceDepthReport } from "@/lib/plotting/space/space-face-depth-report";

export function PlotWorkbench({ aiInitial, title, simplified = false, resultReady = false }: { aiInitial?: PlotAiPanelProps; title?: ReactNode; simplified?: boolean; resultReady?: boolean }) {
  const inputMode = usePlotStore((state) => state.inputMode);
  const setInputMode = usePlotStore((state) => state.setInputMode);
  const spaceTab = usePlotStore((state) => state.spaceTab);
  const setSpaceTab = usePlotStore((state) => state.setSpaceTab);
  const resetScene = usePlotStore((state) => state.resetScene);
  const scene = usePlotStore((state) => state.scene);
  const space3d = scene.space3d;

  const [aiSessionKey, setAiSessionKey] = useState(0);
  const [faceDepthOpen, setFaceDepthOpen] = useState(false);
  const [faceDepthReport, setFaceDepthReport] = useState<SpaceFaceDepthReport | null>(null);

  const isAi = inputMode === "ai";
  const canFaceDepthDebug = scene.space === "space" && !!space3d?.figure;

  function handleReset() {
    resetScene();
    if (isAi) setAiSessionKey((key) => key + 1);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>{title}</div>
        {!simplified && <div className="flex items-center gap-2">
          <Tabs value={inputMode} onValueChange={(value) => setInputMode(value as "manual" | "ai")}>
            <TabsList>
              <TabsTrigger value="manual">Ручной ввод</TabsTrigger>
              <TabsTrigger value="ai">ИИ-ввод</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canFaceDepthDebug}
            title={canFaceDepthDebug ? "Снимок глубин граней многогранника" : "Доступно на вкладке «Пространство» с построенным телом"}
            onClick={() => {
              if (!space3d) return;
              setFaceDepthReport(buildSpaceFaceDepthReport(space3d));
              setFaceDepthOpen(true);
            }}
          >
            <Layers className="size-4" />
            Глубины граней
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="size-4" />
            Сбросить
          </Button>
        </div>}
      </header>

      {!isAi && (
        <Tabs value={spaceTab} onValueChange={(value) => setSpaceTab(value as "line" | "plane" | "space")}>
          <TabsList>
            <TabsTrigger value="line">Числовая прямая</TabsTrigger>
            <TabsTrigger value="plane">Координатная плоскость</TabsTrigger>
            <TabsTrigger value="space">Пространство</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
        <div className="min-h-0 space-y-4 overflow-y-auto lg:pr-2">
          {isAi ? <PlotAiPanel key={aiSessionKey} {...aiInitial} simplified={simplified} /> : <PlotManualPanel />}
        </div>
        {(!simplified || !isAi || resultReady) && <div className="min-h-0 overflow-y-auto lg:pl-1">
          <PlotPreview simplified={simplified} />
        </div>}
      </div>
      <SpaceFaceDepthDebugDialog open={faceDepthOpen} onOpenChange={setFaceDepthOpen} report={faceDepthReport} />
    </div>
  );
}
