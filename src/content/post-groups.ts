import type { PostSummary } from "~/server/post-list";

export function postDate(post: PostSummary): string {
  return (post.published_at ?? post.created_at).slice(0, 10);
}

/** Consecutive groups preserve the server's stable chronological ordering. */
export function groupPostsByMonth(posts: PostSummary[]) {
  const groups: { month: string; posts: PostSummary[] }[] = [];
  for (const post of posts) {
    const month = postDate(post).slice(0, 7);
    const previous = groups.at(-1);
    if (previous?.month === month) previous.posts.push(post);
    else groups.push({ month, posts: [post] });
  }
  return groups;
}

/** Consecutive day groups keep the sticky date label scoped to its own letters. */
export function groupPostsByDay(posts: PostSummary[]) {
  const groups: { date: string; posts: PostSummary[] }[] = [];
  for (const post of posts) {
    const date = postDate(post);
    const previous = groups.at(-1);
    if (previous?.date === date) previous.posts.push(post);
    else groups.push({ date, posts: [post] });
  }
  return groups;
}
