import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, FileJson, RotateCcw, Sparkles, Upload } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePlotStore } from "@/lib/plotting/store";
import { sceneToSvg, usePlotSvg } from "@/lib/plotting/use-plot-svg";
import { generatePlotBeautifiedImage } from "@/lib/plotting/beautify";
import { downloadImageSrc, downloadPng, downloadSceneJson, downloadSvg, readSceneJson } from "@/lib/plotting/export";
import { PlotBeautifyDialog } from "@/components/plotting/PlotBeautifyDialog";
import { toast } from "sonner";

export interface PlotPreviewResultProps {
  onBeautifiedImageChange?: (src: string | null) => void;
  onBeautifyingChange?: (busy: boolean) => void;
}

export function PlotPreview({
  simplified = false,
  onReset,
  onBeautifiedImageChange,
  onBeautifyingChange,
}: PlotPreviewResultProps & { simplified?: boolean; onReset?: () => void }) {
  const scene = usePlotStore((state) => state.scene);
  const status = usePlotStore((state) => state.status);
  const importScene = usePlotStore((state) => state.importScene);
  const fileRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const previewRef = useRef<HTMLDivElement>(null);

  const spaceTab = usePlotStore((state) => state.spaceTab);

  const [beautifyOpen, setBeautifyOpen] = useState(false);
  const [beautifying, setBeautifying] = useState(false);
  const [beautifiedResult, setBeautifiedResult] = useState<{ src: string; svg: string } | null>(null);

  const svg = usePlotSvg();
  // Temporary point drafts are not changes to the inserted construction.
  const committedSvg = useMemo(() => sceneToSvg(scene), [scene]);
  const svgRef = useRef(committedSvg);
  svgRef.current = committedSvg;
  const beautifiedImage = beautifiedResult?.svg === committedSvg ? beautifiedResult.src : null;

  useEffect(() => {
    onBeautifiedImageChange?.(beautifiedImage);
  }, [beautifiedImage, onBeautifiedImageChange]);

  useEffect(() => {
    onBeautifyingChange?.(beautifying);
  }, [beautifying, onBeautifyingChange]);

  async function onBeautifyDraw(wishes: string) {
    const container = previewRef.current;
    if (!container || !svg || !committedSvg) {
      toast.error("Сначала постройте чертёж");
      return;
    }
    setBeautifying(true);
    const version = usePlotStore.getState().sessionVersion;
    try {
      const dataUrl = await generatePlotBeautifiedImage({
        previewEl: container,
        userWishes: wishes,
      });
      if (!mounted.current || usePlotStore.getState().sessionVersion !== version || svgRef.current !== committedSvg)
        return;
      setBeautifiedResult({ src: dataUrl, svg: committedSvg });
      onBeautifiedImageChange?.(dataUrl);
      setBeautifyOpen(false);
      toast.success("Дорисованная версия готова");
    } catch (error) {
      if (!mounted.current || usePlotStore.getState().sessionVersion !== version) return;
      toast.error(error instanceof Error ? error.message : "Не удалось дорисовать чертёж");
    } finally {
      if (mounted.current) setBeautifying(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-3">
        {!simplified && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={!svg} onClick={() => svg && downloadSvg(svg)}>
              <Download className="size-4" />
              SVG
            </Button>
            {beautifiedImage ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="outline" disabled={!svg}>
                    <Download className="size-4" />
                    PNG
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => svg && downloadPng(svg)}>Скачать чертёж</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadImageSrc(beautifiedImage)}>
                    Скачать картинку
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button type="button" size="sm" variant="outline" disabled={!svg} onClick={() => svg && downloadPng(svg)}>
                <Download className="size-4" />
                PNG
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={() => downloadSceneJson(scene)}>
              <FileJson className="size-4" />
              Сохранить JSON
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" />
              Загрузить JSON
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={onReset ?? usePlotStore.getState().resetScene}
            >
              <RotateCcw className="size-4" />
              Сбросить
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                try {
                  importScene(await readSceneJson(file));
                  toast.success("Чертёж загружен");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Не удалось прочитать файл");
                }
              }}
            />
          </div>
        )}

        <div ref={previewRef} className="overflow-auto rounded-md border border-border bg-background p-2">
          {svg ? (
            <div className="[&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {spaceTab === "line"
                ? "Заполните пределы оси, чтобы увидеть числовую прямую."
                : spaceTab === "space"
                  ? "Выберите фигуру и создайте её."
                  : "Заполните пределы обеих осей, чтобы увидеть координатную плоскость."}
            </p>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="w-full"
          disabled={!svg || beautifying}
          onClick={() => setBeautifyOpen(true)}
        >
          <Sparkles className="size-4" />
          Сделать красиво
        </Button>

        {beautifiedImage && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Дорисованная версия</p>
            <div className="overflow-auto rounded-md border border-border bg-background p-2">
              <img src={beautifiedImage} alt="Дорисованный чертёж" className="h-auto w-full" />
            </div>
          </div>
        )}

        {status && status.errors.length > 0 && (
          <ul className="space-y-1 text-xs text-destructive">
            {status.errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        )}
        {status && status.errors.length === 0 && (
          <p className="text-xs text-muted-foreground">Построено объектов: {status.built}.</p>
        )}

        <PlotBeautifyDialog
          open={beautifyOpen}
          busy={beautifying}
          onOpenChange={setBeautifyOpen}
          onDraw={onBeautifyDraw}
        />
      </CardContent>
    </Card>
  );
}
