import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";
import { splitTextImages, replaceTextSegment } from "@/lib/workspace/text-segments";

export interface InlineImageTextEditorHandle {
  readonly selectionStart: number;
  readonly selectionEnd: number;
  focusRange: (start: number, end: number) => void;
}

function TextPart({ value, placeholder, onChange, onSelection, inputRef, standalone }: {
  value: string; placeholder: string; onChange: (text: string) => void;
  onSelection: (input: HTMLTextAreaElement) => void;
  inputRef: (input: HTMLTextAreaElement | null) => void; standalone: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const input = ref.current;
    if (!input) return;
    input.style.height = "0px";
    input.style.height = `${input.scrollHeight + 2}px`;
  }, [value]);
  return <Textarea ref={(input) => { ref.current = input; inputRef(input); }} value={value}
    placeholder={placeholder} rows={standalone ? 4 : 1}
    className={standalone ? "min-h-28 resize-none overflow-hidden font-mono text-sm" : "min-h-10 resize-none overflow-hidden border-0 font-mono text-sm shadow-none"}
    onChange={(event) => onChange(event.target.value)}
    onSelect={(event) => onSelection(event.currentTarget)}
    onFocus={(event) => onSelection(event.currentTarget)} />;
}

export const InlineImageTextEditor = forwardRef<InlineImageTextEditorHandle, {
  value: string; onChange: (text: string) => void; placeholder: string;
  hasImage: (id: string) => boolean; renderImage: (id: string) => ReactNode;
}>(function InlineImageTextEditor({ value, onChange, placeholder, hasImage, renderImage }, ref) {
  const parts = splitTextImages(value, hasImage);
  const inputs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const selection = useRef<{ key: string; start: number; end: number } | null>(null);
  const readSelection = (edge: "start" | "end") => {
    const current = selection.current;
    const part = parts.find((part) => part.kind === "text" && part.key === current?.key);
    return current && part ? Math.min(part.end, part.start + current[edge]) : value.length;
  };
  useImperativeHandle(ref, () => ({
    get selectionStart() { return readSelection("start"); },
    get selectionEnd() { return readSelection("end"); },
    focusRange(start, end) {
      requestAnimationFrame(() => {
        const part = parts.find((part) => part.kind === "text" && start >= part.start && start <= part.end);
        const input = part ? inputs.current[part.key] : null;
        if (!part || !input) return;
        input.focus();
        input.setSelectionRange(start - part.start, Math.min(end, part.end) - part.start);
      });
    },
  }));
  const standalone = parts.length === 1;
  return <div className={standalone ? "min-w-0" : "min-w-0 rounded-md border border-input bg-transparent py-1 shadow-sm"}>
    {parts.map((part) => part.kind === "image"
      ? <div key={`image-${part.key}`} className="px-3">{renderImage(part.imageId)}</div>
      : <TextPart key={`text-${part.key}`} value={part.text} placeholder={part.start === 0 ? placeholder : "Текст…"}
          standalone={standalone} inputRef={(input) => { inputs.current[part.key] = input; }}
          onChange={(text) => {
            onChange(replaceTextSegment(value, part.start, part.end, text));
          }}
          onSelection={(input) => { selection.current = { key: part.key, start: input.selectionStart, end: input.selectionEnd }; }} />)}
  </div>;
});