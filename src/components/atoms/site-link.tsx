import { Link } from "@qwik.dev/router";
import { component$ } from "@qwik.dev/core";
import { BLOG_NAME } from "~/content/article";

export const SiteLink = component$<{ current?: boolean }>((props) => (
  <Link
    css={{ fontWeight: 600 }}
    class="site-link article-sticky-site article-site-title"
    href="/"
    prefetchBundles="intent"
    prefetchData="intent"
    aria-current={props.current ? "page" : undefined}
  >
    {BLOG_NAME}
  </Link>
));
