/**
 * Полный конструктор чертежей (ручной + ИИ-режим + превью).
 * Используется и на главной странице, и в редакторе заданий — доработки построений общие.
 */
import { useState, type ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlotPreview, type PlotPreviewResultProps } from "@/components/plotting/PlotPreview";
import { PlotManualPanel } from "@/components/plotting/PlotManualPanel";
import { PlotAiPanel, type PlotAiPanelProps } from "@/components/plotting/ai/PlotAiPanel";
import { usePlotStore } from "@/lib/plotting/store";

export function PlotWorkbench({ aiInitial, title, simplified = false, resultReady = false, onBeautifiedImageChange, onBeautifyingChange }: PlotPreviewResultProps & { aiInitial?: PlotAiPanelProps; title?: ReactNode; simplified?: boolean; resultReady?: boolean }) {
  const inputMode = usePlotStore((state) => state.inputMode);
  const setInputMode = usePlotStore((state) => state.setInputMode);
  const spaceTab = usePlotStore((state) => state.spaceTab);
  const setSpaceTab = usePlotStore((state) => state.setSpaceTab);
  const resetScene = usePlotStore((state) => state.resetScene);
  const scene = usePlotStore((state) => state.scene);

  const [aiSessionKey, setAiSessionKey] = useState(0);
  const [aiResultReady, setAiResultReady] = useState(false);

  const isAi = inputMode === "ai";

  function handleReset() {
    resetScene();
    setAiResultReady(false);
    if (isAi) setAiSessionKey((key) => key + 1);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        {!simplified && <div className="flex items-center gap-2">
          <Tabs value={inputMode} onValueChange={(value) => setInputMode(value as "manual" | "ai")}>
            <TabsList className="h-11 border border-primary/30 bg-primary/10 p-1 text-foreground">
              <TabsTrigger value="manual" className="h-9 gap-2 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Ручной ввод</TabsTrigger>
              <TabsTrigger value="ai" className="h-9 gap-2 px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">ИИ-ввод</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>}
        {title && <div className="ml-auto">{title}</div>}
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
          {isAi ? <PlotAiPanel key={aiSessionKey} {...aiInitial} simplified={simplified}
            onBuiltChange={(built) => { setAiResultReady(built); aiInitial?.onBuiltChange?.(built); }} /> : <PlotManualPanel />}
        </div>
        {(!isAi || (simplified ? resultReady : aiResultReady)) && <div className="min-h-0 overflow-y-auto lg:pl-1">
          <PlotPreview simplified={simplified} onReset={handleReset} onBeautifiedImageChange={onBeautifiedImageChange} onBeautifyingChange={onBeautifyingChange} />
        </div>}
      </div>
    </div>
  );
}
