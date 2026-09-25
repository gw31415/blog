import { Link } from "@qwik.dev/router";
import { css } from "@qstyle/qwik";
import { component$, type QRL } from "@qwik.dev/core";
import { BlogTags } from "~/components/molecules/tags";
import { canonicalPath } from "~/content/post-url";
import type { PostSummary } from "~/server/post-list";
import { PostActions } from "../atoms/action-surface";

export const PostCard = component$<{
  post: PostSummary;
  layout?: "list" | "grid";
  canManage?: boolean;
  onDeleteRequest$?: QRL<(post: PostSummary) => void>;
}>((props) => {
  const post = props.post;
  return (
    <li class="dated-letter" css={postCardStyles} data-layout={props.layout}>
      <PostActions>
        <article class="letter">
          <span class="letter-mouth" aria-hidden="true">
            <span class="letter-mouth-face" />
          </span>
          <Link
            class="letter-sheet letter-link"
            href={canonicalPath(post)}
            prefetchData="visible"
            aria-label={post.title || "無題"}
          >
            <div class="letter-heading">
              <h3 class="letter-title type-heading">{post.title || "無題"}</h3>
            </div>
            <div class="letter-details">
              <BlogTags tags={post.tags} wrap />
              {post.subtitle && (
                <p class="letter-subtitle type-subtitle ink ink-muted">{post.subtitle}</p>
              )}
              {post.description && (
                <p class="letter-description type-body ink">{post.description}</p>
              )}
              <div class="letter-bottom type-meta">
                {post.status === "draft" && <span class="draft">非公開</span>}
              </div>
            </div>
          </Link>
          {props.canManage && (
            <div class="management">
              <button
                type="button"
                aria-label={`「${post.title || "無題"}」を削除`}
                onClick$={() => props.onDeleteRequest$?.(post)}
              >
                <span aria-hidden="true">削除</span>
              </button>
            </div>
          )}
        </article>
      </PostActions>
    </li>
  );
});

// One small, static SVG tile: no runtime noise filter or per-card texture layer.
const postCardStyles = css`
  position: relative;
  min-width: 0;
  --paper-fiber: url("data:image/svg+xml,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 width%3D%2283%22 height%3D%2279%22 viewBox%3D%220 0 83 79%22%3E%3Cdefs%3E%3Cpath id%3D%22g%22 d%3D%22M15.5 2.8l0.4 -0.3M68.1 14.7l-0.2 0.2M13.3 18.1l0.1 0.1M43.5 33l0.3 -0.3M72.6 13.4l0.1 0.5M78.5 23.9l0.3 -0.3M16 53.5l0 0.2M42.2 56.1l0.2 0.1M41 54.9l-0.1 -0.3M41.3 13l0.1 -0.1M67.1 40.7l0.5 -0.1M3.2 62.4l0.3 -0.2M80.9 15.9l0.1 -0.3M13.6 52.5l0.4 -0.4M21 1.2l0.1 0.1M30.8 68.2l-0.3 -0.1M11 71.5l0.2 -0.2M31.4 67.5l-0.3 0.2M51.8 14.5l-0.1 -0.2M18.1 62.3l0.2 0.1M62.9 72l0.2 -0.3M54 73.1l-0.1 -0.2M29.9 68.8l-0.3 -0.3M77.8 10.7l0.2 0M15.6 9.8l-0.1 0.2M70 25.8l-0.4 0.1M34 65.6l0.1 -0.4M81 15.5l-0.1 -0.1M30.9 24l0.3 -0.1M42.1 59l0.4 -0.2M51.9 55.7l0.3 -0.4M7 11.5l0.2 0.5M30.3 20.6l0 -0.2M13 25.9l-0.3 0.1M5.9 12.9l0.1 -0.1M49.2 2.3l0 0.2M44.5 61.9l-0.4 0.4M49.7 43l-0.2 0.2M21.3 70.2l-0.3 0.4M73.8 64.9l-0.2 0.5M76.9 63.6l-0.2 0.1M26.1 33.4l0.2 -0.3M46.6 61.8l0.2 -0.5M49.6 46.5l-0.2 0.3M47.8 30.3l0.6 0.1M53.2 39.3l-0.3 -0.3M40.8 68l0.2 -0.4M74.1 31.6l0.3 0.1M62.4 60.9l-0.4 -0.2M18.3 73l0.2 -0.1M79.8 33.9l-0.3 -0.5M73.8 38.3l-0.2 0.1M31.8 44.6l-0.3 -0.3M15.4 44.4l0 0.5M57.6 5.9l0.1 0.1M73.5 23.8l-0.5 0M21.5 51.5l0.2 -0.4M46.6 74.3l0.5 0.2M35.5 59.6l-0.1 -0.2M58.9 42.5l-0.1 0M34.4 28.8l-0.2 0M47.1 36.7l0.1 -0.6M24.9 73.1l-0.4 0M2.1 20.2l-0.2 0.4M35.7 37.1l0 -0.2M73.1 25.9l-0.1 0M12 40.1l0 0.1M49.4 67l-0.3 0.3M59.3 23.7l0 -0.1M2.2 53.4l0 -0.1M64.5 74.7l0.3 0.3M59.7 19.9l-0.3 0M71.3 59l-0.2 0.2M45.8 52.4l-0.2 0.1M32.9 31.3l0.2 0.1M35.7 63.6l0.3 -0.3M76 32.8l0.2 0.3M44.6 36.8l-0.2 0M61.5 48.3l-0.3 0M67.5 42.5l-0.3 -0.1M60.5 44.4l-0.1 -0.3M61.2 29.2l0.5 -0.2M47.1 13.7l0.5 0.2M34.5 4.2l-0.4 -0.1M19.9 22.3l0.1 0.2M81.4 65.2l-0.5 0.1M69.1 32.4l-0.3 0.1M35.3 50.9l-0.3 0.2M63.4 37l0 0.2M39.5 44.7l-0.1 0.6M9.9 45.6l0 0.5M8.3 35.4l0 0.5M35.1 74.9l0.2 -0.1M5.6 44.6l0.5 0.1M66.2 66.9l0.1 -0.2M80.7 28.6l-0.3 0.1M24.7 43.2l-0.2 0.4M49 15.4l-0.5 0M45 32.9l0.2 -0.1M27 16l-0.4 0.2M69.6 5.3l-0.1 0.1M20.4 17.3l-0.5 0.1M37.6 38.9l-0.1 -0.5M23.5 56.6l-0.3 -0.1M17.2 32.2l0.1 -0.1M63.3 70.6l-0.3 -0.1M39.2 36.3l-0.5 0M25.2 56.5l0.1 -0.2M37.2 52.9l0.4 0.4M72.1 7.2l0.2 0M55.8 67.8l-0.6 0M34.5 5.2l0.2 0M79.3 13l-0.2 -0.5M41.8 13.6l-0.4 0M47.9 41.2l-0.1 -0.3M45.1 56.8l0.2 -0.4M60.7 34.4l-0.1 0.1M12 20.4l0.1 -0.1M37.4 42.8l-0.2 -0.4M67.7 73.3l-0.4 0M53.3 34.1l0.4 0.1M11.3 14.7l0.1 0.2M51.6 33.7l-0.1 0.1M74.2 14.1l0.1 0.1M66.4 37.7l0.1 0.5M1.6 45l0 0.2M67.4 8.8l0.6 0M23 18l-0.1 0.1M71.5 29.9l0.5 0.3M65.5 72l-0.1 -0.1M37.2 1.4l-0.2 -0.2M46 23.1l0.2 -0.5M27.8 36.2l0 0.3M26.3 50.7l0 0.2M75.3 11.5l-0.2 0.2M69.6 2.3l0.1 0.3M69.7 51.2l-0.3 -0.2M41 11.8l-0.3 0M78.9 10.1l0 -0.3M1.3 45.2l-0.1 -0.1M45.9 42.9l0.5 -0.2M57.8 66.6l0.2 -0.3M77.5 21.2l0.3 -0.1M79.4 55.1l0.4 0.4M30.7 34.8l0.2 0.1M3.8 27l-0.2 -0.5M14.5 49.7l0 0.5M7.4 61.9l-0.2 -0.2M25.7 33.6l-0.2 0.3M53.5 26.4l0.3 0.4M16.1 9l0.3 0.2M32 72.3l0 -0.1M65.3 34.1l-0.1 -0.3M5.9 61.9l0.5 -0.3M11.7 34.2l0 -0.2M77.6 75.4l-0.1 0.1M81 23.8l-0.2 0.4M38.4 76.9l0.5 0.3M1.5 24.5l-0.1 0.3M14.4 46.8l0.5 -0.1M6.9 65.1l-0.1 0.1M4.1 42.3l0.4 -0.3M1.8 33.1l0.1 0.4M8.3 31.2l0.3 -0.4M48.5 68.8l0 0.1M23.2 38.9l-0.3 -0.2M69.3 41.3l-0.1 0.2M59.3 69.3l-0.3 0.2M59.7 29.8l0.3 -0.4M22.7 30.4l-0.1 0.3M3.3 39.9l-0.2 -0.4M27.7 49.4l-0.5 -0.1M54.5 32.4l-0.5 -0.2M4.8 23l-0.2 -0.1M18.4 34.3l0.3 0.3M63.8 19.7l0.4 -0.4M69.9 23.6l-0.1 0.4M71.8 69.9l-0.1 -0.1M41.1 49.3l-0.5 0.1M66.6 39.4l0 0.1M29.5 49.2l0.4 0M47.1 45l0.1 -0.3M59.2 56.7l0.1 -0.1M32.7 29.4l0.1 -0.1M11.5 27.6l-0.1 -0.4M66.7 32.8l-0.4 -0.1M65.6 57.3l0.5 0.3M1.3 8.1l-0.5 0M31.4 62.6l0.1 0.4M38.2 25.4l0.3 0.3M3.2 8.7l0.4 -0.2M78.5 19.4l0.3 0.2M67.1 62.9l0.2 -0.3M70.6 3.9l-0.4 -0.1M33.1 61l0 0.4M58.7 60l0.1 0M3.2 55.6l-0.3 0M14.2 20.8l0 0.1M73.5 22.8l0 -0.1M16.1 8l0.3 -0.2M61.4 36.1l0 0.1M52.1 50.1l0.1 0M68.5 58.8l0.2 -0.2M6.4 11.9l0.4 -0.1M15.7 50.8l0.5 -0.1M78.3 69.6l0.2 -0.5M13.3 1.8l-0.1 0.4M11 34.1l0.5 0.3M27.9 47.4l0.1 -0.3M46.5 65.9l-0.3 0.1M60.2 50.3l0.4 0.1M43.3 9.1l0.1 0.2M24.5 33.8l-0.1 0.5M76.8 38.5l-0.6 -0.1M58.3 3.5l-0.1 0.2M12.2 2.8l0 -0.4M46.7 5.9l-0.4 0M75.5 5.1l0.1 0.2M64.5 36.2l0.3 0.2M71.2 63.2l0.1 -0.4M32 29.6l0.2 -0.2M4 6.6l0.3 -0.1M45.3 10.2l0.3 0.3M76.6 71l-0.4 -0.2M2 14.3l0.1 -0.2M65.7 34.4l-0.5 -0.1M63.4 18.4l-0.5 -0.2M18.2 52.6l-0.2 0M6.5 26l0.2 -0.2M2.4 35.6l-0.3 -0.5M60.7 4.9l0.2 0M44.4 30.8l-0.2 -0.4M67.8 61l0.4 0.2M10.7 71.4l0.1 -0.3M45 77.2l0.2 0.2M1.3 29.8l0 0.3M44 50.7l0.2 0.3M38.4 14.5l0.2 0.2M35 49.4l-0.3 -0.1M25.3 2.8l-0.1 -0.1M59.6 20.2l0.3 0.2M52.5 15.6l0.1 0.3M3.9 62.9l0 -0.6M1.6 67.9l-0.3 -0.3M44.5 16.8l0 0.1M64.8 45.9l0.1 -0.2M67.2 52.3l-0.1 -0.1M74.9 51l-0.2 0.5M2.2 36.8l-0.3 -0.2M75.9 56.4l0.2 -0.1M21.8 58.1l-0.3 -0.1M27.3 29.5l-0.4 -0.4M35.6 31.2l-0.1 0.3M20.1 59.7l0 0.1M19.5 77.6l0.3 0.2M32.2 29.1l-0.2 0.5M47.8 64.1l0.3 -0.3M32.9 57.5l0.4 0.2M25 69.6l0.2 -0.3M31.8 28.6l-0.1 -0.4M10.9 9.7l-0.2 0.4M72 45.3l-0.6 -0.1M3.6 36.4l0.1 0.2M5.6 42l-0.5 0M71.8 18.6l0.5 -0.1M23.4 18l0 -0.6M27 28.3l0.2 0.4M76.3 45.7l-0.1 -0.4M10.9 61.4l0.3 0.1M50.5 50.8l0.2 0.4M56.2 71.9l-0.1 0.5M49.4 61.1l0 0.5M77.2 10.1l-0.1 -0.3M52.6 73.5l0.6 0.1M47.5 20.4l-0.2 0.6M5.4 4.6l0.4 0M41.8 27.6l-0.1 -0.5M14.3 29.3l-0.4 0.4M58.8 20.8l0.3 0M1.2 1.3l-0.3 0.3%22%2F%3E%3Cpath id%3D%22f%22 d%3D%22M32.9 34.3l-1.2 0.5M30.7 33.3l0.7 -0.8M31.8 56.4l0.6 0.6M14.5 3.8l-0.8 1.2M75.5 20l-1.4 0.7M8.6 69.7l-0.8 0.5M60.7 28.8l1.3 0.8M49.5 29l0.9 1M35.5 49.5l-1.1 1M15.9 73.6l0.3 1.2M12.3 70.7l0.5 -0.9M1.3 8l0.9 0.2M50 35.9l1.4 -0.8M64.2 12.2l-1.4 0.9M37 11.8l-0.9 -0.4M4.1 22.9l0 1.1M66.7 53.8l-1.1 1M52.7 44.5l1.6 -0.3M27.8 76.3l-0.2 -1.2M52.3 2.6l-0.2 -1.6M31 35.6l-0.6 -1M36.5 63.6l-1.2 0M49.9 41l-1 -1.2M25.4 36.3l1.3 -0.7M73.7 7.9l0.8 0M9.3 9.4l1.6 0.1M42.4 10l-0.9 0.7M37.6 70.2l-1.3 -1.2M50 18.9l0.7 -1.4M9.5 27.9l0.2 -1.8M5.8 34.6l-0.4 -0.9M57.6 66l0.1 -1%22%2F%3E%3C%2Fdefs%3E%3Cg fill%3D%22none%22 stroke-linecap%3D%22round%22%3E%3Cuse href%3D%22%23g%22 stroke%3D%22%23795e3a%22 stroke-opacity%3D%22.22%22 stroke-width%3D%22.55%22%2F%3E%3Cuse href%3D%22%23g%22 transform%3D%22translate%28-.35 -.4%29%22 stroke%3D%22%23fffdf6%22 stroke-opacity%3D%22.72%22 stroke-width%3D%22.55%22%2F%3E%3Cuse href%3D%22%23f%22 stroke%3D%22%23897351%22 stroke-opacity%3D%22.16%22 stroke-width%3D%22.35%22%2F%3E%3Cuse href%3D%22%23f%22 transform%3D%22translate%28-.25 -.3%29%22 stroke%3D%22%23fffdf6%22 stroke-opacity%3D%22.6%22 stroke-width%3D%22.35%22%2F%3E%3C%2Fg%3E%3Cpath fill%3D%22%23826b48%22 fill-opacity%3D%22.025%22 d%3D%22M7 12q4-3 8 0t8 1q-3 4-8 3t-8-4M44 34q5-2 9 1t7 0q-3 4-8 2t-8-3M17 57q7-3 12 0t7 0q-5 4-10 2t-9-2M63 68q4-3 8-1t6 2q-3 3-7 1t-7-2%22%2F%3E%3C%2Fsvg%3E");

  & .letter {
    --angle: -1.1deg;
    --flap-width: 30px;
    --paper-inset: 48px;
    --paper-outset: 24px;
    --shift: -2px;
    position: relative;
    isolation: isolate;
    box-sizing: border-box;
    min-height: 148px;
    perspective: 520px;
    transform-style: preserve-3d;
    transform: translateX(var(--shift)) rotate(var(--angle));
    transform-origin: 50% 50%;
    transition:
      transform 180ms ease-out,
      filter 180ms ease-out;
  }
  & .letter-sheet {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-rows: auto 1fr;
    isolation: isolate;
    box-sizing: border-box;
    min-height: inherit;
    color: inherit;
    text-decoration: none;
    border: 1px solid rgb(88 65 36 / 11%);
    background-color: var(--envelope);
    background-image: var(--paper-fiber);
    background-size: 41.5px 39.5px;
    background-position: 11px 23px;
    clip-path: polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%);
    box-shadow:
      inset 0 1px rgb(255 255 255 / 44%),
      inset 0 -1px rgb(74 54 31 / 11%),
      inset -1px 0 rgb(74 54 31 / 5%);
    filter: drop-shadow(0 2px 1px rgb(60 45 25 / 13%)) drop-shadow(0 7px 7px rgb(60 45 25 / 5%));
    transition:
      clip-path 160ms ease-out,
      filter 180ms ease-out;
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
  &:has(.letter-link:hover),
  &:has(.letter-link:focus-visible),
  &:has(.management button:hover),
  &:has(.management button:focus-visible) {
    z-index: 10;
  }
  & .letter-mouth {
    position: absolute;
    z-index: 3;
    top: -8px;
    bottom: -8px;
    left: 0;
    display: block;
    width: var(--flap-width);
    overflow: visible;
    pointer-events: none;
    transform: translateZ(2px) rotateY(0deg);
    transform-origin: 0 50%;
    transform-style: preserve-3d;
    transition: transform 300ms cubic-bezier(0.22, 0.72, 0.2, 1);
  }
  & .letter-mouth-face {
    position: absolute;
    inset: 8px 0;
    display: block;
    clip-path: polygon(0 0, 100% 13%, 100% 87%, 0 100%);
    transform-style: preserve-3d;
  }
  & .letter-mouth-face::before,
  & .letter-mouth-face::after {
    content: "";
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
  }
  & .letter-mouth-face::before {
    background-color: #e7ddc7;
    background-image: var(--paper-fiber);
    background-size: 41.5px 39.5px;
    background-position: 17px 9px;
    box-shadow:
      inset 1px 0 rgb(255 255 255 / 26%),
      inset -1px 0 rgb(76 56 31 / 14%);
  }
  & .letter-mouth-face::after {
    background-color: #dfd2b9;
    background-image: var(--paper-fiber);
    background-size: 41.5px 39.5px;
    background-position: 43px 31px;
    box-shadow:
      inset 2px 0 rgb(78 58 34 / 11%),
      inset -1px 0 rgb(255 255 255 / 14%);
    transform: rotateY(180deg);
  }
  & .letter:has(.letter-link:hover),
  & .letter:has(.letter-link:focus-visible) {
    transform: translateX(var(--shift)) translateY(-4px) rotate(var(--angle)) scale(1.018);
    filter: drop-shadow(0 7px 7px rgb(60 45 25 / 8%));
  }
  & .letter:has(.letter-link:hover) .letter-mouth,
  & .letter:has(.letter-link:focus-visible) .letter-mouth {
    transform: translateX(0.5px) translateZ(5px) rotateY(-138deg);
  }
  & .letter::after {
    content: "";
    position: absolute;
    z-index: 2;
    pointer-events: none;
    top: -4px;
    bottom: -4px;
    left: -1px;
    width: 2px;
    background: #d9ceb7;
    box-shadow: 1px 0 2px rgb(58 42 24 / 8%);
    opacity: 0.3;
    transition:
      box-shadow 180ms ease-out,
      opacity 180ms ease-out;
  }
  & .letter:has(.letter-link:hover)::after,
  & .letter:has(.letter-link:focus-visible)::after {
    box-shadow: 1px 0 2px rgb(58 42 24 / 12%);
    opacity: 0.78;
  }
  &:nth-child(4n + 2) .letter-sheet {
    background-position: 37px 7px;
  }
  &:nth-child(4n + 3) .letter-sheet {
    background-position: 3px 53px;
  }
  &:nth-child(4n) .letter-sheet {
    background-position: 61px 31px;
  }
  & .letter-heading {
    padding: 22px var(--paper-outset) 14px var(--paper-inset);
  }
  & .letter-details {
    position: relative;
    padding: 12px var(--paper-outset) 16px var(--paper-inset);
  }
  & .letter-details::before {
    content: "";
    position: absolute;
    pointer-events: none;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 3' preserveAspectRatio='none'%3E%3Cpath d='M0 1.2Q140 1.6 270 1.1T520 1.3T790 1.1T1000 1.3' fill='none' stroke='%23634d31' stroke-opacity='.18' stroke-width='.7'/%3E%3Cpath d='M0 2Q140 2.4 270 1.9T520 2.1T790 1.9T1000 2.1' fill='none' stroke='%23fffdf6' stroke-opacity='.6' stroke-width='.8'/%3E%3C/svg%3E")
      0 0 / 100% 3px no-repeat;
  }
  & .letter-title {
    overflow-wrap: anywhere;
    margin: 0;
  }
  & .letter-link:hover .letter-title,
  & .letter-link:focus-visible .letter-title {
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
    margin-top: 10px;
    color: var(--muted);
  }
  & .letter-bottom:empty {
    display: none;
  }
  & .management {
    position: absolute;
    z-index: 2;
    bottom: 0;
    right: 0;
  }
  & .management button {
    position: relative;
    display: block;
    width: 44px;
    height: 44px;
    min-height: 44px;
    padding: 0;
    overflow: hidden;
    color: transparent;
    text-decoration: none;
    perspective: 80px;
    transform-style: preserve-3d;
    transition:
      width 160ms ease-out,
      height 160ms ease-out;
  }
  & .management button::before,
  & .management button::after {
    content: "";
    position: absolute;
    pointer-events: none;
    bottom: 0;
    right: 0;
    width: 10px;
    height: 10px;
    backface-visibility: hidden;
    transition:
      width 160ms ease-out,
      height 160ms ease-out,
      filter 160ms ease-out;
  }
  & .management button::before {
    z-index: 2;
    background-color: #ded2b9;
    background-image: var(--paper-fiber);
    background-size: 41.5px 39.5px;
    clip-path: polygon(0 0, 100% 0, 87% 11%, 72% 25%, 55% 43%, 38% 61%, 21% 79%, 8% 92%, 0 100%);
    filter: drop-shadow(1px 2px 1px rgb(75 55 30 / 17%));
    transform-origin: 100% 100%;
  }
  & .management button::after {
    z-index: 3;
    background: transparent;
    box-shadow: inset 1px -1px rgb(92 70 42 / 16%);
    clip-path: polygon(0 0, 100% 0, 86% 12%, 70% 27%, 53% 45%, 36% 63%, 20% 80%, 7% 93%, 0 100%);
  }
  & .management button span {
    position: absolute;
    z-index: 1;
    right: 3px;
    bottom: 2px;
    color: var(--red);
    font: 9px/1 var(--sans);
    letter-spacing: 0.04em;
    opacity: 0;
    transform: translate(2px, 2px);
    transition:
      opacity 100ms 60ms ease-out,
      transform 140ms 40ms ease-out;
  }
  & .management button:hover,
  & .management button:focus-visible {
    width: 48px;
    height: 48px;
    text-decoration: none;
  }
  & .letter:has(.management button:hover) .letter-sheet,
  & .letter:has(.management button:focus-visible) .letter-sheet {
    clip-path: polygon(0 0, 100% 0, 100% calc(100% - 28px), calc(100% - 28px) 100%, 0 100%);
  }
  & .management button:hover::before,
  & .management button:focus-visible::before,
  & .management button:hover::after,
  & .management button:focus-visible::after {
    width: 28px;
    height: 28px;
  }
  & .management button:hover::before,
  & .management button:focus-visible::before {
    filter: drop-shadow(3px 4px 2px rgb(75 55 30 / 22%));
  }
  & .management button:hover span,
  & .management button:focus-visible span {
    opacity: 1;
    transform: translate(0, 0);
  }
  &[data-layout="grid"] .letter {
    min-height: 280px;
  }
  &[data-layout="grid"] .letter-sheet {
    --paper-inset: 36px;
    --paper-outset: 20px;
  }
  &[data-layout="grid"] .letter-heading {
    padding-top: 42px;
  }
  &[data-layout="grid"] .letter-details {
    display: flex;
    flex-direction: column;
  }
  &[data-layout="grid"] .letter-bottom {
    margin-top: auto;
    padding-top: 16px;
  }
  @media (max-width: 600px) {
    & + .dated-letter {
      margin-top: -10px;
    }
    & .letter {
      --flap-width: 24px;
      --paper-inset: 32px;
      --paper-outset: 16px;
    }
    & .letter-heading {
      padding-top: 20px;
      padding-bottom: 12px;
    }
    & .management button {
      width: 44px;
    }
  }
  @media (forced-colors: active) {
    & .letter-sheet {
      outline: 1px solid CanvasText;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    & .letter,
    & .letter-mouth,
    & .management button,
    & .letter-sheet,
    & .management button::before,
    & .management button::after,
    & .management button span {
      transition: none;
    }
  }
`;
