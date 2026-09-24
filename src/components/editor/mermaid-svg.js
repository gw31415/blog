// Runs in both the editor document and the isolated server browser.
// Keep this function self-contained: Puppeteer serializes it into the render page.
export function finalizeMermaidSVG(source) {
  const paper = "#f2ead5";
  function refineDiagramSpacing(svg) {
    const ns = "http://www.w3.org/2000/svg";
    const make = (name, attrs) => {
      const e = document.createElementNS(ns, name);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      return e;
    };
    const move = (e, dx, dy) => {
      const old = e.transform.baseVal.consolidate()?.matrix;
      const m = new DOMMatrix(old ? [old.a, old.b, old.c, old.d, old.e, old.f] : undefined);
      m.e += dx;
      m.f += dy;
      e.setAttribute("transform", `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`);
    };
    // Use-case ellipses are centered at the node origin, but SVG labels can lack an anchor.
    for (const node of svg.querySelectorAll(".usecase-element,.node.statediagram-state")) {
      const ellipse = node.querySelector(
          ":scope > ellipse.label-container,:scope > rect.label-container",
        ),
        label = node.querySelector(":scope > .label");
      if (!ellipse || !label) continue;
      const b = label.getBBox(),
        m = label.transform.baseVal.consolidate()?.matrix;
      const bounds = ellipse.getBBox();
      move(
        label,
        bounds.x + bounds.width / 2 - (b.x + b.width / 2 + (m?.e || 0)),
        bounds.y + bounds.height / 2 - (b.y + b.height / 2 + (m?.f || 0)),
      );
    }
    // Give composite-state headings actual top and bottom insets, retaining the outer boundary.
    for (const cluster of svg.querySelectorAll(".statediagram-cluster")) {
      const outer = cluster.querySelector("rect.outer"),
        inner = cluster.querySelector(":scope > rect.inner"),
        label = cluster.querySelector(":scope > .cluster-label");
      if (!outer || !inner || !label) continue;
      const b = label.getBBox(),
        m = label.transform.baseVal.consolidate()?.matrix;
      const top = Number(outer.getAttribute("y")),
        left = Number(outer.getAttribute("x")),
        width = Number(outer.getAttribute("width"));
      const inset = 6,
        newInnerY = top + b.height + inset * 2,
        oldBottom = Number(inner.getAttribute("y")) + Number(inner.getAttribute("height"));
      move(
        label,
        left + width / 2 - (b.x + b.width / 2 + (m?.e || 0)),
        top + inset - (b.y + (m?.f || 0)),
      );
      inner.setAttribute("y", newInnerY);
      inner.setAttribute("height", oldBottom - newInnerY);
    }
    // C4 boundary headings are siblings of their rect, distinct from labels inside nodes.
    if (svg.getAttribute("aria-roledescription") === "c4")
      for (const group of svg.querySelectorAll("g")) {
        const rect = group.querySelector(":scope > rect"),
          texts = [...group.querySelectorAll(":scope > text")];
        if (!rect || !texts.length || !rect.hasAttribute("width")) continue;
        const first = texts[0].getBBox(),
          target = Number(rect.getAttribute("y")) + 12,
          dy = Math.max(0, target - first.y);
        for (const text of texts) move(text, 0, dy);
      }
    // Git tags have fixed 2px vertical padding in Mermaid: rebuild the outline from the text.
    for (const group of svg.querySelectorAll(".commit-labels")) {
      const labels = [...group.querySelectorAll(":scope > .tag-label")],
        outlines = [...group.querySelectorAll(":scope > .tag-label-bkg")],
        holes = [...group.querySelectorAll(":scope > .tag-hole")];
      labels.forEach((label, i) => {
        const outline = outlines[i],
          hole = holes[i];
        if (!outline || !hole || outline.hasAttribute("transform")) return;
        const old = outline.getBBox(),
          b = label.getBBox(),
          py = 6,
          px = 10,
          tip = 9;
        const dy = old.y + old.height - (b.y + b.height + py);
        label.setAttribute("y", Number(label.getAttribute("y")) + dy);
        const top = b.y + dy - py,
          bottom = b.y + dy + b.height + py,
          left = b.x - px,
          right = b.x + b.width + px,
          cy = (top + bottom) / 2;
        outline.setAttribute(
          "points",
          `${left - tip},${cy} ${left},${top} ${right},${top} ${right},${bottom} ${left},${bottom}`,
        );
        hole.setAttribute("cx", left - 2);
        hole.setAttribute("cy", cy);
      });
    }
    // Paper masks keep vertical lifelines from passing through message text.
    if (svg.getAttribute("aria-roledescription") === "sequence")
      for (const text of [...svg.querySelectorAll("text.messageText,text.loopText")]) {
        const b = text.getBBox();
        if (!b.width) continue;
        const g = make("g", { class: "paper-message" }),
          rect = make("rect", {
            x: b.x - 6,
            y: b.y - 3,
            width: b.width + 12,
            height: b.height + 6,
            fill: paper,
            class: "paper-message-background",
          });
        svg.append(g);
        g.append(rect, text);
      }
    // Read relation labels against paper rather than allowing an edge to cut through glyphs.
    for (const text of svg.querySelectorAll(".edgeLabel text")) {
      if (!text.textContent.trim()) continue;
      const b = text.getBBox(),
        parent = text.parentNode;
      let rect = parent.querySelector(":scope > rect.background");
      if (!rect) {
        rect = make("rect", { class: "background" });
        parent.insertBefore(rect, text);
      }
      for (const [key, value] of Object.entries({
        x: b.x - 5,
        y: b.y - 3,
        width: b.width + 10,
        height: b.height + 6,
        fill: paper,
        stroke: "none",
      }))
        rect.setAttribute(key, value);
      rect.style.setProperty("fill", paper, "important");
      rect.style.setProperty("opacity", "1", "important");
    }
    // Enlarged tag outlines must stay inside the SVG viewport.
    const view = svg.viewBox.baseVal;
    if (view.width && svg.querySelector(".tag-label-bkg")) {
      const b = svg.getBBox(),
        pad = 8;
      const x = Math.min(view.x, b.x - pad),
        y = Math.min(view.y, b.y - pad),
        right = Math.max(view.x + view.width, b.x + b.width + pad),
        bottom = Math.max(view.y + view.height, b.y + b.height + pad);
      svg.setAttribute("viewBox", `${x} ${y} ${right - x} ${bottom - y}`);
      const scale = 1;
      svg.style.width = (right - x) * scale + "px";
      svg.style.height = (bottom - y) * scale + "px";
    }
  }

  function refineC4Relations(svg) {
    if (svg.getAttribute("aria-roledescription") !== "c4") return;
    const ns = "http://www.w3.org/2000/svg";
    const rootMatrix = svg.getCTM().inverse();
    function bounds(el) {
      const b = el.getBBox(),
        m = rootMatrix.multiply(el.getCTM());
      const p = new DOMPoint(b.x, b.y).matrixTransform(m),
        q = new DOMPoint(b.x + b.width, b.y + b.height).matrixTransform(m);
      return { x: p.x, y: p.y, width: q.x - p.x, height: q.y - p.y };
    }
    const obstacles = [...svg.querySelectorAll(".c4-shape")].map(bounds);
    // Boundary headings also reserve space; the boundary rectangle itself is not an obstacle.
    for (const g of svg.querySelectorAll("g")) {
      const border = g.querySelector(":scope > rect[width]");
      if (!border) continue;
      for (const text of g.querySelectorAll(":scope > text")) obstacles.push(bounds(text));
      if (g.querySelector(":scope > text")) {
        const r = bounds(border);
        obstacles.push(
          { x: r.x, y: r.y, width: r.width, height: 2 },
          { x: r.x, y: r.y + r.height - 2, width: r.width, height: 2 },
          { x: r.x, y: r.y, width: 2, height: r.height },
          { x: r.x + r.width - 2, y: r.y, width: 2, height: r.height },
        );
      }
    }
    const overlap = (a, b) =>
      Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    for (const group of [...svg.querySelectorAll("g")]) {
      const children = [...group.children];
      if (
        !children.some(
          (e) => (e.tagName === "line" || e.tagName === "path") && e.hasAttribute("marker-end"),
        )
      )
        continue;
      let edge = null;
      for (const el of children) {
        if ((el.tagName === "line" || el.tagName === "path") && el.hasAttribute("marker-end")) {
          edge = el;
          continue;
        }
        if (el.tagName !== "text" || !edge) continue;
        const b = el.getBBox(),
          w = b.width + 12,
          h = b.height + 6,
          length = edge.getTotalLength(),
          start = edge.getPointAtLength(0),
          end = edge.getPointAtLength(length),
          horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
        const candidates = [];
        for (const fraction of [0.5, 0.35, 0.65]) {
          const p = edge.getPointAtLength(length * fraction);
          for (const side of [-1, 1])
            for (const gap of [7, 19, 35, 51, 67]) {
              const cx = horizontal ? p.x : p.x + side * (w / 2 + gap),
                cy = horizontal ? p.y + side * (h / 2 + gap) : p.y;
              const r = { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
              const cost =
                obstacles.reduce((sum, o) => sum + overlap(r, o), 0) * 1000 +
                Math.abs(fraction - 0.5) * 20 +
                gap +
                (side === 1 ? 2 : 0);
              candidates.push({ ...r, cx, cy, cost });
            }
        }
        candidates.sort((a, b) => a.cost - b.cost);
        const best = candidates[0];
        const dx = best.cx - (b.x + b.width / 2),
          dy = best.cy - (b.y + b.height / 2);
        const wrapper = document.createElementNS(ns, "g");
        wrapper.setAttribute("class", "paper-relation");
        const bg = document.createElementNS(ns, "rect");
        bg.setAttribute("class", "paper-relation-background");
        for (const [key, value] of Object.entries({
          x: best.x,
          y: best.y,
          width: w,
          height: h,
          fill: paper,
        }))
          bg.setAttribute(key, value);
        el.setAttribute("transform", `translate(${dx} ${dy})`);
        group.append(wrapper);
        wrapper.append(bg, el);
        obstacles.push(best);
      }
    }
    // The native C4 viewport includes large unused margins above and beside the drawing.
    const b = svg.getBBox(),
      padding = 10,
      scale = 1;
    svg.setAttribute(
      "viewBox",
      `${b.x - padding} ${b.y - padding} ${b.width + padding * 2} ${b.height + padding * 2}`,
    );
    svg.style.width = (b.width + padding * 2) * scale + "px";
    svg.style.height = (b.height + padding * 2) * scale + "px";
  }

  const host = document.createElement("div");
  host.style.cssText = "position:absolute;left:-100000px;top:0;visibility:hidden;";
  document.body.append(host);
  try {
    host.innerHTML = source;
    const svg = host.querySelector("svg");
    if (!svg) throw new Error("Mermaid SVG is missing");
    svg.removeAttribute("style");
    refineDiagramSpacing(svg);
    refineC4Relations(svg);
    const box = svg.viewBox.baseVal;
    if (box.width > 0 && box.height > 0) {
      svg.setAttribute("width", String(box.width));
      svg.setAttribute("height", String(box.height));
      svg.style.width = box.width + "px";
      svg.style.height = "auto";
      svg.style.maxWidth = "100%";
    }
    return svg.outerHTML;
  } finally {
    host.remove();
  }
}
