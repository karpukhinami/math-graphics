import russianHyphenation from "hyphen/ru";

/** Prefer spaces; only split a long word at Russian dictionary-pattern breaks. */
export function wrapCategoryLabel(text: string, width: number, measure: (text: string) => number): string {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    if (measure(line ? `${line} ${word}` : word) <= width) {
      line = line ? `${line} ${word}` : word;
      continue;
    }
    if (line) { lines.push(line); line = ""; }
    let rest = word;
    while (measure(rest) > width) {
      const syllables = russianHyphenation.hyphenateSync(rest, { hyphenChar: "\u00ad" }).split("\u00ad");
      let prefix = "";
      let cut = "";
      for (let i = 0; i < syllables.length - 1; i++) {
        prefix += syllables[i];
        if (measure(`${prefix}-`) <= width) cut = prefix;
      }
      if (!cut) break; // Never invent a letter-by-letter break.
      lines.push(`${cut}-`);
      rest = rest.slice(cut.length);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines.join("\n");
}