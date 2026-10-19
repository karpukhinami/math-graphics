import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Компактный переключатель-«чип» вместо строки с тумблером. */
export function ToggleChip({
  checked,
  onChange,
  children,
  title,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-2.5 text-xs transition-colors",
        checked
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

/** Строка с тумблером: подпись слева, пояснение — во всплывающей подсказке. */
export function CompactSwitchRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5" title={hint}>
      <span className="text-xs">{label}</span>
      {children}
    </div>
  );
}
