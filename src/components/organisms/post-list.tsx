import { css } from "@qstyle/qwik";
import { PostCard } from "../molecules/post-card";
import { MonthMarker } from "../molecules/month-marker";
import { ConfirmationDialog } from "../molecules/confirmation-dialog";
import { groupPostsByMonth, postDate } from "../../content/post-groups";
import { $, component$, useSignal, type QRL } from "@qwik.dev/core";
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
    <div css={postListStyles}>
      <div class="post-desk" data-layout={props.layout ?? "list"}>
        {groupPostsByMonth(props.posts).map((group) => (
          <section
            class="post-month"
            key={group.month}
            aria-label={`${group.month.slice(0, 4)}年${Number(group.month.slice(5))}月の記事`}
          >
            <MonthMarker month={group.month} />
            <ul class="letters">
              {group.posts.map((post, index) => (
                <PostCard
                  key={post.id}
                  post={post}
                  showDate={index === 0 || postDate(group.posts[index - 1]) !== postDate(post)}
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
      {props.posts.length === 0 && <p class="empty">記事はまだありません。</p>}
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
  display: contents;
  & .post-desk {
    --desk: #dfdbcd;
    --desk-dot: rgb(80 68 45 / 12%);
    --desk-glint: rgb(255 255 255 / 48%);
    --envelope: #f5eedc;
    --fold: #eee6d2;
    --edge: rgb(90 71 44 / 21%);
    --date-ink: var(--muted);
    position: relative;
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
  }
  & .post-month {
    position: relative;
    display: flow-root;
  }
  & .letters {
    list-style: none;
    display: grid;
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
  @media (max-width: 600px) {
    & .post-desk {
      margin-left: 0;
    }
    & .post-month {
      padding: 0 0 6px;
    }
    & .letters {
      gap: 16px;
    }
    & .post-desk[data-layout="grid"] .letters {
      grid-template-columns: 1fr;
    }
  }
  @media (forced-colors: active) {
    & .post-desk {
      background: Canvas;
    }
  }
  @media (min-width: 601px) {
    & .post-desk {
      margin-left: 64px;
    }
    & .post-month {
      padding: 30px 28px 8px 40px;
    }
    & .letters {
      gap: 28px;
    }
    & .post-desk[data-layout="grid"] .letters {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
`;
