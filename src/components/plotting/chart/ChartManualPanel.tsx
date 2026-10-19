/** Плашка одной диаграммы: тип, оформление и таблица данных (формат — как у ИИ). */
import { useEffect, useState } from "react";
import { Eraser, Plus, Table2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CHART_TYPE_LABELS,
  addRow,
  addSeries,
  chartRowCount,
  clearCells,
  parseCell,
  removeColumn,
  removeRow,
  resizeTable,
  setCell,
  type StatDecoChartType,
  type StatDecoJson,
  type StatDecoRendering,
} from "@/lib/plotting/chart";
import { usePlotStore } from "@/lib/plotting/store";

const CHART_TYPES = Object.keys(CHART_TYPE_LABELS) as StatDecoChartType[];
const MULTI_SERIES: StatDecoChartType[] = ["bar", "line", "area", "radar"];
/** Типы, где логична ось значений с сеткой. */
const GRID_TYPES: StatDecoChartType[] = ["bar", "line", "area", "scatter", "histogram", "waterfall", "boxplot"];
/** Типы, где поддержан объёмный вид. */
const VOLUME_TYPES: StatDecoChartType[] = ["bar", "histogram", "waterfall", "pie"];

export function ChartCard({ chart, index }: { chart: StatDecoJson; index: number }) {
  const updateChart = usePlotStore((s) => s.updateChart);
  const removeChart = usePlotStore((s) => s.removeChart);
  const r = chart.rendering;
  const columns = chart.data.columns;
  const rows = chartRowCount(columns);
  const type = chart.chartType;

  const update = (patch: Partial<StatDecoJson>) => updateChart(index, { ...chart, ...patch });
  const render = (patch: Partial<StatDecoRendering>) => update({ rendering: { ...r, ...patch } });
  const setColumns = (next: StatDecoJson["data"]["columns"]) => update({ data: { columns: next } });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Диаграмма {index + 1}</CardTitle>
        <Button type="button" size="icon" variant="ghost" aria-label="Удалить диаграмму" onClick={() => removeChart(index)}>
          <Trash2 className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Тип</Label>
            <Select value={type} onValueChange={(v) => update({ chartType: v as StatDecoChartType })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHART_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{CHART_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Заголовок</Label>
            <CommitInput value={chart.title} placeholder="Без заголовка" onCommit={(title) => update({ title })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Цвета</Label>
            <Select value={r.colorMode ?? "different"} onValueChange={(v) => render({ colorMode: v as StatDecoRendering["colorMode"] })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="same">Один цвет</SelectItem>
                <SelectItem value="similar">Оттенки одного цвета</SelectItem>
                <SelectItem value="different">Разные цвета</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(type === "bar" || type === "waterfall" || type === "histogram") && (
            <div className="space-y-1">
              <Label className="text-xs">Ориентация</Label>
              <Select value={r.orientation ?? "vertical"} onValueChange={(v) => render({ orientation: v as "vertical" | "horizontal" })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vertical">Вертикально</SelectItem>
                  <SelectItem value="horizontal">Горизонтально</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {MULTI_SERIES.includes(type) && type !== "radar" && columns.length > 2 && (
            <div className="space-y-1">
              <Label className="text-xs">Несколько рядов</Label>
              <Select value={r.seriesLayout ?? "grouped"} onValueChange={(v) => render({ seriesLayout: v as StatDecoRendering["seriesLayout"] })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="grouped">Рядом</SelectItem>
                  <SelectItem value="stacked">Друг на друге</SelectItem>
                  <SelectItem value="stacked100">Доли до 100%</SelectItem>
                  <SelectItem value="overlay">Наложением</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {(type === "line" || type === "area") && (
            <div className="space-y-1">
              <Label className="text-xs">Линия</Label>
              <Select value={r.lineShape ?? "straight"} onValueChange={(v) => render({ lineShape: v as "straight" | "smooth" })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="straight">Ломаная</SelectItem>
                  <SelectItem value="smooth">Плавная</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {type === "pie" && (
            <div className="space-y-1">
              <Label className="text-xs">Отверстие в центре</Label>
              <Select value={r.innerHole ?? "none"} onValueChange={(v) => render({ innerHole: v as StatDecoRendering["innerHole"] })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Нет</SelectItem>
                  <SelectItem value="small">Маленькое</SelectItem>
                  <SelectItem value="medium">Среднее</SelectItem>
                  <SelectItem value="large">Большое</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
          <Label className="text-xs">Подписывать значения</Label>
          <Switch checked={r.showValues ?? false} onCheckedChange={(showValues) => render({ showValues })} />
        </div>
        {GRID_TYPES.includes(type) && (
          <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
            <Label className="text-xs">Ось и сетка</Label>
            <Switch checked={r.showGrid ?? false} onCheckedChange={(showGrid) => render({ showGrid })} />
          </div>
        )}
        {VOLUME_TYPES.includes(type) && (
          <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
            <Label className="text-xs">Объёмное</Label>
            <Switch checked={r.volume ?? false} onCheckedChange={(volume) => render({ volume })} />
          </div>
        )}

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {columns.map((col, c) => (
                  <th key={c} className="border-b border-border bg-muted/50 p-1 align-top">
                    <div className="flex items-center gap-1">
                      <CommitInput
                        value={String(col[0] ?? "")}
                        className="h-8 font-medium"
                        onCommit={(v) => setColumns(setCell(columns, c, 0, v))}
                      />
                      {c > 1 && (
                        <Button type="button" size="icon" variant="ghost" className="size-7 shrink-0" aria-label="Удалить ряд" onClick={() => setColumns(removeColumn(columns, c))}>
                          <X className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="w-8 border-b border-border bg-muted/50" />
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }, (_, row) => (
                <tr key={row}>
                  {columns.map((col, c) => (
                    <td key={c} className="p-1">
                      <CommitInput
                        value={col[row + 1] == null ? "" : String(col[row + 1])}
                        className="h-8"
                        inputMode={c === 0 ? "text" : "decimal"}
                        onCommit={(v) => setColumns(setCell(columns, c, row + 1, parseCell(v, c > 0)))}
                      />
                    </td>
                  ))}
                  <td className="p-1">
                    <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Удалить строку" onClick={() => setColumns(removeRow(columns, row))}>
                      <X className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setColumns(addRow(columns))}>
            <Plus className="size-4" />
            Строка
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setColumns(addSeries(columns))}>
            <Plus className="size-4" />
            Ряд данных
          </Button>
          <TableSizePopover
            rows={rows}
            cols={columns.length}
            onApply={(nextRows, nextCols) => setColumns(resizeTable(columns, nextRows, nextCols))}
          />
          <Button type="button" size="sm" variant="outline" onClick={() => setColumns(clearCells(columns))}>
            <Eraser className="size-4" />
            Очистить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Кнопка «Сетка»: задать размер таблицы разом (строки × столбцы). */
function TableSizePopover({ rows, cols, onApply }: { rows: number; cols: number; onApply: (rows: number, cols: number) => void }) {
  const [open, setOpen] = useState(false);
  const [nextRows, setNextRows] = useState(String(rows));
  const [nextCols, setNextCols] = useState(String(cols));
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setNextRows(String(rows));
          setNextCols(String(cols));
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <Table2 className="size-4" />
          Сетка
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 space-y-3" align="start">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Строк</Label>
            <Input type="number" min={1} max={50} value={nextRows} onChange={(e) => setNextRows(e.target.value)} className="h-8" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Столбцов</Label>
            <Input type="number" min={2} max={12} value={nextCols} onChange={(e) => setNextCols(e.target.value)} className="h-8" />
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="w-full"
          onClick={() => {
            onApply(Number(nextRows) || rows, Number(nextCols) || cols);
            setOpen(false);
          }}
        >
          Применить
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/** Поле, которое применяет значение при уходе фокуса или Enter. */
function CommitInput({
  value,
  onCommit,
  ...props
}: { value: string; onCommit: (v: string) => void } & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <Input
      {...props}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== value && onCommit(text)}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
    />
  );
}

export function ChartManualPanel() {
  const charts = usePlotStore((s) => s.charts);
  const addChart = usePlotStore((s) => s.addChart);
  return (
    <div className="space-y-4">
      {charts.length === 0 && <p className="text-sm text-muted-foreground">Диаграммы пока не добавлены.</p>}
      {charts.map((chart, i) => (
        <ChartCard key={i} chart={chart} index={i} />
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addChart}>
        <Plus className="size-4" />
        Диаграмма
      </Button>
    </div>
  );
}
