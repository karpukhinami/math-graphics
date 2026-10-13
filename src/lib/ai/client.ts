/** Браузерные вызовы ИИ: текст (анализ/генерация сцены) и изображение («Сделать красиво»). */
import { extractJson } from "./json-repair";

export interface AiCallOptions {
  model: string;
  prompt: string;
  system?: string;
  images?: string[];
}

async function post<T>(path: string, opts: AiCallOptions): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok || data.error) {
    throw new Error(data.error || `Ошибка ИИ-запроса (${res.status})`);
  }
  return data;
}

export async function callText(opts: AiCallOptions): Promise<string> {
  const { text } = await post<{ text: string }>("/api/ai/text", opts);
  return text;
}

/** Возвращает data URL сгенерированного изображения. */
export async function callImage(opts: AiCallOptions): Promise<string> {
  const { image } = await post<{ image: string }>("/api/ai/image", opts);
  return image.startsWith("data:") || image.startsWith("http") ? image : `data:image/png;base64,${image}`;
}

function buildJsonRepairPrompt(label: string, prompt: string, invalid: string, schemaHint?: string) {
  return `Ты исправляешь НЕВАЛИДНЫЙ JSON, сгенерированный ранее для шага: ${label}.

Верни только исправленный валидный JSON без пояснений и markdown-ограждений.
Сохрани содержание, структуру и формулировки; исправь только формат:
- обратные слеши в строках экранированы (LaTeX: \\frac, \\sqrt, \\left, \\right);
- переводы строк внутри строк — \\n;
- скобки и кавычки сбалансированы, без trailing commas.

ОЖИДАЕМЫЙ ТИП РЕЗУЛЬТАТА:
${schemaHint || "Тот же JSON-объект в валидном виде."}

ИСХОДНАЯ ЗАДАЧА:
${prompt}

НЕВАЛИДНЫЙ ОТВЕТ:
${invalid}`;
}

/**
 * Запрос JSON у текстовой модели: парсинг с починкой, при неудаче — один запрос на исправление,
 * при обрезанном ответе — одна повторная попытка.
 */
export async function callTextForJson<T>(opts: {
  model: string;
  prompt: string;
  label: string;
  schemaHint?: string;
  images?: string[];
  parse: (value: unknown) => T;
}): Promise<T> {
  const { model, prompt, label, schemaHint, images, parse } = opts;

  async function attempt(): Promise<T> {
    const raw = await callText({ model, prompt, images });
    try {
      return parse(extractJson<unknown>(raw));
    } catch {
      const repaired = await callText({
        model,
        prompt: buildJsonRepairPrompt(label, prompt, raw, schemaHint),
        images,
      });
      return parse(extractJson<unknown>(repaired));
    }
  }

  try {
    return await attempt();
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : "";
    if (msg.includes("truncated") || msg.includes("обрезан")) return attempt();
    throw error;
  }
}
