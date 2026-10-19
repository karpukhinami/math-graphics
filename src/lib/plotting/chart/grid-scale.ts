/** Bounds and tick spacing belong to the renderer, never to AI or saved layout. */
export function chartGridScale(values: number[]) {
  const finite = values.filter(Number.isFinite);
  const low = Math.min(0, ...finite);
  const high = Math.max(0, ...finite);
  const span = high - low;
  if (!span) return { min: 0, max: 2, interval: 1 };
  const power = Math.floor(Math.log10(span / 5));
  const candidates = new Set<number>();
  for (let p = power - 2; p <= power + 3; p++) {
    for (const n of [1, 2, 5, 10, 25, 50]) candidates.add(Number((n * 10 ** p).toPrecision(12)));
  }
  const snap = (value: number, step: number, up: boolean) => {
    const q = value / step;
    const nearest = Math.round(q);
    const integer = Math.abs(q - nearest) < 1e-9 ? nearest : up ? Math.ceil(q) : Math.floor(q);
    return Number((integer * step).toPrecision(12));
  };
  const scales = [...candidates].map((interval) => {
    const min = snap(low, interval, false);
    const max = snap(high, interval, true);
    const lines = Math.round((max - min) / interval) + 1;
    return { min, max, interval, lines };
  }).filter((s) => s.lines >= 3 && s.lines <= 8);
  scales.sort((a, b) => a.interval - b.interval);
  const best = scales[0];
  return best ? { min: best.min, max: best.max, interval: best.interval } : { min: low, max: high, interval: span / 5 };
}