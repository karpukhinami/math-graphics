import { beforeEach, describe, expect, test } from "bun:test";
import { usePlotStore } from "../src/lib/plotting/store";

const store = () => usePlotStore.getState();
function drawGraph() {
  store().addGraph();
  const graph = store().scene.graphs[0];
  store().updateGraphMath(graph.id, { expression: "x^2" });
  expect(store().scene.graphs[0].built?.segments.length).toBeGreaterThan(0);
}
beforeEach(() => store().startSession());

describe("изоляция режимов и окон", () => {
  test("переход ручной → ИИ очищает чертёж и черновики", () => {
    drawGraph();
    store().startPointDraft();
    const previous = store().sessionVersion;
    store().setInputMode("ai");
    expect(store().scene.graphs).toHaveLength(0);
    expect(store().pointDraft).toBeNull();
    expect(store().status).toBeNull();
    expect(store().sessionVersion).toBe(previous + 1);
  });
  test("возврат в ручной режим не восстанавливает ни ручной, ни ИИ чертёж", () => {
    drawGraph();
    store().setInputMode("ai");
    drawGraph();
    store().setInputMode("manual");
    expect(store().scene.graphs).toHaveLength(0);
    expect(store().scene.points).toHaveLength(0);
  });
  test("переключение ИИ сценария сбрасывает сцену и инвалидирует старый запрос", () => {
    store().setInputMode("ai");
    drawGraph();
    const version = store().sessionVersion;
    store().resetScene();
    expect(store().sessionVersion).toBe(version + 1);
    expect(store().scene.graphs).toHaveLength(0);
    expect(store().inputMode).toBe("ai");
  });
  test("новое окно не наследует картинку, размерность и режим предыдущего инструмента", () => {
    store().setSpaceTab("line");
    store().startLinePointDraft();
    store().updateLinePointDraftMath({ coordinate: "3" });
    store().commitLinePointDraft();
    expect(store().scene.line?.points).toHaveLength(1);
    store().setInputMode("ai");
    store().startSession();
    expect(store().inputMode).toBe("manual");
    expect(store().spaceTab).toBe("plane");
    expect(store().scene.line).toBeUndefined();
    expect(store().scene.graphs).toHaveLength(0);
  });
  test("смена размерности очищает все пространственные черновики", () => {
    store().setSpaceTab("space");
    store().startSpacePointDraft();
    expect(store().spacePointDraft).not.toBeNull();
    store().setSpaceTab("plane");
    expect(store().spacePointDraft).toBeNull();
    expect(store().scene.space3d).toBeUndefined();
  });
  test("нажатие уже выбранного режима не удаляет построения", () => {
    drawGraph();
    const version = store().sessionVersion;
    store().setInputMode("manual");
    store().setSpaceTab("plane");
    expect(store().scene.graphs).toHaveLength(1);
    expect(store().sessionVersion).toBe(version);
  });
  test("явное редактирование сохранённого чертежа возможно после начала новой сессии", () => {
    drawGraph();
    const saved = structuredClone(store().scene);
    store().startSession("manual");
    store().importScene(saved);
    expect(store().scene.graphs[0].math.expression).toBe("x^2");
    expect(store().scene.graphs[0].built?.segments.length).toBeGreaterThan(0);
  });
});