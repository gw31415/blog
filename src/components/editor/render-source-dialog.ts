import { createCodeBlockControl, createCodeBlockSurface } from "./code-block-view";
import { highlightCode } from "./editor-syntax-highlighting";
import { articleSurface, createMermaidFigure, setSurface } from "./article-surface-contract";

/** A raw-text input over the same highlighted code surface used in the article. */
export function createRenderSourceDialog(options: {
  dialog: HTMLDialogElement;
  host: HTMLElement;
  title: string;
  name: string;
  source: string;
  kind: "mermaid" | "inlineMath" | "blockMath";
  cancel(): void;
  apply(value: string): void;
}) {
  const { dialog, kind } = options;
  dialog.classList.remove("document-command-dialog");
  dialog.classList.add("render-source-dialog");
  const preview = document.createElement("div");
  preview.className = "render-source-preview article-content";
  preview.setAttribute("aria-label", kind === "mermaid" ? "Mermaidプレビュー" : "数式プレビュー");
  const mermaid = kind === "mermaid" ? createMermaidFigure(document) : null;
  const rendered = mermaid?.figure ?? document.createElement("div");
  if (!mermaid) rendered.className = kind === "blockMath" ? "math-block" : "math-inline";
  if (kind === "blockMath") setSurface(rendered, articleSurface.math);
  const target = mermaid?.field ?? document.createElement("div");
  if (!mermaid) {
    target.className = "block-math-inner";
    rendered.appendChild(target);
  }
  const error = document.createElement("p");
  error.setAttribute("role", "alert");
  [rendered, error].forEach((child) => preview.appendChild(child));
  const form = document.createElement("form");
  form.className = "render-source-panel";
  const { pre, code } = createCodeBlockSurface();
  pre.classList.add("render-source-code");
  pre.dataset.blogRole = "source-code";
  const language = kind === "mermaid" ? "mermaid" : "latex";
  pre.dataset.codeLanguage = language;
  const languageControl = createCodeBlockControl(language, () => {});
  languageControl.select.remove();
  const surface = document.createElement("div");
  surface.className = "render-source-surface";
  code.setAttribute("aria-hidden", "true");
  const input = document.createElement("textarea");
  input.name = options.name;
  input.setAttribute("aria-label", language === "latex" ? "LaTeX" : "ソース");
  input.value = options.source;
  input.spellcheck = false;
  input.wrap = "off";
  [code, input].forEach((child) => surface.appendChild(child));
  pre.appendChild(languageControl.control);
  pre.appendChild(surface);
  const actions = document.createElement("div");
  actions.className = "render-source-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "キャンセル";
  cancel.onclick = options.cancel;
  const apply = document.createElement("button");
  apply.type = "submit";
  apply.textContent = "適用";
  [cancel, apply].forEach((child) => actions.appendChild(child));
  [pre, actions].forEach((child) => form.appendChild(child));
  [preview, form].forEach((child) => dialog.appendChild(child));
  let revision = 0;
  const render = async () => {
    const request = ++revision;
    code.replaceChildren(
      ...highlightCode(language, input.value + "\n").map((part) => {
        const span = document.createElement("span");
        span.className = part.classes.join(" ");
        span.textContent = part.text;
        return span;
      }),
    );
    apply.disabled = !input.value.trim();
    error.textContent = "";
    if (kind === "mermaid") {
      const { renderMermaidPreview } = await import("./mermaid-renderer");
      if (request !== revision || !dialog.isConnected) return;
      await renderMermaidPreview(target, input.value, true);
    } else {
      const { validateLatex } = await import("./mathjax-renderer");
      if (request !== revision || !dialog.isConnected) return;
      const result = validateLatex(input.value, kind === "blockMath");
      target.innerHTML = result.ok ? result.html : "";
      error.textContent = result.ok ? "" : result.message;
      apply.disabled = !result.ok || !input.value.trim();
    }
  };
  input.addEventListener("input", () => void render());
  input.addEventListener("scroll", () => {
    code.scrollTop = input.scrollTop;
    code.scrollLeft = input.scrollLeft;
  });
  form.onsubmit = (event) => {
    event.preventDefault();
    if (!apply.disabled) options.apply(input.value);
  };
  const dock = options.host
    .closest("[data-virtual-keyboard-viewport]")
    ?.querySelector<HTMLElement>(".editor-dock");
  if (!dock) throw new Error("編集ツールバーが見つかりません");
  const articleWidth = options.host.getBoundingClientRect().width;
  dialog.style.setProperty("--render-article-width", `${articleWidth}px`);
  dock.classList.add("editor-dock--source");
  dock.appendChild(dialog);
  dialog.setAttribute("open", "");
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      options.cancel();
    }
  });
  input.focus();
  void render();
}
