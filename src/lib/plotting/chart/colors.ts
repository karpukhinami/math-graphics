/**
 * Цвета диаграмм — из той же палитры, что и математические чертежи (PLOT_PALETTE).
 * Модель возвращает только colorMode («same» | «similar» | «different»),
 * конкретные hex выводятся здесь.
 */
import { PLOT_PALETTE, PLOT_PALETTE_GROUPS } from "../shared";
import type { StatDecoColorMode, StatDecoRendering } from "./types";
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

/** Цвета на выбор пользователя: основная палитра чертежей и фирменные дополнительные цвета, без посторонних. */
export const CHART_COLOR_CHOICES: string[] = [
  ...new Set([...PLOT_PALETTE, ...PLOT_PALETTE_GROUPS.flatMap((group) => group.colors)]),
];

/** Фирменные оттенки базового цвета (его группа палитры), начиная с самого базового; null, если цвет вне групп. */
export function paletteShades(base: string): string[] | null {
  const group = PLOT_PALETTE_GROUPS.find((g) => g.colors.includes(base));
  if (!group) return null;
  const start = group.colors.indexOf(base);
  return [...group.colors.slice(start), ...group.colors.slice(0, start)];
}

/** «Оттенки одного цвета» предлагаем, только если у базового цвета не меньше 3 фирменных оттенков. */
export function similarAvailable(base: string): boolean {
  const shades = paletteShades(base);
  return shades !== null && shades.length >= 3;
}

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

/** После шести основных цветов повторяем палитру, не выдумывая новые. */
function distinctColors(theme: StatDecoTheme, count: number): string[] {
  return Array.from({ length: count }, (_, i) => theme.distinct[i % theme.distinct.length] ?? theme.primary);
}

/** В режиме оттенков выбранная строка остаётся выбранного цвета, остальные следуют циклу группы. */
export function changeChartColor(rendering: StatDecoRendering, index: number, color: string): StatDecoRendering {
  if (rendering.colorMode === "similar") {
    const shades = paletteShades(color);
    if (!shades || shades.length < 3) return { ...rendering, colorMode: "same", customColors: [color] };
    const base = shades[(shades.length - index % shades.length) % shades.length] ?? color;
    return { ...rendering, customColors: [base] };
  }
  if (rendering.colorMode === "same") return { ...rendering, customColors: [color] };
  const customColors = [...(rendering.customColors ?? [])];
  customColors[index] = color;
  return { ...rendering, customColors };
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
  else if (effective === "similar") {
    const baseColor = custom?.[0] ?? theme.primary;
    const fixed = paletteShades(baseColor);
    // Оттенков меньше, чем столбцов, — повторяем все по кругу; вне групп палитры — оттенки по светлоте.
    base = fixed ? Array.from({ length: n }, (_, i) => fixed[i % fixed.length]) : Array.from({ length: n }, () => theme.primary);
  }
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
