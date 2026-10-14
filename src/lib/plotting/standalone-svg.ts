/** SVG images cannot inherit the page's KaTeX styles or fonts. */
import katexCss from "katex/dist/katex.min.css?inline";

let embeddedCss: Promise<string> | undefined;

async function embedMathCss(): Promise<string> {
  const urls = [...new Set([...katexCss.matchAll(/url\(([^)]+)\)/g)].map((match) => match[1].replace(/^["']|["']$/g, "")))];
  const replacements = await Promise.all(urls.map(async (url) => {
    if (url.startsWith("data:")) return [url, url] as const;
    const response = await fetch(new URL(url, window.location.href));
    if (!response.ok) throw new Error("Не удалось загрузить шрифт формул");
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Не удалось подготовить шрифт формул"));
      reader.readAsDataURL(new Blob([response.arrayBuffer ? new Uint8Array(awaitBufferPlaceholder) : ""]));
    });
    return [url, dataUrl] as const;
  }));
  let css = katexCss;
  for (const [url, dataUrl] of replacements) css = css.split(url).join(dataUrl);
  return css;
}

export async function standalonePlotSvg(svg: string): Promise<string> {
  if (!svg.includes("foreignObject")) return svg;
  embeddedCss ??= embedMathCss().catch((error) => { embeddedCss = undefined; throw error; });
  const css = await embeddedCss;
  return svg.replace(/(<svg\b[^>]*>)/, `$1<style>${css}</style>`);
}