/** Выгрузка задания в Word: Markdown-текст, LaTeX → OMML (temml + mathml2omml), картинки → PNG. */
import { Document, ImageRun, ImportedXmlComponent, Packer, Paragraph, TextRun, HeadingLevel, type ParagraphChild } from "docx";
import * as Temml from "temml";
import { mml2omml } from "mathml2omml";

const temml = ((Temml as unknown as { default?: typeof Temml }).default ?? Temml) as { renderToString: (tex: string, opts?: object) => string };

export interface ExportOption { text: string; imageId?: string }
export interface ExportBlock { type: "text" | "input" | "choice"; text: string; options: ExportOption[] }
export interface ExportImage { width: number; height: number; data: Uint8Array }

export const ANSWER_LETTERS = ["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К"];
export function answerLetter(index: number): string {
  return ANSWER_LETTERS[index] ?? String(index + 1);
}

export function latexToOmml(tex: string, display = false): string {
  const mathml = temml.renderToString(tex, { displayMode: display, xml: true, throwOnError: false });
  return mml2omml(mathml);
}

function mathRun(tex: string, display: boolean): ParagraphChild {
  try {
    return ImportedXmlComponent.fromXmlString(latexToOmml(tex, display)) as unknown as ParagraphChild;
  } catch {
    return new TextRun(tex);
  }
}

/** Разбивает строку на текст, **жирный**, *курсив* и $формулы$. */
function inlineRuns(line: string): ParagraphChild[] {
  const runs: ParagraphChild[] = [];
  const re = /\$\$([^$]+)\$\$|\$([^$]+)\$|\\\(([\s\S]+?)\\\)|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/g;
  let last = 0;
  for (const m of line.matchAll(re)) {
    if (m.index > last) runs.push(new TextRun(line.slice(last, m.index)));
    if (m[1] ?? m[2] ?? m[3]) runs.push(mathRun((m[1] ?? m[2] ?? m[3]).trim(), Boolean(m[1])));
    else if (m[4]) runs.push(new TextRun({ text: m[4], bold: true }));
    else runs.push(new TextRun({ text: m[5] ?? m[6], italics: true }));
    last = m.index + m[0].length;
  }
  if (last < line.length) runs.push(new TextRun(line.slice(last)));
  return runs;
}

const MAX_WIDTH = 450; // pt-like px inside A4 margins

function imageParagraph(img: ExportImage, maxWidth = MAX_WIDTH): Paragraph {
  const k = Math.min(1, maxWidth / img.width);
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [new ImageRun({
      type: "png", data: img.data,
      transformation: { width: Math.round(img.width * k), height: Math.round(img.height * k) },
      altText: { title: "Чертёж", description: "Чертёж", name: "Чертёж" },
    })],
  });
}

/** Markdown блока → абзацы Word; первая строка может получить префикс (буква ответа). */
export function markdownParagraphs(text: string, images: Record<string, ExportImage>, prefix?: string): Paragraph[] {
  const out: Paragraph[] = [];
  // Выносные формулы $$…$$ на отдельных строках сворачиваем в одну строку.
  const normalized = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => `\n$$${tex.replace(/\n/g, " ")}$$\n`).replace(/\\\[([\s\S]+?)\\\]/g, (_, tex: string) => `\n$$${tex.replace(/\n/g, " ")}$$\n`);
  let pendingPrefix = prefix;
  for (const raw of normalized.split("\n")) {
    const parts = raw.split(/(!\[[^\]]*\]\(plot:[a-z0-9]+\))/);
    for (const part of parts) {
      const img = /^!\[[^\]]*\]\(plot:([a-z0-9]+)\)$/.exec(part);
      if (img) {
        if (images[img[1]]) {
          if (pendingPrefix) { out.push(new Paragraph({ children: [new TextRun({ text: pendingPrefix, bold: true })] })); pendingPrefix = undefined; }
          out.push(imageParagraph(images[img[1]]));
        }
        continue;
      }
      let line = part.trim();
      if (!line) continue;
      const heading = /^(#{1,3})\s+(.*)$/.exec(line);
      const bullet = /^[-*]\s+(.*)$/.exec(line);
      if (heading) line = heading[2];
      else if (bullet) line = `• ${bullet[1]}`;
      const display = /^\$\$([\s\S]+)\$\$$/.exec(line);
      const children: ParagraphChild[] = [];
      if (pendingPrefix) { children.push(new TextRun({ text: pendingPrefix, bold: true })); pendingPrefix = undefined; }
      if (display) children.push(mathRun(display[1].trim(), true));
      else children.push(...inlineRuns(line));
      out.push(new Paragraph({ children, heading: heading ? HeadingLevel.HEADING_3 : undefined, spacing: { after: 80 } }));
    }
  }
  if (pendingPrefix) out.push(new Paragraph({ children: [new TextRun({ text: pendingPrefix, bold: true })] }));
  return out;
}

export function buildTaskDocument(title: string, blocks: ExportBlock[], images: Record<string, ExportImage>): Document {
  const children: Paragraph[] = [];
  if (title.trim()) children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(title.trim())] }));
  blocks.forEach((block) => {
    children.push(...markdownParagraphs(block.text, images));
    if (block.type === "input") children.push(new Paragraph({ children: [new TextRun("Ответ: ______________________")], spacing: { before: 120 } }));
    if (block.type === "choice") {
      block.options.forEach((o, i) => {
        const prefix = `${answerLetter(i)}) `;
        const startsWithImage = Boolean(o.imageId && images[o.imageId]);
        if (startsWithImage) {
          children.push(new Paragraph({ children: [new TextRun({ text: prefix, bold: true })] }));
          children.push(imageParagraph(images[o.imageId!], 300));
          children.push(...markdownParagraphs(o.text, images));
        } else {
          const ps = markdownParagraphs(o.text, images, prefix);
          children.push(...ps);
        }
      });
    }
    children.push(new Paragraph({ children: [] }));
  });
  return new Document({
    styles: { default: { document: { run: { font: "Arial", size: 24 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } }, children }],
  });
}

/** Любой src (PNG/JPEG/SVG data URL) → PNG байты через canvas (только в браузере). */
export async function imageToPng(src: string, scale = 2): Promise<ExportImage> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await img.decode();
  const width = img.naturalWidth || 720;
  const height = img.naturalHeight || 520;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((r, j) => canvas.toBlob((b) => (b ? r(b) : j(new Error("PNG"))), "image/png"));
  return { width, height, data: new Uint8Array(await blob.arrayBuffer()) };
}

export async function exportTaskDocx(title: string, blocks: ExportBlock[], sources: Record<string, string>): Promise<Blob> {
  const images: Record<string, ExportImage> = {};
  await Promise.all(Object.entries(sources).map(async ([id, src]) => {
    try { images[id] = await imageToPng(src); } catch { /* пропускаем битую картинку */ }
  }));
  return Packer.toBlob(buildTaskDocument(title, blocks, images));
}
