/** Меню вставки картинки: файл или чертёж (ИИ / ручной конструктор). Встраиваемая точка входа. */
import { useRef } from "react";
import { ImagePlus, Upload, Wand2, ScanLine, PencilRuler } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type PlotInsertAction = "ai-draw" | "ai-reproduce" | "manual";

export function PlotInsertMenu({
  onFile,
  onPlot,
  size = "sm",
  context = "text",
}: {
  onFile: (dataUrl: string) => void;
  onPlot: (action: PlotInsertAction) => void;
  size?: "sm" | "icon";
  context?: "text" | "task";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => onFile(String(reader.result));
          reader.readAsDataURL(file);
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size={size === "icon" ? "icon" : "sm"} title="Вставить изображение">
            <ImagePlus className="size-4" />
            {size !== "icon" && "Картинка"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Загрузить из файла
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">Чертёж</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => onPlot("ai-draw")}>
            <Wand2 className="size-4" /> {context === "task" ? "Сгенерировать по тексту задания" : "Сгенерировать по тексту"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onPlot("ai-reproduce")}>
            <ScanLine className="size-4" /> Воспроизвести по картинке
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onPlot("manual")}>
            <PencilRuler className="size-4" /> Ручной конструктор
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
