import { useState } from "react";
import { ChevronDown, Eye, EyeOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorDot } from "./ColorDot";
import { ToggleChip } from "./ToggleChip";
import { ValueFormula } from "./MathLatex";
import { usePlotStore } from "@/lib/plotting/store";
import { isSingleValued } from "@/lib/plotting/scene";
import type { ScenePoint } from "@/lib/plotting/types";

export function PointCard({ point }: { point: ScenePoint }) {
  const [open, setOpen] = useState(false);
  const scene = usePlotStore((state) => state.scene);
  const updatePointMath = usePlotStore((state) => state.updatePointMath);
  const updatePointStyle = usePlotStore((state) => state.updatePointStyle);
  const togglePointSolution = usePlotStore((state) => state.togglePointSolution);
  const removePoint = usePlotStore((state) => state.removePoint);
  const buildPoint = usePlotStore((state) => state.buildPoint);

  const xName = scene.xAxis.name.trim() || "x";
  const yName = scene.yAxis.name.trim() || "y";
  const math = point.math;
  const graph = scene.graphs.find((item) => item.id === math.graphId);
  const solution = point.built?.[0] ?? null;

  // Свободную точку можно двигать целиком; точку на однозначной функции —
  // только вдоль горизонтальной оси; рассчитанные точки не редактируются.
  const editableX = math.mode === "plane" || (math.mode === "onGraph" && !!graph && isSingleValued(graph));
  const editableY = math.mode === "plane";

  const coordsText = solution ? `(${solution.displayX}; ${solution.displayY})` : "не построена";
  return (
    <Card className="border-border">
      <CardContent className="p-2.5">
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center gap-1.5">
            <CollapsibleTrigger className="shrink-0 text-muted-foreground">
              <ChevronDown className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} />
            </CollapsibleTrigger>

            <Input
              value={point.style.label}
              placeholder={`Точка ${point.index}`}
              className="h-8 w-[4.5rem] shrink-0 px-2 text-xs italic"
              onChange={(event) => updatePointStyle(point.id, { label: event.target.value })}
            />

            {editableX || editableY ? (
              <div className="flex min-w-0 flex-1 items-center gap-0.5 text-xs">
                <span className="text-muted-foreground">(</span>
                <Input
                  value={math.x}
                  placeholder={xName}
                  className="h-8 min-w-0 flex-1 px-1.5 text-center font-mono text-xs"
                  onChange={(event) => updatePointMath(point.id, { x: event.target.value })}
                  onBlur={() => buildPoint(point.id)}
                />
                <span className="text-muted-foreground">;</span>
                {editableY ? (
                  <Input
                    value={math.y}
                    placeholder={yName}
                    className="h-8 min-w-0 flex-1 px-1.5 text-center font-mono text-xs"
                    onChange={(event) => updatePointMath(point.id, { y: event.target.value })}
                    onBlur={() => buildPoint(point.id)}
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate px-1 text-center font-mono">
                    {solution ? solution.displayY : "—"}
                  </span>
                )}
                <span className="text-muted-foreground">)</span>
              </div>
            ) : (
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{coordsText}</span>
            )}

            <ColorDot
              value={point.style.color}
              onChange={(color) => updatePointStyle(point.id, { color })}
              title="Цвет точки"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`size-8 ${point.style.visible ? "text-primary" : "text-muted-foreground"}`}
              title={point.style.visible ? "Точка видна" : "Точка скрыта"}
              onClick={() => updatePointStyle(point.id, { visible: !point.style.visible })}
            >
              {point.style.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              onClick={() => removePoint(point.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>

          {(editableX || editableY) && (
            <div className="flex gap-2 pl-6 pt-1">
              <ValueFormula value={math.x} prefix={`${xName} =`} />
              {editableY && <ValueFormula value={math.y} prefix={`${yName} =`} />}
            </div>
          )}

          <CollapsibleContent className="space-y-2 pt-2 pl-6">
            <div className="flex flex-wrap gap-1.5">
              <ToggleChip checked={point.style.open} onChange={(v) => updatePointStyle(point.id, { open: v })}>
                Выколотая
              </ToggleChip>
              <ToggleChip checked={point.style.showCoords} onChange={(v) => updatePointStyle(point.id, { showCoords: v })}>
                Координаты
              </ToggleChip>
              <ToggleChip
                checked={point.style.projectX}
                title="Перпендикуляр к горизонтальной оси"
                onChange={(v) => updatePointStyle(point.id, { projectX: v })}
              >
                ⊥ к {xName}
              </ToggleChip>
              <ToggleChip
                checked={point.style.projectY}
                title="Перпендикуляр к вертикальной оси"
                onChange={(v) => updatePointStyle(point.id, { projectY: v })}
              >
                ⊥ к {yName}
              </ToggleChip>
            </div>
            {(point.style.projectX || point.style.projectY) && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Подписать основание:</span>
                {point.style.projectX && (
                  <ToggleChip checked={point.style.labelProjectionX} onChange={(v) => updatePointStyle(point.id, { labelProjectionX: v })}>
                    на {xName}
                  </ToggleChip>
                )}
                {point.style.projectY && (
                  <ToggleChip checked={point.style.labelProjectionY} onChange={(v) => updatePointStyle(point.id, { labelProjectionY: v })}>
                    на {yName}
                  </ToggleChip>
                )}
              </div>
            )}


            {point.built && point.built.length > 1 && (
              <div className="space-y-1.5 rounded-md border border-border p-2">
                <Label className="text-xs text-muted-foreground">
                  В этой координате график даёт несколько значений
                </Label>
                {point.built.map((item, index) => (
                  <div key={index} className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs">
                      ({item.displayX}; {item.displayY}){item.style?.open ? " — выколотая" : ""}
                    </span>
                    <Switch
                      checked={item.show}
                      onCheckedChange={(checked) => togglePointSolution(point.id, index, checked)}
                    />
                  </div>
                ))}
              </div>
            )}

            {point.error && <p className="text-xs text-destructive">{point.error}</p>}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
