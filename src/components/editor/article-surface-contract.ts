/** Stable semantic hooks for surfaces rendered by Qwik, Tiptap, and the static renderer. */
import type { DOMOutputSpec } from "@tiptap/pm/model";

export const articleSurface = {
  code: "code",
  figure: "figure",
  math: "math",
} as const;

export function surfaceAttributes(kind: (typeof articleSurface)[keyof typeof articleSurface]) {
  return { "data-blog-surface": kind };
}

export function setSurface<T extends HTMLElement>(
  element: T,
  kind: (typeof articleSurface)[keyof typeof articleSurface],
): T {
  element.dataset.blogSurface = kind;
  return element;
}

export function figureFieldAttributes() {
  return { class: "figure-field", ...surfaceAttributes(articleSurface.figure) };
}

export function figureFieldDOMSpec(content: DOMOutputSpec): DOMOutputSpec {
  return ["div", figureFieldAttributes(), content];
}

export function createFigureField(ownerDocument: Document): HTMLDivElement {
  const field = ownerDocument.createElement("div");
  field.className = "figure-field";
  return setSurface(field, articleSurface.figure);
}

export function mermaidFigureDOMSpec(source: string, caption?: string | null): DOMOutputSpec {
  return [
    "figure",
    {
      class: "mermaid-diagram",
      "data-blog-role": "mermaid-diagram",
      "data-mermaid-source": source,
    },
    [
      "div",
      {
        ...figureFieldAttributes(),
        class: "figure-field mermaid-preview",
        "data-blog-role": "mermaid-field",
      },
      0,
    ],
    ...(caption ? [["figcaption", {}, caption]] : []),
  ];
}

export function createMermaidFigure(ownerDocument: Document) {
  const figure = ownerDocument.createElement("figure");
  figure.className = "mermaid-diagram";
  figure.dataset.blogRole = "mermaid-diagram";
  const field = createFigureField(ownerDocument);
  field.classList.add("mermaid-preview");
  field.dataset.blogRole = "mermaid-field";
  figure.appendChild(field);
  return { figure, field };
}
