/** Presentation-only attributes; original URLs remain in the document model. */
export function articleImageAttributes(src: string, alt: string | null = null) {
  return {
    loading: "lazy",
    src,
    "data-article-image": "",
    "data-image-state": "pending",
    alt: alt ?? "",
    width: 960,
    height: 540,
    decoding: "async",
    style: "aspect-ratio: 960 / 540; --article-image-ratio: 960 / 540",
  };
}

export function observeArticleImages(root: HTMLElement) {
  const dimensions = new Map<string, { width: string; height: string }>();
  const tracked = new Map<HTMLImageElement, string>();
  const updateState = (image: HTMLImageElement) => {
    image.dataset.imageState = image.complete
      ? image.naturalWidth > 0
        ? "loaded"
        : "error"
      : "pending";
  };
  const onSettled = (event: Event) => {
    if (event.target instanceof HTMLImageElement && event.target.hasAttribute("data-article-image"))
      updateState(event.target);
  };
  root.addEventListener("load", onSettled, true);
  root.addEventListener("error", onSettled, true);
  const scan = () => {
    for (const image of root.querySelectorAll<HTMLImageElement>("img[data-article-image]")) {
      const source = image.getAttribute("src") ?? "";
      const known = dimensions.get(source);
      if (known) {
        image.setAttribute("width", known.width);
        image.setAttribute("height", known.height);
      } else
        dimensions.set(source, {
          width: image.getAttribute("width")!,
          height: image.getAttribute("height")!,
        });
      const ratio = `${image.getAttribute("width") || 960} / ${image.getAttribute("height") || 540}`;
      image.style.aspectRatio = ratio;
      image.style.setProperty("--article-image-ratio", ratio);
      if (tracked.get(image) === source) continue;
      tracked.set(image, source);
      updateState(image);
    }
    for (const image of tracked.keys())
      if (!root.contains(image)) {
        tracked.delete(image);
      }
  };
  scan();
  const mutations = new MutationObserver(scan);
  mutations.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"],
  });
  return () => {
    mutations.disconnect();
    root.removeEventListener("load", onSettled, true);
    root.removeEventListener("error", onSettled, true);
  };
}
