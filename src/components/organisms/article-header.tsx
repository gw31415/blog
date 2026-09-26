import { RenderOnce, sync$, type QRL } from "@qwik.dev/core";
import { ArticleEditButton } from "../atoms/edit-button";
import { BlogTags } from "../molecules/tags";
import { singleLineInput, singleLinePaste, singleLineKey } from "../foundations/single-line-input";

interface BlogHeaderProps {
  tags: string[];
  initialTags: string[];
  /** <time datetime> 用の機械可読日付 (例: "2026-09-17") */
  dateTime: string;
  /** 表示用の和文日付 (例: "令和八年 九月十七日 木曜日") */
  dateLabel: string;
  publicationStatus?: "draft" | "published";
  initialTitle: string;
  initialSubtitle: string;
  initialDescription: string;
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
  onDescriptionInput$?: QRL<(value: string) => void>;
}

/** 記事ヘッダー (タグ・日付・公開状態・題・副題・説明)。 */
export function BlogHeader(props: BlogHeaderProps) {
  // Keep browser-owned text nodes across mode changes as well as typing.
  // Removing the header during a remount can clamp a bottom-aligned scroller.
  const dateParts = /^(.+年)\s*(.+月)(.+日)\s*(.曜日)$/.exec(props.dateLabel);
  return (
    <header data-layout-key="header">
      <hgroup>
        <h1
          class="ink type-title"
          data-article-field="title"
          data-placeholder="タイトルを入力"
          onBeforeInput$={singleLineInput}
          onPaste$={singleLinePaste}
          onKeyDown$={singleLineKey}
          contentEditable={props.editable ? "true" : "false"}
          onInput$={(event, element) => {
            if (!event.isComposing && !element.textContent) element.replaceChildren();
            void props.onTitleInput$?.(element.textContent ?? "");
          }}
        >
          <RenderOnce>{props.initialTitle}</RenderOnce>
        </h1>

        <p
          class="subtitle type-subtitle ink ink-muted"
          data-article-field="subtitle"
          data-placeholder="サブタイトルを入力"
          data-empty={props.subtitle?.trim() ? undefined : "true"}
          onBeforeInput$={singleLineInput}
          onPaste$={singleLinePaste}
          onKeyDown$={singleLineKey}
          contentEditable={props.editable ? "true" : "false"}
          onInput$={(event, element) => {
            if (!event.isComposing && !element.textContent) element.replaceChildren();
            const value = element.textContent ?? "";
            element.toggleAttribute("data-empty", !value.trim());
            void props.onSubtitleInput$?.(value);
          }}
        >
          <RenderOnce>{props.initialSubtitle}</RenderOnce>
        </p>
      </hgroup>
      <p
        class="article-description type-meta ink ink-muted"
        data-article-field="description"
        data-placeholder="説明を入力"
        aria-label="記事の説明"
        role={props.editable ? "textbox" : undefined}
        aria-multiline={props.editable ? "false" : undefined}
        onBeforeInput$={singleLineInput}
        onPaste$={singleLinePaste}
        onKeyDown$={singleLineKey}
        contentEditable={props.editable ? "true" : "false"}
        onInput$={(event, element) => {
          if (!event.isComposing && !element.textContent) element.replaceChildren();
          void props.onDescriptionInput$?.(element.textContent ?? "");
        }}
      >
        <RenderOnce>{props.initialDescription}</RenderOnce>
      </p>
      <div class="meta type-meta">
        <BlogTags
          initialTags={props.initialTags}
          tags={props.tags}
          editable={props.editable}
          onTagsChange$={props.onTagsChange$}
        />
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
                onClick$={sync$((_, element: HTMLInputElement) => {
                  try {
                    element.showPicker?.();
                  } catch {
                    element.focus();
                  }
                })}
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
            <ArticleEditButton
              placement="header"
              editable={props.editable}
              busy={props.editLoading || props.saving}
              onEditIntent$={props.onEditIntent$}
              onEditRequest$={props.onEditRequest$}
              onDoneRequest$={props.onDoneRequest$}
            />
          )}
        </span>
      </div>
    </header>
  );
}
