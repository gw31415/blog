import { component$, Slot, useVisibleTask$ } from "@qwik.dev/core";
/** Animate router snapshots, never the live article or editable DOM. */
export const PaperNavigation = component$(() => {
  useVisibleTask$(
    ({ cleanup }) => {
      const root = document.documentElement;
      const previousName = root.style.viewTransitionName;
      // Only the named content surface participates; the backing and chrome stay live.
      root.style.viewTransitionName = "none";
      let previousPath = window.location.pathname;
      const contentSelector = "main.paper, main.archive > #articles";
      let departingRect: DOMRect | undefined;
      // Qwik can restore the destination's scroll before it captures the old DOM.
      // Retain the visible source slice at the navigation gesture instead.
      const captureDeparture = () => {
        departingRect = document.querySelector(contentSelector)?.getBoundingClientRect();
      };
      const onClick = (event: MouseEvent) => {
        const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
        if (
          link &&
          !event.defaultPrevented &&
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          !link.download &&
          (!link.target || link.target === "_self") &&
          link.origin === location.origin &&
          link.pathname !== location.pathname
        )
          captureDeparture();
      };
      let active:
        | { transition: ViewTransition; animations: Animation[]; cancelled: boolean }
        | undefined;
      const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
      const finish = () => {
        if (active) active.cancelled = true;
        active?.transition.skipTransition();
        active?.animations.forEach((animation) => animation.cancel());
      };
      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") finish();
      };
      const onVisibility = () => {
        if (document.hidden) finish();
      };
      const onTransition = async (event: Event) => {
        const transition = (event as CustomEvent<ViewTransition>).detail;
        finish();
        const running = { transition, animations: [] as Animation[], cancelled: false };
        active = running;
        const from = previousPath;
        const oldRect =
          departingRect ?? document.querySelector(contentSelector)?.getBoundingClientRect();
        departingRect = undefined;
        try {
          await transition.updateCallbackDone;
          const to = window.location.pathname;
          previousPath = to;
          if (
            from === to ||
            !oldRect ||
            !(
              document.querySelector("main.paper") ||
              (to === "/" && document.querySelector("main.archive"))
            ) ||
            reducedMotion.matches ||
            document.hidden
          ) {
            transition.skipTransition();
            return;
          }
          await transition.ready;
          // The router restores history scrolling after `ready`. Read the landing
          // geometry on the next frame, before painting our content snapshots.
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const newRect = document.querySelector(contentSelector)?.getBoundingClientRect();
          const header = document.querySelector("[data-site-header]");
          if (active !== running || running.cancelled || !newRect || !header) {
            transition.skipTransition();
            return;
          }
          const duration = 390;
          const returningHome = to === "/";
          const top =
            getComputedStyle(header).visibility === "hidden"
              ? 0
              : Math.max(0, header.getBoundingClientRect().bottom);
          const snapshot = (rect: DOMRect): Keyframe => ({
            left: `${rect.left - newRect.left}px`,
            top: `${rect.top - top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            // Capture only the visible slice so a long, scrolled article leaves as
            // one sheet instead of pulling earlier paragraphs into the viewport.
            clipPath: `inset(${Math.max(0, top - rect.top)}px 0 ${Math.max(0, rect.bottom - window.innerHeight)}px 0)`,
            transformOrigin: `14% ${Math.max(0, top - rect.top) + (window.innerHeight - top) * 0.08}px`,
            mixBlendMode: "normal",
            opacity: 1,
          });
          const animate = (pseudoElement: string, frames: Keyframe[], easing: string) => {
            const animation = root.animate(frames.length === 1 ? [frames[0], frames[0]] : frames, {
              duration,
              easing,
              fill: "both",
              pseudoElement,
              direction:
                returningHome && pseudoElement === "::view-transition-old(paper-content)"
                  ? "reverse"
                  : "normal",
            });
            running.animations.push(animation);
            return animation;
          };
          const still = snapshot(returningHome ? newRect : oldRect);
          const moving = snapshot(returningHome ? oldRect : newRect);
          const animations = [
            animate(
              "::view-transition-group(paper-content)",
              [
                {
                  // Anchor both snapshots to the viewport without interpolating their
                  // different document heights or restored scroll positions.
                  transform: `translate(${newRect.left}px, ${top}px)`,
                  width: `${newRect.width}px`,
                  height: `${Math.max(0, window.innerHeight - top)}px`,
                  perspective: "2600px",
                  perspectiveOrigin: "50% 35%",
                  overflow: "clip",
                },
              ],
              "linear",
            ),
            animate(
              returningHome
                ? "::view-transition-new(paper-content)"
                : "::view-transition-old(paper-content)",
              [
                { ...still, transform: "none", zIndex: 1 },
                { ...still, transform: "none", zIndex: 1 },
              ],
              "linear",
            ),
            animate(
              returningHome
                ? "::view-transition-old(paper-content)"
                : "::view-transition-new(paper-content)",
              [
                {
                  ...moving,
                  offset: 0,
                  transform: `translate3d(-24px,${window.innerHeight + 100}px,55px) rotateZ(-2.2deg) rotateX(8deg)`,
                  zIndex: 2,
                },
                {
                  ...moving,
                  offset: 0.77,
                  transform: "translate3d(5px,-7px,32px) rotateZ(.5deg) rotateX(4deg)",
                },
                {
                  ...moving,
                  offset: 1,
                  transform: "translate3d(0,0,0) rotateZ(0deg) rotateX(0deg)",
                  zIndex: 2,
                },
              ],
              "cubic-bezier(.43,.02,.22,1)",
            ),
          ];
          await Promise.all(
            animations.map((animation) => animation.finished.catch(() => undefined)),
          );
        } catch {
          // A superseding navigation or unavailable effect must not block routing.
          transition.skipTransition();
        } finally {
          running.animations.forEach((animation) => animation.cancel());
          if (active === running) active = undefined;
        }
      };
      document.addEventListener("qviewtransition", onTransition);
      document.addEventListener("click", onClick, true);
      window.addEventListener("popstate", captureDeparture, true);
      document.addEventListener("keydown", onKey);
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("resize", finish);
      reducedMotion.addEventListener("change", finish);
      cleanup(() => {
        finish();
        root.style.viewTransitionName = previousName;
        document.removeEventListener("qviewtransition", onTransition);
        document.removeEventListener("click", onClick, true);
        window.removeEventListener("popstate", captureDeparture, true);
        document.removeEventListener("keydown", onKey);
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("resize", finish);
        reducedMotion.removeEventListener("change", finish);
      });
    },
    { strategy: "document-ready" },
  );
  return <Slot />;
});
