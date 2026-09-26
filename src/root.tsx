import { component$ } from "@qwik.dev/core";
import { QwikRouterProvider, RouterOutlet } from "@qwik.dev/router";
import "@unocss/reset/normalize.css";
import { BlogTheme } from "./components/foundations/theme";
import { BlogDocumentHead } from "./components/foundations/document-head";

import { PaperNavigation } from "./components/foundations/paper-navigation";

export default component$(() => (
  <QwikRouterProvider viewTransition>
    <head>
      <BlogDocumentHead />
    </head>
    <BlogTheme>
      <PaperNavigation>
        <RouterOutlet />
      </PaperNavigation>
    </BlogTheme>
  </QwikRouterProvider>
));
