import { WebMcpTools } from "~/components/molecules/webmcp-tools";
import { canManagePosts } from "~/server/access";
import { component$, Slot } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { DevManagerToggle } from "~/components/molecules/dev-manager-toggle";
import { DEV_MANAGER_COOKIE } from "~/dev/manager";

export const useDevManager = routeLoader$(
  ({ cookie }) => import.meta.env.BLOG_DEV_SERVER && cookie.get(DEV_MANAGER_COOKIE)?.value === "1",
);

export const useWebMcpManager = routeLoader$((event) => canManagePosts(event));

export default component$(() => {
  const enabled = useDevManager();
  const manager = useWebMcpManager();
  return (
    <>
      <Slot />
      <WebMcpTools manager={manager.value} />
      {import.meta.env.BLOG_DEV_SERVER && <DevManagerToggle enabled={enabled.value} />}
    </>
  );
});
