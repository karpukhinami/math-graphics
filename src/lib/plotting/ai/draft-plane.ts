/**
 * Урезанная схема координатной плоскости → полная JSON-сцена.
 *
 * Модель задаёт только содержание: пределы осей, графики и точки (в том числе точки,
 * зависящие от графиков). Цвета, толщины, сетка, форма области, шаги и прочие
 * технические значения подставляются здесь.
 */
import { compileExpression, evaluateNumber } from "../math-expr";
import {
  enumKey,
  flag,
  isRecord,
  MIN_GRID_CELLS,
  niceStep,
  niceStepPi,
  refKey,
  text,
  unwrapDraft,
  type DraftExpansion,
  type Rec,
} from "./draft-common";

type GraphType = "explicit" | "implicit" | "piecewise" | "points";

interface GraphRef {
  id: string;
  /** Как график назван в черновике. */
  ref: string;
  type: GraphType;
  anchorCount: number;
}

const GRAPH_TYPE_ALIASES: Record<string, GraphType> = {
  explicit: "explicit",
  function: "explicit",
  implicit: "implicit",
  equation: "implicit",
  piecewise: "piecewise",
  points: "points",
  throughpoints: "points",
  qualitative: "points",
  smooth: "points",
  piecewiselinear: "points",
  polyline: "points",
};

type PointType = "coords" | "onGraph" | "intersection" | "graphPoint";

const POINT_TYPE_ALIASES: Record<string, PointType> = {
  coords: "coords",
  plane: "coords",
  xy: "coords",
  ongraph: "onGraph",
  graph: "onGraph",
  intersection: "intersection",
  intersect: "intersection",
  graphpoint: "graphPoint",
  anchor: "graphPoint",
  vertex: "graphPoint",
};

const ASPECT_RATIO_LIMIT = 3;
const MAX_PALETTE_GROUP = 6;

function inferGraphType(graph: Rec): GraphType | null {
  const declared = enumKey(graph.type ?? graph.kind);
  if (declared) return GRAPH_TYPE_ALIASES[declared] ?? null;
  if ("expression" in graph) return "explicit";
  if ("equation" in graph) return "implicit";
  if ("pieces" in graph) return "piecewise";
  if ("through" in graph || "points" in graph) return "points";
  return null;
}

function inferPointType(point: Rec): PointType | null {
  const declared = enumKey(point.type ?? point.mode ?? point.at);
  if (declared) return POINT_TYPE_ALIASES[declared] ?? null;
  if ("graphs" in point) return "intersection";
  if ("graph" in point && "index" in point) return "graphPoint";
  if ("graph" in point) return "onGraph";
  if ("x" in point && "y" in point) return "coords";
  return null;
}

/** y = f(x) → f(x): модель иногда пишет левую часть. */
function stripYEquals(expression: string, yName: string): string {
  const escaped = yName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^\\s*(?:${escaped}|f\\s*\\(\\s*x\\s*\\))\\s*=(?!=)\\s*`);
  // Хвостовые знаки препинания («x^2.») mathjs читает как обращение к свойству.
  return expression.replace(pattern, "").trim().replace(/[\s.,;:]+$/, "");
}

function parseNumber(raw: string): number | null {
  try {
    return evaluateNumber(raw);
  } catch {
    return null;
  }
}

function axisBound(
  axes: Rec,
  key: string,
  errors: string[],
): { raw: string; value: number } | null {
  const raw = text(axes[key]);
  if (!raw) {
    errors.push(`axes.${key}: не задан предел оси`);
    return null;
  }
  const value = parseNumber(raw);
  if (value === null) {
    errors.push(`axes.${key}: «${raw}» не является числом`);
    return null;
  }
  return { raw, value };
}

function labelFormat(value: unknown): "number" | "fraction" | "pi" {
  const key = enumKey(value);
  return key === "pi" || key === "fraction" ? key : "number";
}

function readAnchors(graph: Rec, where: string, errors: string[]) {
  const list = graph.through ?? graph.points;
  if (!Array.isArray(list) || list.length < 2) {
    errors.push(`${where}: для графика по точкам нужно минимум 2 точки в through`);
    return [];
  }
  const anchors: Array<{ x: string; y: string; kind: "plain" | "min" | "max" }> = [];
  list.forEach((item, i) => {
    let x = "";
    let y = "";
    let extremum = "";
    if (Array.isArray(item)) {
      x = text(item[0]);
      y = text(item[1]);
    } else if (isRecord(item)) {
      x = text(item.x);
      y = text(item.y);
      extremum = enumKey(item.extremum ?? item.kind);
    }
    if (!x || !y) {
      errors.push(`${where}: точка ${i + 1} графика должна иметь обе координаты x и y`);
      return;
    }
    anchors.push({ x, y, kind: extremum === "min" || extremum === "max" ? extremum : "plain" });
  });
  return anchors;
}

interface ExplicitGraph {
  id: string;
  ref: string;
  fn: (x: number) => number;
  from: number | null;
  to: number | null;
}

function compileExplicit(expression: string): ((x: number) => number) | null {
  try {
    const fn = compileExpression(expression, ["x"]);
    return (x) => fn({ x });
  } catch {
    return null;
  }
}

function graphValue(graph: ExplicitGraph, x: number): number {
  if (graph.from !== null && x < graph.from) return NaN;
  if (graph.to !== null && x > graph.to) return NaN;
  return graph.fn(x);
}

/**
 * Если точка (x, y) лежит ровно на двух явных графиках и эти графики пересекаются
 * внутри осей ровно один раз — возвращает эту пару. Иначе null (в т.ч. когда внутри
 * осей несколько пересечений: тогда инструмент отметил бы лишние точки).
 */
function findSoleCrossing(
  graphs: ExplicitGraph[],
  x: number,
  y: number,
  [xMin, xMax, yMin, yMax]: [number, number, number, number],
): [ExplicitGraph, ExplicitGraph] | null {
  const tolerance = 5e-3 * Math.max(1, Math.abs(y));
  const onGraph = graphs.filter((g) => Math.abs(graphValue(g, x) - y) <= tolerance);
  if (onGraph.length !== 2) return null;
  const [a, b] = onGraph;

  const steps = 2000;
  let crossings = 0;
  let prev = NaN;
  for (let i = 0; i <= steps; i += 1) {
    const sx = xMin + ((xMax - xMin) * i) / steps;
    const fa = graphValue(a, sx);
    const diff = fa - graphValue(b, sx);
    // Нулевая разность в узле считается один раз; смена знака между узлами — тоже.
    const crossed =
      Number.isFinite(diff) && (diff === 0 || (Number.isFinite(prev) && prev * diff < 0));
    if (crossed && fa >= yMin && fa <= yMax) crossings += 1;
    prev = diff;
  }
  return crossings === 1 ? [a, b] : null;
}

/**
 * Шаг оси: заданный моделью берётся, только если он даёт не меньше MIN_GRID_CELLS клеток;
 * иначе (и если шаг не задан) подбирается автоматически.
 */
function pickStep(
  requested: string,
  min: number,
  max: number,
  format: "number" | "fraction" | "pi",
): string {
  if (requested) {
    const value = parseNumber(requested);
    if (value !== null && value > 0 && (max - min) / value >= MIN_GRID_CELLS - 1e-9) {
      return requested;
    }
  }
  return format === "pi" ? niceStepPi(min, max) : niceStep(min, max);
}

export interface DraftOptions {
  /** Редактор заданий: координаты точек по умолчанию не показываются. */
  minimalLabels?: boolean;
}

export function expandPlaneDraft(raw: unknown, options: DraftOptions = {}): DraftExpansion {
  const errors: string[] = [];
  const root = unwrapDraft(raw, ["axes", "axis", "graphs", "points"]);
  if (!root) return { scene: null, errors: ["Ответ должен быть JSON-объектом"] };

  // ── Оси ────────────────────────────────────────────────────────────────
  const axes = isRecord(root.axes) ? root.axes : isRecord(root.axis) ? root.axis : {};
  const xMin = axisBound(axes, "xMin", errors);
  const xMax = axisBound(axes, "xMax", errors);
  const yMin = axisBound(axes, "yMin", errors);
  const yMax = axisBound(axes, "yMax", errors);
  if (xMin && xMax && !(xMax.value > xMin.value)) errors.push("axes: xMax должен быть больше xMin");
  if (yMin && yMax && !(yMax.value > yMin.value)) errors.push("axes: yMax должен быть больше yMin");

  const xName = axisVariableName(text(axes.xName), "x");
  const yName = axisVariableName(text(axes.yName), "y");
  const xCaption = text(axes.xCaption).trim();
  const yCaption = text(axes.yCaption).trim();
  const xFormat = labelFormat(axes.xLabelFormat);
  const yFormat = labelFormat(axes.yLabelFormat);

  const axesOk = Boolean(xMin && xMax && yMin && yMax);
  const xSpan = axesOk ? xMax!.value - xMin!.value : 0;
  const ySpan = axesOk ? yMax!.value - yMin!.value : 0;
  // Квадратная сетка, пока масштабы осей сопоставимы; иначе независимые шкалы.
  const ratio = axesOk && ySpan > 0 ? xSpan / ySpan : 1;
  const equalScale = ratio <= ASPECT_RATIO_LIMIT && ratio >= 1 / ASPECT_RATIO_LIMIT;
  // При равном масштабе шаг сетки всегда 1 (кроме осей в долях π); шаг от модели игнорируется.
  const stepFor = (requested: string, min: number, max: number, format: "number" | "fraction" | "pi") =>
    equalScale && format !== "pi" ? "1" : pickStep(equalScale ? "" : requested, min, max, format);
  const xStep = axesOk ? stepFor(text(axes.xStep), xMin!.value, xMax!.value, xFormat) : "1";
  const yStep = axesOk ? stepFor(text(axes.yStep), yMin!.value, yMax!.value, yFormat) : "1";

  // ── Графики ────────────────────────────────────────────────────────────
  const graphsRaw = Array.isArray(root.graphs) ? root.graphs : [];
  const graphRefs: GraphRef[] = [];
  const explicitGraphs: ExplicitGraph[] = [];
  const graphs: unknown[] = [];

  graphsRaw.forEach((item, i) => {
    const n = i + 1;
    const where = `График ${n}`;
    if (!isRecord(item)) {
      errors.push(`${where}: должен быть объектом`);
      return;
    }
    const type = inferGraphType(item);
    if (!type) {
      errors.push(
        `${where}: не удалось определить тип; допустимо explicit | implicit | piecewise | points`,
      );
      return;
    }

    const id = `ai-graph-${n}`;
    const ref = refKey(item.id) || `g${n}`;
    const math: Rec = {
      kind: "explicit",
      expression: "",
      equation: "",
      domainFrom: text((isRecord(item.domain) ? item.domain.from : undefined) ?? item.domainFrom),
      domainTo: text((isRecord(item.domain) ? item.domain.to : undefined) ?? item.domainTo),
    };
    let anchorCount = 0;

    if (type === "explicit") {
      const expression = stripYEquals(text(item.expression), yName);
      if (!expression) errors.push(`${where}: для explicit нужно поле expression (правая часть y = …)`);
      if (expression.includes("=")) {
        errors.push(`${where}: в expression должна быть только правая часть без знака «=»`);
      }
      math.kind = "explicit";
      math.expression = expression;
    } else if (type === "implicit") {
      const equation = text(item.equation);
      if (!equation.includes("=")) errors.push(`${where}: для implicit нужно поле equation со знаком «=»`);
      math.kind = "implicit";
      math.equation = equation;
    } else if (type === "piecewise") {
      const pieces = Array.isArray(item.pieces) ? item.pieces : [];
      if (!pieces.length) errors.push(`${where}: для piecewise нужен массив pieces`);
      math.kind = "piecewise";
      math.pieces = pieces.filter(isRecord).map((piece) => ({
        expression: stripYEquals(text(piece.expression), yName),
        from: text(piece.from),
        to: text(piece.to),
        includeFrom: flag(piece.includeFrom, true),
        includeTo: flag(piece.includeTo, false),
      }));
    } else {
      const anchors = readAnchors(item, where, errors);
      anchorCount = anchors.length;
      const connect = enumKey(item.connect ?? item.type ?? item.kind);
      const segments = connect === "segments" || connect === "piecewiselinear" || connect === "polyline";
      math.kind = segments ? "piecewise-linear" : "qualitative";
      math.anchors = anchors;
      math.extendEnds = flag(item.extendEnds, false);
    }

    if (type === "explicit" && !errors.some((e) => e.startsWith(`${where}:`))) {
      const fn = compileExplicit(String(math.expression));
      if (fn) {
        explicitGraphs.push({
          id,
          ref,
          fn,
          from: parseNumber(String(math.domainFrom)),
          to: parseNumber(String(math.domainTo)),
        });
      }
    }

    graphRefs.push({ id, ref, type, anchorCount });
    const labelMode = enumKey(item.labelMode);
    if (labelMode && !["none", "name", "equation", "custom"].includes(labelMode)) {
      errors.push(`${where}: labelMode должен быть none | name | equation | custom`);
    }
    if (labelMode === "equation" && type !== "explicit" && type !== "implicit") {
      errors.push(`${where}: подпись уравнением доступна только для explicit и implicit; используй custom для своего текста`);
    }
    graphs.push({
      id,
      index: n,
      math,
      style: {
        colorGroup: ((n - 1) % MAX_PALETTE_GROUP) + 1,
        width: null,
        label: text(item.label),
        labelMode: labelMode || "none",
        ...(labelMode === "custom" ? { customLabel: text(item.customLabel) } : {}),
        visible: true,
      },
    });
  });

  function axisTarget(value: unknown): string | null {
    const key = typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "") : "";
    if (["ox", "x-axis", "xaxis", "axis:y=0", "y=0", "осьox", "осьx"].includes(key)) return "axis:y=0";
    if (["oy", "y-axis", "yaxis", "axis:x=0", "x=0", "осьoy", "осьy"].includes(key)) return "axis:x=0";
    return null;
  }

  function findGraph(value: unknown, where: string): GraphRef | null {
    const key = refKey(value);
    // Ссылка — id из черновика ("g1") либо порядковый номер графика (1, 2, …).
    const found = key
      ? (graphRefs.find((g) => g.ref === key) ??
        graphRefs.find((g) => g.id === `ai-graph-${Number(key)}`))
      : undefined;
    if (!found) {
      const known = graphRefs.map((g) => g.ref).join(", ") || "графиков нет";
      errors.push(`${where}: график «${key}» не найден (доступны: ${known})`);
      return null;
    }
    return found;
  }

  // ── Точки ──────────────────────────────────────────────────────────────
  const pointsRaw = Array.isArray(root.points) ? root.points : [];
  const points: unknown[] = [];

  pointsRaw.forEach((item, i) => {
    const n = i + 1;
    const where = `Точка ${n}`;
    if (!isRecord(item)) {
      errors.push(`${where}: должна быть объектом`);
      return;
    }
    const type = inferPointType(item);
    if (!type) {
      errors.push(
        `${where}: не удалось определить тип; допустимо coords | onGraph | intersection | graphPoint`,
      );
      return;
    }

    const math: Rec = {
      mode: "plane",
      x: "",
      y: "",
      graphId: null,
      graphIdB: null,
      anchorIndex: null,
    };
    let solutionLabels: string[] | undefined;

    if (type === "coords") {
      const x = text(item.x);
      const y = text(item.y);
      if (!x || !y) errors.push(`${where}: для coords нужны обе координаты x и y`);
      math.mode = "plane";
      math.x = x;
      math.y = y;
      const vx = parseNumber(x);
      const vy = parseNumber(y);
      // Страховка: модель задала координатами единственную точку пересечения двух графиков.
      // Заменяем её зависимостью — тогда точка остаётся точной и следует за графиками.
      const crossing =
        vx !== null && vy !== null && axesOk
          ? findSoleCrossing(explicitGraphs, vx, vy, [xMin!.value, xMax!.value, yMin!.value, yMax!.value])
          : null;
      if (crossing) {
        math.mode = "intersection";
        math.x = "";
        math.y = "";
        math.graphId = crossing[0].id;
        math.graphIdB = crossing[1].id;
      } else {
        if (vx !== null && xMin && xMax && (vx < xMin.value || vx > xMax.value)) {
          errors.push(`${where}: x=${x} вне пределов оси (${xMin.raw}…${xMax.raw}) — расширь оси`);
        }
        if (vy !== null && yMin && yMax && (vy < yMin.value || vy > yMax.value)) {
          errors.push(`${where}: y=${y} вне пределов оси (${yMin.raw}…${yMax.raw}) — расширь оси`);
        }
      }
    } else if (type === "onGraph") {
      const graph = findGraph(item.graph, where);
      const x = text(item.x);
      if (!x) errors.push(`${where}: для onGraph нужна координата x`);
      math.mode = "onGraph";
      math.x = x;
      math.graphId = graph?.id ?? null;
    } else if (type === "intersection") {
      const pair = Array.isArray(item.graphs) ? item.graphs : [item.graphA ?? item.graph, item.graphB];
      // Пересечение с осью: "Ox"/"Oy" → зарезервированные цели axis:y=0 / axis:x=0 (без новых графиков).
      const axisA = axisTarget(pair[0]);
      const axisB = axisTarget(pair[1]);
      const first = axisA ? null : findGraph(pair[0], where);
      const second = axisB ? null : findGraph(pair[1], where);
      if ((axisA && axisB) || (first && second && first.id === second.id)) {
        errors.push(`${where}: для intersection нужны два разных графика (или график и ось Ox/Oy)`);
      }
      math.mode = "intersection";
      math.graphId = axisA ? (second?.id ?? null) : (first?.id ?? null);
      math.graphIdB = axisA ?? axisB ?? second?.id ?? null;
      if (Array.isArray(item.labels)) {
        solutionLabels = item.labels.map((label) => text(label));
      }
    } else {
      const graph = findGraph(item.graph, where);
      const index = Number(item.index);
      if (graph && graph.type !== "points") {
        errors.push(`${where}: graphPoint работает только с графиком типа points`);
      } else if (graph && !(Number.isInteger(index) && index >= 1 && index <= graph.anchorCount)) {
        errors.push(
          `${where}: index должен быть номером точки графика от 1 до ${graph.anchorCount}`,
        );
      }
      math.mode = "anchor";
      math.graphId = graph?.id ?? null;
      math.anchorIndex = Number.isInteger(index) ? index - 1 : null;
    }

    const label = text(item.label);
    const dropX = flag(item.dropToXAxis, false);
    const dropY = flag(item.dropToYAxis, false);
    const labelOnAxes = flag(item.labelOnAxes, false);
    // Подпись «A» либо значения на осях уже называют точку — координаты рядом не дублируем.
    const showCoords = flag(
      item.showCoords,
      !options.minimalLabels && !label && !(labelOnAxes && (dropX || dropY)),
    );

    const rawPoint: Rec = {
      index: n,
      math,
      style: {
        open: flag(item.open, false),
        label,
        showCoords,
        visible: true,
        projectX: dropX,
        projectY: dropY,
        labelProjectionX: dropX && labelOnAxes,
        labelProjectionY: dropY && labelOnAxes,
      },
    };
    if (solutionLabels) rawPoint.solutionLabels = solutionLabels;
    points.push(rawPoint);
  });

  if (!graphs.length && !points.length) {
    errors.push("Черновик пуст: нет ни одного графика или точки");
  }

  const axisMarksAll = String(axes.axisMarks ?? "").trim() === "all";
  const scene = {
    version: 1,
    space: "plane",
    axisScaleMode: equalScale ? "equal" : "independent",
    plotAspectRatio: "4:3",
    xAxis: {
      name: xName,
      label: xCaption,
      unit: "",
      min: xMin?.raw ?? "",
      max: xMax?.raw ?? "",
      gridStep: xStep,
      labelStep: "",
      labelFormat: xFormat,
      markRule: axisMarksAll ? "all" : "zeroAndFirst",
      selectedMarks: "",
    },
    yAxis: {
      name: yName,
      label: yCaption,
      unit: "",
      min: yMin?.raw ?? "",
      max: yMax?.raw ?? "",
      gridStep: yStep,
      labelStep: "",
      labelFormat: yFormat,
      markRule: axisMarksAll ? "all" : "zeroAndFirst",
      selectedMarks: "",
    },
    grid: { visible: flag(root.grid, true) },
    graphs,
    points,
    tangents: [],
  };

  return { scene, errors };
}

/** Имя оси — это имя переменной в формулах; словесное название («Время (ч)») заменяем на стандартное. */
export function axisVariableName(raw: string | undefined, fallback: string): string {
  const v = (raw ?? "").trim();
  return /^[A-Za-zα-ωΑ-Ω](_?[A-Za-z0-9]{1,2})?$/.test(v) ? v : fallback;
}
