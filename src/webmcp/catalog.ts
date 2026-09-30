/** Tool contract shared by browser registration, server validation and maintenance. */
export type Input = Record<string, unknown>;
type Field = {
  type: string;
  description?: string;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  enum?: string[];
  items?: Field;
};
const string = (description: string, maxLength = 500): Field => ({
  type: "string",
  description,
  maxLength,
});
const integer: Field = { type: "integer", minimum: 0, maximum: 10000 };
const identifier = string("記事IDまたはURL別名", 200);
const state = string("get_editor_stateが返したstateToken。入力競合を検出する", 64);
function tool<Name extends string>(
  name: Name,
  description: string,
  scope: "public" | "manager" | "editor",
  location: "server" | "browser",
  properties: Record<string, Field>,
  required: string[] = [],
  readOnly = true,
  consequential = false,
) {
  return {
    name,
    description,
    scope,
    location,
    inputSchema: { type: "object", properties, required, additionalProperties: false },
    annotations: {
      readOnlyHint: readOnly,
      untrustedContentHint: true,
      consequentialHint: consequential,
    },
  };
}
export const catalog = [
  tool(
    "search_posts",
    "記事を検索。本文・題・説明のキーワード、タグ、公開日範囲。本文はget_postで取得。",
    "public",
    "server",
    {
      query: string("検索文字列", 200),
      tag: string("完全一致タグ", 100),
      from: string("公開日の下限 YYYY-MM-DD", 10),
      to: string("公開日の上限 YYYY-MM-DD", 10),
      cursor: string("前の検索結果のnext", 1000),
    },
  ),
  tool(
    "get_post",
    "保存済み記事と正規URL、版、Markdown、Tiptap JSONを取得。編集中の内容はget_editor_stateを使う。",
    "public",
    "server",
    { identifier },
    ["identifier"],
  ),
  tool(
    "get_post_outline",
    "保存済み記事の見出し一覧と節を取得。sectionは見出しの0始まり番号。",
    "public",
    "server",
    { identifier, section: integer },
    ["identifier"],
  ),
  tool("list_tags", "閲覧可能な記事のタグと件数を取得。", "public", "server", {}),
  tool(
    "export_post",
    "保存済み記事を指定形式のMarkdownに変換。変換診断も返す。外部投稿はしない。",
    "public",
    "server",
    { identifier, target: { type: "string", enum: ["canonical", "github", "zenn", "qiita"] } },
    ["identifier", "target"],
  ),
  tool(
    "open_post",
    "記事を画面で開く。sectionを指定すると見出しの0始まり番号へ移動。未保存の変更がある場合は拒否。",
    "public",
    "browser",
    { identifier, section: integer },
    ["identifier"],
    false,
  ),
  tool(
    "create_draft",
    "下書きを作成して開く。同じrequestIdの実行中要求はBUSY。記録は終了時に削除し、終了後の再試行は別記事を作る。応答が不明なら検索で確認する。未保存の変更がある場合は拒否。",
    "manager",
    "browser",
    { requestId: string("実行中の重複を防ぐ一意なリクエストID", 128) },
    ["requestId"],
    false,
  ),
  tool(
    "list_images",
    "管理者の元画像、関連記事と再利用可能な配信画像を取得。",
    "manager",
    "server",
    { unused: { type: "boolean" }, cursor: string("前の結果のnext", 100) },
  ),
  tool(
    "export_original_image",
    "元画像を取得できる同一サイトの認証付きダウンロードURLを返す。",
    "manager",
    "server",
    { originalId: string("元画像ID", 100) },
    ["originalId"],
  ),
  tool(
    "delete_post",
    "記事を削除する。expectedVersionはget_postのversion。ブラウザで対象の確認が必要。元画像は保持。",
    "manager",
    "browser",
    { identifier, expectedVersion: string("get_postのversion", 100) },
    ["identifier", "expectedVersion"],
    false,
    true,
  ),
  tool(
    "cleanup_unused_images",
    "未使用の配信用画像と未保存の紐付けを整理。元画像は保持。編集中は拒否しブラウザで確認する。",
    "manager",
    "browser",
    {},
    [],
    false,
    true,
  ),
  tool(
    "get_editor_state",
    "現在の記事のメタデータ、本文、選択範囲、未保存状態、stateTokenを取得。",
    "editor",
    "browser",
    {},
  ),
  tool(
    "update_draft",
    "現在の記事の作業下書きを更新する（自動保存、公開版は変更しない）。body全体またはstartBlock/deleteCount/blocksでトップレベルブロックを置換。未知ノードは拒否。",
    "editor",
    "browser",
    {
      expectedState: state,
      title: string("タイトル", 200),
      subtitle: string("副題", 5000),
      description: string("説明", 5000),
      tags: { type: "array", items: string("タグ", 100) },
      alias: string("URL別名", 200),
      publishedAt: string("公開日 YYYY-MM-DD", 10),
      body: { type: "object" },
      startBlock: integer,
      deleteCount: integer,
      blocks: { type: "array", items: { type: "object" } },
    },
    ["expectedState"],
    false,
  ),
  tool(
    "validate_post",
    "現在の編集内容の保存形式と公開要件、数式・Mermaidを検証。保存はしない。",
    "editor",
    "browser",
    {},
  ),
  tool(
    "save_post",
    "現在の編集内容を作業下書きとして保存し閲覧表示へ戻る。公開版は変更しない。",
    "editor",
    "browser",
    { expectedState: state },
    ["expectedState"],
    false,
    true,
  ),
  tool(
    "publish_post",
    "現在の記事の作業下書きと未保存内容を検証して公開／更新。ブラウザで確認が必要。",
    "editor",
    "browser",
    { expectedState: state },
    ["expectedState"],
    false,
    true,
  ),
  tool(
    "unpublish_post",
    "現在の記事と未保存内容を保存して公開を取り消す。ブラウザで確認が必要。",
    "editor",
    "browser",
    { expectedState: state },
    ["expectedState"],
    false,
    true,
  ),
  tool(
    "attach_image",
    "既存の配信画像を現在の記事の選択位置へ挿入（未保存）。list_imagesのvariantIdを使用。",
    "editor",
    "browser",
    {
      expectedState: state,
      variantId: string("配信画像ID", 100),
      alt: string("代替テキスト", 2000),
      caption: string("キャプション", 2000),
    },
    ["expectedState", "variantId", "alt"],
    false,
  ),
] as const;
export type ToolName = (typeof catalog)[number]["name"];
export class ToolError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
function check(field: Field, item: unknown): boolean {
  if (field.type === "array")
    return (
      Array.isArray(item) &&
      item.length <= 1000 &&
      item.every((part) => !field.items || check(field.items, part))
    );
  if (field.type === "object") return !!item && typeof item === "object" && !Array.isArray(item);
  if (field.type === "integer")
    return (
      Number.isInteger(item) &&
      Number(item) >= (field.minimum ?? 0) &&
      Number(item) <= (field.maximum ?? 10000)
    );
  if (typeof item !== field.type) return false;
  return (
    typeof item !== "string" ||
    (item.length <= (field.maxLength ?? 1000) && (!field.enum || field.enum.includes(item)))
  );
}

export function validateInput(name: string, value: unknown): Input {
  const definition = catalog.find((entry) => entry.name === name);
  if (!definition) throw new ToolError("UNKNOWN_TOOL", "未対応のツールです");
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ToolError("INVALID_INPUT", "引数はオブジェクトです");
  const input: Input = Object.fromEntries(Object.entries(value));
  for (const key of definition.inputSchema.required)
    if (!(key in input)) throw new ToolError("INVALID_INPUT", `${key}が必要です`);
  for (const [key, item] of Object.entries(input)) {
    const field = definition.inputSchema.properties[key];
    if (!field || !check(field, item))
      throw new ToolError("INVALID_INPUT", `${key}の形式が不正です`);
  }
  if (JSON.stringify(input).length > 550_000)
    throw new ToolError("INVALID_INPUT", "入力が長すぎます");
  return input;
}
export function failure(error: unknown) {
  return {
    ok: false as const,
    error: {
      code: error instanceof ToolError ? error.code : "FAILED",
      message: error instanceof Error ? error.message : "処理できませんでした",
    },
  };
}

export function inputText(input: Input, key: string): string {
  const value = input[key];
  if (value === undefined) return "";
  if (typeof value !== "string") throw new ToolError("INVALID_INPUT", `${key}は文字列です`);
  return value;
}
