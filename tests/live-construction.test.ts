import { beforeEach, describe, expect, test } from "bun:test";
import { usePlotStore } from "../src/lib/plotting/store";
import { createGraph, createPoint, createScene, buildScene } from "../src/lib/plotting/scene";

const store = () => usePlotStore.getState();
const vertices = () => store().scene.graphs[0]?.built?.segments.flat() ?? [];

beforeEach(() => {
  usePlotStore.setState({
    scene: createScene(),
    spaceTab: "plane",
    inputMode: "manual",
    status: null,
  });
});

describe("автоматическое перестроение ввода", () => {
  test("уравнение сразу изменяет график и зависимую точку без кнопки построения", () => {
    const graph = createGraph(1);
    graph.math.expression = "x";
    const point = createPoint(1, { mode: "onGraph", graphId: graph.id, x: "1" });
    usePlotStore.setState({
      scene: buildScene({ ...createScene(), graphs: [graph], points: [point] }).scene,
    });
    store().updateGraphMath(graph.id, { expression: "2*x" });
    expect(store().scene.points[0].built?.[0].y).toBeCloseTo(2, 6);
    expect(store().scene.graphs[0].dirty).toBe(false);
    expect(vertices().some(([x, y]) => x > 1 && Math.abs(y - 2 * x) < 1e-6)).toBe(true);
  });

  test("новые пределы осей продолжают график до нового края", () => {
    const graph = createGraph(1);
    graph.math.expression = "x/10";
    usePlotStore.setState({ scene: buildScene({ ...createScene(), graphs: [graph] }).scene });
    expect(Math.max(...vertices().map(([x]) => x))).toBeCloseTo(5, 6);
    store().updateAxis("xAxis", { min: "-10", max: "10" });
    expect(Math.min(...vertices().map(([x]) => x))).toBeCloseTo(-10, 6);
    expect(Math.max(...vertices().map(([x]) => x))).toBeCloseTo(10, 6);
  });

  test("явно заданный промежуток сохраняется при расширении сетки", () => {
    const graph = createGraph(1);
    graph.math = { ...graph.math, expression: "x/10", domainFrom: "-2", domainTo: "3" };
    usePlotStore.setState({ scene: buildScene({ ...createScene(), graphs: [graph] }).scene });
    store().updateAxis("xAxis", { min: "-10", max: "10" });
    expect(Math.min(...vertices().map(([x]) => x))).toBeCloseTo(-2, 6);
    expect(Math.max(...vertices().map(([x]) => x))).toBeCloseTo(3, 6);
  });

  test("новая функция строится при вводе без отдельного подтверждения", () => {
    store().addGraph();
    store().updateGraphMath(store().scene.graphs[0].id, { expression: "x/2" });
    expect(vertices().length).toBeGreaterThan(2);
    expect(store().scene.graphs[0].error).toBeNull();
  });

  test("границы множества и связанные точки обновляются вместе", () => {
    store().setSpaceTab("line");
    store().startSetDraft();
    store().updateSetDraftMath({
      kind: "interval",
      left: "-2",
      right: "2",
      leftOp: "<",
      rightOp: "<",
    });
    store().commitSetDraft();
    const set = store().scene.line?.sets[0];
    expect(set).toBeDefined();
    if (!set) throw new Error("Множество не создано");
    store().updateSetMath(set.id, { right: "3" });
    expect(store().scene.line?.sets[0].built?.parts[0].right).toBe(3);
    expect(store().scene.line?.points.some((point) => point.locked && point.built?.x === 3)).toBe(
      true,
    );
  });

  test("изменение координаты самостоятельной точки на прямой применяется сразу", () => {
    store().setSpaceTab("line");
    store().startLinePointDraft();
    store().updateLinePointDraftMath({ coordinate: "1/3" });
    store().commitLinePointDraft();
    const point = store().scene.line?.points[0];
    if (!point) throw new Error("Точка не создана");
    store().updateLinePointMath(point.id, { coordinate: "2/3" });
    expect(store().scene.line?.points[0].built?.x).toBeCloseTo(2 / 3, 12);
  });

  test("пространственная точка и её зависимости пересчитываются без построить всё", () => {
    store().setSpaceTab("space");
    store().setSpaceShapeKind("parallelepiped");
    store().setSpaceBaseInput("ABCD");
    store().buildSpaceFigure();
    store().startSpacePointDraft();
    store().commitSpacePointDraft();
    const point = store().scene.space3d?.points[0];
    if (!point?.geometry) throw new Error("Пространственная точка не создана");
    const old = { ...point.geometry };
    store().updateSpacePointOnLine(point.id, { lineParam: 0.8 });
    const changed = store().scene.space3d?.points[0];
    expect(changed?.dirty).toBe(false);
    expect(changed?.geometry).not.toEqual(old);
  });

  test("черновики не попадают в сцену автоматически", () => {
    store().startPointDraft();
    store().updatePointDraft({ mode: "plane", x: "2", y: "3" });
    store().updateAxis("xAxis", { max: "10" });
    expect(store().scene.points).toHaveLength(0);
    expect(store().pointDraft?.x).toBe("2");
  });
});
