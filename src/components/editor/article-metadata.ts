/** Read browser-owned fields even when a lazy metadata QRL is still loading. */
export function readArticleMetadata(fallback: {
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
}) {
  const fields = {
    title: document.querySelector('[data-article-field="title"]')?.textContent ?? fallback.title,
    subtitle:
      document.querySelector('[data-article-field="subtitle"]')?.textContent ?? fallback.subtitle,
    description:
      document.querySelector('[data-article-field="description"]')?.textContent ??
      fallback.description,
  };
  const element = document.querySelector('[data-article-field="tags"]');
  const tags = element
    ? Array.from(element.childNodes).flatMap((node) =>
        node.nodeType === Node.TEXT_NODE
          ? (node.textContent ?? "").split(/[,，、\s]+/u).filter(Boolean)
          : node instanceof Element && node.classList.contains("meta-tag")
            ? [node.textContent ?? ""]
            : [],
      )
    : fallback.tags;
  return { ...fields, tags: [...new Set(tags)] };
}
