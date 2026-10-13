import { describe, expect, test } from "bun:test";
import { buildGraph } from "../src/lib/plotting/build";
import { pointsOnGraphAtX } from "../src/lib/plotting/solve";
import type { GraphMath } from "../src/lib/plotting/types";

const math: GraphMath = {
  kind: "piecewise-linear", expression: "", equation: "", pieces: [],
  anchors: [
    { x: "3", y: "1", kind: "min" },
    { x: "-2", y: "-1", kind: "plain" },
    { x: "0", y: "3", kind: "max" },
  ],
  extendEnds: false, domainFrom: "", domainTo: "",
};
const bounds = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
const build = (patch: Partial<GraphMath> = {}) =>
  buildGraph({ ...math, ...patch }, { x: "x", y: "y" }, bounds);

describe("point-defined functions", () => {
  test("connects exact vertices in x order, preserving source anchor indexes", () => {
    const result = build();
    expect(result.segments).toEqual([[[-2, -1], [0, 3], [3, 1]]]);
    expect(result.anchors?.[0].x).toBe(3);
    expect(pointsOnGraphAtX(result, -1)[0].y).toBe(1);
    expect(pointsOnGraphAtX(result, -3)).toEqual([]);
  });
  test("extends the first and last segment with unchanged slopes", () => {
    const result = build({ extendEnds: true });
    expect(result.segments[0][0]).toEqual([-5, -7]);
    expect(result.segments[0].at(-1)?.[0]).toBe(5);
    expect(result.segments[0].at(-1)?.[1]).toBeCloseTo(-1 / 3);
    expect(pointsOnGraphAtX(result, 4)[0].y).toBeCloseTo(1 / 3);
  });
  test("clips to explicit domain while retaining internal corners", () => {
    expect(build({ extendEnds: true, domainFrom: "-1", domainTo: "1" }).segments)
      .toEqual([[[-1, 1], [0, 3], [1, 7 / 3]]]);
  });
  test("rejects duplicate horizontal coordinates", () => {
    expect(() => build({ anchors: [math.anchors[0], { x: "3", y: "4", kind: "plain" }] }))
      .toThrow("разные координаты");
  });
  test("two anchors form a line, irrespective of extrema metadata", () => {
    expect(build({ anchors: [math.anchors[0], math.anchors[2]] }).segments)
      .toEqual([[[0, 3], [3, 1]]]);
  });
  test("legacy smooth interpolation remains curved", () => {
    const result = build({ kind: "qualitative" });
    expect(result.segments[0].length).toBeGreaterThan(3);
    expect(pointsOnGraphAtX(result, -1)[0].y).not.toBeCloseTo(1);
  });
});