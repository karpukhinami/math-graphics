/**
 * Урезанная схема числовой прямой → полная JSON-сцена.
 *
 * Модель описывает прямые (rows) и на каждой — множества и точки. Границы множеств,
 * штриховка, цвета, засечки, шаги, диапазон оси и номера строк определяет код.
 */
import { evaluateNumber, parseBound } from "../math-expr";
import { parseIntervalMath } from "../line/intervals";
import type { SetMath } from "../line/types";
import {
  enumKey,
  flag,
  isRecord,
  niceStep,
  text,
  unwrapDraft,
  type DraftExpansion,
  type Rec,
} from "./draft-common";

const MAX_ROWS = 8;
const MAX_PALETTE_GROUP = 6;
const COORD_EPS = 1e-9;

function parseNumber(raw: string): number | null {
  try {
    return evaluateNumber(raw);
  } catch {
    return null;
  }
}

function emptySetMath(): SetMath {
  return {
    kind: "interval",
    left: "",
    right: "",
    leftOp: "<",
    rightOp: "<",
    rayOp: ">",
    rayBoundary: "",
    freeformInput: "",
  };
}

interface SetBuild {
  math: SetMath;
  display: "hatchRight" | "hatchLeft";
}

/** Одно множество из черновика → SetMath; null и ошибка при некорректных данных. */
function buildSetMath(item: Rec, where: string, errors: string[]): SetBuild | null {
  const declared = enumKey(item.type ?? item.kind);
  const type =
    declared ||
    ("notation" in item ? "set" : "direction" in item || "boundary" in item ? "ray" : "interval");
  const math = emptySetMath();

  if (type === "interval") {
    const from = text(item.from);
    const to = text(item.to);
    if (!from || !to) {
      errors.push(`${where}: для interval нужны границы from и to`);
      return null;
    }
    let lo: number;
    let hi: number;
    try {
      lo = parseBound(from);
      hi = parseBound(to);
    } catch {
      errors.push(`${where}: границы «${from}» и «${to}» должны быть числами или ±inf`);
      return null;
    }
    const fromOpen = flag(item.fromOpen, true);
    const toOpen = flag(item.toOpen, true);
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      math.kind = "interval";
      math.left = from;
      math.right = to;
      math.leftOp = fromOpen ? "<" : "<=";
      math.rightOp = toOpen ? "<" : "<=";
      return { math, display: "hatchRight" };
    }
    if (!Number.isFinite(lo) && Number.isFinite(hi)) {
      math.kind = "ray";
      math.rayBoundary = to;
      math.rayOp = toOpen ? "<" : "<=";
      return { math, display: "hatchLeft" };
    }
    if (Number.isFinite(lo) && !Number.isFinite(hi)) {
      math.kind = "ray";
      math.rayBoundary = from;
      math.rayOp = fromOpen ? ">" : ">=";
      return { math, display: "hatchRight" };
    }
    errors.push(`${where}: обе границы бесконечны — такое множество не рисуется`);
    return null;
  }

  if (type === "ray") {
    const boundary = text(item.boundary ?? item.from ?? item.to);
    if (!boundary) {
      errors.push(`${where}: для ray нужна граница boundary`);
      return null;
    }
    const dir = enumKey(item.direction ?? item.op);
    const right = ["right", ">", ">=", "+inf", "plus"].includes(dir);
    const left = ["left", "<", "<=", "-inf", "minus"].includes(dir);
    if (!right && !left) {
      errors.push(`${where}: для ray нужно direction: "right" (x > a) или "left" (x < a)`);
      return null;
    }
    const open = flag(item.open, true);
    math.kind = "ray";
    math.rayBoundary = boundary;
    math.rayOp = right ? (open ? ">" : ">=") : open ? "<" : "<=";
    return { math, display: right ? "hatchRight" : "hatchLeft" };
  }

  if (type === "set" || type === "union" || type === "freeform") {
    const notation = text(item.notation);
    if (!notation) {
      errors.push(`${where}: для set нужно поле notation, например "(-inf; -2] ; [1; 3)"`);
      return null;
    }
    math.kind = "freeform";
    math.freeformInput = notation;
    return { math, display: "hatchRight" };
  }

  errors.push(`${where}: неизвестный тип «${text(item.type ?? item.kind)}»; допустимо interval | ray | set`);
  return null;
}

export function expandLineDraft(raw: unknown): DraftExpansion {
  const errors: string[] = [];
  const root = unwrapDraft(raw, ["axis", "rows", "sets", "points"]);
  if (!root) return { scene: null, errors: ["Ответ должен быть JSON-объектом"] };

  // ── Прямые: rows[] (либо плоские sets/points как одна прямая) ──────────
  let rowsRaw: unknown[] = Array.isArray(root.rows) ? root.rows : [];
  if (!rowsRaw.length && (Array.isArray(root.sets) || Array.isArray(root.points))) {
    rowsRaw = [{ sets: root.sets, points: root.points }];
  }
  if (!rowsRaw.length) errors.push("rows: нужна хотя бы одна прямая");
  if (rowsRaw.length > MAX_ROWS) errors.push(`rows: слишком много прямых (максимум ${MAX_ROWS})`);

  const sets: unknown[] = [];
  const points: unknown[] = [];
  /** Все конечные координаты содержимого — для подбора диапазона оси. */
  const contentCoords: number[] = [];
  let setCounter = 0;
  let pointCounter = 0;

  rowsRaw.slice(0, MAX_ROWS).forEach((rowItem, rowIndex) => {
    const rowWhere = `Прямая ${rowIndex + 1}`;
    if (!isRecord(rowItem)) {
      errors.push(`${rowWhere}: должна быть объектом с полями sets и points`);
      return;
    }
    const boundaries: number[] = [];
    const usedCoords: number[] = [];

    const setsRaw = Array.isArray(rowItem.sets) ? rowItem.sets : [];
    setsRaw.forEach((setItem, i) => {
      const where = `${rowWhere}, множество ${i + 1}`;
      if (!isRecord(setItem)) {
        errors.push(`${where}: должно быть объектом`);
        return;
      }
      const built = buildSetMath(setItem, where, errors);
      if (!built) return;

      const parsed = parseIntervalMath(built.math);
      if (parsed.error) {
        errors.push(`${where}: ${parsed.error}`);
        return;
      }
      for (const part of parsed.parts) {
        for (const value of [part.left, part.right]) {
          if (Number.isFinite(value)) {
            boundaries.push(value);
            contentCoords.push(value);
          }
        }
      }

      setCounter += 1;
      sets.push({
        index: setCounter,
        axisRow: rowIndex,
        math: built.math,
        style: {
          colorGroup: ((setCounter - 1) % MAX_PALETTE_GROUP) + 1,
          display: built.display,
          position: enumKey(setItem.side) === "below" ? "below" : "above",
          visible: true,
        },
      });
    });

    const pointsRaw = Array.isArray(rowItem.points) ? rowItem.points : [];
    pointsRaw.forEach((pointItem, i) => {
      const where = `${rowWhere}, точка ${i + 1}`;
      if (!isRecord(pointItem)) {
        errors.push(`${where}: должна быть объектом`);
        return;
      }
      const coordinate = text(pointItem.x ?? pointItem.coordinate);
      if (!coordinate) {
        errors.push(`${where}: нужна координата x`);
        return;
      }
      const value = parseNumber(coordinate);
      if (value === null) {
        errors.push(`${where}: координата «${coordinate}» не является числом`);
        return;
      }
      // Граничные точки множеств создаёт система; дубликаты координат на одной прямой не нужны.
      const duplicate = [...boundaries, ...usedCoords].some((c) => Math.abs(c - value) < COORD_EPS);
      if (duplicate) return;
      usedCoords.push(value);
      contentCoords.push(value);

      const label = text(pointItem.label);
      pointCounter += 1;
      points.push({
        index: pointCounter,
        axisRow: rowIndex,
        math: { coordinate, sourceSetId: null, boundaryKey: null },
        style: {
          open: flag(pointItem.open, false),
          label,
          showLabel: true,
          showCoords: flag(pointItem.showCoords, !label),
          visible: true,
          perpendicular: flag(pointItem.perpendicular, false),
        },
      });
    });
  });

  if (!sets.length && !points.length && !errors.length) {
    errors.push("Черновик пуст: нет ни одного множества или точки");
  }

  // ── Ось: диапазон по содержимому, если не задан или не вмещает его ─────
  const axisRaw = isRecord(root.axis) ? root.axis : {};
  const givenMin = text(axisRaw.min);
  const givenMax = text(axisRaw.max);
  let min = givenMin ? parseNumber(givenMin) : null;
  let max = givenMax ? parseNumber(givenMax) : null;
  if (givenMin && min === null) errors.push(`axis.min: «${givenMin}» не является числом`);
  if (givenMax && max === null) errors.push(`axis.max: «${givenMax}» не является числом`);

  if (contentCoords.length) {
    const lo = Math.min(...contentCoords);
    const hi = Math.max(...contentCoords);
    const pad = Math.max(1, (hi - lo) * 0.3);
    if (min === null || lo < min) min = Math.floor(min === null ? lo - pad : lo - 1);
    if (max === null || hi > max) max = Math.ceil(max === null ? hi + pad : hi + 1);
  }
  if (min !== null && max !== null && !(max > min)) {
    errors.push("axis: max должен быть больше min");
  }

  const axisOk = min !== null && max !== null && max > min;
  const step = text(axisRaw.step) || (axisOk ? niceStep(min!, max!) : "1");

  // По умолчанию у чертежа множеств деления не нужны, у чертежа одних точек — нужны.
  const tickMode = enumKey(root.ticks) || (sets.length ? "none" : "all");
  const showTicks = tickMode !== "none";

  const scene = {
    version: 1,
    space: "line",
    line: {
      axis: {
        name: text(axisRaw.name) || "x",
        unit: "",
        min: min !== null ? String(min) : "",
        max: max !== null ? String(max) : "",
        majorStep: step,
      },
      ticks: {
        majorVisible: showTicks,
        majorLabelMode: showTicks ? "all" : "none",
        minorEnabled: false,
      },
      axisRowCount: Math.max(1, Math.min(rowsRaw.length, MAX_ROWS)),
      sets,
      points,
    },
  };

  return { scene, errors };
}
