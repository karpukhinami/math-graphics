import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Markdown } from "@/components/plotting/Markdown";
import { DEFAULT_REPRODUCE_MODEL, DEFAULT_TEXT_MODEL } from "@/lib/ai/models";
import { hasSourceMaterials } from "@/lib/plotting/ai/source-files";
import { analyzePlotMaterial, generatePlotScene } from "@/lib/plotting/ai/pipeline";
import type { PlotAiScenario, PlotAnalysisResult } from "@/lib/plotting/ai/types";
import { usePlotStore } from "@/lib/plotting/store";
import { usePlotSourceState } from "./PlotSourceInput";
import { PlotManualPanel } from "../PlotManualPanel";
import { cn } from "@/lib/utils";
import { SourceImageInput } from "@/components/workspace/SourceImageInput";

export interface PlotAiPanelProps {
  /** Предзаполнение извне (встраивание в редактор заданий). */
  initialText?: string;
  simplified?: boolean;
  textLabel?: string;
  onTextChange?: (text: string) => void;
  onBuiltChange?: (built: boolean) => void;
  onAnalogText?: (text: string) => void;
  initialScenario?: PlotAiScenario;
  initialRefinements?: string;
}

export function PlotAiPanel({ initialText, initialScenario, initialRefinements, simplified = false, textLabel = "Текст задания", onTextChange, onBuiltChange, onAnalogText }: PlotAiPanelProps = {}) {
  const importAiScene = usePlotStore((s) => s.importAiScene);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const isCurrentSession = (version: number) =>
    mounted.current && usePlotStore.getState().sessionVersion === version;

  const source = usePlotSourceState(initialText ?? "");
  const [model, setModel] = useState(initialScenario === "reproduce" ? DEFAULT_REPRODUCE_MODEL : DEFAULT_TEXT_MODEL);
  const [scenario, setScenario] = useState<PlotAiScenario>(initialScenario ?? "task");
  const [analysis, setAnalysis] = useState<PlotAnalysisResult | null>(null);
  const [userRefinements, setUserRefinements] = useState(initialRefinements ?? "");
  const [analogTaskText, setAnalogTaskText] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [sceneBuilt, setSceneBuilt] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { manualText, attachedImages } = source;
  useEffect(() => { onTextChange?.(manualText); }, [manualText, onTextChange]);
  useEffect(() => { onBuiltChange?.(sceneBuilt); }, [sceneBuilt, onBuiltChange]);
  function invalidate() { setAnalysis(null); setSceneBuilt(false); setAnalogTaskText(null); }

  const hasSource =
    hasSourceMaterials(manualText, source.state.uploadedSourceText, attachedImages) ||
    (scenario === "task" && userRefinements.trim().length > 0);

  async function onAnalyze() {
    if (!hasSource) {
      toast.error("Добавьте исходный материал: текст, PDF или изображение");
      return;
    }
    setAnalyzing(true);
    setAnalysis(null);
    setAnalogTaskText(null);
    setSceneBuilt(false);
    setEditOpen(false);
    const version = usePlotStore.getState().sessionVersion;
    try {
      const result = await analyzePlotMaterial({
        model,
        scenario,
        manualText,
        uploadedSourceText: source.state.uploadedSourceText,
        attachedImages,
        userRefinements: scenario === "task" || scenario === "reproduce" ? userRefinements : undefined,
      });
      if (!isCurrentSession(version)) return;
      setAnalysis(result);
      if (!result.canDraw) {
        toast.message("Построение недоступно", {
          description: "Смотрите результат анализа ниже",
        });
      }
    } catch (e) {
      if (!isCurrentSession(version)) return;
      toast.error(e instanceof Error ? e.message : "Ошибка анализа");
    } finally {
      if (isCurrentSession(version)) setAnalyzing(false);
    }
  }

  async function onDraw() {
    if (!analysis?.canDraw || !analysis.sceneType) return;
    setDrawing(true);
    setSceneBuilt(false);
    const version = usePlotStore.getState().sessionVersion;
    try {
      const result = await generatePlotScene({
        model,
        scenario,
        manualText,
        uploadedSourceText: source.state.uploadedSourceText,
        attachedImages,
        analysis,
        userRefinements,
      });
      if (!isCurrentSession(version)) return;
      importAiScene(result.scene);
      setSceneBuilt(true);
      if ("newTaskText" in result && result.newTaskText) {
        setAnalogTaskText(result.newTaskText);
        onAnalogText?.(result.newTaskText);
      }
      toast.success("Чертёж построен");
    } catch (e) {
      if (!isCurrentSession(version)) return;
      toast.error(e instanceof Error ? e.message : "Не удалось построить чертёж");
    } finally {
      if (isCurrentSession(version)) setDrawing(false);
    }
  }

  return (
    <div className="space-y-4">
      {!simplified && <Tabs value={scenario} onValueChange={(value) => {
        if (value !== "task" && value !== "reproduce") return;
        if (value === scenario) return;
        usePlotStore.getState().resetScene();
        onBuiltChange?.(false);
        setScenario(value);
        setModel(value === "reproduce" ? DEFAULT_REPRODUCE_MODEL : DEFAULT_TEXT_MODEL);
        source.setManualText("");
        attachedImages.forEach((_, index) => source.removeImage(attachedImages.length - index - 1));
        setUserRefinements("");
        invalidate();
        setEditOpen(false);
      }}>
        <TabsList className="grid h-auto w-full grid-cols-2">
          <TabsTrigger value="task" disabled={analyzing || drawing} className="whitespace-normal text-center">Нарисовать по заданию</TabsTrigger>
          <TabsTrigger value="reproduce" disabled={analyzing || drawing} className="whitespace-normal text-center">Воспроизвести скриншот</TabsTrigger>
        </TabsList>
      </Tabs>}

      {
        <fieldset disabled={analyzing || drawing} className="space-y-4">
          {scenario === "draw" || scenario === "task" ? <>
            <div className="space-y-2"><Label htmlFor="plot-source-text">{textLabel}</Label>
              <Textarea id="plot-source-text" rows={8} value={manualText} onChange={(e) => { source.setManualText(e.target.value); invalidate(); }} />
            </div>
            <div className="space-y-2"><Label htmlFor="plot-wishes">Дополнительные пожелания</Label>
              <Textarea id="plot-wishes" rows={3} value={userRefinements} onChange={(e) => setUserRefinements(e.target.value)} />
            </div>
          </> : <>
            <SourceImageInput images={attachedImages} onChange={(urls) => { source.removeImage(0); if (urls.length) source.addImages(urls); invalidate(); }} />
            <div className="space-y-2"><Label htmlFor="plot-reproduce-wishes">Уточнения</Label>
              <Textarea id="plot-reproduce-wishes" rows={3} value={userRefinements}
                placeholder="Например: точки A(1; 2) и B(-3; 0); ожидаемая функция y = x^2 - 2x"
                onChange={(e) => setUserRefinements(e.target.value)} />
            </div>
          </>}
        </fieldset>
      }

      <Button
        type="button"
        className="w-full"
        disabled={!hasSource || analyzing || drawing}
        onClick={() => void onAnalyze()}
      >
        {analyzing ? (
          <Loader2 className="size-4 mr-2 animate-spin" />
        ) : (
          <Sparkles className="size-4 mr-2" />
        )}
        Проанализировать
      </Button>

      {analysis && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Результат анализа</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.drawPlan ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Что будет построено</p>
                  {/* Обычный текст, не Markdown: в записи math.js «*» и «^» иначе станут разметкой. */}
                  <pre className="whitespace-pre-wrap font-sans text-sm">{analysis.drawPlan}</pre>
                </div>
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="px-0 text-xs">
                      Ход рассуждений
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <Markdown>{analysis.analysisText}</Markdown>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ) : (
              <Markdown>{analysis.analysisText}</Markdown>
            )}
            {analysis.canDraw && analysis.sceneType && (
              <p className="text-xs text-muted-foreground">
                Тип сцены:{" "}
                {analysis.sceneType === "plane"
                  ? "координатная плоскость"
                  : analysis.sceneType === "space"
                    ? "пространство (многогранник)"
                    : "числовая прямая"}
              </p>
            )}
            {analysis.canDraw && (
              <Button
                type="button"
                className="w-full"
                disabled={drawing}
                onClick={() => void onDraw()}
              >
                {drawing ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Pencil className="size-4 mr-2" />
                )}
                Нарисовать
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {analogTaskText && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Новое задание</CardTitle>
          </CardHeader>
          <CardContent>
            <Markdown>{analogTaskText}</Markdown>
          </CardContent>
        </Card>
      )}

      {sceneBuilt && (
        <Collapsible open={editOpen} onOpenChange={setEditOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-between">
              Редактировать изображение
              <span className={cn("text-xs text-muted-foreground", editOpen && "rotate-180")}>▼</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <PlotManualPanel />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
