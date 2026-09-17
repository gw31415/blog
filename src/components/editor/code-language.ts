export const CODE_LANGUAGES = [
  "plaintext",
  "html",
  "css",
  "javascript",
  "typescript",
  "json",
  "bash",
  "markdown",
] as const;

export function codeLanguage(languageInfo: string | null | undefined): string {
  return languageInfo?.trim().split(/\s+/, 1)[0] || "plaintext";
}

export function replaceCodeLanguage(
  languageInfo: string | null | undefined,
  language: string,
): string {
  const [, caption = ""] = languageInfo?.trim().match(/^\S+\s*(.*)$/) ?? [];
  return [language, caption].filter(Boolean).join(" ");
}
