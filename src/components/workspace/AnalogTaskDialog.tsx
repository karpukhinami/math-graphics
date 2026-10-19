/** «Аналог по скриншоту»: картинка → шаблон аналога (предпросмотр) → N вариантов → чертежи → готовые задания. */
import { useState } from "react";
import { Loader2, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Markdown } from "@/components/plotting/Markdown";
import { SourceImageInput } from "@/components/workspace/SourceImageInput";
import { DEFAULT_REPRODUCE_MODEL } from "@/lib/ai/models";
import {
  analyzeAnalogTask, analyzeRequestTask, generateAnalogFigures, generateAnalogVariants, MAX_ANALOG_COUNT,
  type AnalogTaskAnalysis, type AnalogTemplate,
} from "@/lib/plotting/ai/analog-task";
import { usePlotStore } from "@/lib/plotting/store";
import { sceneToSvg } from "@/lib/plotting/use-plot-svg";
import { standalonePlotSvg } from "@/lib/plotting/standalone-svg";
import type { WorkspacePlotImage } from "@/lib/workspace/plot-insertion";
import { renderChartsPng, type StatDecoJson } from "@/lib/plotting/chart";

export interface AnalogTaskResult {
  task: AnalogTaskAnalysis["task"];
  figures: AnalogTaskAnalysis["figures"];
  images: Record<string, WorkspacePlotImage>;
}

const markerPreview = (text: string) => text.replace(/\[\[(fig\d+|[a-z0-9_-]+)\]\]/gi, (_m, id: string) => `*[чертёж ${id}]*`);

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="list-disc space-y-0.5 pl-5 text-sm">{items.map((x, i) => <li key={i}><Markdown>{x}</Markdown></li>)}</ul>
    </div>
  );
}

export function AnalogTaskDialog({ open, onOpenChange, onCreate, mode = "screenshot" }: {
  open: boolean;
  /** "screenshot" — аналог по скриншоту; "request" — задание по свободному запросу. */
  mode?: "screenshot" | "request";
  onOpenChange: (open: boolean) => void;
  onCreate: (results: AnalogTaskResult[]) => void;
}) {
  const [images, setImages] = useState<string[]>([]);
  const [wishes, setWishes] = useState("");
  const [count, setCount] = useState(1);
  const [tpl, setTpl] = useState<AnalogTemplate | null>(null);
  const [busy, setBusy] = useState<"analyze" | "build" | null>(null);
  const [progress, setProgress] = useState("");

  const isShot = mode === "screenshot";
  async function onAnalyze() {
    if (isShot ? !images[0] : !wishes.trim()) { toast.error(isShot ? "Вставьте скриншот задания" : "Опишите, какое задание нужно"); return; }
    setBusy("analyze"); setTpl(null);
    try {
      setTpl(isShot
        ? await analyzeAnalogTask({ model: DEFAULT_REPRODUCE_MODEL, image: images[0], userRefinements: wishes })
        : await analyzeRequestTask({ model: DEFAULT_REPRODUCE_MODEL, request: wishes }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка анализа");
    } finally { setBusy(null); }
  }

  async function onBuild() {
    if (!tpl || (isShot && !images[0])) return;
    setBusy("build");
    const store = usePlotStore.getState();
    try {
      setProgress("Придумываю варианты…");
      const variants = await generateAnalogVariants({ model: DEFAULT_REPRODUCE_MODEL, image: isShot ? images[0] : undefined, template: tpl, count, userRefinements: isShot ? wishes : "" });
      setProgress("Строю чертежи…");
      const allScenes = await Promise.all(variants.map((v) => generateAnalogFigures({ model: DEFAULT_REPRODUCE_MODEL, analysis: v })));
      // Рендер через общий стор — строго последовательно.
      const results: AnalogTaskResult[] = [];
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const rendered: AnalogTaskResult["images"] = {};
        for (const fig of v.figures) {
          if (!(fig.id in allScenes[i])) continue;
          const built = allScenes[i][fig.id];
          if (v.sceneType === "chart") {
            const charts = (built as { charts: StatDecoJson[] }).charts;
            const src = await renderChartsPng(charts);
            if (!src) throw new Error(`Вариант ${i + 1}: диаграмма ${fig.id} не построена`);
            rendered[fig.id] = { src, charts: structuredClone(charts) };
            continue;
          }
          store.importAiScene(built);
          const scene = usePlotStore.getState().scene;
          const svg = sceneToSvg(scene);
          if (!svg) throw new Error(`Вариант ${i + 1}: чертёж ${fig.id} не построен`);
          const standalone = await standalonePlotSvg(svg);
          rendered[fig.id] = { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(standalone)}`, scene: structuredClone(scene) };
        }
        results.push({ task: v.task, figures: v.figures, images: rendered });
      }
      store.resetScene();
      onCreate(results);
      toast.success(results.length > 1 ? `Создано заданий: ${results.length}` : "Задание создано");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось построить задание");
    } finally { setBusy(null); setProgress(""); }
  }

  const t = tpl?.template;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{isShot ? "Аналог по скриншоту" : "Задание с чертежом по запросу"}</DialogTitle>
        <fieldset disabled={busy !== null} className="space-y-4">
          {isShot && <SourceImageInput images={images} onChange={(urls) => { setImages(urls); setTpl(null); }} />}
          <div className="space-y-2">
            <Label htmlFor="analog-wishes">{isShot ? "Уточнения" : "Какое задание нужно"}</Label>
            <Textarea id="analog-wishes" rows={isShot ? 3 : 5} value={wishes} onChange={(e) => setWishes(e.target.value)}
              placeholder={isShot
                ? "Например: оставить тот же тип функции, поменять только коэффициенты"
                : "Например: 9 класс, по графику параболы найти координаты вершины, ответ вводом"} />
          </div>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="analog-count">Сколько заданий</Label>
              <Input id="analog-count" type="number" min={1} max={MAX_ANALOG_COUNT} className="w-24" value={count}
                onChange={(e) => setCount(Math.min(MAX_ANALOG_COUNT, Math.max(1, Number(e.target.value) || 1)))} />
            </div>
            <Button className="flex-1" onClick={() => void onAnalyze()} disabled={isShot ? !images[0] : !wishes.trim()}>
              {busy === "analyze" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Проанализировать
            </Button>
          </div>
        </fieldset>

        {tpl && t && (
          <div className="space-y-3 rounded-md border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">
              {isShot ? "Шаблон аналога" : "Шаблон задания"} · {t.type === "choice" ? `выбор ответа (${t.optionCount})` : "ввод ответа"}
              {tpl.figures.length > 0 && ` · чертежей: ${tpl.figures.length}`}
            </p>
            <Markdown>{markerPreview(t.pattern)}</Markdown>
            <List title="Сохраняется" items={t.mustPreserve} />
            <List title="Меняется" items={t.mayChange} />
            {!tpl.canDraw && tpl.figures.length > 0 && (
              <p className="text-sm text-destructive">Чертежи построить инструментом нельзя — будет создан только текст.</p>
            )}
            <Collapsible>
              <CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="px-0 text-xs">Подробности анализа</Button></CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2 text-sm">
                {tpl.originalText && <><p className="text-xs font-medium text-muted-foreground">{isShot ? "Исходное задание" : "Образец задания"}</p><Markdown>{markerPreview(tpl.originalText)}</Markdown></>}
                {t.answerRule && <><p className="text-xs font-medium text-muted-foreground">Как получается ответ</p><Markdown>{t.answerRule}</Markdown></>}
                {t.visibility && <><p className="text-xs font-medium text-muted-foreground">Что видно на чертежах</p><pre className="whitespace-pre-wrap font-sans text-sm">{t.visibility}</pre></>}
                {tpl.figures.map((f) => (
                  <p key={f.id}><span className="text-muted-foreground">Чертёж {f.id} ({f.placement === "option" ? `в варианте №${(f.optionIndex ?? 0) + 1}` : "в тексте"}):</span> {f.role}</p>
                ))}
                {tpl.reasoning && <Markdown>{tpl.reasoning}</Markdown>}
              </CollapsibleContent>
            </Collapsible>
            <Button className="w-full" onClick={() => void onBuild()} disabled={busy !== null}>
              {busy === "build" ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
              {busy === "build" && progress ? progress : count > 1 ? `Построить задания (${count})` : "Построить задание"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
