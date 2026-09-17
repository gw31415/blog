import {
  $,
  component$,
  noSerialize,
  useComputed$,
  useSignal,
  useStore,
  useTask$,
  type NoSerialize,
} from "@qwik.dev/core";

import { BlogFooter, BlogHeader, BlogPaper } from "~/components/blog/blog";
import { formatJapaneseDate, formatJapaneseEraYear, type ArticleDraft } from "~/content/article";
import { INITIAL_ARTICLE } from "~/content/initial-article";
import { INITIAL_ARTICLE_HTML, INITIAL_ARTICLE_JSON } from "~/content/initial-article.generated";

import {
  createEditorController,
  type EditorCommand,
  type EditorController,
  type MathEditRequest,
} from "./editor-controller";
import { ArticleStyleBoundary } from "./article-styles";

let editorRuntimePromise: Promise<typeof import("./editor-runtime")> | undefined;

export function loadEditorRuntime() {
  editorRuntimePromise ??= import("./editor-runtime");
  return editorRuntimePromise;
}

export function createArticlePresentation(article: Pick<ArticleDraft, "publishedAt">) {
  if (article.publishedAt === "") {
    return { dateLabel: "公開日未設定", footerRight: "年未設定" };
  }
  return {
    dateLabel: formatJapaneseDate(article.publishedAt),
    footerRight: formatJapaneseEraYear(article.publishedAt),
  };
}

export function canSwitchToView(mode: EditorUiState["mode"]): boolean {
  return mode !== "loading";
}

interface EditorUiState {
  mode: "view" | "loading" | "edit";
  editorReady: boolean;
  error: string;
  category: string;
  publishedAt: string;
  title: string;
  subtitle: string;
  bodyMarkdown: string;
  link: string;
  imageUrl: string;
  imageAlt: string;
  detailsSummary: string;
  detailsBody: string;
  math: (MathEditRequest & { preview: string; error: string }) | null;
}

export const ArticleShell = component$(() => {
  const editorMount = useSignal<HTMLElement>();
  const controller = useSignal<NoSerialize<EditorController>>();
  const ui = useStore<EditorUiState>({
    mode: "view",
    editorReady: false,
    error: "",
    category: INITIAL_ARTICLE.category,
    publishedAt: INITIAL_ARTICLE.publishedAt,
    title: INITIAL_ARTICLE.title,
    subtitle: INITIAL_ARTICLE.subtitle,
    bodyMarkdown: INITIAL_ARTICLE.bodyMarkdown,
    link: "https://",
    imageUrl: "",
    imageAlt: "",
    detailsSummary: "補足",
    detailsBody: "詳しい内容を書きます。",
    math: null,
  });
  const presentation = createArticlePresentation(ui);
  const editable = useComputed$(() => ui.mode === "edit");

  useTask$(({ cleanup, track }) => {
    const ready = track(() => ui.editorReady);
    if (ready) cleanup(() => controller.value?.destroy());
  });

  const command$ = $((command: EditorCommand) => controller.value?.run(command));
  const preloadEditor$ = $(() => {
    void loadEditorRuntime();
  });

  const openMathEditor$ = $(async (request: MathEditRequest) => {
    const { validateLatex } = await import("./math-dialog");
    const result = validateLatex(request.latex, request.kind === "block");
    ui.math = {
      ...request,
      preview: result.ok ? result.html : "",
      error: result.ok ? "" : result.message,
    };
  });

  const enterEdit$ = $(async () => {
    if (!editorMount.value || ui.mode !== "view") return;
    ui.mode = "loading";
    ui.error = "";
    try {
      if (!controller.value) {
        controller.value = noSerialize(createEditorController(loadEditorRuntime));
      }
      await controller.value?.enterEdit(editorMount.value, {
        content: INITIAL_ARTICLE_JSON,
        onUpdate: (markdown) => {
          ui.bodyMarkdown = markdown;
        },
        onSelectionChange: () => {},
        onMathEdit: (request) => void openMathEditor$(request),
      });
      ui.editorReady = true;
      ui.mode = "edit";
    } catch (error) {
      ui.mode = "view";
      ui.error = error instanceof Error ? error.message : "エディターを読み込めませんでした。";
    }
  });

  const enterView$ = $(() => {
    if (!canSwitchToView(ui.mode)) return;
    controller.value?.enterView();
    ui.math = null;
    ui.mode = "view";
  });

  const updateMathPreview$ = $(async (latex: string) => {
    if (!ui.math) return;
    ui.math.latex = latex;
    const { validateLatex } = await import("./math-dialog");
    const result = validateLatex(latex, ui.math.kind === "block");
    ui.math.preview = result.ok ? result.html : "";
    ui.math.error = result.ok ? "" : result.message;
  });

  const applyMath$ = $((latex: string) => {
    if (!ui.math || ui.math.error || !latex.trim()) return;
    const applied = controller.value?.run({
      type: "updateMath",
      kind: ui.math.kind,
      position: ui.math.position,
      latex,
    });
    if (!applied) {
      ui.math.error = "数式の位置を特定できませんでした。もう一度数式を選択してください。";
      return;
    }
    ui.math = null;
  });

  return (
    <ArticleStyleBoundary>
      <BlogPaper>
        <BlogHeader
          category={ui.category}
          dateTime={ui.publishedAt}
          dateLabel={presentation.dateLabel}
          title={ui.title}
          subtitle={ui.subtitle}
          editable={editable.value}
          editLoading={ui.mode === "loading"}
          onEditIntent$={preloadEditor$}
          onEditRequest$={enterEdit$}
          onCategoryInput$={$((value) => (ui.category = value))}
          onDateInput$={$((value) => (ui.publishedAt = value))}
          onTitleInput$={$((value) => (ui.title = value))}
          onSubtitleInput$={$((value) => (ui.subtitle = value))}
        />
        <article
          class="article-content"
          data-layout-key="article"
          data-editor-mount
          ref={editorMount}
          dangerouslySetInnerHTML={INITIAL_ARTICLE_HTML}
        ></article>
        <BlogFooter left="日々の記録" right={presentation.footerRight} />
      </BlogPaper>

      {ui.error && (
        <p class="editor-error" role="alert">
          エディターを開始できませんでした: {ui.error}
        </p>
      )}

      {ui.mode === "edit" && (
        <aside class="editor-dock" aria-label="記事編集ツール">
          <div class="editor-dock-head">
            <button type="button" class="editor-done" onClick$={enterView$}>
              完了
            </button>
            <div class="editor-dock-row editor-formatting" role="toolbar" aria-label="本文の書式">
              <button type="button" title="元に戻す" onClick$={() => command$({ type: "undo" })}>
                ↶
              </button>
              <button type="button" title="やり直す" onClick$={() => command$({ type: "redo" })}>
                ↷
              </button>
              <button type="button" onClick$={() => command$({ type: "paragraph" })}>
                本文
              </button>
              <button type="button" onClick$={() => command$({ type: "heading", level: 2 })}>
                見出し
              </button>
              <button type="button" onClick$={() => command$({ type: "heading", level: 3 })}>
                小見出し
              </button>
              <button type="button" aria-label="太字" onClick$={() => command$({ type: "bold" })}>
                <b>B</b>
              </button>
              <button type="button" aria-label="斜体" onClick$={() => command$({ type: "italic" })}>
                <i>I</i>
              </button>
              <button
                type="button"
                aria-label="打ち消し線"
                onClick$={() => command$({ type: "strike" })}
              >
                <s>S</s>
              </button>
              <button type="button" onClick$={() => command$({ type: "bulletList" })}>
                箇条書き
              </button>
              <button type="button" onClick$={() => command$({ type: "orderedList" })}>
                番号
              </button>
              <button type="button" onClick$={() => command$({ type: "taskList" })}>
                ToDo
              </button>
              <button type="button" onClick$={() => command$({ type: "blockquote" })}>
                引用
              </button>
              <button type="button" onClick$={() => command$({ type: "codeBlock" })}>
                コード
              </button>
              <button type="button" onClick$={() => command$({ type: "table" })}>
                表
              </button>
              <button type="button" onClick$={() => command$({ type: "horizontalRule" })}>
                区切り
              </button>
              <button type="button" onClick$={() => command$({ type: "inlineMath" })}>
                文中数式
              </button>
              <button type="button" onClick$={() => command$({ type: "blockMath" })}>
                別行数式
              </button>
              <button type="button" onClick$={() => command$({ type: "callout", label: "補足" })}>
                補足
              </button>
            </div>

            <details class="editor-panel">
              <summary title="リンク・画像・折りたたみ">挿入</summary>
              <div class="editor-fields">
                <label class="wide">
                  リンクURL
                  <input value={ui.link} onInput$={(_, el) => (ui.link = el.value)} />
                </label>
                <button type="button" onClick$={() => command$({ type: "link", href: ui.link })}>
                  選択範囲へリンク
                </button>
                <label>
                  画像URL
                  <input value={ui.imageUrl} onInput$={(_, el) => (ui.imageUrl = el.value)} />
                </label>
                <label>
                  代替テキスト
                  <input value={ui.imageAlt} onInput$={(_, el) => (ui.imageAlt = el.value)} />
                </label>
                <button
                  type="button"
                  disabled={!ui.imageUrl}
                  onClick$={() => command$({ type: "image", src: ui.imageUrl, alt: ui.imageAlt })}
                >
                  画像を挿入
                </button>
                <label>
                  折りたたみ見出し
                  <input
                    value={ui.detailsSummary}
                    onInput$={(_, el) => (ui.detailsSummary = el.value)}
                  />
                </label>
                <label class="wide">
                  折りたたみ本文
                  <input value={ui.detailsBody} onInput$={(_, el) => (ui.detailsBody = el.value)} />
                </label>
                <button
                  type="button"
                  onClick$={() =>
                    command$({ type: "details", summary: ui.detailsSummary, body: ui.detailsBody })
                  }
                >
                  折りたたみを挿入
                </button>
              </div>
            </details>
          </div>
        </aside>
      )}

      {ui.math && (
        <div class="math-dialog-backdrop" role="presentation" onClick$={() => (ui.math = null)}>
          <form
            class="math-dialog"
            data-math-position={ui.math.position}
            role="dialog"
            aria-modal="true"
            aria-labelledby="math-dialog-title"
            onClick$={(event) => event.stopPropagation()}
            preventdefault:submit
            onSubmit$={(_, form) => {
              const value = new FormData(form).get("latex");
              void applyMath$(typeof value === "string" ? value : "");
            }}
          >
            <h2 id="math-dialog-title">
              {ui.math.kind === "block" ? "別行数式" : "文中数式"}を編集
            </h2>
            <label>
              LaTeX
              <textarea
                name="latex"
                value={ui.math.latex}
                rows={4}
                autoFocus
                onInput$={(_, el) => updateMathPreview$(el.value)}
              ></textarea>
            </label>
            <div
              class="math-dialog-preview"
              aria-label="数式プレビュー"
              dangerouslySetInnerHTML={ui.math.preview}
            ></div>
            {ui.math.error && (
              <p class="math-dialog-error" role="alert">
                {ui.math.error}
              </p>
            )}
            <div class="math-dialog-actions">
              <button type="button" onClick$={() => (ui.math = null)}>
                キャンセル
              </button>
              <button type="submit" disabled={!!ui.math.error || !ui.math.latex.trim()}>
                適用
              </button>
            </div>
          </form>
        </div>
      )}
    </ArticleStyleBoundary>
  );
});
