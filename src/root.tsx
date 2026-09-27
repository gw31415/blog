import { component$ } from "@qwik.dev/core";
import { QwikRouterProvider, RouterOutlet } from "@qwik.dev/router";
import "@unocss/reset/normalize.css";
import { BlogTheme } from "./components/foundations/theme";
import { BlogDocumentHead } from "./components/foundations/document-head";

export default component$(() => (
  <QwikRouterProvider>
    <head>
      <BlogDocumentHead />
    </head>
    <BlogTheme>
      <RouterOutlet />
    </BlogTheme>
  </QwikRouterProvider>
));
