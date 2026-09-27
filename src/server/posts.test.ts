import { expect, it } from "vite-plus/test";
import { CONTENT_SCHEMA_VERSION, EMPTY_DOCUMENT, FORMAT_VERSION } from "../content/document";
import { findPost } from "./posts";

it("returns the document without retaining its database JSON string", async () => {
  const editingState = { selection: { anchor: 1, head: 1 } };
  const row = {
    id: "01M3F8PQTC6VJ0W36F5DYER7HS",
    format_version: FORMAT_VERSION,
    content_schema_version: CONTENT_SCHEMA_VERSION,
    body_format: "tiptap-json",
    title: "記事",
    subtitle: null,
    tags: '["開発"]',
    body_json: JSON.stringify(EMPTY_DOCUMENT),
    editing_state: JSON.stringify(editingState),
  };
  const statement = {
    bind: () => statement,
    first: async () => row,
  };
  // This fixture implements only the D1 operations used by findPost.
  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  const db = { prepare: () => statement } as unknown as D1Database;
  const post = await findPost(db, row.id);
  expect(post?.body).toEqual(EMPTY_DOCUMENT);
  expect(post?.editing_state).toEqual(editingState);
  expect(post?.tags).toEqual(["開発"]);
  expect(post).not.toHaveProperty("body_json");
});
