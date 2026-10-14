/** Модалка с общим конструктором чертежей; по «Вставить» отдаёт SVG и снимок сцены. */
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PlotWorkbench } from "@/components/plotting/PlotWorkbench";
import type { PlotAiPanelProps } from "@/components/plotting/ai/PlotAiPanel";
import { usePlotSvg } from "@/lib/plotting/use-plot-svg";
import { usePlotStore } from "@/lib/plotting/store";
import type { PlotScene } from "@/lib/plotting/types";

export interface PlotInsertResult {
  src: string;
  scene: PlotScene;
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
  const svg = usePlotSvg();
  const scene = usePlotStore((s) => s.scene);

  function insert() {
    if (!svg) {
      toast.error("Сначала постройте чертёж");
      return;
    }
    onInsert({
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      scene: structuredClone(scene),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-[95vw] flex-col gap-3 sm:max-w-[95vw]">
        <DialogTitle className="sr-only">Конструктор чертежа</DialogTitle>
        <PlotWorkbench
          key={sessionKey}
          aiInitial={aiInitial}
          title={<h2 className="text-lg font-semibold">Чертёж</h2>}
        />
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={insert}>
            <Check className="size-4" /> Вставить чертёж
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
