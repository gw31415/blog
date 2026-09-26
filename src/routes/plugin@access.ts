import type { RequestHandler } from "@qwik.dev/router";
// SSR and Qwik loader/action responses depend on request identity. Never share them
// across visitors or retain privileged pages in the browser's HTTP cache.
export const onRequest: RequestHandler = async (event) => {
  if (!event.url.pathname.startsWith("/images/variants/")) {
    event.headers.set("Cache-Control", "private, no-store");
    event.headers.set("Vary", "Cookie, Cf-Access-Jwt-Assertion");
  }
};
