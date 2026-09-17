import katex from "katex";

export type LatexValidation = { ok: true; html: string } | { ok: false; message: string };

export function validateLatex(latex: string, displayMode: boolean): LatexValidation {
  try {
    return {
      ok: true,
      html: katex.renderToString(latex, { displayMode, throwOnError: true, strict: "warn" }),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "数式を解釈できませんでした。",
    };
  }
}
