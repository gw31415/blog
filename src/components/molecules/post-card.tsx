import { Link } from "@qwik.dev/router";
import { css } from "@qstyle/qwik";
import { component$, type QRL } from "@qwik.dev/core";
import { BlogTags } from "~/components/molecules/tags";
import { canonicalPath } from "~/content/post-url";
import type { PostSummary } from "~/server/post-list";
import { postDate } from "../../content/post-groups";
import { PostActions } from "../atoms/action-surface";

export const PostCard = component$<{
  post: PostSummary;
  showDate?: boolean;
  layout?: "list" | "grid";
  canManage?: boolean;
  onDeleteRequest$?: QRL<(post: PostSummary) => void>;
}>((props) => {
  const post = props.post;
  return (
    <li class="dated-letter" css={postCardStyles} data-layout={props.layout}>
      <PostActions>
        {props.showDate !== false && (
          <time class="letter-day" dateTime={postDate(post)} aria-label={postDate(post)}>
            {postDate(post).slice(8)}
          </time>
        )}
        <article class="letter">
          <h3 class="letter-title type-heading">
            <Link href={canonicalPath(post)} prefetchData="visible">
              {post.title || "無題"}
            </Link>
          </h3>
          <BlogTags tags={post.tags} wrap />
          {post.subtitle && (
            <p class="letter-subtitle type-subtitle ink ink-muted">{post.subtitle}</p>
          )}
          {post.description && <p class="letter-description type-body ink">{post.description}</p>}
          <div class="letter-bottom type-meta">
            {post.status === "draft" && <span class="draft">非公開</span>}
            {props.canManage && (
              <div class="management">
                <button
                  type="button"
                  aria-label={`「${post.title || "無題"}」を削除`}
                  onClick$={() => props.onDeleteRequest$?.(post)}
                >
                  削除
                </button>
              </div>
            )}
          </div>
        </article>
      </PostActions>
    </li>
  );
});

const postCardStyles = css`
  position: relative;
  min-width: 0;
  padding-bottom: 18px;

  & .letter-day {
    font-size: var(--small-size);
    color: var(--date-ink);
    font-variant-numeric: tabular-nums;
  }
  & .letter {
    --angle: -1.1deg;
    --shift: -2px;
    position: relative;
    isolation: isolate;
    box-sizing: border-box;
    min-height: 148px;
    background: var(--envelope);
    border: 1px solid var(--edge);
    box-shadow: 0 2px 3px rgb(60 45 25 / 9%);
  }
  &:nth-child(4n + 2) .letter {
    --angle: 1deg;
    --shift: 3px;
  }
  &:nth-child(4n + 3) .letter {
    --angle: -0.5deg;
    --shift: 1px;
  }
  &:nth-child(4n) .letter {
    --angle: 0.65deg;
    --shift: -3px;
  }
  & .letter::before,
  & .letter::after {
    content: "";
    position: absolute;
    z-index: -1;
    pointer-events: none;
    top: 0;
    bottom: 0;
    left: 0;
    clip-path: polygon(0 0, 100% 19px, 100% calc(100% - 19px), 0 100%);
  }
  & .letter::before {
    width: calc(var(--flap-width) + 6px);
    background: linear-gradient(
      90deg,
      transparent,
      rgb(75 55 30 / 18%) calc(100% - 6px),
      transparent
    );
  }
  & .letter::after {
    width: var(--flap-width);
    background: linear-gradient(90deg, var(--envelope), var(--fold));
  }
  & .letter-title {
    overflow-wrap: anywhere;
    margin: 0 0 8px;
  }
  & .letter-title a {
    color: inherit;
    text-decoration: none;
  }
  & .letter-title a:hover {
    color: var(--link);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 0.2em;
  }
  & .letter-subtitle,
  & .letter-description {
    margin: 8px 0 0;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
  & .letter-subtitle {
    color: var(--muted);
    font-size: var(--small-size);
  }
  & .letter-bottom {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--muted);
  }
  & .management {
    display: flex;
    margin-left: auto;
  }
  &[data-layout="grid"] .letter {
    min-height: 280px;
    padding: 42px 20px 18px;
    display: flex;
    flex-direction: column;
  }
  &[data-layout="grid"] .letter-bottom {
    margin-top: auto;
    padding-top: 16px;
  }
  &[data-layout="grid"] .letter::before,
  &[data-layout="grid"] .letter::after {
    inset: 0 0 auto;
    width: auto;
    height: 22px;
    clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 100%, 14px 100%);
  }
  &[data-layout="grid"] .letter::before {
    height: 28px;
    background: linear-gradient(transparent, rgb(75 55 30 / 18%) 21px, transparent);
  }
  &[data-layout="grid"] .letter::after {
    height: 21px;
    background: linear-gradient(var(--envelope), var(--fold));
  }
  @media (max-width: 600px) {
    & .letter {
      --flap-width: 16px;
      padding: 20px 16px 10px 32px;
    }
    & .letter-day {
      display: block;
      margin: 0 0 8px;
      padding-inline: 16px;
    }
    & .management {
      gap: 12px;
    }
    & .management button {
      min-height: 32px;
      padding: 8px 2px;
    }
  }
  @media (forced-colors: active) {
    & .letter {
      border-color: CanvasText;
    }
  }
  @media (min-width: 601px) {
    & .letter-day {
      position: absolute;
      top: 18px;
      left: -30px;
    }
    & .letter {
      --flap-width: 22px;
      padding: 24px 24px 14px 48px;
      transform: translateX(var(--shift)) rotate(var(--angle));
    }
    & .management {
      gap: 14px;
    }
  }
`;
