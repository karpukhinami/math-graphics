/** «Аналог по скриншоту»: картинка → шаблон аналога (предпросмотр) → N вариантов → чертежи → готовые задания. */
import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  const [busy, setBusy] = useState<"build" | null>(null);
  const [progress, setProgress] = useState("");

  const isShot = mode === "screenshot";
  async function onBuild() {
    if (isShot ? !images[0] : !wishes.trim()) { toast.error(isShot ? "Вставьте скриншот задания" : "Опишите, какое задание нужно"); return; }
    setBusy("build");
    const store = usePlotStore.getState();
    try {
      setProgress(isShot ? "Разбираю скриншот…" : "Разбираю запрос…");
      const tpl: AnalogTemplate = isShot
        ? await analyzeAnalogTask({ model: DEFAULT_REPRODUCE_MODEL, image: images[0], userRefinements: wishes })
        : await analyzeRequestTask({ model: DEFAULT_REPRODUCE_MODEL, request: wishes });
      setProgress("Придумываю варианты…");
      const variants = await generateAnalogVariants({ model: DEFAULT_REPRODUCE_MODEL, image: isShot ? images[0] : undefined, template: tpl, count, userRefinements: isShot ? wishes : "" });
      setProgress("Строю чертежи…");
      // Сбой одного варианта не должен ронять остальные: оставляем удавшиеся.
      const settled = await Promise.allSettled(variants.map((v) => generateAnalogFigures({ model: DEFAULT_REPRODUCE_MODEL, analysis: v })));
      const okIdx = settled.map((r, i) => (r.status === "fulfilled" ? i : -1)).filter((i) => i >= 0);
      if (!okIdx.length) throw (settled[0] as PromiseRejectedResult).reason;
      const allScenes = okIdx.map((i) => (settled[i] as PromiseFulfilledResult<Awaited<ReturnType<typeof generateAnalogFigures>>>).value);
      const okVariants = okIdx.map((i) => variants[i]);
      setProgress("Собираю задания…");
      // Рендер через общий стор — строго последовательно.
      const results: AnalogTaskResult[] = [];
      for (let i = 0; i < okVariants.length; i++) {
        const v = okVariants[i];
        const rendered: AnalogTaskResult["images"] = {};
        for (const fig of v.figures) {
          if (!(fig.id in allScenes[i])) continue;
          const built = allScenes[i][fig.id];
          if (v.sceneType === "chart") {
            const charts = (built as { charts: StatDecoJson[] }).charts;
            const src = await renderChartsPng(charts);
            if (!src) continue; // фигура без картинки — задание остаётся текстовым
            rendered[fig.id] = { src, charts: structuredClone(charts) };
            continue;
          }
          store.importAiScene(built);
          const scene = usePlotStore.getState().scene;
          const svg = sceneToSvg(scene);
          if (!svg) continue;
          const standalone = await standalonePlotSvg(svg);
          rendered[fig.id] = { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(standalone)}`, scene: structuredClone(scene) };
        }
        results.push({ task: v.task, figures: v.figures, images: rendered });
      }
      store.resetScene();
      onCreate(results);
      toast.success(results.length > 1 ? `Создано заданий: ${results.length}` : "Задание создано");
      if (okVariants.length < variants.length) toast.message(`Не удалось построить вариантов: ${variants.length - okVariants.length}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось построить задание");
    } finally { setBusy(null); setProgress(""); }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!next && (busy !== null || !window.confirm("Закрыть окно? Введённые данные будут потеряны."))) return;
      onOpenChange(next);
    }}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}>
        <DialogTitle>{isShot ? "Аналог по скриншоту" : "Задание с чертежом по запросу"}</DialogTitle>
        <fieldset disabled={busy !== null} className="space-y-4">
          {isShot && <SourceImageInput images={images} onChange={setImages} />}
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
            <Button className="flex-1" onClick={() => void onBuild()} disabled={isShot ? !images[0] : !wishes.trim()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
              {busy && progress ? progress : "Создать"}
            </Button>
          </div>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
}
