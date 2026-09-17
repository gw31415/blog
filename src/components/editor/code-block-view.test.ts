import { describe, expect, it } from "vite-plus/test";

import { codeBlockDOMSpec } from "./code-block-view";

describe("code block view", () => {
  it("uses one stable DOM contract for the language control and editable code", () => {
    expect(codeBlockDOMSpec("html caption")).toEqual([
      "pre",
      expect.objectContaining({ class: "code-block", "data-code-language": "html" }),
      [
        "span",
        { class: "code-language-control", contenteditable: "false" },
        ["span", { class: "code-language-label" }, "html"],
        expect.arrayContaining([
          "select",
          expect.objectContaining({
            class: "code-language-select",
            "aria-label": "コード言語",
          }),
        ]),
      ],
      ["code", { class: "language-html" }, 0],
    ]);
  });

  it("keeps the Markdown fence caption out of DOM language attributes", () => {
    expect(codeBlockDOMSpec("typescript example.ts")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          class: "code-block",
          "data-code-language": "typescript",
        }),
        ["code", { class: "language-typescript" }, 0],
      ]),
    );
  });
});
