import { component$ } from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$, type DocumentHead } from "@qwik.dev/router";

import { canonicalPath } from "~/content/post-url";
import { canManagePosts } from "~/content/permissions";
import { createDraft, database, deletePost, isUlid, listPosts } from "~/server/posts";

export const usePosts = routeLoader$(async (event) => listPosts(database(event)));

export const useCreateDraft = routeAction$(async (_, event) => {
  if (!canManagePosts()) throw event.error(403, "作成できません。");
  const id = await createDraft(database(event));
  throw event.redirect(303, `/blog/${id}?edit=1`);
});

export const useDeletePost = routeAction$(async (values, event) => {
  if (!canManagePosts()) throw event.error(403, "削除できません。");
  const id = typeof values.id === "string" ? values.id : "";
  if (!isUlid(id) || values.confirm !== "yes")
    return event.fail(400, { message: "削除を確認してください。" });
  if (!(await deletePost(database(event), id)))
    return event.fail(404, { message: "記事が見つかりません。" });
  throw event.redirect(303, "/");
});

export default component$(() => {
  const posts = usePosts();
  const create = useCreateDraft();
  const remove = useDeletePost();
  const canManage = canManagePosts();
  return (
    <main>
      <h1>記事一覧</h1>
      {canManage && (
        <Form action={create}>
          <button type="submit" disabled={create.isRunning}>
            新規記事
          </button>
        </Form>
      )}
      {remove.value?.failed && <p role="alert">{remove.value.message}</p>}
      {posts.value.length === 0 ? (
        <p>記事はまだありません。</p>
      ) : (
        <ul>
          {posts.value.map((post) => (
            <li key={post.id}>
              <a href={canonicalPath(post)}>{post.title}</a>{" "}
              <time dateTime={post.published_at}>{post.published_at}</time>{" "}
              {post.status === "draft" && <span>下書き</span>}
              {canManage && (
                <>
                  {" "}
                  <a href={`${canonicalPath(post)}?edit=1`}>編集</a>
                  <details>
                    <summary>削除</summary>
                    <p>「{post.title}」を削除します。</p>
                    <Form action={remove}>
                      <input type="hidden" name="id" value={post.id} />
                      <label>
                        <input type="checkbox" name="confirm" value="yes" required /> 削除を確認
                      </label>{" "}
                      <button type="submit" disabled={remove.isRunning}>
                        削除する
                      </button>
                    </Form>
                  </details>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
});

export const head: DocumentHead = { title: "記事一覧" };
