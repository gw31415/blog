import { component$ } from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$ } from "@qwik.dev/router";
import { requireManager } from "~/server/access";
import { database } from "~/server/posts";
import { collectUnusedImages, listOriginals } from "~/server/images";
import { ArchiveLayout } from "~/components/templates/archive-layout";
import { ImageLibrary } from "~/components/organisms/image-library";
export const useImages = routeLoader$(async (event) => {
  await requireManager(event);
  event.headers.set("Cache-Control", "private, no-store");
  const unused = event.url.searchParams.get("filter") === "unused";
  return {
    ...(await listOriginals(database(event), unused, event.url.searchParams.get("before") ?? "")),
    unused,
  };
});
export const useCollect = routeAction$(async (values, event) => {
  await requireManager(event);
  if (values.confirm !== "yes") return event.fail(400, { message: "削除を確認してください" });
  await collectUnusedImages(database(event), event.platform.env.IMAGES);
  return { message: "未使用の配信用画像を整理しました。オリジナルは保持しています。" };
});
export default component$(() => {
  const data = useImages(),
    collect = useCollect();
  return (
    <ArchiveLayout title="画像の管理">
      <ImageLibrary>
        <nav aria-label="画像の絞り込み">
          <a href="/manage/images" aria-current={!data.value.unused ? "page" : undefined}>
            すべて
          </a>
          <a
            href="/manage/images?filter=unused"
            aria-current={data.value.unused ? "page" : undefined}
          >
            紐付けのない画像
          </a>
        </nav>
        <details>
          <summary>未使用の配信用画像を整理</summary>
          <p>
            編集を終えてから実行してください。本文に保存されていない紐付けを解除し、未使用の配信用画像を削除します。
          </p>
          <Form action={collect}>
            <input type="hidden" name="confirm" value="yes" />
            <button disabled={collect.isRunning}>未使用の配信用画像を削除</button>
          </Form>
        </details>
        <p role="status">{collect.value?.message}</p>
        {!data.value.items.length && <p>該当する画像はありません。</p>}
        <ul>
          {data.value.items.map((original) => (
            <li key={original.id}>
              <h2>{original.id}</h2>
              <a href={`/api/images/originals/${original.id}`} download>
                オリジナルをダウンロード
              </a>
              <ul aria-label="関連する記事">
                {original.articles.map((article) => (
                  <li key={article.post_id}>
                    <a href={`/blog/${article.post_id}`}>{article.post_title || "無題"}</a>
                  </li>
                ))}
              </ul>
              {!original.articles.length && <p>現在の記事への紐付けなし</p>}
            </li>
          ))}
        </ul>
        {data.value.next && (
          <a
            href={`/manage/images?filter=${data.value.unused ? "unused" : "all"}&before=${data.value.next}`}
          >
            続きを表示
          </a>
        )}
      </ImageLibrary>
    </ArchiveLayout>
  );
});
export const head = {
  title: "画像の管理",
  meta: [
    { name: "description", content: "アップロードした画像と記事への関連を管理します。" },
    { name: "robots", content: "noindex, nofollow" },
  ],
};
