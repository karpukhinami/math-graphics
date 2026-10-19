import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Pencil } from "lucide-react";
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
import { isChartResult, type PlotAiScenario, type PlotAnalysisResult } from "@/lib/plotting/ai/types";
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
  /** Текущий шаг ИИ-построения (null — не идёт); индикатор остаётся на кнопке. */
  onProgressChange?: (step: string | null) => void;
}

export function PlotAiPanel({ initialText, initialScenario, initialRefinements, simplified = false, textLabel = "Текст задания", onTextChange, onBuiltChange, onAnalogText, onProgressChange }: PlotAiPanelProps = {}) {
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
  const [sourceOpen, setSourceOpen] = useState(true);
  const [progress, setProgress] = useState("");
  function reportProgress(step: string | null) {
    setProgress(step ?? "");
    onProgressChange?.(step);
  }

  const { manualText, attachedImages } = source;
  useEffect(() => { onTextChange?.(manualText); }, [manualText, onTextChange]);
  useEffect(() => { onBuiltChange?.(sceneBuilt); }, [sceneBuilt, onBuiltChange]);
  function invalidate() {
    setAnalysis(null);
    setSceneBuilt(false);
    setAnalogTaskText(null);
    setSourceOpen(true);
    setEditOpen(false);
  }

  const hasSource =
    hasSourceMaterials(manualText, source.state.uploadedSourceText, attachedImages) ||
    (scenario === "task" && userRefinements.trim().length > 0);

  async function onRun() {
    if (!hasSource) {
      toast.error("Добавьте исходный материал: текст, PDF или изображение");
      return;
    }
    setAnalyzing(true);
    setAnalysis(null);
    setAnalogTaskText(null);
    setSceneBuilt(false);
    setEditOpen(false);
    setSourceOpen(true);
    const version = usePlotStore.getState().sessionVersion;
    try {
      reportProgress(scenario === "reproduce" ? "Разбираю изображение…" : "Разбираю задание…");
      const result = await analyzePlotMaterial({
        model,
        scenario,
        manualText,
        uploadedSourceText: source.state.uploadedSourceText,
        attachedImages,
        userRefinements: scenario === "task" || scenario === "reproduce" ? userRefinements : undefined,
      });
      if (!isCurrentSession(version)) return;
      if (!result.canDraw || !result.sceneType) {
        // Пользователю показываем только причину, без хода рассуждений.
        setAnalysis(result);
        toast.message("Построение недоступно");
        return;
      }
      setAnalyzing(false);
      setDrawing(true);
      reportProgress(result.sceneType === "chart" ? "Строю диаграмму…" : "Рисую чертёж…");
      const built = await generatePlotScene({
        model,
        scenario,
        manualText,
        uploadedSourceText: source.state.uploadedSourceText,
        attachedImages,
        analysis: result,
        userRefinements,
      });
      if (!isCurrentSession(version)) return;
      if (isChartResult(built)) {
        usePlotStore.getState().setCharts([built.chart]);
      } else {
        importAiScene(built.scene);
      }
      setSceneBuilt(true);
      setSourceOpen(false);
      setEditOpen(true);
      if ("newTaskText" in built && built.newTaskText) {
        setAnalogTaskText(built.newTaskText);
        onAnalogText?.(built.newTaskText);
      }
      toast.success("Чертёж построен");
    } catch (e) {
      if (!isCurrentSession(version)) return;
      toast.error(e instanceof Error ? e.message : "Не удалось построить чертёж");
    } finally {
      if (isCurrentSession(version)) {
        setAnalyzing(false);
        setDrawing(false);
        reportProgress(null);
      }
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

      <Collapsible open={sourceOpen} onOpenChange={setSourceOpen}>
        {sceneBuilt && (
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-between">
              Исходные данные
              <ChevronDown className={cn("size-4", sourceOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
        )}
        <CollapsibleContent className={cn("space-y-4", sceneBuilt && "pt-4")}>
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
        onClick={() => void onRun()}
      >
        {analyzing || drawing ? (
          <Loader2 className="size-4 mr-2 animate-spin" />
        ) : (
          <Pencil className="size-4 mr-2" />
        )}
        {analyzing || drawing ? progress : scenario === "analog" ? "Создать" : "Нарисовать"}
      </Button>

      {analysis && !analysis.canDraw && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Построение недоступно</CardTitle>
          </CardHeader>
          <CardContent>
            <Markdown>{analysis.analysisText}</Markdown>
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
        </CollapsibleContent>
      </Collapsible>

      {sceneBuilt && (
        <Collapsible open={editOpen} onOpenChange={setEditOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-between">
              Редактировать изображение
              <ChevronDown className={cn("size-4", editOpen && "rotate-180")} />
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
