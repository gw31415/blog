import { server$ } from "@qwik.dev/router";
import { canManagePosts } from "~/server/access";
import { database } from "~/server/posts";
import { listPostPage } from "~/server/post-list";

export const loadMore = server$(async function (cursor: string) {
  return listPostPage(database(this), await canManagePosts(this), cursor);
});
