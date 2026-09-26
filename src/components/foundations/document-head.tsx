import { component$ } from "@qwik.dev/core";
import { isServer } from "@qwik.dev/core/build";
import { DocumentHeadTags, getRequestEvent, useLocation } from "@qwik.dev/router";

/** Keep reactive metadata inside its own boundary so head-level build assets survive navigation. */
export const BlogDocumentHead = component$(() => {
  const { url } = useLocation();
  const userAgent = isServer
    ? (getRequestEvent()?.request.headers.get("user-agent") ?? "")
    : navigator.userAgent;
  // Safari (including iOS browsers) reports unknown viewport keys as errors.
  // Keep keyboard resizing for Chromium and Firefox without sending it to WebKit.
  const resizesContent =
    /(?:Chrome|Chromium|Firefox)\//.test(userAgent) && !/iPhone|iPad|iPod/.test(userAgent);
  const viewport = `width=device-width, initial-scale=1.0${resizesContent ? ", interactive-widget=resizes-content" : ""}`;
  return (
    <>
      <meta charset="utf-8" />
      <meta name="viewport" content={viewport} />
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <meta name="theme-color" content="#f2ead5" />
      <DocumentHeadTags />
      <link rel="canonical" href={`${url.origin}${url.pathname}`} />
    </>
  );
});
