/**
 * Общие помощники «урезанных» схем сценария «Нарисовать по заданию».
 *
 * Модель заполняет только содержательную часть (draft); код превращает её в полный
 * JSON сцены и подставляет все технические и оформительские значения по умолчанию.
 */

export type Rec = Record<string, unknown>;

export interface DraftExpansion {
  /** Полная сцена в формате, который понимает mergeAiScene / рендерер (null при фатальной ошибке). */
  scene: unknown;
  /** Ошибки содержимого, понятные модели: уходят в повторный запрос. */
  errors: string[];
}

export function isRecord(value: unknown): value is Rec {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Строка из string | number; всё остальное — пустая строка. */
export function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function flag(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

/** Нормализация перечислений: регистр, «_» и «-» не важны. */
export function enumKey(value: unknown): string {
  return text(value).toLowerCase().replace(/[\s_-]/g, "");
}

/**
 * Модель может обернуть черновик в { "scene": … } — разворачиваем.
 * `markerKeys` — ключи, по которым узнаётся сам черновик.
 */
export function unwrapDraft(raw: unknown, markerKeys: string[]): Rec | null {
  if (!isRecord(raw)) return null;
  const hasMarker = markerKeys.some((key) => key in raw);
  if (!hasMarker && isRecord(raw.scene)) return raw.scene;
  return raw;
}

function formatNumber(value: number): string {
  return String(Number(value.toPrecision(12)));
}

/** Шаг сетки/засечек: не более ~12 делений на оси, значения 1·10ᵏ, 2·10ᵏ, 5·10ᵏ. */
export function niceStep(min: number, max: number): string {
  const span = max - min;
  if (!(span > 0) || !Number.isFinite(span)) return "1";
  const target = span / 12;
  const base = 10 ** Math.floor(Math.log10(target));
  for (const mult of [1, 2, 5, 10]) {
    if (mult * base >= target - 1e-12) return formatNumber(mult * base);
  }
  return formatNumber(10 * base);
}

/** Шаг для оси с подписями в долях π. */
export function niceStepPi(min: number, max: number): string {
  const span = (max - min) / Math.PI;
  if (!(span > 0) || !Number.isFinite(span)) return "pi";
  const target = span / 12;
  const options: Array<[number, string]> = [
    [0.25, "pi/4"],
    [0.5, "pi/2"],
    [1, "pi"],
    [2, "2*pi"],
    [5, "5*pi"],
  ];
  for (const [value, expr] of options) {
    if (value >= target - 1e-12) return expr;
  }
  return "10*pi";
}

/** Ссылка на график/объект: строковый id из черновика либо порядковый номер (с 1). */
export function refKey(value: unknown): string {
  return text(value);
}
