import { postImageIds, removeUnusedVariants } from "~/server/images";
import { css } from "@qstyle/qwik";
import {
  clearLegacyPostListCache,
  readPostListCache,
  writePostListCache,
} from "~/browser/post-list-cache";
import type { PostPage } from "~/server/post-list";
import { loadMore } from "~/api/post-list";
import { $, component$, useSignal, useStore, useVisibleTask$ } from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$, type DocumentHead } from "@qwik.dev/router";
import { ArchiveLayout } from "~/components/templates/archive-layout";
import { StreamStatus } from "~/components/molecules/stream-status";
import { PostList } from "~/components/organisms/post-list";
import { JournalHeading } from "~/components/organisms/journal-heading";
import { BlogFooter, BlogFooterContainer } from "~/components/molecules/footer";
import { BLOG_NAME, formatJapaneseEraYear } from "~/content/article";
import { canManagePosts, requireManager } from "~/server/access";
import { createDraft, database, deletePost, isUlid } from "~/server/posts";
import { listPostPage } from "~/server/post-list";

export const usePosts = routeLoader$(async (event) => {
  const canManage = await canManagePosts(event);
  return {
    ...(await listPostPage(database(event), canManage, event.url.searchParams.get("after"))),
    canManage,
  };
});

export const useCreateDraft = routeAction$(async (_, event) => {
  await requireManager(event);
  const id = await createDraft(database(event));
  throw event.redirect(303, `/blog/${id}?edit=1`);
});

export const useDeletePost = routeAction$(async (values, event) => {
  await requireManager(event);
  const id = typeof values.id === "string" ? values.id : "";
  if (!isUlid(id) || values.confirm !== "yes")
    return event.fail(400, { message: "削除を確認してください。" });
  const imageIds = await postImageIds(database(event), id);
  if (!(await deletePost(database(event), id)))
    return event.fail(404, { message: "記事が見つかりません。" });
  await removeUnusedVariants(database(event), event.platform.env.IMAGES, imageIds);
  return { ok: true };
});

export default component$(() => {
  const initial = usePosts();
  const state = useStore({
    posts: initial.value.posts,
    next: initial.value.next,
    loading: false,
    error: "",
  });
  const sentinel = useSignal<Element>();
  const cacheKey = useSignal("");
  const restored = useSignal(false);
  const create = useCreateDraft();
  const remove = useDeletePost();
  const more = $(async () => {
    if (!state.next || state.loading) return;
    state.loading = true;
    state.error = "";
    try {
      const page = await loadMore(state.next);
      const ids = new Set(state.posts.map((post) => post.id));
      state.posts = [...state.posts, ...page.posts.filter((post) => !ids.has(post.id))];
      state.next = page.next;
    } catch {
      state.error = "読み込めませんでした。もう一度お試しください。";
    } finally {
      state.loading = false;
    }
  });
  // Keep an opaque key on the existing history entry; cached data has no TTL.
  // replaceState adds neither a URL parameter nor a new Back-button step.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    async ({ cleanup }) => {
      await clearLegacyPostListCache();
      if (initial.value.canManage) {
        restored.value = true;
        return;
      }
      const scrollPosition = () => window.scrollY;
      const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
      let disposed = false;
      cleanup(() => {
        disposed = true;
      });
      // This is a tab-local cache key, not a security token. LAN HTTP previews
      // do not expose randomUUID, so keep a fallback for non-secure contexts.
      const id =
        history.state?.postListEntry ??
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      history.replaceState({ ...history.state, postListEntry: id }, "");
      const key = `blog:post-list:v2:${id}:${initial.value.canManage}`;
      cacheKey.value = key;
      let cached: PostPage | undefined;
      let y = history.state?.postListY;
      try {
        cached = JSON.parse(sessionStorage.getItem(key) ?? "null");
        const savedY = sessionStorage.getItem(`${key}:y`);
        const sessionY = savedY === null ? undefined : Number(savedY);
        // Scroll events update the session copy immediately; history is debounced.
        if (sessionY !== undefined && Number.isFinite(sessionY) && sessionY >= 0) {
          y = sessionY;
        }
      } catch {
        /* Fall back to the persistent copy. */
      }
      cached ??= await readPostListCache<PostPage>(key);
      y ??= await readPostListCache<number>(`${key}:y`);
      if (disposed) return;
      if (
        cached &&
        Array.isArray(cached.posts) &&
        (cached.next === null || typeof cached.next === "string")
      ) {
        state.posts = cached.posts;
        state.next = cached.next;
      } else {
        y = undefined;
      }
      let frame = 0;
      let stableFrames = 0;
      let userInteracted = false;
      let fontsReady = false;
      void document.fonts.ready.then(() => {
        fontsReady = true;
      });
      const targetY = Number.isFinite(y) && y > 0 ? y : 0;
      const finish = () => {
        if (!Number.isFinite(y)) {
          lastY = scrollPosition();
          restored.value = true;
          flushPosition();
          return;
        }
        // Qwik must commit the cached cards before restoring a deep position.
        if (document.querySelectorAll("#articles .letter").length !== state.posts.length) {
          frame = requestAnimationFrame(finish);
          return;
        }
        if (!fontsReady || document.visibilityState === "hidden") {
          frame = requestAnimationFrame(finish);
          return;
        }
        const reachableY = Math.min(targetY, maxScroll());
        if (Math.abs(scrollPosition() - reachableY) > 1) {
          stableFrames = 0;
          window.scrollTo({ top: reachableY, behavior: "instant" });
        } else {
          stableFrames++;
        }
        // scrollTo is a request, not proof that layout and scroll restoration finished.
        if (stableFrames < 2) {
          frame = requestAnimationFrame(finish);
          return;
        }
        lastY = scrollPosition();
        restored.value = true;
        flushPosition();
      };
      frame = requestAnimationFrame(finish);
      let suspended = document.visibilityState === "hidden";
      let timer: ReturnType<typeof setTimeout> | undefined;
      let lastY = y ?? 0;
      const flushPosition = () => {
        clearTimeout(timer);
        if (!restored.value || history.state?.postListEntry !== id) return;
        history.replaceState({ ...history.state, postListY: lastY }, "");
        void writePostListCache(`${key}:y`, lastY);
      };
      const savePosition = () => {
        if (suspended || !restored.value || history.state?.postListEntry !== id) return;
        // Browser/router restoration can emit a later scroll event. Until the
        // user takes control, do not save that intermediate position over ours.
        if (targetY > 0 && !userInteracted) {
          if (Math.abs(scrollPosition() - lastY) > 1) {
            restored.value = false;
            stableFrames = 0;
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(finish);
          }
          return;
        }
        lastY = scrollPosition();
        try {
          sessionStorage.setItem(`${key}:y`, String(lastY));
        } catch {
          /* Optional. */
        }
        clearTimeout(timer);
        timer = setTimeout(flushPosition, 150);
      };
      const hide = () => {
        if (!restored.value || history.state?.postListEntry !== id) return;
        savePosition();
        flushPosition();
        suspended = true;
        // Also flush the current summaries before a suspended tab can be discarded.
        void writePostListCache(
          key,
          JSON.parse(JSON.stringify({ posts: state.posts, next: state.next })),
        );
      };
      const visibility = () => {
        if (document.visibilityState === "hidden") hide();
        else suspended = false;
      };
      const show = () => {
        suspended = false;
      };
      const takeControl = () => {
        userInteracted = true;
        cancelAnimationFrame(frame);
        lastY = scrollPosition();
        restored.value = true;
      };
      const click = () => {
        takeControl();
        savePosition();
        flushPosition();
      };
      const inputEvents = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
      for (const event of inputEvents)
        document.addEventListener(event, takeControl, { passive: true });
      window.addEventListener("scroll", savePosition, { passive: true });
      window.addEventListener("pagehide", hide);
      window.addEventListener("pageshow", show);
      document.addEventListener("visibilitychange", visibility);
      document.addEventListener("click", click, true);
      cleanup(() => {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
        for (const event of inputEvents) document.removeEventListener(event, takeControl);
        window.removeEventListener("scroll", savePosition);
        window.removeEventListener("pagehide", hide);
        window.removeEventListener("pageshow", show);
        document.removeEventListener("visibilitychange", visibility);
        document.removeEventListener("click", click, true);
      });
    },
    { strategy: "document-ready" },
  );
  // Serialize the summaries only when the list changes, never on each scroll.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    ({ track }) => {
      const ready = track(() => restored.value);
      const posts = track(() => state.posts);
      const next = track(() => state.next);
      if (!ready || initial.value.canManage) return;
      const snapshot = JSON.stringify({ posts, next });
      void writePostListCache(cacheKey.value, JSON.parse(snapshot));
      try {
        sessionStorage.setItem(cacheKey.value, snapshot);
      } catch {
        /* Storage is optional. */
      }
    },
    { strategy: "document-ready" },
  );
  // Observe only the end of the SSR list; no editor or image runtime is needed.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    ({ track, cleanup }) => {
      track(() => state.next);
      if (!track(() => restored.value)) return;
      if (!sentinel.value || !state.next || !("IntersectionObserver" in window)) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting) && !state.error) void more();
        },
        {
          root: null,
          rootMargin: "240px",
        },
      );
      observer.observe(sentinel.value);
      cleanup(() => observer.disconnect());
    },
    { strategy: "document-ready" },
  );
  return (
    <ArchiveLayout>
      {initial.value.canManage && <CreatePostAction q:slot="header-actions" action={create} />}
      <section id="articles" aria-labelledby="articles-title">
        <PostList
          posts={state.posts}
          canManage={initial.value.canManage}
          onDelete$={$(async (id) => {
            const result = await remove.submit({ id, confirm: "yes" });
            if (result.value.failed) return false;
            state.posts = state.posts.filter((post) => post.id !== id);
            return true;
          })}
        >
          <JournalHeading q:slot="stream-start" />
          <StreamStatus q:slot="stream-end" sentinel={sentinel} busy={state.loading}>
            <p role="status">{state.loading ? "読み込み中" : state.error}</p>
            {!state.loading &&
              (state.next ? (
                <a
                  href={`/?after=${encodeURIComponent(state.next)}#articles`}
                  preventdefault:click
                  onClick$={more}
                >
                  続きを読み込む
                </a>
              ) : (
                <p>{state.posts.length > 0 ? "記事は以上です" : "まだ記事はありません"}</p>
              ))}
          </StreamStatus>
          <div q:slot="stream-after" class="stream-footer">
            <BlogFooterContainer wide>
              <BlogFooter
                left={BLOG_NAME}
                right={formatJapaneseEraYear(new Date().toISOString().slice(0, 10))}
              />
            </BlogFooterContainer>
          </div>
        </PostList>
      </section>
    </ArchiveLayout>
  );
});
export const head: DocumentHead = {
  title: "記事一覧",
  meta: [{ name: "description", content: "amas.devに公開された記事の一覧です。" }],
};

const CreatePostAction = component$<{ action: ReturnType<typeof useCreateDraft> }>(({ action }) => (
  <Form action={action} css={managementActionsStyles}>
    <a href="/manage/images">画像</a>
    <button type="submit" disabled={action.isRunning}>
      新規記事
    </button>
  </Form>
));

const managementActionsStyles = css`
  display: flex;
  align-items: center;
  gap: 16px;
  & a {
    color: var(--muted);
    text-decoration: none;
  }
  & a:hover {
    color: var(--link);
    text-decoration: underline;
  }
`;
