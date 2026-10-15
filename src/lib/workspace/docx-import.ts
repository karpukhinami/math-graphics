/** Импорт Word (.docx) в один текстовый блок: абзацы → Markdown, формулы OMML → LaTeX, картинки → токены plot:id. */
import JSZip from "jszip";

const kids = (el: Element, name?: string) =>
  Array.from(el.children).filter((c) => !name || c.localName === name);
const kid = (el: Element | undefined, name: string) => (el ? kids(el, name)[0] : undefined);
const attr = (el: Element | undefined, name: string) =>
  el ? (Array.from(el.attributes).find((a) => a.localName === name)?.value ?? "") : "";

const SYMBOLS: Record<string, string> = {
  "≤": "\\le ", "≥": "\\ge ", "≠": "\\ne ", "±": "\\pm ", "∓": "\\mp ", "×": "\\times ", "·": "\\cdot ", "÷": "\\div ",
  "∞": "\\infty ", "→": "\\to ", "⇒": "\\Rightarrow ", "⇔": "\\Leftrightarrow ", "∈": "\\in ", "∉": "\\notin ",
  "∪": "\\cup ", "∩": "\\cap ", "⊂": "\\subset ", "∅": "\\varnothing ", "≈": "\\approx ", "∠": "\\angle ", "°": "^{\\circ}",
  "α": "\\alpha ", "β": "\\beta ", "γ": "\\gamma ", "δ": "\\delta ", "Δ": "\\Delta ", "ε": "\\varepsilon ", "λ": "\\lambda ",
  "μ": "\\mu ", "π": "\\pi ", "φ": "\\varphi ", "ω": "\\omega ", "θ": "\\theta ", "σ": "\\sigma ", "ρ": "\\rho ",
  "−": "-", "⊥": "\\perp ", "∥": "\\parallel ", "√": "\\sqrt{}",
};
const symbols = (s: string) => Array.from(s).map((c) => SYMBOLS[c] ?? (c === "{" || c === "}" ? `\\${c}` : c)).join("");

const NARY: Record<string, string> = { "∑": "\\sum", "∏": "\\prod", "∫": "\\int", "∬": "\\iint", "∮": "\\oint" };
const ACC: Record<string, string> = { "̄": "\\bar", "⃗": "\\vec", "̂": "\\hat", "̃": "\\tilde", "̇": "\\dot", "→": "\\vec" };
const FUNCS = new Set(["sin", "cos", "tg", "tan", "ctg", "cot", "log", "ln", "lg", "exp", "arcsin", "arccos", "arctg", "lim", "max", "min"]);

const g = (el: Element | undefined) => (el ? `{${omml(el)}}` : "{}");

export function omml(el: Element): string {
  return kids(el).map(node).join("");
}

function node(el: Element): string {
  switch (el.localName) {
    case "r": return kids(el, "t").map((t) => symbols(t.textContent ?? "")).join("");
    case "f": {
      const type = attr(kid(kid(el, "fPr"), "type"), "val");
      const num = g(kid(el, "num")), den = g(kid(el, "den"));
      return type === "lin" ? `${num}/${den}` : type === "noBar" ? `\\genfrac{}{}{0pt}{}${num}${den}` : `\\frac${num}${den}`;
    }
    case "sSup": return `${g(kid(el, "e"))}^${g(kid(el, "sup"))}`;
    case "sSub": return `${g(kid(el, "e"))}_${g(kid(el, "sub"))}`;
    case "sSubSup": return `${g(kid(el, "e"))}_${g(kid(el, "sub"))}^${g(kid(el, "sup"))}`;
    case "sPre": return `{}_${g(kid(el, "sub"))}^${g(kid(el, "sup"))}${g(kid(el, "e"))}`;
    case "rad": {
      const deg = kid(el, "deg");
      const d = deg ? omml(deg) : "";
      return d ? `\\sqrt[${d}]${g(kid(el, "e"))}` : `\\sqrt${g(kid(el, "e"))}`;
    }
    case "d": {
      const pr = kid(el, "dPr");
      const beg = kid(pr, "begChr") ? attr(kid(pr, "begChr"), "val") : "(";
      const end = kid(pr, "endChr") ? attr(kid(pr, "endChr"), "val") : ")";
      const sep = kid(pr, "sepChr") ? attr(kid(pr, "sepChr"), "val") : ",";
      const fence = (c: string, left: boolean) =>
        c === "" ? "." : c === "{" ? "\\{" : c === "}" ? "\\}" : c === "|" ? "|" : c === "‖" ? "\\|" : c === "⟨" ? "\\langle" : c === "⟩" ? "\\rangle" : c || (left ? "(" : ")");
      const inner = kids(el, "e").map(omml).join(symbols(sep));
      // Система уравнений: { + матрица/eqArr
      return `\\left${fence(beg, true)}${inner}\\right${fence(end, false)}`;
    }
    case "eqArr": return `\\begin{array}{l}${kids(el, "e").map(omml).join("\\\\")}\\end{array}`;
    case "m": return `\\begin{matrix}${kids(el, "mr").map((r) => kids(r, "e").map(omml).join("&")).join("\\\\")}\\end{matrix}`;
    case "nary": {
      const pr = kid(el, "naryPr");
      const chr = kid(pr, "chr") ? attr(kid(pr, "chr"), "val") : "∫";
      const sub = kid(el, "sub"), sup = kid(el, "sup");
      const s = sub && omml(sub) ? `_${g(sub)}` : "";
      const p = sup && omml(sup) ? `^${g(sup)}` : "";
      return `${NARY[chr] ?? symbols(chr)}${s}${p}${g(kid(el, "e"))}`;
    }
    case "func": {
      const name = omml(kid(el, "fName")!).trim();
      const fn = FUNCS.has(name) ? `\\${name === "tan" ? "tan" : name}` : name;
      return `${fn}${g(kid(el, "e"))}`;
    }
    case "limLow": return `${g(kid(el, "e"))}_${g(kid(el, "lim"))}`;
    case "limUpp": return `${g(kid(el, "e"))}^${g(kid(el, "lim"))}`;
    case "acc": {
      const chr = kid(kid(el, "accPr"), "chr") ? attr(kid(kid(el, "accPr"), "chr"), "val") : "̂";
      return `${ACC[chr] ?? "\\hat"}${g(kid(el, "e"))}`;
    }
    case "bar": return `\\overline${g(kid(el, "e"))}`;
    case "groupChr": return `\\underbrace${g(kid(el, "e"))}`;
    case "box": case "borderBox": case "phant": case "e": case "oMath": return omml(el);
    case "oMathPara": return kids(el, "oMath").map(omml).join("\\\\");
    default: return el.localName.endsWith("Pr") ? "" : omml(el);
  }
}

/** Убираем лишние фигурные скобки и пробелы. */
function tidy(tex: string): string {
  return tex.replace(/\s+/g, " ").replace(/\s*(\\[a-zA-Z]+)\s+([^a-zA-Z])/g, "$1$2").trim();
}

export interface DocxImport { text: string; images: Record<string, string> }

export function paragraphText(p: Element, embed: (rid: string) => string | null): string {
  let out = "";
  const walk = (el: Element) => {
    for (const c of kids(el)) {
      const n = c.localName;
      if (n === "pPr" || n === "rPr") continue;
      if (n === "oMathPara") { out += `\n$$${tidy(omml(c))}$$\n`; continue; }
      if (n === "oMath") { out += `$${tidy(omml(c))}$`; continue; }
      if (n === "r") {
        const pr = kid(c, "rPr");
        const bold = Boolean(kid(pr, "b")) && attr(kid(pr, "b"), "val") !== "0";
        const ital = Boolean(kid(pr, "i")) && attr(kid(pr, "i"), "val") !== "0";
        let t = "";
        for (const x of kids(c)) {
          if (x.localName === "t") t += x.textContent ?? "";
          else if (x.localName === "tab") t += " ";
          else if (x.localName === "br") t += "\n";
          else if (x.localName === "drawing" || x.localName === "pict") {
            const blip = x.querySelector("*|blip, *|imagedata");
            const rid = blip ? attr(blip, "embed") || attr(blip, "id") : "";
            const token = rid ? embed(rid) : null;
            if (token) t += `\n${token}\n`;
          }
        }
        if (t.trim() && (bold || ital) && !t.includes("\n")) {
          const m = /^(\s*)(.*?)(\s*)$/s.exec(t)!;
          const w = bold && ital ? "***" : bold ? "**" : "*";
          t = `${m[1]}${w}${m[2]}${w}${m[3]}`;
        }
        out += t;
        continue;
      }
      walk(c); // hyperlink, ins, smartTag и т.п.
    }
  };
  walk(p);
  const numbered = kid(kid(p, "pPr"), "numPr");
  const style = attr(kid(kid(p, "pPr"), "pStyle"), "val").toLowerCase();
  if (/heading|заголовок/.test(style) && out.trim()) out = `### ${out.trim()}`;
  else if (numbered && out.trim()) out = `- ${out.trim()}`;
  return out;
}

export async function importDocx(file: File | Blob, newId: () => string): Promise<DocxImport> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("Это не документ Word (.docx)");
  const relsXml = (await zip.file("word/_rels/document.xml.rels")?.async("string")) ?? "";
  const parser = new DOMParser();
  const rels: Record<string, string> = {};
  for (const r of Array.from(parser.parseFromString(relsXml, "application/xml").getElementsByTagName("Relationship")))
    rels[r.getAttribute("Id") ?? ""] = r.getAttribute("Target") ?? "";

  const images: Record<string, string> = {};
  const pending: Promise<void>[] = [];
  const embed = (rid: string) => {
    const target = rels[rid];
    if (!target) return null;
    const path = target.startsWith("/") ? target.slice(1) : `word/${target}`;
    const f = zip.file(path);
    const ext = path.split(".").pop()?.toLowerCase() ?? "png";
    if (!f || !["png", "jpg", "jpeg", "gif", "bmp", "svg"].includes(ext)) return null;
    const id = newId();
    const mime = ext === "svg" ? "image/svg+xml" : `image/${ext === "jpg" ? "jpeg" : ext}`;
    pending.push(f.async("base64").then((b64) => { images[id] = `data:${mime};base64,${b64}`; }));
    return `![Рисунок](plot:${id})`;
  };

  const doc = parser.parseFromString(xml, "application/xml");
  const body = doc.getElementsByTagNameNS("*", "body")[0];
  const lines: string[] = [];
  const handle = (el: Element) => {
    if (el.localName === "p") lines.push(paragraphText(el, embed), "");
    else if (el.localName === "tbl") {
      for (const tr of kids(el, "tr")) {
        const cells = kids(tr, "tc").map((tc) => kids(tc, "p").map((p) => paragraphText(p, embed).replace(/\n+/g, " ").trim()).join(" "));
        lines.push(`| ${cells.join(" | ")} |`);
        if (tr === kids(el, "tr")[0]) lines.push(`|${cells.map(() => " --- ").join("|")}|`);
      }
      lines.push("");
    } else if (el.localName === "sdt") kids(kid(el, "sdtContent") ?? el).forEach(handle);
  };
  if (body) kids(body).forEach(handle);
  await Promise.all(pending);
  const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text, images };
}
