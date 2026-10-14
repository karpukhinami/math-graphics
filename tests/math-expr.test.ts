import { describe, expect, it } from "bun:test";
import { normalizeInput, parseExpression } from "../src/lib/plotting/math-expr";

describe("разбор формул от модели", () => {
  it("запятая между аргументами log не превращается в десятичную точку", () => {
    expect(normalizeInput("log(x, 2) - 3")).toBe("log(x, 2) - 3");
    expect(() => parseExpression("log(x, 2) - 3", ["x"])).not.toThrow();
  });
  it("десятичная запятая между цифрами остаётся десятичной", () => {
    expect(normalizeInput("2,5x")).toBe("2.5x");
  });
  it("хвостовая точка не ломает log_2 x", () => {
    expect(() => parseExpression("-3 + log_2 x.", ["x"])).not.toThrow();
  });
  it("log₂x и \\log_2 x понимаются как логарифм по основанию 2", () => {
    expect(normalizeInput("log₂x - 3")).toBe("log(x, 2) - 3");
    expect(normalizeInput("\\log_2 x - 3")).toBe("log(x, 2) - 3");
  });
});
