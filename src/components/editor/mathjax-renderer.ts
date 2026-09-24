import { AssistiveMmlHandler } from "@mathjax/src/js/a11y/assistive-mml.js";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import { MathJaxTexFont } from "@mathjax/mathjax-tex-font/js/svg.js";
import { ConfigurationHandler } from "@mathjax/src/js/input/tex/Configuration.js";
import "./mathjax-packages";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { mathjax } from "@mathjax/src/js/mathjax.js";
import { SVG } from "@mathjax/src/js/output/svg.js";
import { SafeHandler } from "@mathjax/src/js/ui/safe/SafeHandler.js";

const adaptor = liteAdaptor();
AssistiveMmlHandler(SafeHandler(RegisterHTMLHandler(adaptor)));

let renderIndex = 0;
const createMathDocument = () =>
  mathjax.document("", {
    InputJax: new TeX({
      packages: [...ConfigurationHandler.keys()].filter(
        (name) => ConfigurationHandler.get(name)?.parser === "tex",
      ),
    }),
    OutputJax: new SVG({ fontCache: "local", localID: `render-${++renderIndex}`, fontData: new MathJaxTexFont() }),
  });

export function renderMathContentHTML(latex: string, displayMode: boolean): string {
  try {
    return adaptor.outerHTML(createMathDocument().convert(latex, { display: displayMode }));
  } catch (error) {
    const escape = (value: string) =>
      value
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    return `<span role="alert" data-mjx-error="${escape(error instanceof Error ? error.message : String(error))}">${escape(latex)}</span>`;
  }
}

export type LatexValidation = { ok: true; html: string } | { ok: false; message: string };

export function validateLatex(latex: string, displayMode: boolean): LatexValidation {
  const html = renderMathContentHTML(latex, displayMode);
  const error = /data-mjx-error="([^"]+)"/.exec(html)?.[1];

  return error ? { ok: false, message: error } : { ok: true, html };
}
