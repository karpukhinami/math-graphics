/** Серверный вызов OpenRouter chat/completions. Только для обработчиков /api/ai/*. */

import process from "node:process";

/** Имена не зашиты в `process.env.X`: сборщик не подставляет пустое значение на этапе билда. */
const OPENROUTER_KEY_NAMES = ["OPENROUTER_API_KEY", "OPENROUTER_KEY", "OPEN_ROUTER_API_KEY"] as const;

/** Копия ключа из Cloudflare bindings, если `process.env` недоступен для записи. */
let bindingKey: string | undefined;

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readProcessEnv(name: string): string | undefined {
  try {
    return nonEmptyString(Reflect.get(process.env, name));
  } catch {
    return undefined;
  }
}

/** Ключ OpenRouter из окружения Node. На Render секрет уже лежит в `process.env`. */
export function getOpenRouterKey(): string | undefined {
  for (const name of OPENROUTER_KEY_NAMES) {
    const value = readProcessEnv(name);
    if (value) return value;
  }
  return bindingKey;
}

/**
 * Lovable отдаёт секреты в `env` worker’а, а не в `process.env`.
 * На Render ключ уже в окружении Node — вызов ничего не меняет.
 */
export function hydrateOpenRouterEnvFromBindings(env: unknown): void {
  if (!env || typeof env !== "object") return;
  if (getOpenRouterKey()) return;

  for (const name of OPENROUTER_KEY_NAMES) {
    const value = nonEmptyString(Reflect.get(env, name));
    if (!value) continue;
    bindingKey = value;
    try {
      Reflect.set(process.env, "OPENROUTER_API_KEY", value);
    } catch {
      // process.env может быть неизменяемым на worker; bindingKey уже сохранён.
    }
    return;
  }
}

export interface AiRequestBody {
  model: string;
  prompt: string;
  system?: string;
  /** Data URL или https URL изображений, прикладываемых к запросу. */
  images?: string[];
}

export interface OpenRouterMessage {
  content?: unknown;
  images?: Array<{ image_url?: { url?: string } | string }>;
}

const TIMEOUT_MS = 180_000;

export class AiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function readAiBody(request: Request): Promise<AiRequestBody> {
  const body = (await request.json().catch(() => null)) as AiRequestBody | null;
  if (!body?.model || !body?.prompt) throw new AiError("Не указаны модель или промпт", 400);
  return body;
}

function userContent(body: AiRequestBody): unknown {
  if (!body.images?.length) return body.prompt;
  return [
    { type: "text", text: body.prompt },
    ...body.images.map((url) => ({ type: "image_url", image_url: { url } })),
  ];
}

function isContextTooLong(text: string): boolean {
  const t = text.toLowerCase();
  return ["context length", "context_length", "maximum context", "too long", "token limit"].some((s) =>
    t.includes(s),
  );
}

/** Отправляет запрос в OpenRouter и возвращает первое сообщение ответа. */
export async function openRouterChat(
  body: AiRequestBody,
  extra: Record<string, unknown> = {},
): Promise<{ message: OpenRouterMessage; finishReason?: string }> {
  const key = getOpenRouterKey();
  if (!key) throw new AiError("Не настроен ключ OPENROUTER_API_KEY", 500);

  const messages = [
    ...(body.system ? [{ role: "system", content: body.system }] : []),
    { role: "user", content: userContent(body) },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: body.model, messages, ...extra }),
      signal: controller.signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") {
      throw new AiError(`Модель «${body.model}» не ответила за ${TIMEOUT_MS / 1000} сек.`, 504);
    }
    throw new AiError(`Сетевая ошибка: ${(e as Error).message}`, 502);
  } finally {
    clearTimeout(timer);
  }

  const raw = await res.text().catch(() => "");
  if (!res.ok) {
    if (res.status === 413 || isContextTooLong(raw)) {
      throw new AiError(`Запрос слишком длинный для модели «${body.model}». Сократите материал.`, 413);
    }
    if (res.status === 402) throw new AiError("Недостаточно средств на счёте OpenRouter.", 402);
    if (res.status === 429) throw new AiError("Слишком много запросов, попробуйте позже.", 429);
    throw new AiError(`OpenRouter ${res.status}: ${raw.slice(0, 400) || res.statusText}`, res.status);
  }

  let data: {
    choices?: Array<{ message?: OpenRouterMessage; finish_reason?: string }>;
    error?: { message?: string };
  };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new AiError("OpenRouter вернул не-JSON ответ", 502);
  }
  if (data.error?.message) throw new AiError(data.error.message, 502);
  const choice = data.choices?.[0];
  return { message: choice?.message ?? {}, finishReason: choice?.finish_reason };
}

export function aiErrorResponse(e: unknown): Response {
  const status = e instanceof AiError ? e.status : 500;
  const error = e instanceof Error ? e.message : "Ошибка ИИ-запроса";
  return Response.json({ error }, { status });
}
