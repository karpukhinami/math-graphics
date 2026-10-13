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

/** Минимальное число клеток сетки на каждой оси чертежа. */
export const MIN_GRID_CELLS = 6;
/** Желаемый максимум клеток: шаг подбирается так, чтобы их было не больше. */
const MAX_GRID_CELLS = 12;

/**
 * Шаг сетки/засечек, значения 1·10ᵏ, 2·10ᵏ, 5·10ᵏ.
 * Берётся самый мелкий из подходящих шагов, при котором клеток не больше 12; если при
 * этом клеток получается меньше 6 — самый крупный шаг, дающий не меньше 6.
 */
export function niceStep(min: number, max: number): string {
  const span = max - min;
  if (!(span > 0) || !Number.isFinite(span)) return "1";
  const target = span / MAX_GRID_CELLS;
  const base = 10 ** Math.floor(Math.log10(target));
  let step = 10 * base;
  for (const mult of [1, 2, 5, 10]) {
    if (mult * base >= target - 1e-12) {
      step = mult * base;
      break;
    }
  }
  if (span / step < MIN_GRID_CELLS - 1e-9) {
    const limit = span / MIN_GRID_CELLS;
    const limitBase = 10 ** Math.floor(Math.log10(limit));
    step = limitBase;
    for (const mult of [1, 2, 5, 10]) {
      if (mult * limitBase <= limit + 1e-12) step = mult * limitBase;
    }
  }
  return formatNumber(step);
}

const PI_STEPS: Array<[number, string]> = [
  [0.125, "pi/8"],
  [0.25, "pi/4"],
  [0.5, "pi/2"],
  [1, "pi"],
  [2, "2*pi"],
  [5, "5*pi"],
  [10, "10*pi"],
];

/** Шаг для оси с подписями в долях π (те же ограничения на число клеток). */
export function niceStepPi(min: number, max: number): string {
  const span = (max - min) / Math.PI;
  if (!(span > 0) || !Number.isFinite(span)) return "pi";
  const target = span / MAX_GRID_CELLS;
  let chosen = PI_STEPS[PI_STEPS.length - 1];
  for (const option of PI_STEPS) {
    if (option[0] >= target - 1e-12) {
      chosen = option;
      break;
    }
  }
  if (span / chosen[0] < MIN_GRID_CELLS - 1e-9) {
    const limit = span / MIN_GRID_CELLS;
    const fitting = PI_STEPS.filter(([value]) => value <= limit + 1e-12);
    chosen = fitting.length ? fitting[fitting.length - 1] : PI_STEPS[0];
  }
  return chosen[1];
}

/** Ссылка на график/объект: строковый id из черновика либо порядковый номер (с 1). */
export function refKey(value: unknown): string {
  return text(value);
}
