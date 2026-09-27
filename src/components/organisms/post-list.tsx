import { css } from "@qstyle/qwik";
import { PostCard } from "../molecules/post-card";
import { MonthMarker } from "../molecules/month-marker";
import { ConfirmationDialog } from "../molecules/confirmation-dialog";
import { groupPostsByDay, groupPostsByMonth } from "../../content/post-groups";
import { $, component$, Slot, useSignal, useVisibleTask$, type QRL } from "@qwik.dev/core";
import type { PostSummary } from "~/server/post-list";

export const PostList = component$<{
  posts: PostSummary[];
  layout?: "list" | "grid";
  canManage?: boolean;
  onDelete$?: QRL<(id: string) => Promise<boolean>>;
}>((props) => {
  const dialog = useSignal<HTMLDialogElement>();
  const stream = useSignal<HTMLDivElement>();
  const selected = useSignal<PostSummary>();
  const busy = useSignal(false);
  const error = useSignal("");
  // Envelope movement stays CSS-driven; this flag only pauses hover during scrolling.
  useVisibleTask$(
    ({ cleanup }) => {
      const element = stream.value;
      if (!element) return;
      let idleTimer: number | undefined;
      const endScroll = () => {
        window.clearTimeout(idleTimer);
        idleTimer = undefined;
        element.removeAttribute("data-scrolling");
      };
      const onScroll = () => {
        if (!element.hasAttribute("data-scrolling")) element.setAttribute("data-scrolling", "");
        window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(endScroll, 150);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("scrollend", endScroll);
      cleanup(() => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("scrollend", endScroll);
        endScroll();
      });
    },
    { strategy: "document-ready" },
  );
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
    <div class="post-stream" css={postListStyles} ref={stream}>
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
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  overflow-x: clip;
  --archive-header-height: var(--site-header-height, 52px);
  --archive-month-top: calc(var(--archive-header-height) + 8px);
  --archive-day-offset: 38px;
  --envelope: #f8f6f0;
  --fold: #eee6d2;
  --date-ink: var(--muted);
  position: relative;

  & .post-desk {
    position: relative;
    flex: 1 0 auto;
    padding-top: var(--body-leading);
  }
  @media screen {
    & .post-desk[data-layout="list"] {
      padding-top: 0;
    }
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
  & .post-desk[data-layout="grid"] .letters {
    gap: 28px;
  }
  &
    .post-desk[data-layout="list"]
    .post-month:first-of-type
    .post-day:first-child
    .dated-letter:first-child {
    margin-bottom: 12px;
  }
  & .stream-footer {
    position: relative;
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
  }
  @media (forced-colors: active) {
    &.post-stream {
      background: Canvas;
    }
  }
  @media (min-width: 601px) {
    & .post-desk[data-layout="list"] .post-month:first-of-type {
      margin-top: 80px;
    }
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
