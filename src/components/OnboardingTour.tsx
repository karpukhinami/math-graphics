/** Короткий тур с подсветкой элементов по атрибуту data-tour; показывается один раз (localStorage). */
import { useEffect, useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export interface TourStep { target: string; title: string; text: string }

export function OnboardingTour({ id, steps }: { id: string; steps: TourStep[] }) {
  const key = `onboarding:${id}:v1`;
  const [index, setIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (localStorage.getItem(key)) return;
    const t = window.setTimeout(() => setIndex(0), 600);
    return () => window.clearTimeout(t);
  }, [key]);

  useLayoutEffect(() => {
    if (index === null) return;
    const update = () => {
      const el = document.querySelector(`[data-tour="${steps[index].target}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    document.querySelector(`[data-tour="${steps[index].target}"]`)?.scrollIntoView({ block: "nearest" });
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [index, steps]);

  if (index === null) return null;
  const step = steps[index];
  const last = index === steps.length - 1;
  const finish = () => { localStorage.setItem(key, "1"); setIndex(null); };

  const pad = 6;
  const cardW = 320;
  let top = 80, left = window.innerWidth / 2 - cardW / 2;
  if (rect) {
    const below = rect.bottom + 12;
    top = below + 180 < window.innerHeight ? below : Math.max(12, rect.top - 192);
    left = Math.min(Math.max(12, rect.left), window.innerWidth - cardW - 12);
    if (rect.width < 300 && rect.right + cardW + 24 < window.innerWidth && rect.height > 200) {
      left = rect.right + 12; top = Math.max(12, rect.top);
    }
  }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-label="Подсказки">
      {rect ? (
        <div className="pointer-events-none absolute rounded-lg ring-2 ring-primary transition-all"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px color-mix(in oklab, var(--foreground) 45%, transparent)" }} />
      ) : <div className="absolute inset-0 bg-foreground/45" />}
      <div className="absolute space-y-2 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg"
        style={{ top, left, width: cardW }}>
        <div className="text-xs text-muted-foreground">{index + 1} из {steps.length}</div>
        <div className="font-semibold">{step.title}</div>
        <p className="text-sm text-muted-foreground">{step.text}</p>
        <div className="flex justify-between pt-1">
          <Button variant="ghost" size="sm" onClick={finish}>Пропустить</Button>
          <Button size="sm" onClick={() => (last ? finish() : setIndex(index + 1))}>{last ? "Понятно" : "Далее"}</Button>
        </div>
      </div>
    </div>
  );
}
