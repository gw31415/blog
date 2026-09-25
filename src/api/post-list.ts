import { server$ } from "@qwik.dev/router";
import { canManagePosts } from "~/content/permissions";
import { database } from "~/server/posts";
import { listPostPage } from "~/server/post-list";

export const loadMore = server$(async function (cursor: string) {
  return listPostPage(database(this), canManagePosts(), cursor);
});
