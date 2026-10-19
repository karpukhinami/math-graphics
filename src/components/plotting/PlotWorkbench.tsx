/**
 * Полный конструктор чертежей (ручной + ИИ-режим + превью).
 * Используется и на главной странице, и в редакторе заданий — доработки построений общие.
 */
import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlotPreview, type PlotPreviewResultProps } from "@/components/plotting/PlotPreview";
import { PlotManualPanel } from "@/components/plotting/PlotManualPanel";
import { PlotAiPanel, type PlotAiPanelProps } from "@/components/plotting/ai/PlotAiPanel";
import { usePlotStore } from "@/lib/plotting/store";

export function PlotWorkbench({
  aiInitial,
  title,
  simplified = false,
  resultReady = false,
  onBeautifiedImageChange,
  onBeautifyingChange,
}: PlotPreviewResultProps & {
  aiInitial?: PlotAiPanelProps;
  title?: ReactNode;
  simplified?: boolean;
  resultReady?: boolean;
}) {
  const inputMode = usePlotStore((state) => state.inputMode);
  const setInputMode = usePlotStore((state) => state.setInputMode);
  const spaceTab = usePlotStore((state) => state.spaceTab);
  const setSpaceTab = usePlotStore((state) => state.setSpaceTab);
  const resetScene = usePlotStore((state) => state.resetScene);
  const commitInputs = usePlotStore((state) => state.commitInputs);
  const sessionVersion = usePlotStore((state) => state.sessionVersion);

  const [aiSessionKey, setAiSessionKey] = useState(0);
  const [aiResultReady, setAiResultReady] = useState(false);
  const [aiStep, setAiStep] = useState<string | null>(null);

  const isAi = inputMode === "ai";

  function handleReset() {
    resetScene();
    setAiResultReady(false);
    setAiStep(null);
    if (isAi) setAiSessionKey((key) => key + 1);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        {!simplified && (
          <Tabs
            className="w-full lg:w-[calc(50%-0.5rem)]"
            value={inputMode}
            onValueChange={(value) => {
              if (value === inputMode) return;
              setAiResultReady(false);
              setAiStep(null);
              onBeautifiedImageChange?.(null);
              onBeautifyingChange?.(false);
              setInputMode(value as "manual" | "ai");
            }}
          >
            <TabsList className="grid h-12 w-full grid-cols-2 border border-primary/30 bg-primary/10 p-1 text-foreground">
              <TabsTrigger
                value="ai"
                className="h-10 text-base font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                ИИ-построение
              </TabsTrigger>
              <TabsTrigger
                value="manual"
                className="h-10 text-base font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Ручное построение
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {title && <div className="ml-auto">{title}</div>}
      </header>

      {!isAi && (
        <Tabs
          value={spaceTab}
          onValueChange={(value) => setSpaceTab(value as "line" | "plane" | "space" | "chart")}
        >
          <div className="flex flex-wrap items-center gap-3">
            <TabsList>
              <TabsTrigger value="line">Числовая прямая</TabsTrigger>
              <TabsTrigger value="plane">Координатная плоскость</TabsTrigger>
              <TabsTrigger value="space">Пространство</TabsTrigger>
            </TabsList>
            <span aria-hidden className="h-6 w-px bg-border" />
            <TabsList className="border border-dashed border-primary/40 bg-primary/5">
              <TabsTrigger value="chart">Диаграмма</TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      )}

      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
        <div className="min-h-0 space-y-4 overflow-y-auto lg:pr-2" onBlurCapture={commitInputs}>
          {isAi ? (
            <PlotAiPanel
              key={aiSessionKey}
              {...aiInitial}
              simplified={simplified}
              onProgressChange={setAiStep}
              onBuiltChange={(built) => {
                setAiResultReady(built);
                aiInitial?.onBuiltChange?.(built);
              }}
            />
          ) : (
            <PlotManualPanel />
          )}
        </div>
        {isAi && aiStep ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border text-muted-foreground" role="status">
            <Loader2 className="size-10 animate-spin text-primary" />
            <p className="text-base">{aiStep}</p>
          </div>
        ) : (!isAi || (simplified ? resultReady : aiResultReady)) && (
          <div className="min-h-0 overflow-y-auto lg:pl-1">
            <PlotPreview
              key={sessionVersion}
              simplified={simplified}
              onReset={handleReset}
              onBeautifiedImageChange={onBeautifiedImageChange}
              onBeautifyingChange={onBeautifyingChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
