export const withoutPlotImages = (text: string) => text.replace(/!\[[^\]]*\]\(plot:[a-z0-9]+\)/g, "");

export function previousParagraph(text: string, cursor: number): string {
  const before = withoutPlotImages(text.slice(0, Math.max(0, cursor))).trimEnd();
  return before.split(/\n\s*\n/).at(-1)?.trim() ?? "";
}

export function textGenerationSource(text: string, selectionStart: number, selectionEnd: number): string {
  const start = Math.max(0, Math.min(text.length, selectionStart));
  const end = Math.max(start, Math.min(text.length, selectionEnd));
  return end > start ? text.slice(start, end) : previousParagraph(text, start);
}

export interface CropRect { x: number; y: number; width: number; height: number }
export function cropRect(start: { x: number; y: number }, end: { x: number; y: number }): CropRect {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const x1 = clamp(start.x), y1 = clamp(start.y), x2 = clamp(end.x), y2 = clamp(end.y);
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}
