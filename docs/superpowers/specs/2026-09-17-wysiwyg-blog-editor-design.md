# WYSIWYG Blog Editor Design

## Context

The top page is a statically rendered Qwik blog article with a custom Japanese print layout. Its article body is currently assembled from Qwik components, while MathJax and highlight.js output are generated ahead of time. The demo needs an in-place editor without a database or any persistence across reloads.

The editor must behave like a visual Markdown editor: authors edit the formatted document directly, use familiar Markdown shortcuts, and can edit mathematical expressions. Switching between reading and editing must not change the position or dimensions of the page. Section numbers must be derived from heading order and must never be editable content.

## Goals

- Preserve the existing paper, typography, spacing, and article appearance.
- Keep the initial reading experience resumable and free of editor runtime work.
- Load the editing runtime only after the reader explicitly enters edit mode.
- Support the article metadata that will later belong in a database record.
- Keep Markdown as the portable representation of the article body.
- Support common Markdown editing plus the existing article's specialist blocks.
- Make reading/editing mode changes produce zero layout movement.
- Keep all changes in memory and restore the original article on reload.

## Non-goals

- Database schemas, API routes, authentication, publishing, autosave, or uploads.
- Collaboration, comments, version history, drag-and-drop block reordering, or mobile-native editing.
- A general CMS or a reusable multi-article administration interface.
- Preserving edits across a reload.

## Article data

The transient draft uses this shape:

```ts
interface ArticleDraft {
  category: string;
  publishedAt: string;
  title: string;
  subtitle: string;
  bodyMarkdown: string;
}
```

`publishedAt` is an ISO calendar date. The visible Japanese date is derived from it. The footer is presentation chrome rather than article data: its left label comes from site configuration and its right label is derived from `publishedAt`.

The article body uses GitHub-Flavored Markdown for paragraphs, headings, emphasis, strike-through, links, lists, task lists, block quotes, horizontal rules, code, fenced code blocks, tables, and images. Small documented extensions represent inline math, display math, callouts, collapsible notes, and figures with captions.

## Rendering and resumability

Initial SSR returns static semantic HTML and the existing page CSS. It does not instantiate Tiptap and does not execute ProseMirror or KaTeX in the browser. The edit toggle is a Qwik lazy event boundary.

On the first edit request:

1. Keep the static article visible.
2. Show loading state only in a fixed overlay outside document flow.
3. Dynamically import the editor runtime as a separate client chunk.
4. Construct the Tiptap editor from the same initial document representation.
5. Replace the static body with geometrically equivalent editor markup in one synchronous commit.
6. Store the imperative editor instance with Qwik `noSerialize()`.
7. Enable metadata editing and place focus at the requested position.

After the first activation, Tiptap stays mounted. Later mode changes only toggle editability and editor controls; the document DOM remains mounted.

Production verification must prove that Tiptap, ProseMirror, and KaTeX are absent from the initial executable route chunk. A browser geometry test compares the paper, header, every section heading, editor surface, and footer immediately before and after both the first activation and later toggles. Every compared `getBoundingClientRect()` value must be identical.

## Editor choice and integration

No maintained Qwik-native WYSIWYG editor currently covers Markdown round trips, tables, extensible custom nodes, math, and precise headless styling. Tiptap is framework-agnostic and exposes a vanilla JavaScript API, so it can mount directly into a Qwik-owned element without a React compatibility island.

Tiptap's official Markdown package is currently beta. All Tiptap packages will be pinned to the same exact version. Markdown parse/serialize round trips will be covered by tests, including every custom node. The integration boundary remains a small local module so the Markdown implementation can be replaced without changing the Qwik page shell.

## Editing interactions

A fixed control in the viewport toggles between `閲覧` and `編集`. In edit mode, a fixed formatting dock exposes undo, redo, paragraph, heading levels, bold, italic, strike-through, link, lists, quote, code, table, image, and math actions. Fixed positioning ensures controls never alter paper geometry. On narrow screens, the same dock attaches to the viewport bottom.

The body accepts standard Markdown input rules such as heading markers, list markers, quote markers, horizontal rules, and fenced code blocks. Toolbar operations and keyboard shortcuts update the same Tiptap document.

Metadata interactions are intentionally separate from body Markdown:

- Category, title, and subtitle use their existing elements as plain-text editing surfaces.
- The displayed date opens an overlay date control; authors cannot type an invalid localized date string into the page.
- The footer cannot be selected as editable content.

Visible edit affordances use outlines, inset shadows, or overlays that do not affect box metrics. Empty editable fields use generated placeholders rather than inserted placeholder text.

## Automatic section numbers

Section numbers are not stored in Markdown or Tiptap nodes. Level-two article headings increment a CSS counter, and a pseudo-element renders the Japanese-form section number in the same grid position currently used by `.section-number`. Because pseudo-element content is outside the editor document, it cannot be selected or manually edited. Adding, deleting, or reordering a level-two heading immediately recalculates all numbers.

The page title is metadata and remains the only level-one heading. Body heading controls offer levels two and three so the section hierarchy stays valid.

## Mathematics

Inline math uses `$...$`; display math uses a `$$` fenced block. Both serialize as Markdown text but become atomic math nodes in the editor.

Math nodes render their current LaTeX visually. Selecting or activating one opens a fixed popover containing a LaTeX input and a live preview. Applying a change updates the selected node; cancelling leaves it untouched. Invalid LaTeX remains editable and shows a local, non-blocking error in the popover. Math controls never replace the article with raw source mode.

## Specialist article blocks

- A callout maps to an alert-style block quote in the Markdown dialect.
- A collapsible note maps to a constrained `<details>` Markdown extension.
- An image figure stores URL, alt text, and caption.
- The decorative text figure is a small custom figure node and round-trips through an explicit HTML extension.
- Tables use GFM syntax when they contain plain inline content; unsupported nested content is prevented by the schema.
- Code blocks retain a language identifier and render client-side highlighting only after the editor runtime has loaded. Initial reading output stays pre-rendered.

Every specialist block has an accessible label and keyboard path. Links are not followed while editing unless the author uses the explicit open-link action.

## State and failure handling

The initial `ArticleDraft` is serialized in the page. Draft changes live only in Qwik signals and the Tiptap instance. Switching to reading mode commits the current metadata and Markdown to in-memory state. Reloading the route reconstructs the initial server-provided article.

If the editor chunk fails to load, the page stays in reading mode and the fixed control reports a retryable error. Static article content is never cleared until the editor is ready. If a Markdown conversion fails, the last valid editor document remains visible and the error appears in the controls without losing content.

## Accessibility

- Toggle and toolbar buttons have Japanese accessible names and pressed/disabled states.
- Focus moves into the selected editing surface after activation and returns to the toggle when editing ends.
- Toolbar commands are keyboard reachable and do not remove native editor shortcuts.
- Popovers use dialog semantics, focus trapping, Escape-to-cancel, and focus restoration.
- Reading mode contains no stray `contenteditable` attributes or editor-only tab stops.
- `prefers-reduced-motion` disables optional control transitions.

## Test strategy

Unit tests cover:

- Article metadata derivation, especially Japanese date and footer year.
- Markdown parse/serialize round trips for all supported nodes.
- Standard math delimiter conversion and invalid-LaTeX preservation.
- The heading counter markup and CSS contract that keeps numbers out of editable content.
- Toolbar command mapping and transient-state reset behavior.

Browser tests cover:

- Lazy editor activation and retry behavior.
- Exact geometry before and after initial activation and subsequent toggles.
- Heading creation, deletion, reordering, and automatic renumbering.
- Direct metadata editing with derived date/footer output.
- Bold, links, lists, tables, code blocks, images, callouts, and details.
- Inline and display math creation and editing.
- Keyboard navigation, focus restoration, and reload reset.

Build verification checks formatting, lint, types, production output, editor chunk isolation, and the existing static reading page.

## Expected code boundaries

- `src/components/editor/`: Qwik shell, controls, metadata fields, and the lazy client boundary.
- `src/components/editor/runtime/`: Tiptap construction, extensions, Markdown adapters, and imperative commands.
- `src/content/`: initial article data and Markdown dialect fixtures.
- `src/components/blog/`: shared reading/editor presentation components and styles.
- `scripts/render-initial-article.mjs`: build-time conversion of the initial Markdown fixture into committed static HTML and editor JSON.
- `tests/`: unit and browser behavior tests.

The route composes the article editor shell; it does not own editor mechanics.
