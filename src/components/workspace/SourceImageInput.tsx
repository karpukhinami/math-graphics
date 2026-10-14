import { useRef, useState, type PointerEvent } from "react";
import { Crop, ClipboardPaste, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cropRect, type CropRect } from "@/lib/workspace/plot-context";

export function SourceImageInput({ images, onChange }: { images: string[]; onChange: (images: string[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [cropping, setCropping] = useState(false);
  const [rect, setRect] = useState<CropRect | null>(null);
  const image = images[0];
  async function load(files: File[]) {
    const file = files.find((f) => f.type.startsWith("image/"));
    if (!file) { toast.error("Выберите изображение"); return; }
    const reader = new FileReader();
    reader.onload = () => { onChange([String(reader.result)]); setCropping(false); setRect(null); };
    reader.onerror = () => toast.error("Не удалось прочитать изображение");
    reader.readAsDataURL(file);
  }
  function position(e: PointerEvent<HTMLDivElement>) {
    const bounds = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - bounds.left) / bounds.width, y: (e.clientY - bounds.top) / bounds.height };
  }
  async function applyCrop() {
    if (!image || !rect || rect.width < 0.01 || rect.height < 0.01) return;
    try {
      const img = new Image(); img.src = image; await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * rect.width));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * rect.height));
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      ctx.drawImage(img, rect.x * img.naturalWidth, rect.y * img.naturalHeight, img.naturalWidth * rect.width, img.naturalHeight * rect.height, 0, 0, canvas.width, canvas.height);
      onChange([canvas.toDataURL("image/png")]); setCropping(false); setRect(null);
    } catch { toast.error("Не удалось обрезать изображение"); }
  }
  return (
    <div className="space-y-3" tabIndex={0} aria-label="Исходное изображение" onPaste={(e) => {
      const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
      if (files.length) { e.preventDefault(); void load(files); }
    }}>
      {!image && <div role="button" tabIndex={0} aria-label="Поле для вставки изображения"
        className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground outline-none focus:border-primary"
        onClick={(e) => e.currentTarget.focus()}>
        <ClipboardPaste className="size-6" />
        <span>Нажмите на поле и вставьте картинку из буфера: <kbd className="rounded border border-border px-1">Ctrl</kbd>+<kbd className="rounded border border-border px-1">V</kbd></span>
        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}><Upload className="size-4" /> или загрузите файл</Button>
      </div>}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void load(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      {image && <>
        <div className="relative w-fit max-w-full overflow-hidden rounded-md border border-border touch-none" aria-label="Область обрезки"
          onPointerDown={(e) => { if (!cropping) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); start.current = position(e); setRect(null); }}
          onPointerMove={(e) => { if (cropping && start.current) setRect(cropRect(start.current, position(e))); }}
          onPointerUp={() => { start.current = null; }} onPointerCancel={() => { start.current = null; }}>
          <img src={image} alt="Исходное изображение" draggable={false} className="block max-h-[420px] max-w-full select-none" />
          {cropping && rect && <div className="pointer-events-none absolute border-2 border-primary bg-primary/15" style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%` }} />}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => { setCropping(!cropping); setRect(null); }}><Crop className="size-4" /> {cropping ? "Отменить обрезку" : "Выделить фрагмент"}</Button>
          {cropping && <Button size="sm" disabled={!rect || rect.width < 0.01 || rect.height < 0.01} onClick={() => void applyCrop()}>Обрезать</Button>}
          <Button variant="ghost" size="icon" title="Удалить исходное изображение" onClick={() => { onChange([]); setRect(null); setCropping(false); }}><X className="size-4" /></Button>
        </div>
      </>}
    </div>
  );
}
