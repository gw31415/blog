import { AssistiveMmlHandler } from "mathjax-full/js/a11y/assistive-mml.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { SafeHandler } from "mathjax-full/js/ui/safe/SafeHandler.js";

const adaptor = liteAdaptor();
AssistiveMmlHandler(SafeHandler(RegisterHTMLHandler(adaptor)));

const mathDocument = mathjax.document("", {
  InputJax: new TeX({ packages: AllPackages }),
  OutputJax: new SVG({ fontCache: "local" }),
});

export function renderMathContentHTML(latex: string, displayMode: boolean): string {
  return adaptor.outerHTML(mathDocument.convert(latex, { display: displayMode }));
}

export type LatexValidation = { ok: true; html: string } | { ok: false; message: string };

export function validateLatex(latex: string, displayMode: boolean): LatexValidation {
  const html = renderMathContentHTML(latex, displayMode);
  const error = /data-mjx-error="([^"]+)"/.exec(html)?.[1];

  return error ? { ok: false, message: error } : { ok: true, html };
}
