/** «Аналог по скриншоту»: картинка → анализ (предпросмотр) → построение сразу в готовое задание. */
import { useState } from "react";
import { Loader2, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Markdown } from "@/components/plotting/Markdown";
import { SourceImageInput } from "@/components/workspace/SourceImageInput";
import { DEFAULT_REPRODUCE_MODEL } from "@/lib/ai/models";
import { analyzeAnalogTask, generateAnalogFigures, type AnalogTaskAnalysis } from "@/lib/plotting/ai/analog-task";
import { usePlotStore } from "@/lib/plotting/store";
import { sceneToSvg } from "@/lib/plotting/use-plot-svg";
import { standalonePlotSvg } from "@/lib/plotting/standalone-svg";
import type { PlotScene } from "@/lib/plotting/types";

export interface AnalogTaskResult {
  task: AnalogTaskAnalysis["task"];
  figures: AnalogTaskAnalysis["figures"];
  images: Record<string, { src: string; scene: PlotScene }>;
}

const markerPreview = (text: string) => text.replace(/\[\[(fig\d+|[a-z0-9_-]+)\]\]/gi, (_m, id: string) => `*[чертёж ${id}]*`);

export function AnalogTaskDialog({ open, onOpenChange, onCreate }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (result: AnalogTaskResult) => void;
}) {
  const [images, setImages] = useState<string[]>([]);
  const [wishes, setWishes] = useState("");
  const [analysis, setAnalysis] = useState<AnalogTaskAnalysis | null>(null);
  const [busy, setBusy] = useState<"analyze" | "build" | null>(null);

  async function onAnalyze() {
    if (!images[0]) { toast.error("Вставьте скриншот задания"); return; }
    setBusy("analyze"); setAnalysis(null);
    try {
      setAnalysis(await analyzeAnalogTask({ model: DEFAULT_REPRODUCE_MODEL, image: images[0], userRefinements: wishes }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка анализа");
    } finally { setBusy(null); }
  }

  async function onBuild() {
    if (!analysis) return;
    setBusy("build");
    const store = usePlotStore.getState();
    try {
      const scenes = await generateAnalogFigures({ model: DEFAULT_REPRODUCE_MODEL, analysis });
      const rendered: AnalogTaskResult["images"] = {};
      for (const fig of analysis.figures) {
        if (!(fig.id in scenes)) continue;
        store.importAiScene(scenes[fig.id]);
        const scene = usePlotStore.getState().scene;
        const svg = sceneToSvg(scene);
        if (!svg) throw new Error(`Чертёж ${fig.id} не построен`);
        const standalone = await standalonePlotSvg(svg);
        rendered[fig.id] = { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(standalone)}`, scene: structuredClone(scene) };
      }
      store.resetScene();
      onCreate({ task: analysis.task, figures: analysis.figures, images: rendered });
      toast.success("Задание создано");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось построить задание");
    } finally { setBusy(null); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogTitle>Аналог по скриншоту</DialogTitle>
        <fieldset disabled={busy !== null} className="space-y-4">
          <SourceImageInput images={images} onChange={(urls) => { setImages(urls); setAnalysis(null); }} />
          <div className="space-y-2">
            <Label htmlFor="analog-wishes">Уточнения</Label>
            <Textarea id="analog-wishes" rows={3} value={wishes} onChange={(e) => setWishes(e.target.value)}
              placeholder="Например: оставить тот же тип функции, поменять только коэффициенты" />
          </div>
          <Button className="w-full" onClick={() => void onAnalyze()} disabled={!images[0]}>
            {busy === "analyze" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Проанализировать
          </Button>
        </fieldset>

        {analysis && (
          <div className="space-y-3 rounded-md border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Новое задание · {analysis.task.type === "choice" ? "выбор ответа" : "ввод ответа"}
              {analysis.figures.length > 0 && ` · чертежей: ${analysis.figures.length}`}
            </p>
            <Markdown>{markerPreview(analysis.task.text)}</Markdown>
            {analysis.task.type === "input" && analysis.task.answer && (
              <p className="text-sm"><span className="text-muted-foreground">Ответ:</span> {analysis.task.answer}</p>
            )}
            {analysis.task.type === "choice" && (
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {analysis.task.options.map((o, i) => (
                  <li key={i} className={o.correct ? "font-medium" : undefined}>
                    {o.text || "—"}{o.figure && <span className="text-muted-foreground"> [чертёж {o.figure}]</span>}{o.correct && " ✓"}
                  </li>
                ))}
              </ol>
            )}
            {!analysis.canDraw && analysis.figures.length > 0 && (
              <p className="text-sm text-destructive">Чертежи построить инструментом нельзя — будет создан только текст.</p>
            )}
            <Collapsible>
              <CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="px-0 text-xs">Подробности анализа</Button></CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2 text-sm">
                {analysis.originalText && <><p className="text-xs font-medium text-muted-foreground">Исходное задание</p><Markdown>{markerPreview(analysis.originalText)}</Markdown></>}
                {analysis.figures.map((f) => (
                  <div key={f.id}>
                    <p className="text-xs font-medium text-muted-foreground">Чертёж {f.id} ({f.placement === "option" ? "в варианте ответа" : "в тексте"})</p>
                    <pre className="whitespace-pre-wrap font-sans text-sm">{f.drawPlan}</pre>
                  </div>
                ))}
                {analysis.reasoning && <Markdown>{analysis.reasoning}</Markdown>}
              </CollapsibleContent>
            </Collapsible>
            <Button className="w-full" onClick={() => void onBuild()} disabled={busy !== null}>
              {busy === "build" ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />} Построить задание
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
