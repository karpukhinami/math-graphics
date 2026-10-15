/** Presentation-only ranges; the stored Markdown and plot references stay unchanged. */
export type TextSegment =
  | { kind: "text"; key: string; start: number; end: number; text: string }
  | { kind: "image"; key: string; start: number; end: number; imageId: string };

export function splitTextImages(text: string, hasImage: (id: string) => boolean): TextSegment[] {
  const segments: TextSegment[] = [];
  let start = 0;
  let previousKey = "start";
  for (const match of text.matchAll(/!\[[^\]]*\]\(plot:([a-z0-9]+)\)/g)) {
    if (!hasImage(match[1])) continue;
    const end = match.index;
    const key = `${match[1]}-${segments.length}`;
    segments.push({ kind: "text", key: previousKey, start, end, text: text.slice(start, end) });
    start = end + match[0].length;
    segments.push({ kind: "image", key, start: end, end: start, imageId: match[1] });
    previousKey = key;
  }
  segments.push({ kind: "text", key: previousKey, start, end: text.length, text: text.slice(start) });
  return segments;
}

export function replaceTextSegment(text: string, start: number, end: number, replacement: string): string {
  return text.slice(0, start) + replacement + text.slice(end);
}