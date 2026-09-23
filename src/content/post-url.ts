export interface PostUrl {
  id: string;
  canonical_alias: string | null;
}

export function canonicalPath(post: PostUrl): string {
  return `/blog/${post.canonical_alias ?? post.id}`;
}
