import { describe, expect, test } from "bun:test";
import { plotInsertionImages, insertPlotImageTokens } from "../src/lib/workspace/plot-insertion";
import type { PlotScene } from "../src/lib/plotting/types";

describe("beautified plot insertion", () => {
  const scene = { space: "plane" } as PlotScene;
  test("inserts both images, original first, with editable scene only on original", () => {
    expect(plotInsertionImages("original-svg", scene, "beautified-png")).toEqual([
      { src: "original-svg", scene }, { src: "beautified-png" },
    ]);
  });
  test("without beautification inserts only the original", () => {
    expect(plotInsertionImages("original-svg", scene, null)).toEqual([{ src: "original-svg", scene }]);
  });
  test("inserts both tokens together at the cursor without reversing them", () => {
    expect(insertPlotImageTokens("ДоПосле", ["original", "beautified"], 2)).toBe(
      "До\n![Чертёж](plot:original)\n\n![Чертёж](plot:beautified)\nПосле",
    );
  });
});