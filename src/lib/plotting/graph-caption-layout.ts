/** Shared, DOM-free sizing and wrapping for live, embedded and exported captions. */
import katex from "katex";
import { measureTextWidth } from "./label-layout";

export interface CaptionToken { text: string; math?: boolean }
export interface CaptionLine { tokens: CaptionToken[]; width: number; height: number }
export interface CaptionLayout { lines: CaptionLine[]; width: number; height: number; fontSize: number }

export function captionTokens(text: string, latex?: string | null): CaptionToken[] {
  if (latex) return [{ text: latex, math: true }];
  const result: CaptionToken[] = [];
  const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    result.push({ text: text.slice(offset, match.index) });
    result.push({ text: match[1] ?? match[2] ?? match[3] ?? match[4], math: true });
    offset = (match.index ?? 0) + match[0].length;
  }
  result.push({ text: text.slice(offset) });
  return result.filter((token) => token.text);
}

function tokenSize(token: CaptionToken, font: number): { width: number; height: number } {
  if (!token.math) return { width: measureTextWidth(token.text, font) * 1.4, height: font * 1.4 };
  const html = katex.renderToString(token.text, { throwOnError: false, trust: false, output: "html" });
  const struts = [...html.matchAll(/class="strut" style="height:([\d.]+)em/g)].map((match) => Number(match[1]));
  const visible = token.text.replace(/\\(?:frac|dfrac|tfrac)\{([^{}]*)\}\{([^{}]*)\}/g, (_m, a: string, b: string) => a.length > b.length ? a : b)
    .replace(/\\[a-zA-Z]+/g, "M").replace(/[{}^_]/g, "");
  return { width: Math.max(font * 1.5, measureTextWidth(visible, font) * 1.35 + font), height: font * Math.max(1.5, ...struts.map((v) => v * 1.21 + 0.3)) };
}

export function layoutGraphCaption(text: string, latex: string | null | undefined, fontSize: number, maxWidth: number): CaptionLayout {
  const limit = Math.max(1, maxWidth);
  const tokens: CaptionToken[] = captionTokens(text, latex).flatMap((token): CaptionToken[] => token.math ? [token] : token.text.split(/(\n|[^\S\n]+)/).filter(Boolean).map((text) => ({ text })));
  const longestMath = Math.max(1, ...tokens.filter((token) => token.math).map((token) => tokenSize(token, fontSize).width));
  const font = Math.min(fontSize, fontSize * limit / longestMath);
  const lines: CaptionLine[] = [];
  let line: CaptionLine = { tokens: [], width: 0, height: font * 1.4 };
  const flush = () => { if (line.tokens.length) lines.push(line); line = { tokens: [], width: 0, height: font * 1.4 }; };
  const append = (token: CaptionToken) => {
    if (token.text === "\n") { flush(); return; }
    const size = tokenSize(token, font);
    if (line.width + size.width > limit && line.tokens.length) flush();
    if (!line.tokens.length && /^\s+$/.test(token.text)) return;
    line.tokens.push(token); line.width += size.width; line.height = Math.max(line.height, size.height);
  };
  for (const token of tokens) {
    if (!token.math && tokenSize(token, font).width > limit) {
      let chunk = "";
      for (const char of token.text) {
        if (chunk && tokenSize({ text: chunk + char }, font).width > limit) { append({ text: chunk }); flush(); chunk = ""; }
        chunk += char;
      }
      if (chunk) append({ text: chunk });
    } else append(token);
  }
  flush();
  return { lines, width: Math.min(limit, Math.max(1, ...lines.map((item) => item.width))), height: lines.reduce((sum, item) => sum + item.height, 0), fontSize: font };
}

function escape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderGraphCaption(layout: CaptionLayout, x: number, y: number, color: string, fontFamily: string, backdrop: boolean): string {
  const lines = layout.lines.map((line) => `<div style="height:${line.height}px;display:flex;align-items:center;justify-content:center;white-space:pre;">${line.tokens.map((token) => token.math
    ? `<span>${katex.renderToString(token.text, { throwOnError: false, trust: false, output: "html" })}</span>`
    : `<span>${escape(token.text)}</span>`).join("")}</div>`).join("");
  return `<foreignObject x="${x}" y="${y}" width="${layout.width}" height="${layout.height}"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:${layout.fontSize}px;font-family:${escape(fontFamily)};color:${escape(color)};${backdrop ? "text-shadow:0 0 3px white,0 0 3px white;" : ""}">${lines}</div></foreignObject>`;
}