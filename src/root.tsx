import { component$ } from "@qwik.dev/core";
import { DocumentHeadTags, RouterOutlet, useLocation, useQwikRouter } from "@qwik.dev/router";

export default component$(() => {
  useQwikRouter();
  const { url } = useLocation();

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
        <DocumentHeadTags />
        <link rel="canonical" href={url.href} />
      </head>
      <body
        css={{
          minHeight: "100%",
          margin: 0,
          color: "#352f25",
          fontFamily:
            '"Times New Roman", Times, "Nimbus Roman No9 L", "Liberation Serif", "DejaVu Serif", Georgia, "Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro", "Noto Serif JP", "Noto Serif CJK JP", serif',
          fontKerning: "normal",
          fontSynthesis: "none",
          textAutospace: "normal",
          background: "#ded8ca",
          "&::selection, & ::selection": {
            color: "#352f25",
            background: "rgb(135 89 79 / 28%)",
          },
          "@media (max-width: 600px)": {
            background: "#f2ead5",
          },
        }}
      >
        <RouterOutlet />
      </body>
    </>
  );
});
