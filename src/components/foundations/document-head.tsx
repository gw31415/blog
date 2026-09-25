import { component$ } from "@qwik.dev/core";
import { DocumentHeadTags, useLocation } from "@qwik.dev/router";

/** Keep reactive metadata inside its own boundary so head-level build assets survive navigation. */
export const BlogDocumentHead = component$(() => {
  const { url } = useLocation();
  return (
    <>
      <meta charset="utf-8" />
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content, maximum-scale=1"
      />
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <meta name="theme-color" content="#f2ead5" />
      <DocumentHeadTags />
      <link rel="canonical" href={`${url.origin}${url.pathname}`} />
    </>
  );
});
