import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Bold, Eye, Italic, Pencil, Plus, Copy, FileText, ListChecks, TextCursorInput, Send, Sigma, Trash2, X, Rows3, Columns3, Grid2X2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { allAnswersAreImages, answerColumnCount, type AnswerLayout } from "@/lib/workspace/answer-layout";
import { PlotInsertMenu, type PlotInsertAction } from "@/components/workspace/PlotInsertMenu";
import { PlotEditorDialog, type PlotInsertResult } from "@/components/workspace/PlotEditorDialog";
import type { PlotAiPanelProps } from "@/components/plotting/ai/PlotAiPanel";
import { usePlotStore } from "@/lib/plotting/store";
import type { PlotScene } from "@/lib/plotting/types";
import { previousParagraph, withoutPlotImages } from "@/lib/workspace/plot-context";
import { AnalogTaskDialog, type AnalogTaskResult } from "@/components/workspace/AnalogTaskDialog";
import { buildAnalogBlock } from "@/lib/workspace/analog-block";

export const Route = createFileRoute("/workspace")({
  head: () => ({
    meta: [
      { title: "Редактор заданий с чертежами — Plotting" },
      { name: "description", content: "Создание учебных заданий по математике с чертежами: вручную или с помощью ИИ." },
      { property: "og:title", content: "Редактор заданий с чертежами — Plotting" },
      { property: "og:description", content: "Текст, вопросы и варианты ответов с вставкой чертежей из конструктора." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkspacePage,
});

type BlockType = "text" | "input" | "choice";
interface ChoiceOption { id: string; text: string; correct: boolean; imageId?: string }
interface Block { id: string; type: BlockType; text: string; answer: string; options: ChoiceOption[]; answerLayout?: AnswerLayout }
interface TaskImage { src: string; scene?: PlotScene }
interface PlotTarget { blockId: string; optionId?: string; imageId?: string; position?: number; syncText?: boolean; newTask?: boolean }

const uid = () => Math.random().toString(36).slice(2, 9);
const IMG_RE = /!\[[^\]]*\]\(plot:([a-z0-9]+)\)/g;

function newBlock(type: BlockType): Block {
  return {
    id: uid(),
    type,
    text: "",
    answer: "",
    options: type === "choice" ? [1, 2, 3, 4].map(() => ({ id: uid(), text: "", correct: false })) : [],
  };
}

function RichView({ text, images }: { text: string; images: Record<string, TaskImage> }) {
  return (
    <div className="markdown-body min-w-0 text-sm leading-relaxed [&_img]:my-2 [&_img]:block [&_img]:h-auto [&_img]:w-full [&_img]:rounded-md [&_img]:border [&_img]:border-border">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        urlTransform={(url) => url}
        components={{
          img: ({ src, alt }) => {
            const s = typeof src === "string" ? src : "";
            const real = s.startsWith("plot:") ? images[s.slice(5)]?.src : s;
            return real ? <img src={real} alt={alt ?? "Чертёж"} /> : null;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function WorkspacePage() {
  const resetScene = usePlotStore((s) => s.resetScene);
  const importScene = usePlotStore((s) => s.importScene);
  const setInputMode = usePlotStore((s) => s.setInputMode);

  const [title, setTitle] = useState("Новое задание");
  const [blocks, setBlocks] = useState<Block[]>([newBlock("text")]);
  const [images, setImages] = useState<Record<string, TaskImage>>({});
  const [preview, setPreview] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [aiInitial, setAiInitial] = useState<PlotAiPanelProps | undefined>();
  const [target, setTarget] = useState<PlotTarget | null>(null);
  const [analogOpen, setAnalogOpen] = useState(false);
  const [analogKey, setAnalogKey] = useState(0);
  const [analogMode, setAnalogMode] = useState<"screenshot" | "request">("screenshot");

  function onAnalogCreate(results: AnalogTaskResult[]) {
    const newImages: Record<string, AnalogTaskResult["images"][string]> = {};
    const newBlocks: Block[] = results.map((r) => {
      const ids: Record<string, string> = {};
      const imageIdOf = (fig: string) => (ids[fig] ??= uid());
      const built = new Set(Object.keys(r.images));
      const b = buildAnalogBlock({ task: r.task, figures: r.figures, built, imageIdOf });
      const block: Block = { ...newBlock(b.type), text: b.text, answer: b.answer };
      if (b.type === "choice") block.options = b.options.map((o) => ({ id: uid(), ...o }));
      if (b.options.length && b.options.every((o) => o.imageId)) block.answerLayout = b.options.length === 4 ? "grid" : "horizontal";
      for (const [fig, img] of Object.entries(r.images)) newImages[imageIdOf(fig)] = img;
      return block;
    });
    setImages((m) => ({ ...m, ...newImages }));
    setBlocks((bs) => [...bs, ...newBlocks]);
  }
  const textRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const patch = (id: string, p: Partial<Block>) =>
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...p } : b)));
  const patchOption = (blockId: string, optId: string, p: Partial<ChoiceOption>) =>
    setBlocks((bs) =>
      bs.map((b) => (b.id === blockId ? { ...b, options: b.options.map((o) => (o.id === optId ? { ...o, ...p } : o)) } : b)),
    );

  function insertToken(blockId: string, imageId: string, position?: number) {
    const el = textRefs.current[blockId];
    setBlocks((bs) =>
      bs.map((b) => {
        if (b.id !== blockId) return b;
        const pos = position ?? el?.selectionStart ?? b.text.length;
        const token = `\n![Чертёж](plot:${imageId})\n`;
        return { ...b, text: b.text.slice(0, pos) + token + b.text.slice(pos) };
      }),
    );
  }

  function placeImage(t: PlotTarget, img: TaskImage) {
    const id = t.imageId ?? uid();
    setImages((m) => ({ ...m, [id]: img }));
    if (t.imageId) return;
    if (t.optionId) patchOption(t.blockId, t.optionId, { imageId: id });
    else insertToken(t.blockId, id, t.position);
  }

  function wrapSelection(blockId: string, left: string, right = left) {
    const el = textRefs.current[blockId];
    const b = blocks.find((x) => x.id === blockId);
    if (!el || !b) return;
    const { selectionStart: s, selectionEnd: e } = el;
    patch(blockId, { text: b.text.slice(0, s) + left + b.text.slice(s, e) + right + b.text.slice(e) });
  }

  function openPlot(t: PlotTarget, action: PlotInsertAction | "ai-analog", existing?: PlotScene) {
    const block = blocks.find((b) => b.id === t.blockId);
    const position = textRefs.current[t.blockId]?.selectionStart ?? block?.text.length ?? 0;
    const isTask = block?.type !== "text";
    const taskText = isTask ? withoutPlotImages(block?.text ?? "").trim() : previousParagraph(block?.text ?? "", position);
    if (existing) {
      importScene(existing);
      setInputMode("manual");
      setAiInitial(undefined);
    } else {
      resetScene();
      setInputMode(action === "manual" ? "manual" : "ai");
      setAiInitial(
        action === "ai-draw"
          ? { initialScenario: "task", initialText: taskText, textLabel: isTask ? "Текст задания" : "Текст" }
          : action === "ai-reproduce"
            ? { initialScenario: "reproduce" }
            : action === "ai-analog" ? { initialScenario: "analog" } : undefined,
      );
    }
    setTarget({ ...t, position, syncText: isTask && action === "ai-draw" });
    setSessionKey((k) => k + 1);
    setDialogOpen(true);
  }

  function onInsert(r: PlotInsertResult) {
    if (!target) return;
    if (target.newTask) {
      const block = newBlock("input");
      const imageId = uid();
      block.text = `${r.newTaskText ?? ""}\n![Чертёж](plot:${imageId})\n`;
      setImages((m) => ({ ...m, [imageId]: { src: r.src, scene: r.scene } }));
      setBlocks((bs) => [...bs, block]);
      return;
    }
    if (target.syncText && r.text !== undefined) {
      // Сохраняем уже вставленные изображения, меняем только текст вопроса.
      setBlocks((bs) => bs.map((b) => {
        if (b.id !== target.blockId) return b;
        const tokens = b.text.match(IMG_RE) ?? [];
        return { ...b, text: [r.text, ...tokens].join("\n") };
      }));
      placeImage({ ...target, position: Number.MAX_SAFE_INTEGER }, { src: r.src, scene: r.scene });
    } else placeImage(target, { src: r.src, scene: r.scene });
  }

  function imagesOf(text: string) {
    return [...text.matchAll(IMG_RE)].map((m) => m[1]).filter((id) => images[id]);
  }

  function ImageThumb({ blockId, imageId, onRemove }: { blockId: string; imageId: string; onRemove: () => void }) {
    const img = images[imageId];
    if (!img) return null;
    return (
      <div className="group relative w-full min-w-0 rounded-md border border-border bg-card p-1">
        <img src={img.src} alt="Чертёж" className="block h-auto w-full" />
        <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
          {img.scene && (
            <Button size="icon" variant="secondary" className="size-7" title="Редактировать чертёж"
              onClick={() => openPlot({ blockId, imageId }, "manual", img.scene)}>
              <Pencil className="size-3.5" />
            </Button>
          )}
          <Button size="icon" variant="secondary" className="size-7" title="Удалить" onClick={onRemove}>
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/30">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background px-4 py-3 sm:flex sm:justify-between">
        <div className="min-w-0 truncate text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Конструктор графиков</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{title || "Без названия"}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant={preview ? "default" : "outline"} size="sm" onClick={() => setPreview((p) => !p)}>
            <Eye className="size-4" /> {preview ? "Редактировать" : "Предпросмотр"}
          </Button>
          <Button size="sm" onClick={() => toast.success("Задание выдано (демо)")}>
            <Send className="size-4" /> Выдать
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-y-auto">
        {!preview && <aside aria-label="Добавить блок" className="sticky top-0 h-fit w-44 shrink-0 space-y-2 border-r border-border p-3 lg:w-56">
          <Button variant="ghost" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => setBlocks((bs) => [...bs, newBlock("text")])}><FileText className="size-4 shrink-0" /> Текст</Button>
          <Button variant="ghost" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => setBlocks((bs) => [...bs, newBlock("input")])}><TextCursorInput className="size-4 shrink-0" /> Вопрос с вводом</Button>
          <Button variant="ghost" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => setBlocks((bs) => [...bs, newBlock("choice")])}><ListChecks className="size-4 shrink-0" /> Вопрос с вариантами</Button>
          <Button variant="ghost" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => { setAnalogMode("screenshot"); setAnalogKey((k) => k + 1); setAnalogOpen(true); }}><Copy className="size-4 shrink-0" /> Аналог по скриншоту</Button>
          <Button variant="ghost" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => { setAnalogMode("request"); setAnalogKey((k) => k + 1); setAnalogOpen(true); }}><Sparkles className="size-4 shrink-0" /> Задание с чертежом по запросу</Button>
        </aside>}
      <main className="mx-auto min-w-0 w-full max-w-3xl flex-1 space-y-4 p-4 lg:p-6">
        {preview ? (
          <h1 className="text-2xl font-semibold">{title}</h1>
        ) : (
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg font-semibold" />
        )}

        {blocks.map((block, index) => (
          <Card key={block.id}>
            <CardContent className="space-y-3 p-4">
              {preview ? (
                <>
                  <RichView text={block.text} images={images} />
                  {block.type === "input" && <Input placeholder="Ваш ответ" />}
                  {block.type === "choice" && (
                    <div className="workspace-answer-grid grid gap-2" style={{ "--answer-columns": answerColumnCount(block.answerLayout ?? "vertical", block.options.length) } as React.CSSProperties}>
                      {block.options.map((o) => (
                        <label key={o.id} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] cursor-pointer items-start gap-2 rounded-md border border-border p-2">
                          <Checkbox className="mt-1 shrink-0" aria-label={`Выбрать вариант ${block.options.indexOf(o) + 1}`} />
                          <div className="min-w-0 space-y-1">
                            <RichView text={o.text} images={images} />
                            {o.imageId && images[o.imageId] && (
                              <img src={images[o.imageId].src} alt="Вариант" className="block h-auto w-full rounded border border-border" />
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      {index + 1}. {block.type === "text" ? "Текст" : block.type === "input" ? "Вопрос с вводом ответа" : "Вопрос с выбором ответа"}
                    </span>
                    <Button size="icon" variant="ghost" className="size-7" title="Удалить блок"
                      onClick={() => setBlocks((bs) => bs.filter((b) => b.id !== block.id))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1 rounded-md border border-border bg-muted/40 p-1">
                    <Button size="icon" variant="ghost" className="size-8" title="Жирный" onClick={() => wrapSelection(block.id, "**")}>
                      <Bold className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-8" title="Курсив" onClick={() => wrapSelection(block.id, "*")}>
                      <Italic className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-8" title="Формула" onClick={() => wrapSelection(block.id, "$")}>
                      <Sigma className="size-4" />
                    </Button>
                    <PlotInsertMenu context={block.type === "text" ? "text" : "task"}
                      onFile={(src) => placeImage({ blockId: block.id }, { src })}
                      onPlot={(a) => openPlot({ blockId: block.id }, a)}
                    />
                  </div>
                  <Textarea
                    ref={(el) => { textRefs.current[block.id] = el; }}
                    value={block.text}
                    onChange={(e) => patch(block.id, { text: e.target.value })}
                    placeholder={block.type === "text" ? "Текст. Формулы — в $...$" : "Текст вопроса. Формулы — в $...$"}
                    className="min-h-28 font-mono text-sm"
                  />
                  {imagesOf(block.text).length > 0 && (
                    <div className="space-y-2">
                      {imagesOf(block.text).map((id) => (
                        <ImageThumb key={id} blockId={block.id} imageId={id}
                          onRemove={() => patch(block.id, { text: block.text.replace(new RegExp(`\\n?!\\[[^\\]]*\\]\\(plot:${id}\\)\\n?`, "g"), "") })} />
                      ))}
                    </div>
                  )}
                  {block.type === "input" && (
                    <Input value={block.answer} onChange={(e) => patch(block.id, { answer: e.target.value })} placeholder="Правильный ответ" />
                  )}
                  {block.type === "choice" && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                        <span className="min-w-0 text-sm text-muted-foreground">Раскладка ответов</span>
                          <ToggleGroup type="single" variant="outline" size="sm" value={block.answerLayout ?? "vertical"}
                            onValueChange={(value) => { if (value === "vertical" || value === "horizontal" || value === "grid") patch(block.id, { answerLayout: value }); }}>
                            <ToggleGroupItem value="vertical" title="Все вниз подряд" aria-label="Все вниз подряд"><Rows3 className="size-4" /></ToggleGroupItem>
                            <ToggleGroupItem value="horizontal" title="Все по горизонтали" aria-label="Все по горизонтали"><Columns3 className="size-4" /></ToggleGroupItem>
                            <ToggleGroupItem value="grid" title="Раскладка 2×2" aria-label="Раскладка 2×2"><Grid2X2 className="size-4" /></ToggleGroupItem>
                          </ToggleGroup>
                      </div>
                      <div className="workspace-answer-grid grid gap-2" style={{ "--answer-columns": answerColumnCount(block.answerLayout ?? "vertical", block.options.length) } as React.CSSProperties}>
                      {block.options.map((o, i) => (
                        <div key={o.id} className="min-w-0 space-y-2 rounded-md border border-border p-2">
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                            <Checkbox checked={o.correct} title="Верный вариант" className="shrink-0"
                              onCheckedChange={(v) => patchOption(block.id, o.id, { correct: v === true })} />
                            <Input value={o.text} onChange={(e) => patchOption(block.id, o.id, { text: e.target.value })}
                              placeholder={`Вариант ${i + 1}`} className="min-w-0" />
                            </div>
                            <div className="flex shrink-0 items-center">
                            <PlotInsertMenu size="icon" context="task"
                              onFile={(src) => placeImage({ blockId: block.id, optionId: o.id }, { src })}
                              onPlot={(a) => openPlot({ blockId: block.id, optionId: o.id }, a)} />
                            <Button size="icon" variant="ghost" title="Удалить вариант"
                              onClick={() => patch(block.id, { options: block.options.filter((x) => x.id !== o.id) })}>
                              <X className="size-4" />
                            </Button>
                            </div>
                          </div>
                          {o.imageId && (
                            <ImageThumb blockId={block.id} imageId={o.imageId}
                              onRemove={() => patchOption(block.id, o.id, { imageId: undefined })} />
                          )}
                        </div>
                      ))}
                      </div>
                      <Button variant="outline" size="sm"
                        onClick={() => patch(block.id, { options: [...block.options, { id: uid(), text: "", correct: false }] })}>
                        <Plus className="size-4" /> Вариант
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}

      </main>
      </div>

      <PlotEditorDialog key={sessionKey} open={dialogOpen} onOpenChange={setDialogOpen} aiInitial={aiInitial}
        sessionKey={sessionKey} onInsert={onInsert} />
      <AnalogTaskDialog key={analogKey} mode={analogMode} open={analogOpen} onOpenChange={setAnalogOpen} onCreate={onAnalogCreate} />
    </div>
  );
}
