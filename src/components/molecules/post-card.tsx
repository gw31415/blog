import { Link } from "@qwik.dev/router";
import { css } from "@qstyle/qwik";
import { component$, type QRL } from "@qwik.dev/core";
import { BlogTags } from "~/components/molecules/tags";
import { canonicalPath } from "~/content/post-url";
import type { PostSummary } from "~/server/post-list";
import { PostActions } from "../atoms/action-surface";
import { PaperMaterial } from "../atoms/paper-material";

export const PostCard = component$<{
  post: PostSummary;
  layout?: "list" | "grid";
  canManage?: boolean;
  onDeleteRequest$?: QRL<(post: PostSummary) => void>;
}>((props) => {
  const post = props.post;
  let stockSeed = 2166136261;
  for (const character of post.id)
    stockSeed = Math.imul(stockSeed ^ character.charCodeAt(0), 16777619);
  return (
    <li
      class="dated-letter"
      css={postCardStyles}
      data-layout={props.layout}
      data-status={post.status}
      style={{
        "--stock-x": `${(stockSeed >>> 0) % 512}px`,
        "--stock-y": `${(stockSeed >>> 9) % 512}px`,
      }}
    >
      <PostActions>
        <article class="letter" data-managed={props.canManage ? "true" : undefined}>
          <span class="letter-shadow" aria-hidden="true">
            <span class="letter-shadow-shape" />
          </span>
          <span class="letter-mouth" aria-hidden="true">
            <span class="letter-mouth-face" />
          </span>
          <Link
            class="letter-sheet letter-link"
            href={canonicalPath(post)}
            prefetchBundles="intent"
            prefetchData="intent"
            aria-label={post.title || "無題"}
          >
            <PaperMaterial
              class="letter-stock"
              x={(stockSeed >>> 0) % 512}
              y={(stockSeed >>> 9) % 512}
            />
            <span class="letter-right-flap" aria-hidden="true" />
            <h3 class="letter-title ink">{post.title || "無題"}</h3>
            {post.subtitle && <p class="letter-subtitle ink ink-muted">{post.subtitle}</p>}
            <div class="letter-details">
              <PaperMaterial
                class="letter-stock-detail"
                x={((stockSeed >>> 0) % 512) + 71}
                y={((stockSeed >>> 9) % 512) - 127}
              />
              {post.description && (
                <p class="letter-description ink ink-muted">{post.description}</p>
              )}
              {(post.tags.length > 0 || post.status === "draft") && (
                <div class="letter-bottom">
                  {post.tags.length > 0 && <BlogTags tags={post.tags} wrap ink />}
                  {post.status === "draft" && <span class="draft">非公開</span>}
                </div>
              )}
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

// The original staggered envelopes and corner peel share the same paper stock texture.
// Opening is CSS-only; article data and the delete action still load on intent.
const postCardStyles = css`
  position: relative;
  isolation: isolate;
  min-width: 0;
  display: flex;
  --angle: -1.1deg;
  --shift: -2px;
  --envelope-tint: rgb(255 255 255 / 32%);

  &[data-status="draft"] {
    --envelope: #cba879;
    --envelope-tint: rgb(151 105 50 / 40%);
    --muted: #514335;
  }

  & .letter {
    --flap-width: 30px;
    --stock-size: var(--paper-stock-size);
    --paper-left: 36px;
    --paper-right: 24px;
    --paper-bottom: 22px;
    --peel-size: 0px;
    --stock-cut: polygon(
      0 0.6px,
      27% 0,
      66% 0.35px,
      calc(100% - 0.6px) 0,
      100% 23%,
      calc(100% - 0.3px) 69%,
      100% calc(100% - max(0.8px, var(--peel-size))),
      calc(100% - var(--peel-size)) 100%,
      82% 100%,
      36% calc(100% - 0.35px),
      0.4px 100%
    );
    position: relative;
    isolation: isolate;
    z-index: 1;
    width: 100%;
    perspective: 520px;
    transform-style: preserve-3d;
    transform: translateX(var(--shift)) rotate(var(--angle));
    transform-origin: 50% 50%;
    transition: transform 180ms ease-out;
  }
  & .letter-shadow {
    position: absolute;
    z-index: 0;
    inset: 0;
    pointer-events: none;
    filter: drop-shadow(1px 2px 1px rgb(59 47 30 / 24%))
      drop-shadow(2px 5px 6px rgb(59 47 30 / 19%));
    transition: filter 180ms ease-out;
  }
  & .letter-shadow-shape {
    position: absolute;
    inset: 0;
    display: block;
    background: var(--envelope);
    clip-path: var(--stock-cut);
    transition: clip-path 160ms ease-out;
  }
  &:nth-child(4n + 2) {
    --angle: 1deg;
    --shift: 3px;
  }
  &:nth-child(4n + 3) {
    --angle: -0.5deg;
    --shift: 1px;
  }
  &:nth-child(4n) {
    --angle: 0.65deg;
    --shift: -3px;
  }
  & .letter::before {
    content: "";
    position: absolute;
    z-index: 2;
    inset: 0;
    background: linear-gradient(
      135deg,
      rgb(255 253 242 / 13%),
      transparent 50%,
      rgb(76 55 29 / 4%)
    );
    opacity: 0.35;
    clip-path: polygon(
      0 0,
      100% 0,
      100% calc(100% - var(--peel-size)),
      calc(100% - var(--peel-size)) 100%,
      0 100%
    );
    transition:
      opacity 180ms ease-out,
      clip-path 160ms ease-out;
    pointer-events: none;
  }
  & .letter::after {
    content: "";
    position: absolute;
    z-index: 2;
    inset: 1px auto 1px 0;
    width: 0.8px;
    background: rgb(255 255 246 / 57%);
    pointer-events: none;
  }
  & .letter-sheet::after {
    content: "";
    position: absolute;
    z-index: -1;
    inset: -1px;
    background-color: var(--envelope-tint);
    background-image: linear-gradient(
      112deg,
      rgb(255 254 243 / 12%),
      transparent 40%,
      rgb(108 84 46 / 3%) 95%
    );
    box-shadow:
      inset 0 0.45px rgb(255 255 250 / 58%),
      inset -0.4px 0 rgb(83 66 40 / 12%);
    clip-path: var(--stock-cut);
    transition: clip-path 160ms ease-out;
    pointer-events: none;
  }
  & .letter-sheet {
    position: relative;
    z-index: 1;
    /* Composite the ink and paper together above the filtered shadow in Safari zoom. */
    transform: translateZ(0);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    color: var(--ink);
    text-decoration: none;
    border: 1px solid transparent;
    isolation: isolate;
  }
  & .letter-sheet > .letter-stock {
    z-index: -2;
    top: -1px;
    left: -1px;
    width: calc(100% + 2px);
    height: calc(100% + 2px);
    clip-path: var(--stock-cut);
    transition: clip-path 160ms ease-out;
  }
  & .letter-right-flap {
    position: absolute;
    z-index: 2;
    inset: 0 0 0 auto;
    width: calc(var(--flap-width) / 2);
    background-color: var(--envelope);
    background-image:
      linear-gradient(var(--envelope-tint), var(--envelope-tint)),
      linear-gradient(90deg, rgb(77 56 30 / 16%), rgb(255 255 246 / 14%) 28%, transparent),
      var(--paper-stock);
    background-position:
      0 0,
      0 0,
      calc(var(--stock-x) + 193px) calc(var(--stock-y) + 37px);
    background-size:
      100% 100%,
      100% 100%,
      var(--stock-size);
    clip-path: polygon(
      100% 0,
      0 13%,
      0 87%,
      0 calc(100% - var(--peel-size) + var(--flap-width) / 2),
      100% calc(100% - var(--peel-size))
    );
    filter: brightness(0.956) sepia(0.204);
    transition: clip-path 160ms ease-out;
    pointer-events: none;
  }
  & .letter-sheet::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: var(--flap-width);
    background: linear-gradient(90deg, rgb(53 40 22 / 18%), rgb(53 40 22 / 13%) 77%, transparent);
    clip-path: polygon(0 0, 100% 13%, 100% 87%, 0 100%);
    transform-origin: 0 50%;
    transform: matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0.48, 0.3, 0.001, 0, 0.96, 0.6, 0, 1) rotateY(0deg);
    opacity: 0.8;
    transition:
      transform 300ms cubic-bezier(0.22, 0.72, 0.2, 1),
      opacity 300ms ease;
    pointer-events: none;
  }
  & .letter-mouth {
    position: absolute;
    z-index: 3;
    inset: -8px auto -8px 0;
    display: block;
    width: var(--flap-width);
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
    transform-style: preserve-3d;
  }
  & .letter-mouth-face::before,
  & .letter-mouth-face::after {
    content: "";
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    filter: brightness(0.956) sepia(0.204);
    background-size:
      100% 100%,
      var(--stock-size);
  }
  & .letter-mouth-face::before {
    clip-path: polygon(0 0, 100% 13%, 100% 87%, 0 100%);
    background-color: var(--envelope);
    background-image:
      linear-gradient(var(--envelope-tint), var(--envelope-tint)),
      linear-gradient(
        90deg,
        rgb(91 68 35 / 9%),
        rgb(255 255 248 / 19%) 13%,
        transparent 53%,
        rgb(91 68 35 / 6%)
      ),
      var(--paper-stock);
    background-position:
      0 0,
      0 0,
      calc(var(--stock-x) + 47px) calc(var(--stock-y) + 13px);
    background-size:
      100% 100%,
      100% 100%,
      var(--stock-size);
    box-shadow:
      inset -0.65px 0 rgb(83 66 40 / 27%),
      inset 0.5px 0 rgb(255 255 248 / 57%);
    transform: translateZ(0.2px);
  }
  & .letter-mouth-face::after {
    clip-path: polygon(0 13%, 100% 0, 100% 100%, 0 87%);
    background-color: var(--envelope);
    background-image:
      linear-gradient(var(--envelope-tint), var(--envelope-tint)),
      linear-gradient(
        90deg,
        rgb(116 91 51 / 3%),
        rgb(255 254 245 / 5%) 26%,
        rgb(116 91 51 / 4%) 74%,
        rgb(64 49 26 / 12%) 92%,
        rgb(64 49 26 / 28%) 100%
      ),
      var(--paper-stock);
    background-position:
      0 0,
      0 0,
      calc(var(--stock-x) + 141px) calc(var(--stock-y) + 53px);
    background-size:
      100% 100%,
      100% 100%,
      var(--stock-size);
    box-shadow:
      inset 0.65px 0 rgb(83 66 40 / 19%),
      inset -0.5px 0 rgb(255 255 248 / 38%);
    transform: rotateY(180deg) translateZ(0.2px);
  }
  & .letter-mouth::after {
    content: "";
    position: absolute;
    inset: 8px 0;
    background: linear-gradient(90deg, rgb(255 253 235 / 28%), transparent 64%);
    clip-path: polygon(0 0, 100% 13%, 100% 87%, 0 100%);
    transform: translateZ(0.3px);
    backface-visibility: hidden;
    opacity: 0.15;
    transition: opacity 300ms ease;
  }
  & .draft {
    --stamp-red: #953f36;
    display: inline-block;
    padding: 3px 7px;
    border: 2px solid var(--stamp-red);
    box-shadow:
      inset 0 0 0 2px var(--envelope),
      inset 0 0 0 3px var(--stamp-red);
    color: var(--stamp-red);
    font: 700 12px/1.3 var(--sans);
    letter-spacing: 0.08em;
  }
  & .letter-details::before {
    content: "";
    position: absolute;
    z-index: -1;
    inset: 3px calc(-1 * var(--paper-right)) calc(-1 * var(--paper-bottom))
      calc(-1 * var(--paper-left));
    background-color: var(--envelope-tint);
    background-image:
      radial-gradient(ellipse 28px 3px at 0 0, rgb(74 54 29 / 13%), transparent),
      radial-gradient(ellipse 19px 2px at 100% 0, rgb(74 54 29 / 11%), transparent),
      linear-gradient(180deg, rgb(74 54 29 / 6%), transparent 3px),
      linear-gradient(112deg, rgb(255 254 245 / 7%), transparent 45%, rgb(104 78 39 / 3%));
    clip-path: var(--detail-cut);
    transition: clip-path 160ms ease-out;
    pointer-events: none;
  }
  & .letter-details {
    position: relative;
    display: flow-root;
    isolation: isolate;
    --detail-cut: polygon(
      0 0.4px,
      23% 0,
      47% 0.3px,
      78% 0,
      100% 0.6px,
      100% calc(100% - max(0.5px, var(--peel-size))),
      calc(100% - var(--peel-size)) 100%,
      79% 100%,
      46% calc(100% - 0.3px),
      15% 100%,
      0 99%
    );
  }
  & .letter-details > .letter-stock-detail {
    z-index: -2;
    top: 3px;
    left: calc(-1 * var(--paper-left));
    width: calc(100% + var(--paper-left) + var(--paper-right));
    height: calc(100% + var(--paper-bottom) - 3px);
    clip-path: var(--detail-cut);
    transition: clip-path 160ms ease-out;
  }
  & .letter-details::after {
    content: "";
    position: absolute;
    z-index: -1;
    top: 1px;
    left: calc(-1 * var(--paper-left));
    right: calc(-1 * var(--paper-right));
    height: 3px;
    mask-image: linear-gradient(
      90deg,
      black,
      rgb(0 0 0 / 46%) 18%,
      rgb(0 0 0 / 30%) 52%,
      rgb(0 0 0 / 64%) 83%,
      black
    );
    background:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 3' preserveAspectRatio='none'%3E%3Cpath d='M0 1Q93 .65 174 1.05T350 .75T530 1T746 .65T1000 1.1' fill='none' stroke='%23fffdf6' stroke-opacity='.6' stroke-width='.5'/%3E%3Cpath d='M0 1.7Q93 1.35 174 1.75T350 1.45T530 1.7T746 1.35T1000 1.8' fill='none' stroke='%23634d31' stroke-opacity='.22' stroke-width='.6'/%3E%3Cpath d='M41 1.8L104 1.85M346 1.9L382 1.98M613 1.7L644 1.72M892 1.93L937 1.8' fill='none' stroke='%23634d31' stroke-opacity='.1' stroke-width='.5'/%3E%3C/svg%3E")
        0 0 / 100% 3px no-repeat,
      linear-gradient(
        90deg,
        transparent,
        rgb(86 65 37 / 4%) 16%,
        transparent 38%,
        rgb(86 65 37 / 6%) 73%,
        transparent
      );
    pointer-events: none;
  }
  & .letter-title {
    margin: 0;
    color: var(--ink);
    font-family: var(--serif);
    font-weight: 400;
    line-height: 1.55;
    overflow-wrap: anywhere;
    text-wrap: pretty;
  }
  & .letter-subtitle {
    margin: 6px 0 0;
    color: var(--muted);
    font: 13px/1.6 var(--sans);
    overflow-wrap: anywhere;
  }
  & .letter-subtitle::before,
  & .letter-subtitle::after {
    content: "";
    display: inline-block;
    inline-size: 1em;
    block-size: 1em;
    background: linear-gradient(var(--muted), var(--muted)) center / 100% 0.06em no-repeat;
    vertical-align: text-top;
  }
  & .letter-subtitle::before {
    margin-inline-end: 0.5em;
  }
  & .letter-subtitle::after {
    margin-inline-start: 0.5em;
  }
  & .letter-description {
    margin: 12px 0 0;
    color: var(--muted);
    font: 14px/1.8 var(--serif);
    overflow-wrap: anywhere;
  }
  & .letter-bottom {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    margin-top: 12px;
    color: var(--muted);
  }
  & .letter-bottom .post-tags {
    min-width: 0;
    font-size: var(--small-size);
  }
  & .letter-bottom .draft {
    margin-left: auto;
    text-align: right;
    white-space: nowrap;
  }
  & .letter-link:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 5px;
  }
  &:has(.letter-link:focus-visible),
  &:has(.management button:focus-visible) {
    z-index: 10;
  }
  & .letter:has(.letter-link:focus-visible) {
    transform: translateX(var(--shift)) translateY(-4px) rotate(var(--angle)) scale(1.018);
  }
  & .letter:has(.letter-link:focus-visible) .letter-shadow {
    filter: drop-shadow(1px 3px 2px rgb(59 47 30 / 28%))
      drop-shadow(3px 8px 10px rgb(59 47 30 / 22%));
  }
  & .letter:has(.letter-link:focus-visible)::before {
    opacity: 0.8;
  }
  & .letter:has(.letter-link:focus-visible) .letter-sheet::before {
    transform: matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0.48, 0.3, 0.001, 0, 2.9, 1.5, 0, 1)
      rotateY(-138deg);
    opacity: 0.47;
  }
  & .letter:has(.letter-link:focus-visible) .letter-mouth {
    transform: translateX(0.5px) translateZ(5px) rotateY(-138deg);
  }
  & .letter:has(.letter-link:focus-visible) .letter-mouth::after {
    opacity: 0.95;
  }
  & .management {
    position: absolute;
    z-index: 4;
    right: 0;
    bottom: 0;
  }
  & .management button {
    position: relative;
    display: block;
    box-sizing: border-box;
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    overflow: hidden;
    color: transparent;
    text-decoration: none;
    perspective: 80px;
    transform-style: preserve-3d;
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
    background-color: var(--envelope);
    background-image:
      linear-gradient(var(--envelope-tint), var(--envelope-tint)),
      linear-gradient(
        135deg,
        rgb(255 253 243 / 22%),
        rgb(101 75 39 / 13%) 63%,
        rgb(76 55 30 / 19%)
      ),
      var(--paper-stock);
    background-size:
      100% 100%,
      100% 100%,
      var(--stock-size);
    background-position:
      0 0,
      0 0,
      calc(var(--stock-x) + 97px) calc(var(--stock-y) + 181px);
    clip-path: polygon(0 0, 100% 0, 87% 11%, 72% 25%, 55% 43%, 38% 61%, 21% 79%, 8% 92%, 0 100%);
    filter: brightness(0.956) sepia(0.204) drop-shadow(1px 2px 1px rgb(75 55 30 / 17%));
    transform-origin: 100% 100%;
  }
  & .management button::after {
    z-index: 3;
    background: transparent;
    box-shadow: inset 0.6px -0.6px rgb(92 70 42 / 24%);
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
  & .management button:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 0;
  }
  & .letter[data-managed="true"] {
    --peel-size: 10px;
  }
  & .letter:has(.management button:focus-visible) {
    --peel-size: 28px;
  }
  & .management button:focus-visible::before,
  & .management button:focus-visible::after {
    width: 28px;
    height: 28px;
  }
  & .management button:focus-visible::before {
    filter: brightness(0.956) sepia(0.204) drop-shadow(3px 4px 2px rgb(75 55 30 / 22%));
  }
  & .management button:focus-visible span {
    opacity: 1;
    transform: translate(0, 0);
  }
  @media (hover: hover) and (pointer: fine) {
    &:has(.letter-link:hover),
    &:has(.management button:hover) {
      z-index: 10;
    }
    & .letter:has(.letter-link:hover) {
      transform: translateX(var(--shift)) translateY(-4px) rotate(var(--angle)) scale(1.018);
    }
    & .letter:has(.letter-link:hover) .letter-shadow {
      filter: drop-shadow(1px 3px 2px rgb(59 47 30 / 28%))
        drop-shadow(3px 8px 10px rgb(59 47 30 / 22%));
    }
    & .letter:has(.letter-link:hover)::before {
      opacity: 0.8;
    }
    & .letter:has(.letter-link:hover) .letter-sheet::before {
      transform: matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0.48, 0.3, 0.001, 0, 2.9, 1.5, 0, 1)
        rotateY(-138deg);
      opacity: 0.47;
    }
    & .letter:has(.letter-link:hover) .letter-mouth {
      transform: translateX(0.5px) translateZ(5px) rotateY(-138deg);
    }
    & .letter:has(.letter-link:hover) .letter-mouth::after {
      opacity: 0.95;
    }
    & .letter-link:hover .letter-title {
      color: var(--red);
      --ink-color: var(--red);
    }
    & .letter:has(.management button:hover) {
      --peel-size: 28px;
    }
    & .management button:hover::before,
    & .management button:hover::after {
      width: 28px;
      height: 28px;
    }
    & .management button:hover::before {
      filter: brightness(0.956) sepia(0.204) drop-shadow(3px 4px 2px rgb(75 55 30 / 22%));
    }
    & .management button:hover span {
      opacity: 1;
      transform: translate(0, 0);
    }
  }
  @media (max-width: 600px) {
    & + .dated-letter {
      margin-top: -10px;
    }
  }
  @media (max-width: 760px) {
    & .letter {
      --flap-width: 24px;
      --paper-left: 32px;
      --paper-right: 18px;
      --paper-bottom: 20px;
    }
    & .letter-sheet {
      padding: 18px var(--paper-right) var(--paper-bottom) var(--paper-left);
    }
    & .letter-title {
      font-size: 20px;
    }
  }
  @media (min-width: 761px) {
    & .letter-sheet {
      padding: 20px var(--paper-right) var(--paper-bottom) var(--paper-left);
    }
    & .letter-title {
      font-size: 22px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    &.dated-letter .letter,
    &.dated-letter .letter-mouth,
    &.dated-letter .letter-mouth::after,
    &.dated-letter .letter::before,
    &.dated-letter .letter-sheet::before {
      transition: none;
      transform: none;
    }
    &.dated-letter .letter-sheet::after,
    &.dated-letter .letter-shadow,
    &.dated-letter .letter-shadow-shape,
    &.dated-letter .letter-stock,
    &.dated-letter .letter-stock-detail,
    &.dated-letter .letter-details::before,
    &.dated-letter .management button::before,
    &.dated-letter .management button::after,
    &.dated-letter .management button span {
      transition: none;
    }
    &.dated-letter .letter:has(.letter-link:hover),
    &.dated-letter .letter:has(.letter-link:focus-visible),
    &.dated-letter .letter:has(.letter-link:hover) .letter-sheet::before,
    &.dated-letter .letter:has(.letter-link:focus-visible) .letter-sheet::before,
    &.dated-letter .letter:has(.letter-link:hover) .letter-mouth,
    &.dated-letter .letter:has(.letter-link:focus-visible) .letter-mouth {
      transform: none;
    }
    &.dated-letter .letter:has(.letter-link:hover)::before,
    &.dated-letter .letter:has(.letter-link:focus-visible)::before {
      opacity: 0.35;
    }
    &.dated-letter .letter:has(.letter-link:hover) .letter-sheet::before,
    &.dated-letter .letter:has(.letter-link:focus-visible) .letter-sheet::before {
      opacity: 0.8;
    }
    &.dated-letter .letter:has(.letter-link:hover) .letter-mouth::after,
    &.dated-letter .letter:has(.letter-link:focus-visible) .letter-mouth::after {
      opacity: 0.15;
    }
  }
  @media (forced-colors: active) {
    & .letter-sheet {
      border: 1px solid CanvasText;
      background: Canvas;
    }
    & .letter-shadow,
    & .letter-mouth,
    & .letter-right-flap,
    & .letter-sheet::before,
    & .letter-sheet::after,
    & .letter-details::before,
    & .letter-details::after,
    & .letter::before,
    & .letter::after {
      display: none;
    }
    & .management button {
      color: ButtonText;
      background: Canvas;
    }
    & .management button::before,
    & .management button::after {
      display: none;
    }
    &.dated-letter .management button span {
      position: static;
      color: ButtonText;
      font: 11px/1.5 var(--sans);
      opacity: 1;
      transform: none;
    }
  }
`;
