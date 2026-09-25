import { Link } from "@qwik.dev/router";
import { component$ } from "@qwik.dev/core";
import { BLOG_NAME } from "~/content/article";

export const SiteLink = component$(() => (
  <Link css={{ fontWeight: 600 }} class="site-link article-sticky-site article-site-title" href="/">
    {BLOG_NAME}
  </Link>
));
