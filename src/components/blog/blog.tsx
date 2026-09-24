/**
 * ブログ記事コンポーネント群。
 *
 * ArticleStyleBoundary の qstyle スタイリングを前提とした再利用部品。
 * 記事ページは BlogPaper を土台に、BlogHeader / SectionHeading /
 * InlineMath / MathBlock / CodeBlock などを組み立てて作る。
 *
 * 数式・コードの HTML はサーバー側の生成処理で組版・強調済みにし、
 * dangerouslySetInnerHTML で埋め込む。初期表示でクライアント側の
 * MathJax / highlight.js 実行や CDN スクリプトは不要。
 */
import { RenderOnce, Slot, component$, useConstant, type QRL } from "@qwik.dev/core";
import { articleSurface } from "~/components/editor/article-surface-contract";

const tagSeparators = /[,，、\s]+/u;

function tagsInEditor(editor: HTMLElement): string[] {
  return Array.from(editor.children)
    .filter((child) => child.classList.contains("meta-tag"))
    .map((child) => child.textContent ?? "");
}

function insertTagBefore(editor: HTMLElement, before: Node, value: string, known: Set<string>): void {
  const tag = value.trim();
  if (!tag || known.has(tag)) return;
  const chip = document.createElement("span");
  chip.className = "meta-tag";
  chip.contentEditable = "false";
  chip.textContent = tag;
  editor.insertBefore(chip, before);
  known.add(tag);
}

function escapeTagHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function commitTagTextAtCaret(editor: HTMLElement, includeRemainder = false): void {
  const selection = window.getSelection();
  const node = selection?.anchorNode;
  if (!selection?.isCollapsed || node?.nodeType !== Node.TEXT_NODE || node.parentNode !== editor) return;

  const text = node as Text;
  const beforeCaret = text.data.slice(0, selection.anchorOffset);
  const boundary = includeRemainder
    ? beforeCaret.length
    : [...beforeCaret.matchAll(/[,，、\s]/gu)].at(-1)?.index;
  if (boundary === undefined) return;

  const committed = beforeCaret.slice(0, includeRemainder ? boundary : boundary + 1);
  const remainder = beforeCaret.slice(committed.length);
  const known = new Set(tagsInEditor(editor));
  const additions = committed.split(tagSeparators).map((value) => value.trim()).filter((value) => {
    if (!value || known.has(value)) return false;
    known.add(value);
    return true;
  });
  const offset = selection.anchorOffset;

  // Let the browser add the replacement to its native undo history.
  const replacement = document.createRange();
  replacement.setStart(text, 0);
  replacement.setEnd(text, committed.length);
  selection.removeAllRanges();
  selection.addRange(replacement);
  const html = additions.map((value) => `<span class="meta-tag" contenteditable="false">${escapeTagHtml(value)}</span>`).join("");
  if (document.execCommand(additions.length ? "insertHTML" : "delete", false, html)) {
    const insertedChip = selection.anchorNode?.parentElement?.closest(".meta-tag");
    if (insertedChip?.parentNode === editor) {
      const range = document.createRange();
      range.setStartAfter(insertedChip);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return;
  }

  const existing = new Set(tagsInEditor(editor));
  for (const value of additions) insertTagBefore(editor, text, value, existing);
  text.data = remainder + text.data.slice(offset);

  const range = document.createRange();
  range.setStart(text, remainder.length);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function commitAllTagText(editor: HTMLElement): void {
  const known = new Set(tagsInEditor(editor));
  for (const node of Array.from(editor.childNodes)) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    for (const value of (node.textContent ?? "").split(tagSeparators)) {
      insertTagBefore(editor, node, value, known);
    }
    node.parentNode?.removeChild(node);
  }
}

/** 紙面の土台。方眼・紙テクスチャ・本文カラムを提供する。 */
export const BlogPaper = component$(() => {
  return (
    <main class="paper" data-layout-key="paper">
      <GridLayer />
      <div class="paper-texture" aria-hidden="true"></div>
      <div class="content">
        <Slot />
      </div>
    </main>
  );
});

/** 方眼レイヤー (sample.html の SVG を移植)。 */
export const GridLayer = component$(() => {
  return (
    <svg class="grid-layer" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <pattern id="graph-paper" width="39" height="39" patternUnits="userSpaceOnUse">
          <path
            d="M 9.75 0 V 39"
            fill="none"
            stroke="rgb(135 76 68 / 20%)"
            stroke-width=".6"
            stroke-dasharray="1.5 2.7"
          />

          <path
            d="M 19.5 0 V 39"
            fill="none"
            stroke="rgb(128 71 65 / 16%)"
            stroke-width=".62"
            stroke-dasharray="2.1 2.4"
            stroke-dashoffset=".8"
          />

          <path
            d="M 29.25 0 V 39"
            fill="none"
            stroke="rgb(139 79 69 / 18%)"
            stroke-width=".58"
            stroke-dasharray="1.3 2.9"
            stroke-dashoffset="1.1"
          />

          <path
            d="M 0 9.75 H 39"
            fill="none"
            stroke="rgb(135 76 68 / 20%)"
            stroke-width=".6"
            stroke-dasharray="2.2 2.8"
            stroke-dashoffset=".4"
          />

          <path
            d="M 0 19.5 H 39"
            fill="none"
            stroke="rgb(128 71 65 / 16%)"
            stroke-width=".62"
            stroke-dasharray="1.6 2.5"
            stroke-dashoffset="1.2"
          />

          <path
            d="M 0 29.25 H 39"
            fill="none"
            stroke="rgb(139 79 69 / 18%)"
            stroke-width=".58"
            stroke-dasharray="2.3 3.1"
            stroke-dashoffset=".6"
          />

          <path
            d="M 0 0 H 39"
            fill="none"
            stroke="rgb(119 64 58 / 32%)"
            stroke-width=".78"
            stroke-dasharray="14 .8 8 1.3 12 .9"
          />

          <path
            d="M 0 0 V 39"
            fill="none"
            stroke="rgb(119 64 58 / 32%)"
            stroke-width=".78"
            stroke-dasharray="9 .7 15 1.1 11 .8"
            stroke-dashoffset="3"
          />

          <path
            d="
              M .27 .18 H 39
              M .27 .18 V 39
            "
            fill="none"
            stroke="rgb(151 83 72 / 10%)"
            stroke-width=".7"
            stroke-dasharray="11 1 16 2 7 1"
          />

          <path d="M 9.75 23 V 27" stroke="rgb(242 234 213 / 52%)" stroke-width="1.8" />

          <path d="M 25 19.5 H 29" stroke="rgb(242 234 213 / 43%)" stroke-width="1.8" />

          <circle cx="0" cy="0" r=".68" fill="rgb(115 61 55 / 16%)" />
        </pattern>
      </defs>

      <rect width="100%" height="100%" fill="url(#graph-paper)" />
    </svg>
  );
});

interface BlogHeaderProps {
  tags: string[];
  /** <time datetime> 用の機械可読日付 (例: "2026-09-17") */
  dateTime: string;
  /** 表示用の和文日付 (例: "令和八年 九月十七日 木曜日") */
  dateLabel: string;
  publicationStatus?: "draft" | "published";
  title: string;
  subtitle?: string;
  editable?: boolean;
  canEdit?: boolean;
  editLoading?: boolean;
  saving?: boolean;
  onEditIntent$?: QRL<() => void>;
  onEditRequest$?: QRL<() => void>;
  onDoneRequest$?: QRL<() => void>;
  onTagsChange$?: QRL<(tags: string[]) => void>;
  onDateInput$?: QRL<(value: string) => void>;
  onPublicationToggle$?: QRL<() => void>;
  onTitleInput$?: QRL<(value: string) => void>;
  onSubtitleInput$?: QRL<(value: string) => void>;
}

/** 記事ヘッダー (タグ・日付・公開状態・題・副題)。 */
export const BlogHeader = component$((props: BlogHeaderProps) => {
  // Keep the browser-owned text nodes stable while editing. ArticleShell remounts
  // this component only when switching modes so these values refresh afterward.
  const initialTags = useConstant(() => props.tags);
  const initialTitle = useConstant(() => props.title);
  const initialSubtitle = useConstant(() => props.subtitle);
  const dateParts = /^(.+年)\s*(.+月)(.+日)\s*(.曜日)$/.exec(props.dateLabel);
  return (
    <header data-layout-key="header">
      <hgroup>
      <h1
        class="ink"
        data-article-field="title"
        contentEditable={props.editable ? "true" : undefined}
        onInput$={(_, element) => props.onTitleInput$?.(element.textContent ?? "")}
      >
        <RenderOnce>{initialTitle}</RenderOnce>
      </h1>

      <p
        class="subtitle ink ink-muted"
        data-article-field="subtitle"
        data-empty={props.subtitle?.trim() ? undefined : "true"}
        contentEditable={props.editable ? "true" : undefined}
        onInput$={(_, element) => {
          const value = element.textContent ?? "";
          element.toggleAttribute("data-empty", !value.trim());
          props.onSubtitleInput$?.(value);
        }}
      >
        <RenderOnce>{initialSubtitle}</RenderOnce>
      </p>
      </hgroup>
      <div class="meta">
        <span
          class="meta-tags"
          data-article-field="tags"
          data-editable={props.editable ? "true" : undefined}
          data-empty={props.tags.length ? undefined : "true"}
          contentEditable={props.editable ? "true" : undefined}
          role={props.editable ? "textbox" : undefined}
          aria-label={props.editable ? "タグ" : undefined}
          aria-multiline={props.editable ? "false" : undefined}
          onInput$={props.editable ? (event, element) => {
            if (event.isComposing) return;
            commitTagTextAtCaret(element);
            const tags = tagsInEditor(element);
            element.toggleAttribute("data-empty", tags.length === 0);
            if (tags.join("\0") !== props.tags.join("\0")) props.onTagsChange$?.(tags);
          } : undefined}
          onCompositionEnd$={props.editable ? (_, element) => {
            commitTagTextAtCaret(element);
            const tags = tagsInEditor(element);
            element.toggleAttribute("data-empty", tags.length === 0);
            if (tags.join("\0") !== props.tags.join("\0")) props.onTagsChange$?.(tags);
          } : undefined}
          onKeyDown$={props.editable ? (event, element) => {
            if (event.isComposing || event.key !== "Enter") return;
            event.preventDefault();
            commitTagTextAtCaret(element, true);
            const tags = tagsInEditor(element);
            element.toggleAttribute("data-empty", tags.length === 0);
            if (tags.join("\0") !== props.tags.join("\0")) props.onTagsChange$?.(tags);
          } : undefined}
          onBlur$={props.editable ? (_, element) => {
            commitAllTagText(element);
            const tags = tagsInEditor(element);
            element.toggleAttribute("data-empty", tags.length === 0);
            if (tags.join("\0") !== props.tags.join("\0")) props.onTagsChange$?.(tags);
          } : undefined}
        >
          <RenderOnce>
            {initialTags.map((tag) => (
              <span class="meta-tag" contentEditable={props.editable ? "false" : undefined} key={tag}>{tag}</span>
            ))}
          </RenderOnce>
        </span>
        <span class="meta-controls">
        <span class="article-date-control">
          <time class="ink ink-muted" dateTime={props.dateTime} data-article-field="publishedAt">
            {dateParts ? (
              <>
                <span class="article-date-group">
                  <span class="article-date-unit">{dateParts[1].trim()}</span>{" "}
                  <span class="article-date-group">
                    <span class="article-date-unit">{dateParts[2].trim()}</span>
                    <wbr />
                    <span class="article-date-unit">{dateParts[3].trim()}</span>
                  </span>
                </span>{" "}
                <span class="article-date-unit">{dateParts[4]}</span>
              </>
            ) : (
              props.dateLabel
            )}
          </time>
          {props.editable && props.onDateInput$ && (
            <input
              class="article-date-input"
              type="date"
              aria-label="公開日"
              value={props.dateTime}
              onInput$={(_, element) => props.onDateInput$?.(element.value)}
            />
          )}
        </span>

        {props.publicationStatus && (
          <span class="publication-status">
            <span class="publication-status-measure" aria-hidden="true">
              （非公開）
            </span>
            <button
              type="button"
              class="publication-status-button"
              disabled={!props.editable}
              aria-label={
                props.editable
                  ? `公開状態を切り替え。現在${props.publicationStatus === "published" ? "公開" : "非公開"}`
                  : props.publicationStatus === "published"
                    ? "公開"
                    : "非公開"
              }
              onClick$={props.onPublicationToggle$}
            >
              {props.publicationStatus === "published" ? "（公開）" : "（非公開）"}
            </button>
          </span>
        )}
        {props.canEdit !== false && (
          <button
            type="button"
            class="article-header-edit"
            aria-busy={props.editLoading || props.saving}
            disabled={props.editLoading || props.saving}
            onPointerEnter$={props.editable ? undefined : props.onEditIntent$}
            onFocus$={props.editable ? undefined : props.onEditIntent$}
            onClick$={props.editable ? props.onDoneRequest$ : props.onEditRequest$}
          >
            {props.editLoading || props.saving ? "…" : props.editable ? "完了" : "編集"}
          </button>
        )}
        </span>
      </div>

    </header>
  );
});

interface SectionHeadingProps {
  title: string;
}

/** 節見出し。番号は CSS counter から自動生成する。 */
export const SectionHeading = component$((props: SectionHeadingProps) => {
  return <h2 class="ink">{props.title}</h2>;
});

/** 本文段落。 */
export const ProseP = component$(() => {
  return (
    <p>
      <span class="ink">
        <Slot />
      </span>
    </p>
  );
});

/** 本文ブロック (<article>)。 */
export const BlogArticle = component$(() => {
  return (
    <article>
      <Slot />
    </article>
  );
});

interface InlineMathProps {
  /** SSR 済み HTML (mjx-container を含む) */
  html: string;
}

/** 文中の数式。 */
export const InlineMath = component$((props: InlineMathProps) => {
  return <span class="math-tex" dangerouslySetInnerHTML={props.html}></span>;
});

interface MathBlockProps {
  /** SSR 済み HTML (display="true" の mjx-container) */
  html: string;
}

/** 別行立て数式。 */
export const MathBlock = component$((props: MathBlockProps) => {
  return (
    <div class="math-block" data-blog-surface={articleSurface.math}>
      <div dangerouslySetInnerHTML={props.html}></div>
    </div>
  );
});

interface CodeBlockProps {
  /** キャプション左 (例: "文章の構造") */
  caption: string;
  /** キャプション右の言語表示 (例: "HTML") */
  languageLabel: string;
  /** <code> の言語クラス (例: "language-html") */
  languageClass: string;
  /** highlight.js SSR 済みの HTML (エスケープ済みコード断片) */
  html: string;
}

/** コードブロック (キャプション + ハイライト済み pre)。 */
export const CodeBlock = component$((props: CodeBlockProps) => {
  return (
    <div class="code-block" data-blog-surface={articleSurface.code}>
      <div class="code-caption">
        <span>{props.caption}</span>
        <span>{props.languageLabel}</span>
      </div>

      <pre>
        <code class={props.languageClass} dangerouslySetInnerHTML={props.html}></code>
      </pre>
    </div>
  );
});

export interface UrlLinkItem {
  href: string;
  label: string;
}

/** URL 直書きリンクのリスト。 */
export const UrlLinkList = component$((props: { items: readonly UrlLinkItem[] }) => {
  return (
    <ul class="link-list">
      {props.items.map((item) => (
        <li key={item.href}>
          <a class="url-link" href={item.href}>
            {item.label}
          </a>
        </li>
      ))}
    </ul>
  );
});

interface AsideNoteProps {
  label: string;
}

/** 補足 (aside)。 */
export const AsideNote = component$((props: AsideNoteProps) => {
  return (
    <aside class="aside ink ink-muted" data-kind={props.label === "WARN" ? "warning" : "note"}>
      <span class="aside-label">{props.label}</span>
      <Slot />
    </aside>
  );
});

interface DetailsNoteProps {
  summary: string;
}

/** 折りたたみ補足 (details)。 */
export const DetailsNote = component$((props: DetailsNoteProps) => {
  return (
    <details>
      <summary>{props.summary}</summary>

      <div class="details-body">
        <Slot />
      </div>
    </details>
  );
});

/** 表の横スクロール用ラッパー。中に素の table を書く。 */
export const TableWrap = component$(() => {
  return (
    <div class="table-wrap">
      <Slot />
    </div>
  );
});

interface FigureProps {
  caption: string;
}

/**
 * 図版。枠内には図・写真など任意の内容を置く。
 * 画像の色は変えず、紙面の枠で本文と馴染ませる。
 */
export const Figure = component$((props: FigureProps) => {
  return (
    <figure>
      <div class="figure-field" data-blog-surface={articleSurface.figure}>
        <Slot />
      </div>

      <figcaption>{props.caption}</figcaption>
    </figure>
  );
});

interface BlogFooterProps {
  left: string;
  right: string;
}

/** 記事末フッター。 */
export const BlogFooter = component$((props: BlogFooterProps) => {
  return (
    <footer class="page-footer ink ink-muted" data-layout-key="footer">
      <span>{props.left}</span>
      <span>{props.right}</span>
    </footer>
  );
});
