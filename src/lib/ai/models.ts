/** Каталог моделей OpenRouter, доступных в UI построений. */
import catalog from "./models.json";

export type ModelKind = "text" | "image";

export interface ModelOption {
  /** Идентификатор модели OpenRouter, напр. `google/gemini-2.5-flash`. */
  id: string;
  label: string;
  kind: ModelKind;
}

const list = catalog as { text: Array<{ id: string }>; image: Array<{ id: string }> };

function toOption(id: string, kind: ModelKind): ModelOption {
  return { id, label: id.split("/").pop() ?? id, kind };
}

export const TEXT_MODELS: ModelOption[] = list.text.map((m) => toOption(m.id, "text"));
export const IMAGE_MODELS: ModelOption[] = list.image.map((m) => toOption(m.id, "image"));

export const DEFAULT_TEXT_MODEL = "google/gemini-2.5-flash";
export const DEFAULT_IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";
