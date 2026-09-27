import { ArticleEditButton } from "~/components/atoms/edit-button";
import { StickyHeader } from "~/components/molecules/sticky-header";
import { BlogTopbar } from "~/components/molecules/topbar";
import {
  $,
  component$,
  noSerialize,
  RenderOnce,
  useConstant,
  useSignal,
  useStore,
  useTask$,
  useVisibleTask$,
  type NoSerialize,
  type QRL,
  type Signal,
} from "@qwik.dev/core";
import type { JSONContent } from "@tiptap/core";

import { BlogFooter, BlogFooterContainer } from "~/components/molecules/footer";
import { BlogHeader } from "~/components/organisms/article-header";
import { BlogPaper } from "~/components/templates/blog-paper";
import { VirtualKeyboardViewport } from "~/components/templates/virtual-keyboard-viewport";
import {
  BLOG_NAME,
  formatJapaneseDate,
  formatJapaneseEraYear,
  formatShortDate,
  type ArticleDraft,
} from "~/content/article";

import {
  createEditorController,
  type EditorCommand,
  type EditorController,
  type ToolbarState,
} from "../editor/editor-controller";
import { ArticleStyleBoundary } from "../editor/article-styles";

let editorRuntimePromise: Promise<typeof import("../editor/editor-runtime")> | undefined;

export function loadEditorRuntime() {
  editorRuntimePromise ??= import("../editor/editor-runtime");
  return editorRuntimePromise;
}

export function createArticlePresentation(article: Pick<ArticleDraft, "publishedAt">) {
  if (article.publishedAt === "") {
    return { dateLabel: "公開日未設定", shortDate: "日付未設定", footerRight: "年未設定" };
  }
  return {
    dateLabel: formatJapaneseDate(article.publishedAt),
    shortDate: formatShortDate(article.publishedAt),
    footerRight: formatJapaneseEraYear(article.publishedAt),
  };
}

export function canSwitchToView(mode: EditorUiState["mode"]): boolean {
  return mode !== "loading";
}

export type InsertDialogState =
  | { kind: "link"; href: string; error: string }
  | { kind: "image"; src: string; alt: string; error: string };

export function createInsertDialog(kind: InsertDialogState["kind"]): InsertDialogState {
  return kind === "link"
    ? { kind, href: "https://", error: "" }
    : { kind, src: "", alt: "", error: "" };
}

export function canApplyInsertDialog(dialog: InsertDialogState): boolean {
  const destination = dialog.kind === "link" ? dialog.href.trim() : dialog.src.trim();
  return destination !== "" && destination !== "https://" && dialog.error === "";
}

interface EditorUiState {
  mode: "view" | "loading" | "edit";
  editorReady: boolean;
  saving: boolean;
  error: string;
  publishedAt: string;
  title: string;
  subtitle: string;
  body: JSONContent;
  description: string;
  tags: string[];
  status: "draft" | "published";
  alias: string;
  insertDialog: InsertDialogState | null;
  toolbar: ToolbarState;
}

interface ArticleShellProps {
  postId?: string;
  article: ArticleDraft;
  initialHtml: string;
  initialContent: JSONContent;
  publicationStatus?: "draft" | "published";
  canonicalAlias?: string | null;
  autoEditFromQuery?: boolean;
  canEdit?: boolean;
  onSave$?: QRL<
    (draft: ArticleDraft & { status: "draft" | "published"; alias: string }) => Promise<void>
  >;
}

const ArticleBody = component$(
  (props: { html: string; elementRef: Signal<HTMLElement | undefined> }) => {
    const html = useConstant(() => props.html);
    return (
      <RenderOnce>
        <article
          class="article-content"
          data-layout-key="article"
          data-editor-mount
          ref={props.elementRef}
          dangerouslySetInnerHTML={html}
        ></article>
      </RenderOnce>
    );
  },
);

export const ArticleShell = component$((props: ArticleShellProps) => {
  const article = props.article;
  const initialHtml = useConstant(() => props.initialHtml);
  const initialHeader = useConstant(() => ({
    title: article.title,
    subtitle: article.subtitle,
    description: article.description,
    tags: article.tags,
  }));
  const editorMount = useSignal<HTMLElement>();
  const formattingToolbar = useSignal<HTMLElement>();
  const controller = useSignal<NoSerialize<EditorController>>();
  const ui = useStore<EditorUiState>({
    mode: "view",
    editorReady: false,
    saving: false,
    error: "",
    publishedAt: article.publishedAt,
    title: article.title,
    subtitle: article.subtitle,
    body: article.body,
    description: article.description,
    tags: article.tags,
    status: props.publicationStatus ?? "published",
    alias: props.canonicalAlias ?? "",
    insertDialog: null,
    toolbar: {
      paragraph: true,
      bold: false,
      italic: false,
      strike: false,
      heading: null,
      bulletList: false,
      orderedList: false,
      taskList: false,
      blockquote: false,
      codeBlock: false,
      canUndo: false,
      canRedo: false,
    },
  });
  const presentation = createArticlePresentation(ui);

  useTask$(({ cleanup, track }) => {
    const ready = track(() => ui.editorReady);
    if (ready) cleanup(() => controller.value?.destroy());
  });

  // Native listeners must run in the same trusted gesture as an iOS toolbar tap;
  // a resumable handler can refocus too late after Safari starts hiding the keyboard.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    ({ cleanup, track }) => {
      const mode = track(() => ui.mode);
      const toolbar = formattingToolbar.value;
      if (mode !== "edit" || !toolbar) return;

      let touchStart: { identifier: number; x: number; y: number } | undefined;
      const onTouchStart = (event: TouchEvent) => {
        const touch = event.touches[0];
        touchStart = touch
          ? { identifier: touch.identifier, x: touch.clientX, y: touch.clientY }
          : undefined;
      };
      const onTouchEnd = (event: TouchEvent) => {
        const start = touchStart;
        touchStart = undefined;
        const touch = start
          ? [...event.changedTouches].find((candidate) => candidate.identifier === start.identifier)
          : undefined;
        const target =
          event.target instanceof Element
            ? event.target.closest<HTMLButtonElement>("button")
            : null;
        if (
          !start ||
          !touch ||
          !target ||
          Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 8
        ) {
          return;
        }

        event.preventDefault();
        editorMount.value
          ?.querySelector<HTMLElement>(".ProseMirror")
          ?.focus({ preventScroll: true });
        target.click();
      };
      const onTouchCancel = () => {
        touchStart = undefined;
      };

      toolbar.addEventListener("touchstart", onTouchStart, { passive: true });
      toolbar.addEventListener("touchend", onTouchEnd, { passive: false });
      toolbar.addEventListener("touchcancel", onTouchCancel);
      cleanup(() => {
        toolbar.removeEventListener("touchstart", onTouchStart);
        toolbar.removeEventListener("touchend", onTouchEnd);
        toolbar.removeEventListener("touchcancel", onTouchCancel);
      });
    },
    { strategy: "document-ready" },
  );

  const command$ = $((command: EditorCommand) => controller.value?.run(command));
  const preloadEditor$ = $(() => {
    void loadEditorRuntime();
  });

  const enterEdit$ = $(async () => {
    const mount = editorMount.value ?? document.querySelector<HTMLElement>("[data-editor-mount]");
    if (!mount || ui.mode !== "view") return;
    ui.mode = "loading";
    ui.error = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (!controller.value) {
          controller.value = noSerialize(createEditorController(loadEditorRuntime));
        }
        await controller.value?.enterEdit(mount, {
          content: props.initialContent,
          postId: props.postId,
          workingState: props.article.editingState,
          onUpdate: (content) => {
            ui.body = content;
          },
          onSelectionChange: (state) => {
            ui.toolbar = state;
          },
          onMathEdit: () => {},
        });
        ui.editorReady = true;
        ui.mode = "edit";
        return;
      } catch (error) {
        let failure = error;
        if (attempt === 0 && error instanceof Promise) {
          try {
            await error;
            continue;
          } catch (loadError) {
            failure = loadError;
          }
        }
        ui.mode = "view";
        ui.error =
          failure instanceof Error ? failure.message : "エディターを読み込めませんでした。";
        return;
      }
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    () => {
      // The editor is a large dynamic chunk. Start it as soon as an article is
      // interactive so a mobile tap does not have to wait for the whole chunk.
      void loadEditorRuntime();
      if (props.autoEditFromQuery && new URLSearchParams(window.location.search).has("edit")) {
        void enterEdit$();
      }
    },
    { strategy: "document-ready" },
  );

  const enterView$ = $(async () => {
    if (!canSwitchToView(ui.mode) || ui.saving) return;
    if (props.onSave$) {
      ui.error = "";
      ui.saving = true;
      try {
        if (controller.value?.getWorkingState()?.uploading)
          throw new Error("画像の変換・アップロードが完了するまでお待ちください。");
        if (controller.value?.getWorkingState()?.pending)
          throw new Error("入力中のフォームを適用するかキャンセルしてください。");
        await props.onSave$({
          publishedAt: ui.publishedAt,
          title: ui.title,
          subtitle: ui.subtitle,
          body: controller.value?.getJSON() ?? ui.body,
          editingState: null,
          description: ui.description,
          tags: ui.tags,
          status: ui.status,
          alias: ui.alias.trim(),
        });
        if (props.autoEditFromQuery && new URLSearchParams(window.location.search).has("edit")) {
          window.history.replaceState(window.history.state, "", window.location.pathname);
        }
      } catch (error) {
        ui.error = error instanceof Error ? error.message : "保存できませんでした。";
        return;
      } finally {
        ui.saving = false;
      }
    }
    controller.value?.enterView();
    ui.insertDialog = null;
    ui.mode = "view";
  });

  const applyInsert$ = $(() => {
    const dialog = ui.insertDialog;
    if (!dialog || !canApplyInsertDialog(dialog)) return;
    const applied =
      dialog.kind === "link"
        ? controller.value?.run({ type: "link", href: dialog.href.trim() })
        : controller.value?.run({
            type: "image",
            src: dialog.src.trim(),
            alt: dialog.alt.trim(),
          });
    if (!applied) {
      dialog.error =
        dialog.kind === "link"
          ? "リンクを設定する文字列を選択してから、もう一度お試しください。"
          : "画像を挿入できませんでした。カーソル位置を確認してください。";
      return;
    }
    ui.insertDialog = null;
  });

  return (
    <ArticleStyleBoundary>
      <VirtualKeyboardViewport internalScroll={ui.mode === "edit"}>
        <StickyHeader q:slot="top" class="article-sticky-header" title={ui.title || "無題"}>
          {props.canEdit !== false && (
            <ArticleEditButton
              placement="sticky"
              editable={ui.mode === "edit"}
              busy={ui.mode === "loading" || ui.saving}
              onEditIntent$={preloadEditor$}
              onEditRequest$={enterEdit$}
              onDoneRequest$={enterView$}
            />
          )}
        </StickyHeader>
        <BlogPaper>
          <BlogTopbar
            class="article-topbar"
            title={ui.title || "無題"}
            showTitle={false}
            variant="inline"
          >
            {props.canEdit !== false && (
              <ArticleEditButton
                placement="header"
                editable={ui.mode === "edit"}
                busy={ui.mode === "loading" || ui.saving}
                onEditIntent$={preloadEditor$}
                onEditRequest$={enterEdit$}
                onDoneRequest$={enterView$}
              />
            )}
          </BlogTopbar>
          <BlogHeader
            tags={ui.tags}
            dateTime={ui.publishedAt}
            dateLabel={presentation.dateLabel}
            publicationStatus={props.publicationStatus ? ui.status : undefined}
            initialTitle={initialHeader.title}
            initialSubtitle={initialHeader.subtitle}
            initialDescription={initialHeader.description}
            initialTags={initialHeader.tags}
            subtitle={ui.subtitle}
            editable={ui.mode === "edit"}
            onPublicationToggle$={$(() => {
              ui.status = ui.status === "published" ? "draft" : "published";
            })}
            onDateInput$={$((value) => {
              if (value) ui.publishedAt = value;
            })}
            onTagsChange$={$((tags) => {
              ui.tags = tags;
            })}
            onTitleInput$={$((value) => {
              ui.title = value;
            })}
            onSubtitleInput$={$((value) => {
              ui.subtitle = value;
            })}
            onDescriptionInput$={$((value) => {
              ui.description = value;
            })}
          />
          {/* After mounting, Tiptap owns this DOM; mode updates must not restore the SSR HTML. */}
          <ArticleBody key="article-body" html={initialHtml} elementRef={editorMount} />
          <BlogFooterContainer q:slot="footer" wide>
            <BlogFooter left={BLOG_NAME} right={presentation.footerRight} />
          </BlogFooterContainer>
        </BlogPaper>

        {ui.mode === "edit" && (
          <aside q:slot="bottom" class="editor-dock" aria-label="記事編集ツール">
            <div
              ref={formattingToolbar}
              class="editor-formatting"
              role="toolbar"
              aria-label="本文の書式"
              preventdefault:mousedown
              onMouseDown$={() => {}}
            >
              <button
                type="button"
                title="元に戻す"
                aria-label="元に戻す"
                onClick$={() => command$({ type: "undo" })}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m9 5-5 5 5 5M4 10h10a6 6 0 0 1 0 12" />
                </svg>
              </button>
              <button
                type="button"
                title="やり直す"
                aria-label="やり直す"
                onClick$={() => command$({ type: "redo" })}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m15 5 5 5-5 5M20 10H10a6 6 0 0 0 0 12" />
                </svg>
              </button>
              <button
                type="button"
                title="表を挿入"
                aria-label="表を挿入"
                data-insert-table
                onClick$={() => command$({ type: "palette", command: "table" })}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18" />
                </svg>
              </button>
              <button
                type="button"
                title="画像をアップロード"
                aria-label="画像をアップロード"
                onClick$={() => command$({ type: "palette", command: "upload-image" })}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 3h18v18H3zM3 17l6-6 5 5 3-3 4 4" />
                  <circle cx="16" cy="8" r="1.5" />
                </svg>
              </button>
              <button
                type="button"
                title="リンクを挿入"
                aria-label="リンクを挿入"
                data-insert-link
                onClick$={() => command$({ type: "palette", command: "link" })}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"
                    transform="translate(1 0)"
                  />
                </svg>
              </button>
            </div>
          </aside>
        )}
      </VirtualKeyboardViewport>

      {ui.error && (
        <p class="editor-error" role="alert">
          {ui.error}
        </p>
      )}

      {ui.insertDialog && (
        <div
          class="editor-dialog-backdrop"
          role="presentation"
          onClick$={() => (ui.insertDialog = null)}
        >
          <form
            class="editor-dialog insert-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="insert-dialog-title"
            onClick$={(event) => event.stopPropagation()}
            preventdefault:submit
            onSubmit$={applyInsert$}
          >
            <div class="editor-dialog-heading">
              <p>挿入ツール</p>
              <h2 id="insert-dialog-title">
                {ui.insertDialog.kind === "link" ? "リンクを挿入" : "画像を挿入"}
              </h2>
            </div>
            <div class="editor-dialog-fields">
              {ui.insertDialog.kind === "link" ? (
                <label>
                  リンクURL
                  <input
                    name="href"
                    inputMode="url"
                    value={ui.insertDialog.href}
                    autoFocus
                    onInput$={(_, el) => {
                      if (ui.insertDialog?.kind === "link") {
                        ui.insertDialog.href = el.value;
                        ui.insertDialog.error = "";
                      }
                    }}
                  />
                </label>
              ) : (
                <>
                  <label>
                    画像URL
                    <input
                      name="src"
                      inputMode="url"
                      value={ui.insertDialog.src}
                      autoFocus
                      onInput$={(_, el) => {
                        if (ui.insertDialog?.kind === "image") {
                          ui.insertDialog.src = el.value;
                          ui.insertDialog.error = "";
                        }
                      }}
                    />
                  </label>
                  <label>
                    代替テキスト（任意）
                    <input
                      name="alt"
                      value={ui.insertDialog.alt}
                      onInput$={(_, el) => {
                        if (ui.insertDialog?.kind === "image") ui.insertDialog.alt = el.value;
                      }}
                    />
                  </label>
                </>
              )}
            </div>
            {ui.insertDialog.error && (
              <p class="editor-dialog-error" role="alert">
                {ui.insertDialog.error}
              </p>
            )}
            <div class="editor-dialog-actions">
              <button type="button" onClick$={() => (ui.insertDialog = null)}>
                キャンセル
              </button>
              <button type="submit" disabled={!canApplyInsertDialog(ui.insertDialog)}>
                挿入
              </button>
            </div>
          </form>
        </div>
      )}
    </ArticleStyleBoundary>
  );
});
