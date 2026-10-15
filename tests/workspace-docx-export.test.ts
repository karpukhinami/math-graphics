import { describe, expect, test } from "bun:test";
import { Packer } from "docx";
import JSZip from "jszip";
import { answerLetter, buildTaskDocument, latexToOmml } from "../src/lib/workspace/docx-export";

describe("выгрузка в Word", () => {
  test("варианты ответа называются А, Б, В, Г", () => {
    expect([0, 1, 2, 3].map(answerLetter)).toEqual(["А", "Б", "В", "Г"]);
  });
  test("LaTeX превращается в формулу Word", () => {
    expect(latexToOmml("\\frac{1}{2}")).toContain("<m:f>");
  });
  test("варианты идут подряд вниз с буквами, формулы — объекты Word", async () => {
    const doc = buildTaskDocument("Т", [{ type: "choice", text: "Найдите $x^2$", options: ["1", "2", "3", "4"].map((text) => ({ text })) }], {});
    const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("<m:oMath");
    const order = ["А) ", "Б) ", "В) ", "Г) "].map((l) => xml.indexOf(l));
    expect(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1]))).toBe(true);
  });
});
