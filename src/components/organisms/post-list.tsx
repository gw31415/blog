import { css } from "@qstyle/qwik";
import { PostCard } from "../molecules/post-card";
import { MonthMarker } from "../molecules/month-marker";
import { ConfirmationDialog } from "../molecules/confirmation-dialog";
import { groupPostsByDay, groupPostsByMonth } from "../../content/post-groups";
import { $, component$, Slot, useSignal, type QRL, type Signal } from "@qwik.dev/core";
import type { PostSummary } from "~/server/post-list";

export const PostList = component$<{
  posts: PostSummary[];
  layout?: "list" | "grid";
  canManage?: boolean;
  stream?: Signal<HTMLElement | undefined>;
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
    <div class="post-stream" ref={props.stream} css={postListStyles}>
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
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scrollbar-gutter: stable;
  scroll-padding-top: var(--body-leading);
  --desk: #dfdbcd;
  --desk-dot: rgb(80 68 45 / 12%);
  --desk-glint: rgb(255 255 255 / 48%);
  --envelope: #f5eedc;
  --fold: #eee6d2;
  --edge: rgb(90 71 44 / 21%);
  --date-ink: var(--muted);
  background-color: var(--desk);
  background-image:
    radial-gradient(circle, var(--desk-dot) 0.55px, transparent 0.8px),
    radial-gradient(circle, var(--desk-glint) 0.55px, transparent 0.8px);
  background-position:
    0 0,
    1px 1px;
  background-size: 5px 5px;
  box-shadow:
    inset 1px 0 var(--edge),
    inset -1px 0 var(--edge);

  & .post-desk {
    position: relative;
    min-height: 100%;
    padding-top: var(--body-leading);
  }
  & .stream-heading {
    position: static;
    margin: 0;
    padding: 0 68px 18px;
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
    top: var(--body-leading);
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
    padding: 0 0 var(--body-leading);
    background: transparent;
  }
  @media (max-width: 600px) {
    & .stream-heading {
      padding: 0 20px 16px;
    }
    & .post-month {
      display: block;
      padding: 0 0 4px;
    }
    & .month-days {
      padding: 0 6px 4px 4px;
    }
    & .post-day {
      grid-template-columns: 28px minmax(0, 1fr);
    }
    & .letter-day {
      top: calc(var(--body-leading) + 64px);
      padding-left: 0;
    }
    & .letters {
      gap: 0;
    }
    & .post-desk[data-layout="grid"] .letters {
      grid-template-columns: 1fr;
    }
    & .more {
      margin: 6px 6px 0 32px;
      padding-bottom: 22px;
    }
  }
  @media (forced-colors: active) {
    &.post-stream {
      background: Canvas;
    }
  }
  @media (min-width: 601px) {
    & .post-month {
      padding: 0 0 8px;
    }
    & .post-desk[data-layout="grid"] .letters {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
`;
