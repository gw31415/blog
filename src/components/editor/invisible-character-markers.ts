import type { Editor } from "@tiptap/core";

/** A read-only gutter layer: never inserts glyphs into the editable document. */
export function createInvisibleCharacterMarkers(editor: Editor) {
  const layer = document.createElement("div");
  layer.className = "editor-invisible-characters";
  layer.setAttribute("aria-hidden", "true");
  const host = editor.view.dom.closest("[data-qstyle-boundary]") ?? document.body;
  host.appendChild(layer);
  let frame = 0;
  let disposed = false;
  const render = () => {
    frame = 0;
    layer.replaceChildren();
    if (disposed || editor.isDestroyed || !editor.isEditable) return;
    const article = editor.view.dom.getBoundingClientRect();
    const headerBottom =
      host.querySelector(".article-sticky-header")?.getBoundingClientRect().bottom ?? 0;
    const dockTop =
      host.querySelector(".editor-dock")?.getBoundingClientRect().top ?? window.innerHeight;
    const lines = new Map<number, Set<string>>();
    editor.state.doc.descendants((node, pos) => {
      if (["codeBlock", "table", "figure"].includes(node.type.name)) return false;
      const glyph =
        node.type.name === "paragraph"
          ? "¶"
          : node.type.name === "hardBreak"
            ? "↵"
            : node.type.name === "softBreak"
              ? "↩"
              : null;
      if (!glyph) return true;
      const dom = editor.view.nodeDOM(pos);
      const element = dom instanceof Element ? dom : dom?.parentElement;
      if (element && !element.getClientRects().length) return true;
      const coords = editor.view.coordsAtPos(
        node.type.name === "paragraph" ? pos + node.nodeSize - 1 : pos,
      );
      if (coords.top < Math.max(0, headerBottom) || coords.bottom > dockTop) return true;
      const y = Math.round((coords.top + coords.bottom) / 2);
      const glyphs = lines.get(y) ?? new Set<string>();
      glyphs.add(glyph);
      lines.set(y, glyphs);
      return true;
    });
    for (const [y, glyphs] of lines) {
      const marker = document.createElement("span");
      marker.textContent = [...glyphs].join("");
      marker.style.left = `${article.right + 3}px`;
      marker.style.top = `${y}px`;
      layer.appendChild(marker);
    }
  };
  const update = () => {
    if (!disposed && !frame) frame = requestAnimationFrame(render);
  };
  const resize = new ResizeObserver(update);
  resize.observe(editor.view.dom);
  editor.on("transaction", update);
  window.addEventListener("scroll", update, true);
  window.addEventListener("resize", update);
  editor.view.dom.addEventListener("load", update, true);
  update();
  return {
    update,
    destroy() {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      editor.off("transaction", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      editor.view.dom.removeEventListener("load", update, true);
      layer.remove();
    },
  };
}
