// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Packer } from "docx";
import { buildTaskDocument } from "@/lib/workspace/docx-export";
import { importDocx } from "@/lib/workspace/docx-import";

describe("импорт Word", () => {
  it("формулы Word превращаются в LaTeX, весь текст — одно поле", async () => {
    const doc = buildTaskDocument("Задача", [{ type: "text", text: "Решите $\\frac{x^2}{3}=\\sqrt{y}$ сейчас", options: [] }], {});
    const buf = await Packer.toBuffer(doc);
    const { text } = await importDocx(new Blob([buf]), () => "id1");
    expect(text).toContain("Задача");
    expect(text).toMatch(/\$\\frac\{x\^\{?2\}?\}\{3\}=\\sqrt\{y\}\$/);
  });
});
