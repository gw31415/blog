/** Presentation only: keep em/ruby text and the editor-owned DOM intact. */
export function observeArticleAnnotations(root: HTMLElement) {
  const layer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  layer.classList.add("article-emphasis-layer");
  layer.setAttribute("aria-hidden", "true");
  layer.setAttribute("focusable", "false");
  root.parentNode?.insertBefore(layer, root.nextSibling);
  const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
  const range = document.createRange();
  let frame = 0;
  let disposed = false;

  const render = () => {
    frame = 0;
    if (disposed || !root.isConnected) return;
    const origin = layer.getBoundingClientRect();
    const dots: { x: number; y: number; radius: number; color: string }[] = [];
    const rubyPositions: { rt: HTMLElement; offset: number }[] = [];
    const rubyModes: { ruby: Element; natural: boolean }[] = [];
    for (const ruby of root.querySelectorAll("ruby:has(> [data-ruby-base])")) {
      const base = ruby.querySelector("[data-ruby-base]")!;
      const style = getComputedStyle(base);
      const size = Number.parseFloat(style.fontSize);
      const rt = ruby.querySelector<HTMLElement>("rt");
      if (rt && getComputedStyle(rt).display === "flex") {
        range.selectNodeContents(base);
        const baseRect = range.getBoundingClientRect();
        const leading = Number.parseFloat(style.lineHeight);
        // Range bounds include font padding. Center an em box within them,
        // then place the reading 60% down the inter-em gap toward its base.
        const emTop = baseRect.top + (baseRect.height - size) / 2;
        const targetCenter = emTop - Math.max(0, leading - size) * 0.4;
        range.selectNodeContents(rt);
        const reading = range.getBoundingClientRect();
        const currentOffset = Number.parseFloat(rt.style.getPropertyValue("--ruby-offset"));
        const transform = getComputedStyle(rt).transform;
        const appliedOffset = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
        const offset = appliedOffset + targetCenter - (reading.top + reading.height / 2);
        if (reading.width && (!Number.isFinite(currentOffset) || Math.abs(offset - currentOffset) > 0.02))
          rubyPositions.push({ rt, offset });
      }
      // Honor expanded user text spacing instead of forcing our compact layout.
      rubyModes.push({
        ruby,
        natural:
          Number.parseFloat(style.lineHeight) > size * 1.5 + 0.1 ||
          Number.parseFloat(style.letterSpacing) >= size * 0.1 ||
          Number.parseFloat(style.wordSpacing) >= size * 0.15,
      });
    }
    for (const em of root.querySelectorAll("em")) {
      // Do not draw the same text twice for nested emphasis.
      if (em.parentElement?.closest("em") || em.closest("ruby")) continue;
      const walker = document.createTreeWalker(em, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (!parent || parent.closest("ruby, rt, rp, [aria-hidden='true']")) continue;
        const style = getComputedStyle(parent);
        if (style.visibility !== "visible") continue;
        const size = Number.parseFloat(style.fontSize);
        const color = style.getPropertyValue("--ink-color").trim() || style.color;
        for (const { segment, index } of segmenter.segment(node.textContent ?? "")) {
          if (/^[\p{P}\p{Z}\p{C}]+$/u.test(segment)) continue;
          range.setStart(node, index);
          range.setEnd(node, index + segment.length);
          const rect = range.getBoundingClientRect();
          if (!rect.width || !rect.height) continue;
          dots.push({
            x: rect.left - origin.left + rect.width / 2,
            y: rect.top - origin.top - 1 - size * 0.0625,
            radius: size * 0.0625,
            color,
          });
        }
      }
    }
    // All layout reads precede writes; this layer is outside the observed/editor DOM.
    const fragment = document.createDocumentFragment();
    for (const dot of dots) {
      const circle = document.createElementNS(layer.namespaceURI, "circle");
      circle.setAttribute("cx", String(dot.x));
      circle.setAttribute("cy", String(dot.y));
      circle.setAttribute("r", String(dot.radius));
      circle.setAttribute("fill", dot.color);
      fragment.append(circle);
    }
    layer.replaceChildren(fragment);
    for (const { rt, offset } of rubyPositions)
      rt.style.setProperty("--ruby-offset", `${offset}px`);
    for (const { ruby, natural } of rubyModes)
      if (ruby.hasAttribute("data-ruby-natural") !== natural)
        ruby.toggleAttribute("data-ruby-natural", natural);
  };
  const update = () => {
    if (!disposed && !frame) frame = requestAnimationFrame(render);
  };
  // Native emphasis is the no-JS/print/forced-colors fallback. Only take over
  // after the painter is installed; neither the text nor its marks are changed.
  root.setAttribute("data-annotations-ready", "");
  const resize = new ResizeObserver(update);
  resize.observe(root);
  if (root.parentElement) resize.observe(root.parentElement);
  const mutations = new MutationObserver(update);
  mutations.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });
  // Inherited user styles can change without resizing the article itself.
  for (let ancestor = root.parentElement; ancestor; ancestor = ancestor.parentElement)
    mutations.observe(ancestor, { attributes: true, attributeFilter: ["class", "style"] });
  mutations.observe(document.head, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });
  root.addEventListener("load", update, true);
  root.addEventListener("toggle", update, true);
  root.addEventListener("scroll", update, true);
  window.addEventListener("resize", update);
  document.fonts.addEventListener("loadingdone", update);
  void document.fonts.ready.then(update);
  update();
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    mutations.disconnect();
    resize.disconnect();
    root.removeEventListener("load", update, true);
    root.removeEventListener("toggle", update, true);
    root.removeEventListener("scroll", update, true);
    window.removeEventListener("resize", update);
    document.fonts.removeEventListener("loadingdone", update);
    root.removeAttribute("data-annotations-ready");
    layer.remove();
  };
}
