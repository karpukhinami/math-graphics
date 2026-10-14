/** Модалка с общим конструктором чертежей; по «Вставить» отдаёт SVG и снимок сцены. */
import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PlotWorkbench } from "@/components/plotting/PlotWorkbench";
import type { PlotAiPanelProps } from "@/components/plotting/ai/PlotAiPanel";
import { usePlotSvg } from "@/lib/plotting/use-plot-svg";
import { usePlotStore } from "@/lib/plotting/store";
import type { PlotScene } from "@/lib/plotting/types";
import { standalonePlotSvg } from "@/lib/plotting/standalone-svg";

export interface PlotInsertResult {
  src: string;
  scene: PlotScene;
  text?: string;
  newTaskText?: string;
}

export function PlotEditorDialog({
  open,
  onOpenChange,
  aiInitial,
  sessionKey,
  onInsert,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aiInitial?: PlotAiPanelProps;
  sessionKey: number;
  onInsert: (result: PlotInsertResult) => void;
}) {
  const [resultReady, setResultReady] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [text, setText] = useState(aiInitial?.initialText ?? "");
  const [newTaskText, setNewTaskText] = useState<string>();
  const isAi = usePlotStore((s) => s.inputMode === "ai");
  const svg = usePlotSvg();
  const scene = usePlotStore((s) => s.scene);

  async function insert() {
    if (!svg || (isAi && !resultReady)) {
      toast.error("Сначала постройте чертёж");
      return;
    }
    setInserting(true);
    try {
    const standalone = await standalonePlotSvg(svg);
    onInsert({
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(standalone)}`,
      scene: structuredClone(scene),
      text: aiInitial?.initialScenario === "task" ? text : undefined,
      newTaskText,
    });
    onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось вставить чертёж");
    } finally {
      setInserting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-[95vw] flex-col gap-3 sm:max-w-[95vw]">
        <DialogTitle className="sr-only">Конструктор чертежа</DialogTitle>
        <PlotWorkbench
          key={sessionKey}
          simplified
          resultReady={resultReady}
          aiInitial={{ ...aiInitial, onBuiltChange: setResultReady, onTextChange: setText, onAnalogText: setNewTaskText }}
          title={<h2 className="text-lg font-semibold">Чертёж</h2>}
        />
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={insert} disabled={inserting || !svg || (isAi && !resultReady)}>
            <Check className="size-4" /> {inserting ? "Подготовка…" : "Вставить чертёж"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
