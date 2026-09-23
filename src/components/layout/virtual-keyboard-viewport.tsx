import { Slot, component$, useSignal, useVisibleTask$ } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";

const virtualKeyboardViewportStyles = css`
  position: relative;
  isolation: isolate;
  width: 100%;
  height: calc(100 * var(--virtual-keyboard-svh, 1svh));
  margin-top: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: auto;

  &[data-virtual-keyboard-open],
  &:has(input:focus, textarea:focus, select:focus, [contenteditable="true"]:focus) {
    overscroll-behavior-y: contain;
  }

  &[data-virtual-keyboard-open] {
    margin-top: var(--visual-viewport-offset-top, 0px);
  }

  & > [data-virtual-keyboard-region="top"] {
    position: sticky;
    z-index: 2;
    top: 0;
  }

  & > [data-virtual-keyboard-region="content"] {
    min-height: calc(
      100 * var(--virtual-keyboard-svh, 1svh) - var(--virtual-keyboard-top-height, 0px) -
        var(--virtual-keyboard-bottom-height, 0px)
    );
  }

  &[data-virtual-keyboard-open] > [data-virtual-keyboard-region="content"],
  &:has(input:focus, textarea:focus, select:focus, [contenteditable="true"]:focus)
    > [data-virtual-keyboard-region="content"] {
    min-height: calc(
      100 * var(--virtual-keyboard-svh, 1svh) - var(--virtual-keyboard-top-height, 0px) -
        var(--virtual-keyboard-bottom-height, 0px) + 1px
    );
  }

  & > [data-virtual-keyboard-region="bottom"] {
    position: sticky;
    z-index: 2;
    bottom: 0;
  }
`;

export const VirtualKeyboardViewport = component$(() => {
  const viewportRef = useSignal<HTMLElement>();

  // visualViewport is browser-only state. Running at document-ready keeps the
  // initial SSR static while installing the iOS keyboard workaround promptly.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    ({ cleanup }) => {
      const root = viewportRef.value;
      if (!root) return;

      const top = root.querySelector<HTMLElement>('[data-virtual-keyboard-region="top"]');
      const bottom = root.querySelector<HTMLElement>('[data-virtual-keyboard-region="bottom"]');
      const syncBarSizes = () => {
        root.style.setProperty("--virtual-keyboard-top-height", `${top?.offsetHeight ?? 0}px`);
        root.style.setProperty(
          "--virtual-keyboard-bottom-height",
          `${bottom?.offsetHeight ?? 0}px`,
        );
      };
      const resizeObserver = new ResizeObserver(syncBarSizes);
      if (top) resizeObserver.observe(top);
      if (bottom) resizeObserver.observe(bottom);
      syncBarSizes();

      const syncScroll = () => {
        root.toggleAttribute("data-scrolled", root.scrollTop > 0);
      };
      root.addEventListener("scroll", syncScroll, { passive: true });
      syncScroll();

      const visualViewport = window.visualViewport;
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (!isIOS || !visualViewport) {
        cleanup(() => {
          resizeObserver.disconnect();
          root.removeEventListener("scroll", syncScroll);
        });
        return;
      }

      let previousHeight: number | undefined;
      let previousOffsetTop: number | undefined;
      const animationFrames = new Set<number>();

      const syncVisualViewport = (event?: Event) => {
        const height = visualViewport.height * visualViewport.scale;
        const offsetTop = visualViewport.offsetTop;

        const animationFrame = requestAnimationFrame(() => {
          animationFrames.delete(animationFrame);
          if (previousHeight !== height) {
            previousHeight = height;
            root.style.setProperty("--virtual-keyboard-svh", `${height * 0.01}px`);
          }

          if (previousOffsetTop === undefined) {
            previousOffsetTop = offsetTop;
          } else if (previousOffsetTop !== offsetTop) {
            const scrollOffset = offsetTop - previousOffsetTop;
            previousOffsetTop = offsetTop;
            if (event?.type === "resize") root.scrollBy(0, scrollOffset);
          }
          root.style.setProperty("--visual-viewport-offset-top", `${offsetTop}px`);

          if (height + 10 < document.documentElement.clientHeight) {
            root.setAttribute("data-virtual-keyboard-open", "");
          } else {
            root.removeAttribute("data-virtual-keyboard-open");
          }
        });
        animationFrames.add(animationFrame);
      };

      syncVisualViewport();
      visualViewport.addEventListener("resize", syncVisualViewport);
      visualViewport.addEventListener("scroll", syncVisualViewport);
      cleanup(() => {
        for (const animationFrame of animationFrames) cancelAnimationFrame(animationFrame);
        animationFrames.clear();
        resizeObserver.disconnect();
        root.removeEventListener("scroll", syncScroll);
        visualViewport.removeEventListener("resize", syncVisualViewport);
        visualViewport.removeEventListener("scroll", syncVisualViewport);
      });
    },
    { strategy: "document-ready" },
  );

  return (
    <div ref={viewportRef} data-virtual-keyboard-viewport css={virtualKeyboardViewportStyles}>
      <div data-virtual-keyboard-region="top">
        <Slot name="top" />
      </div>
      <div data-virtual-keyboard-region="content">
        <Slot />
      </div>
      <div data-virtual-keyboard-region="bottom">
        <Slot name="bottom" />
      </div>
    </div>
  );
});
