/**
 * Цвета диаграмм — из той же палитры, что и математические чертежи (PLOT_PALETTE).
 * Модель возвращает только colorMode («same» | «similar» | «different»),
 * конкретные hex выводятся здесь.
 */
import { PLOT_PALETTE } from "../shared";
import type { StatDecoColorMode } from "./types";
import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from "./palette-math";

export interface StatDecoTheme {
  background: string;
  surface: string;
  ink: string;
  muted: string;
  header: string;
  primary: string;
  spot: string;
  /** Упорядоченный набор различимых цветов палитры для режима «different». */
  distinct: string[];
}

const THEME: StatDecoTheme = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  ink: "#0C1126",
  muted: "#818C96",
  header: "#293642",
  primary: PLOT_PALETTE[0],
  spot: PLOT_PALETTE[1],
  distinct: [...PLOT_PALETTE],
};

export function statDecoTheme(): StatDecoTheme {
  return THEME;
}

/** Расширенный набор цветов на выбор пользователя (без произвольного ввода). */
export const CHART_COLOR_CHOICES: string[] = [
  ...PLOT_PALETTE,
  "#E15759",
  "#F28E2B",
  "#59A14F",
  "#76B7B2",
  "#EDC948",
  "#B07AA1",
  "#FF9DA7",
  "#9C755F",
  "#4E79A7",
  "#A0CBE8",
  "#86BCB6",
];

function shiftHsl(hex: string, dH: number, dS: number, dL: number): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const nl = Math.min(92, Math.max(12, l + dL));
  const ns = Math.min(100, Math.max(6, s + dS));
  const rgb = hslToRgb(h + dH, ns, nl);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/** Осветлить hex на долю (0..1) — верхние грани псевдо-3D. */
export function lighten(hex: string, amount: number): string {
  return shiftHsl(hex, 0, 0, Math.round(amount * 100));
}

/** Затемнить hex на долю (0..1) — боковые грани псевдо-3D. */
export function darken(hex: string, amount: number): string {
  return shiftHsl(hex, 0, 0, -Math.round(amount * 100));
}

/** Оттенки одного базового цвета, равномерно по светлоте (для «similar»). */
function shades(base: string, count: number): string[] {
  if (count <= 1) return [base];
  const out: string[] = [];
  const span = 34;
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1);
    out.push(shiftHsl(base, (t - 0.5) * 14, 0, Math.round((0.5 - t) * span)));
  }
  return out;
}

/** Различимые цвета: сначала палитра, затем повороты оттенка от primary. */
function distinctColors(theme: StatDecoTheme, count: number): string[] {
  const out = theme.distinct.slice(0, count);
  let step = 1;
  while (out.length < count) {
    out.push(shiftHsl(theme.primary, (step * 360) / (count + 1), 0, step % 2 ? -8 : 8));
    step += 1;
  }
  return out;
}

/**
 * Подобрать `count` цветов под colorMode.
 * `count` — число рядов, если их несколько, иначе число категорий одного ряда.
 */
export function resolveColors(
  theme: StatDecoTheme,
  mode: StatDecoColorMode | undefined,
  count: number,
  custom?: string[],
): string[] {
  const n = Math.max(1, count);
  const effective: StatDecoColorMode = mode ?? (n > 1 ? "different" : "same");
  let base: string[];
  if (effective === "same") base = Array.from({ length: n }, () => custom?.[0] ?? theme.primary);
  else if (effective === "similar") base = shades(custom?.[0] ?? theme.primary, n);
  else base = distinctColors(theme, n);
  // Ручные цвета (режим «different») перекрывают палитру по позициям.
  if (effective === "different" && custom) {
    return base.map((color, i) => custom[i] ?? color);
  }
  return base;
}

/** Функциональные цвета ролей каскадной диаграммы (роль важнее colorMode). */
export function waterfallColors(theme: StatDecoTheme) {
  return {
    increase: theme.primary,
    decrease: theme.spot,
    subtotal: theme.header,
    total: theme.header,
  };
}
