import { component$, useVisibleTask$ } from "@qwik.dev/core";
import { useNavigate } from "@qwik.dev/router";

export const WebMcpTools = component$<{ manager: boolean }>((props) => {
  const navigate = useNavigate();
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    async ({ track, cleanup }) => {
      const manager = track(() => props.manager);
      let dispose: (() => void) | undefined,
        cancelled = false;
      cleanup(() => {
        cancelled = true;
        dispose?.();
      });
      if (!("modelContext" in document) && !("modelContext" in navigator)) return;
      const { registerSiteTools } = await import("~/webmcp/browser");
      if (!cancelled) dispose = registerSiteTools(manager, navigate);
    },
    { strategy: "document-ready" },
  );
  return null;
});
