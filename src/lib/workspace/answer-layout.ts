export type AnswerLayout = "vertical" | "horizontal" | "grid";

export function allAnswersAreImages(options: readonly { imageId?: string; text: string }[]): boolean {
  return options.length > 0 && options.every((option) => Boolean(option.imageId) && !option.text.trim());
}

export function answerColumnCount(layout: AnswerLayout, count: number): number {
  if (layout === "horizontal") return Math.max(1, count);
  if (layout === "grid") return 2;
  return 1;
}