import type { PostPage } from "~/server/post-list";

/** Restore list depth, never the contents or cursor of an old browser snapshot. */
export async function restorePostList(
  initial: PostPage,
  count: number,
  loadPage: (cursor: string) => Promise<PostPage>,
  cancelled: () => boolean = () => false,
): Promise<PostPage> {
  const posts = [...initial.posts];
  const ids = new Set(posts.map((post) => post.id));
  const cursors = new Set<string>();
  let next = initial.next;
  while (posts.length < count && next && !cancelled() && !cursors.has(next)) {
    cursors.add(next);
    const page = await loadPage(next);
    for (const post of page.posts) {
      if (ids.has(post.id)) continue;
      ids.add(post.id);
      posts.push(post);
    }
    next = page.next;
  }
  return { posts, next };
}
