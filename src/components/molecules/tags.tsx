import { css } from "@qstyle/qwik";
import { singleLineInput, singleLinePaste, singleLineKey } from "../foundations/single-line-input";
import { RenderOnce, $, type QRL } from "@qwik.dev/core";

const tagSeparators = /[,，、\s]+/u;

function tagsInEditor(editor: HTMLElement): string[] {
  return Array.from(editor.children)
    .filter((child) => child.classList.contains("meta-tag"))
    .map((child) => child.textContent ?? "");
}

function insertTagBefore(
  editor: HTMLElement,
  before: Node,
  value: string,
  known: Set<string>,
): void {
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
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function commitTagTextAtCaret(editor: HTMLElement, includeRemainder = false): void {
  const selection = window.getSelection();
  const node = selection?.anchorNode;
  if (!selection?.isCollapsed || !(node instanceof Text) || node.parentNode !== editor) return;

  const text = node;
  const beforeCaret = text.data.slice(0, selection.anchorOffset);
  const boundary = includeRemainder
    ? beforeCaret.length
    : [...beforeCaret.matchAll(/[,，、\s]/gu)].at(-1)?.index;
  if (boundary === undefined) return;

  const committed = beforeCaret.slice(0, includeRemainder ? boundary : boundary + 1);
  const remainder = beforeCaret.slice(committed.length);
  const known = new Set(tagsInEditor(editor));
  const additions = committed
    .split(tagSeparators)
    .map((value) => value.trim())
    .filter((value) => {
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
  const html = additions
    .map((value) => `<span class="meta-tag" contenteditable="false">${escapeTagHtml(value)}</span>`)
    .join("");
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

/** Shared tag renderer; the editable branch keeps browser-owned nodes stable. */
export function BlogTags(props: {
  tags: string[];
  initialTags?: string[];
  editable?: boolean;
  wrap?: boolean;
  ink?: boolean;
  onTagsChange$?: QRL<(tags: string[]) => void>;
}) {
  return (
    <span
      css={blogTagsStyles}
      class={`meta-tags type-meta ${props.wrap ? "post-tags" : ""}`}
      data-article-field={props.wrap ? undefined : "tags"}
      data-placeholder="タグを入力"
      data-editable={props.editable ? "true" : undefined}
      data-empty={props.tags.length ? undefined : "true"}
      contentEditable={props.editable ? "true" : "false"}
      role={props.editable ? "textbox" : undefined}
      aria-label={props.editable ? "タグ" : undefined}
      aria-multiline={props.editable ? "false" : undefined}
      onBeforeInput$={singleLineInput}
      onPaste$={singleLinePaste}
      onInput$={
        props.editable
          ? (event, element) => {
              if (event.isComposing) return;
              if (!element.textContent) element.replaceChildren();
              commitTagTextAtCaret(element);
              const tags = tagsInEditor(element);
              element.toggleAttribute("data-empty", tags.length === 0);
              if (tags.join("\0") !== props.tags.join("\0")) void props.onTagsChange$?.(tags);
            }
          : undefined
      }
      onCompositionEnd$={
        props.editable
          ? (_, element) => {
              commitTagTextAtCaret(element);
              const tags = tagsInEditor(element);
              element.toggleAttribute("data-empty", tags.length === 0);
              if (tags.join("\0") !== props.tags.join("\0")) void props.onTagsChange$?.(tags);
            }
          : undefined
      }
      onKeyDown$={
        props.editable
          ? [
              singleLineKey,
              $((event: KeyboardEvent, element: HTMLSpanElement) => {
                if (event.isComposing || event.key !== "Enter") return;
                commitTagTextAtCaret(element, true);
                const tags = tagsInEditor(element);
                element.toggleAttribute("data-empty", tags.length === 0);
                if (tags.join("\0") !== props.tags.join("\0")) void props.onTagsChange$?.(tags);
              }),
            ]
          : undefined
      }
      onBlur$={
        props.editable
          ? (_, element) => {
              commitAllTagText(element);
              const tags = tagsInEditor(element);
              element.toggleAttribute("data-empty", tags.length === 0);
              if (tags.join("\0") !== props.tags.join("\0")) void props.onTagsChange$?.(tags);
            }
          : undefined
      }
    >
      <RenderOnce>
        {(props.initialTags ?? props.tags).map((tag) => (
          <span class="meta-tag" contentEditable={props.editable ? "false" : undefined} key={tag}>
            {props.ink ? <span class="ink ink-muted">{tag}</span> : tag}
          </span>
        ))}
      </RenderOnce>
    </span>
  );
}

const blogTagsStyles = css`
  & .meta-tag {
    display: inline-flex;
    align-items: baseline;
    padding: 0.05em 0.45em;
    margin-inline-end: 0.3em;
    border: 0;
    border-radius: 999px;
    background: rgb(112 65 58 / 10%);
    font-family: system-ui, sans-serif;
    font-size: 0.9em;
    white-space: nowrap;
  }
  &.post-tags {
    line-height: 1.5;
  }
  &.post-tags .meta-tag {
    max-inline-size: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }
`;
