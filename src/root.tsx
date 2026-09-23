import { component$ } from "@qwik.dev/core";
import { DocumentHeadTags, QwikRouterProvider, RouterOutlet, useLocation } from "@qwik.dev/router";
import "./reset.css";

export default component$(() => (
  <QwikRouterProvider>
    <RootContent />
  </QwikRouterProvider>
));

const RootContent = component$(() => {
  const { url } = useLocation();
  const isArticlePage = url.pathname === "/sample" || url.pathname.startsWith("/blog/");

  /**
   * This is the root of a QwikRouter site. It contains the document's `<head>` and `<body>`. You can adjust them as you see fit.
   */

  return (
    <>
      <head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content, maximum-scale=1"
        />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        {isArticlePage && (
          <>
            <meta name="theme-color" content="#f2ead5" />
            <style>{"html { background-color: #f2ead5; }"}</style>
          </>
        )}
        <DocumentHeadTags />
        <link rel="canonical" href={`${url.origin}${url.pathname}`} />
      </head>
      <body
        css={
          isArticlePage
            ? {
                minHeight: "100%",
                margin: 0,
                color: "#352f25",
                fontFamily:
                  '"Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", "DejaVu Serif", Georgia, "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro", "Noto Serif JP", "Noto Serif CJK JP", serif',
                fontKerning: "normal",
                fontSynthesis: "none",
                textAutospace: "normal",
                background: "#f2ead5",
                "&::selection, & ::selection": {
                  color: "#352f25",
                  background: "rgb(135 89 79 / 28%)",
                },
              }
            : undefined
        }
      >
        <RouterOutlet />
      </body>
    </>
  );
});
