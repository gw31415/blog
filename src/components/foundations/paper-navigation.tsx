import { component$, Slot, useVisibleTask$ } from "@qwik.dev/core";

/** Animate router snapshots, never the live article or editable DOM. */
export const PaperNavigation = component$(() => {
  useVisibleTask$(
    ({ cleanup }) => {
      const root = document.documentElement;
      const previousName = root.style.viewTransitionName;
      // Override the router's opt-out for its default root snapshot.
      root.style.viewTransitionName = "root";
      let previousPath = window.location.pathname;
      let active: ViewTransition | undefined;
      const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
      const finish = () => active?.skipTransition();
      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") finish();
      };
      const onVisibility = () => {
        if (document.hidden) finish();
      };
      const onTransition = async (event: Event) => {
        const transition = (event as CustomEvent<ViewTransition>).detail;
        active = transition;
        const from = previousPath;
        try {
          await transition.updateCallbackDone;
          const to = window.location.pathname;
          previousPath = to;
          if (
            from === to ||
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
          const duration = 390;
          const returningHome = to === "/";
          const animate = (pseudoElement: string, frames: Keyframe[], easing: string) =>
            root.animate(frames, {
              duration,
              easing,
              fill: "both",
              pseudoElement,
              direction:
                returningHome && pseudoElement === "::view-transition-old(root)"
                  ? "reverse"
                  : "normal",
            });
          const animations = [
            animate(
              "::view-transition-group(root)",
              [
                {
                  transform: "none",
                  perspective: "2600px",
                  perspectiveOrigin: "50% 35%",
                  overflow: "clip",
                },
              ],
              "linear",
            ),
            animate(
              returningHome ? "::view-transition-new(root)" : "::view-transition-old(root)",
              [
                { transform: "none", opacity: 1, mixBlendMode: "normal", zIndex: 1 },
                { transform: "none", opacity: 1, mixBlendMode: "normal", zIndex: 1 },
              ],
              "linear",
            ),
            animate(
              returningHome ? "::view-transition-old(root)" : "::view-transition-new(root)",
              [
                {
                  offset: 0,
                  transform: `translate3d(-24px,${window.innerHeight + 100}px,55px) rotateZ(-2.2deg) rotateX(8deg)`,
                  opacity: 1,
                  mixBlendMode: "normal",
                  transformOrigin: "14% 8%",
                  zIndex: 2,
                },
                {
                  offset: 0.77,
                  transform: "translate3d(5px,-7px,32px) rotateZ(.5deg) rotateX(4deg)",
                  opacity: 1,
                },
                {
                  offset: 1,
                  transform: "translate3d(0,0,0) rotateZ(0deg) rotateX(0deg)",
                  opacity: 1,
                  mixBlendMode: "normal",
                  transformOrigin: "14% 8%",
                  zIndex: 2,
                },
              ],
              "cubic-bezier(.43,.02,.22,1)",
            ),
          ];
          await Promise.all(
            animations.map((animation) => animation.finished.catch(() => undefined)),
          );
          animations.forEach((animation) => animation.cancel());
        } catch {
          // A superseding navigation or unavailable effect must not block routing.
          transition.skipTransition();
        } finally {
          if (active === transition) active = undefined;
        }
      };
      document.addEventListener("qviewtransition", onTransition);
      document.addEventListener("keydown", onKey);
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("resize", finish);
      reducedMotion.addEventListener("change", finish);
      cleanup(() => {
        finish();
        root.style.viewTransitionName = previousName;
        document.removeEventListener("qviewtransition", onTransition);
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
