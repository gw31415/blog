import { css } from "@qstyle/qwik";
import { PostCard } from "../molecules/post-card";
import { MonthMarker } from "../molecules/month-marker";
import { ConfirmationDialog } from "../molecules/confirmation-dialog";
import { groupPostsByDay, groupPostsByMonth } from "../../content/post-groups";
import { $, component$, Slot, useSignal, type QRL } from "@qwik.dev/core";
import type { PostSummary } from "~/server/post-list";

export const PostList = component$<{
  posts: PostSummary[];
  layout?: "list" | "grid";
  canManage?: boolean;
  onDelete$?: QRL<(id: string) => Promise<boolean>>;
}>((props) => {
  const dialog = useSignal<HTMLDialogElement>();
  const selected = useSignal<PostSummary>();
  const busy = useSignal(false);
  const error = useSignal("");
  const confirm = $(async () => {
    if (!selected.value || busy.value || !props.onDelete$) return;
    busy.value = true;
    error.value = "";
    try {
      if (await props.onDelete$(selected.value.id)) dialog.value?.close();
      else error.value = "削除できませんでした。もう一度お試しください。";
    } catch {
      error.value = "通信に失敗しました。もう一度お試しください。";
    } finally {
      busy.value = false;
    }
  });
  return (
    <div class="post-stream" css={postListStyles}>
      <span class="desk-surface" aria-hidden="true" />
      <div class="post-desk" data-layout={props.layout ?? "list"}>
        <Slot name="stream-start" />
        {groupPostsByMonth(props.posts).map((group) => (
          <section
            class="post-month"
            key={group.month}
            aria-label={`${group.month.slice(0, 4)}年${Number(group.month.slice(5))}月の記事`}
          >
            <MonthMarker month={group.month} />
            <div class="month-days">
              {groupPostsByDay(group.posts).map((day) => (
                <section class="post-day" key={day.date} aria-label={`${day.date}の記事`}>
                  <time class="letter-day" dateTime={day.date} aria-label={day.date}>
                    {day.date.slice(8)}
                  </time>
                  <ul class="letters">
                    {day.posts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        layout={props.layout}
                        canManage={props.canManage}
                        onDeleteRequest$={(selectedPost) => {
                          selected.value = selectedPost;
                          error.value = "";
                          dialog.value?.showModal();
                        }}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </section>
        ))}
        <Slot name="stream-end" />
      </div>
      {props.posts.length === 0 && <p class="empty">記事はまだありません。</p>}
      <Slot name="stream-after" />
      {props.canManage && (
        <ConfirmationDialog
          id="delete"
          dialog={dialog}
          title="記事を削除しますか"
          subject={selected.value?.title || "無題"}
          description="削除した記事は元に戻せません。"
          confirmLabel="削除する"
          busy={busy.value}
          error={error.value}
          onConfirm$={confirm}
        />
      )}
    </div>
  );
});

const postListStyles = css`
  flex: 1 1 auto;
  overflow-x: clip;
  --archive-header-height: calc(1.6875rem + 1px + env(safe-area-inset-top));
  --archive-month-top: calc(var(--archive-header-height) + 8px);
  --archive-day-offset: 38px;
  --desk: #dfdbcd;
  --desk-dot: rgb(80 68 45 / 12%);
  --desk-glint: rgb(255 255 255 / 48%);
  --envelope: #f8f6f0;
  --fold: #eee6d2;
  --edge: rgb(90 71 44 / 21%);
  --date-ink: var(--muted);
  background-color: var(--desk);
  --desk-pattern:
    radial-gradient(circle, var(--desk-dot) 0.55px, transparent 0.8px),
    radial-gradient(circle, var(--desk-glint) 0.55px, transparent 0.8px);
  --desk-edge-shadow: inset 1px 0 var(--edge), inset -1px 0 var(--edge);

  @media screen {
    position: relative;

    /* Only the background is isolated/clipped. Cards must share the header's
       stacking context so an active envelope can rise in front of it. */
    & > .desk-surface {
      position: absolute;
      inset: 0;
      z-index: 0;
      isolation: isolate;
      clip-path: inset(0);
      pointer-events: none;
    }
    & > .desk-surface::before {
      content: "";
      position: fixed;
      inset: 0;
      z-index: -1;
      pointer-events: none;
      background-image: var(--desk-pattern);
      background-position:
        0 0,
        1px 1px;
      background-size: 5px 5px;
    }
    & > .desk-surface::after {
      content: "";
      position: absolute;
      inset: 0;
      z-index: -1;
      pointer-events: none;
      /* Keep the inset edge above the dots, as for a normal CSS background. */
      box-shadow: var(--desk-edge-shadow);
    }
  }
  @media print {
    & > .desk-surface {
      display: none;
    }
    background-image: var(--desk-pattern);
    background-attachment: fixed, fixed;
    background-position:
      0 0,
      1px 1px;
    background-size: 5px 5px;
    box-shadow: var(--desk-edge-shadow);
  }

  & .post-desk {
    position: relative;
    min-height: 100%;
    padding-top: var(--body-leading);
  }
  & .post-month {
    position: relative;
    display: grid;
    grid-template-columns: 68px minmax(0, 1fr);
    align-items: start;
  }
  & .month-days {
    min-width: 0;
    padding: 0 24px 8px 0;
  }
  & .post-day {
    position: relative;
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr);
    align-items: start;
  }
  & .letter-day {
    position: sticky;
    z-index: 3;
    align-self: start;
    padding: 4px 0;
    color: var(--date-ink);
    font: var(--small-size)/1.5 var(--sans);
    font-variant-numeric: tabular-nums;
    text-align: left;
  }
  & .letters {
    grid-column: 2;
    list-style: none;
    display: grid;
    gap: 8px;
    padding: 0;
    margin: 0;
  }
  & .empty {
    padding: 48px;
    color: var(--muted);
  }
  & .post-desk[data-layout="grid"] .letters {
    gap: 28px;
  }
  & .more {
    position: relative;
    min-height: 72px;
    margin: 8px 24px 0 104px;
    padding: 22px 12px 28px;
    box-sizing: border-box;
    color: var(--muted);
    font-size: var(--small-size);
    text-align: center;
  }
  & .more::before {
    content: "";
    position: absolute;
    top: 0;
    right: 18%;
    left: 18%;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--edge) 20% 80%, transparent);
  }
  & .more p {
    margin: 0;
  }
  & .more p + p,
  & .more p + a {
    margin-top: 8px;
  }
  & .more a {
    font: inherit;
    color: var(--muted);
    text-underline-offset: 4px;
  }
  & .more a:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 4px;
  }
  & .stream-footer {
    position: relative;
    padding: 0 0 var(--body-leading);
    background: transparent;
  }
  @media (max-width: 600px) {
    --mobile-calendar-inset: 12px;
    --mobile-calendar-rail: 52px;
    --mobile-calendar-height: 4.75rem;

    & .post-month {
      display: grid;
      grid-template-columns: var(--mobile-calendar-rail) minmax(0, 1fr);
      padding: 0 0 4px;
    }
    & .month-days {
      grid-column: 1 / -1;
      padding: 0 6px 4px 0;
    }
    & .post-day {
      grid-template-columns: var(--mobile-calendar-rail) minmax(0, 1fr);
    }
    & .letter-day {
      top: calc(var(--archive-header-height) + var(--mobile-calendar-height));
      margin-left: var(--mobile-calendar-inset);
    }
    & .post-desk[data-layout="grid"] .letters {
      grid-template-columns: 1fr;
    }
    & .more {
      margin: 6px 6px 0 var(--mobile-calendar-rail);
      padding-bottom: 22px;
    }
  }
  @media (forced-colors: active) {
    &.post-stream {
      background: Canvas;
    }
    & > .desk-surface {
      display: none;
    }
  }
  @media (min-width: 601px) {
    & .letter-day {
      top: calc(var(--archive-month-top) + var(--archive-day-offset));
    }
    & .post-month {
      padding: 0 0 8px;
    }
    & .post-day:first-child > .letter-day {
      margin-top: var(--archive-day-offset);
    }
    & .post-desk[data-layout="grid"] .letters {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
`;
