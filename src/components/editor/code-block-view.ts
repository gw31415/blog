import type { DOMOutputSpec } from "@tiptap/pm/model";

import { CODE_LANGUAGES, codeLanguage } from "./code-language.ts";

type CodeLanguageControl = {
  control: HTMLSpanElement;
  label: HTMLSpanElement;
  select: HTMLSelectElement;
  update(languageInfo: string): void;
};

function codeLanguageOptions(languageInfo: string): DOMOutputSpec[] {
  const currentLanguage = codeLanguage(languageInfo);
  return CODE_LANGUAGES.map((language) => [
    "option",
    language === currentLanguage ? { value: language, selected: "" } : { value: language },
    language,
  ]);
}

export function codeBlockDOMSpec(languageInfo: string): DOMOutputSpec {
  const language = codeLanguage(languageInfo);
  return [
    "pre",
    { class: "code-block", "data-code-language": language },
    [
      "span",
      { class: "code-language-control", contenteditable: "false" },
      ["span", { class: "code-language-label" }, language],
      [
        "select",
        { class: "code-language-select", "aria-label": "コード言語" },
        ...codeLanguageOptions(languageInfo),
      ],
    ],
    ["code", { class: `language-${language}` }, 0],
  ];
}

export function createCodeBlockControl(
  languageInfo: string,
  onLanguageChange: (language: string) => void,
  ownerDocument: Document = document,
): CodeLanguageControl {
  const control = ownerDocument.createElement("span");
  control.className = "code-language-control";
  control.contentEditable = "false";

  const label = ownerDocument.createElement("span");
  label.className = "code-language-label";
  control.appendChild(label);

  const select = ownerDocument.createElement("select");
  select.className = "code-language-select";
  select.setAttribute("aria-label", "コード言語");
  for (const language of CODE_LANGUAGES) {
    const option = ownerDocument.createElement("option");
    option.value = language;
    option.textContent = language;
    select.appendChild(option);
  }
  select.addEventListener("change", () => onLanguageChange(select.value));
  control.appendChild(select);

  const update = (nextLanguageInfo: string) => {
    const language = codeLanguage(nextLanguageInfo);
    label.textContent = language;
    select.value = language;
  };
  update(languageInfo);

  return { control, label, select, update };
}
