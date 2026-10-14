/** Сборка блока задания из результата «Аналог по скриншоту»: метки [[figN]] → токены картинок. */
export interface AnalogBlockInput {
  task: { type: "input" | "choice"; text: string; answer: string; options: Array<{ text: string; correct: boolean; figure: string | null }> };
  figures: Array<{ id: string; placement: "text" | "option" }>;
  /** Построенные чертежи по id; отсутствующие пропускаются. */
  built: Set<string>;
  /** id чертежа → id картинки в редакторе. */
  imageIdOf: (figureId: string) => string;
}

export function buildAnalogBlock(input: AnalogBlockInput) {
  const { task, figures, built, imageIdOf } = input;
  const token = (fig: string) => `\n![Чертёж](plot:${imageIdOf(fig)})\n`;
  const used = new Set<string>();
  let text = task.text.replace(/\[\[([^\]]+)\]\]/g, (_m, raw: string) => {
    const id = raw.trim();
    if (!built.has(id)) return "";
    used.add(id);
    return token(id);
  });
  // Чертёж «в тексте» без метки — в конец текста.
  for (const f of figures) {
    if (f.placement === "text" && built.has(f.id) && !used.has(f.id)) text += token(f.id);
  }
  const options = task.type === "choice"
    ? task.options.map((o) => ({ text: o.text, correct: o.correct, imageId: o.figure && built.has(o.figure) ? imageIdOf(o.figure) : undefined }))
    : [];
  return { type: task.type, text: text.trim() + "\n", answer: task.type === "input" ? task.answer : "", options };
}
