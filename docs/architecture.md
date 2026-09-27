# アーキテクチャ

## 実装の配置

| パス                                   | 責務                                                          |
| -------------------------------------- | ------------------------------------------------------------- |
| `src/routes/`                          | ページ、loader/action、HTTPエンドポイント                     |
| `src/server/`                          | Access認可、記事保存、D1/R2、描画キャッシュ、WebMCPの永続操作 |
| `src/content/`                         | 文書正規化、記事メタデータ、Markdown出力、描画契約、サンプル  |
| `src/components/foundations/`          | テーマ、文字組み、入力・メタ情報の基盤                        |
| `src/components/atoms/` / `molecules/` | 小さな部品と、その組み合わせ                                  |
| `src/components/organisms/`            | 記事ヘッダー、記事一覧、画像管理などのまとまったUI            |
| `src/components/templates/`            | 記事画面・紙面・一覧・viewportの構造                          |
| `src/components/editor/`               | Tiptap、変換、SSRとの共有DOM契約、画像・数式・図の編集        |
| `src/browser/` / `src/api/`            | 一覧復元などのブラウザー処理とサーバー関数                    |
| `src/dev/`                             | dev専用の管理者目線切替                                       |
| `src/webmcp/`                          | ツールカタログ、ブラウザー登録、編集中の記事との接続          |
| `migrations/`                          | D1のスキーマ                                                  |
| `adapters/`                            | Workerビルド用のQwik設定                                      |
| `scripts/` / `patches/`                | 開発用スクリプトと依存パッケージ修正                          |
| `public/`                              | アイコン、同梱AVIF変換器などの配信アセット                    |

## 記事と編集

本文JSON・メタデータ・Markdown・操作の正本は [Tiptap文書仕様](tiptap-document-spec-v1.md) です。`src/content/document.ts` が許可ノードと正規化を担当し、`src/server/posts.ts` が読込・保存を担当します。通常の保存と再読込にMarkdown変換を挟みません。

`/` は記事一覧、`/blog` は年月別アーカイブ、`/blog/{IDまたはalias}` は記事です。`posts.canonical_alias` は現在の別名だけを保持し、変更・解除した旧別名は404になります。ULIDは不変です。下書きは管理者だけが閲覧できます。

記事画面は `ArticleShell`、表示・編集のヘッダーは共通部品を使用します。タイトル・副題・説明・タグ・公開日を表示位置で編集し、本文はH2〜H4を許可します。固定ツールバーはUndo・Redo・表・画像・リンク、その他の本文操作は入力ルールとスラッシュ候補から行います。公開／非公開と未確定フォームは別であり、未確定フォームやアップロード中の保存は拒否します。旧 `editing_state` は互換読込のみで、新規保存しません。

`/blog/{IDまたはalias}.md` は保存済みJSONから生成したMarkdownです。既定の正規形式のほか `?type=github`、`?type=zenn`、`?type=qiita` に対応します。画面に目次・書き出しメニュー・常設の取り込みフォームは置きません。

## SSR・編集ランタイム・スタイル

初期記事はSSR済みのHTMLです。`editor-runtime.ts` のTiptap / ProseMirrorは編集開始時に動的に読み込み、以降は同じインスタンスの編集可否を切り替えます。Qwikが編集中のDOMを上書きしないよう、`RenderOnce` などでブラウザー所有の領域を維持します。

表示と編集のDOMは `article-surface-contract.ts`、スタイルは `ArticleStyleBoundary` / `ArticleSurfaceBoundary` を共有します。アプリ固有のスタイルはqstyleで定義し、その定義を使うコンポーネントと同じモジュールに置きます。共通テーマは `src/components/foundations/theme.tsx` が所有します。スタイルだけをコピーせず、同じ役割のUIはコンポーネントごと共有します。

MathJaxはTeXからSVGと支援技術向けMathMLを生成します。Mermaidも初期HTMLへSVG画像として含め、閲覧時のJavaScriptによる描画を必要としません。編集時のプレビューはブラウザー側で生成します。Mermaidのブラウザー用配布物はViteが依存パッケージから配信・出力し、外部CDNは使いません。

## 保存と描画キャッシュ

初期スキーマは [0001_initial.sql](../migrations/0001_initial.sql) の5テーブルです。WebMCPのリクエスト管理は [0002](../migrations/0002_webmcp_requests.sql) で追加し、[0003](../migrations/0003_webmcp_request_lifecycle.sql) で実行中のみ保持する方式へ変更しています。現在のテーブルは以下の6つです。

| テーブル           | 保存するもの                                   |
| ------------------ | ---------------------------------------------- |
| `posts`            | 記事メタデータ、本文JSON、公開状態、現在の別名 |
| `image_variants`   | 配信画像と元画像のID対応、配信画像の寸法       |
| `post_images`      | 現在の記事と配信画像の参照                     |
| `render_cache`     | MathJax/Mermaidの描画結果・診断・生成権        |
| `post_render_refs` | 記事と描画キャッシュの参照                     |
| `webmcp_requests`  | 作成処理中のrequestId、所有者、有効期限        |

DBの `format_version` は1、本文の `content_schema_version` も1です。一方、現行の保存入力・記事JSON取り込みは `formatVersion: 2` を要求します。この値の違いをDB移行済みという意味に解釈せず、詳細は文書仕様第2章・第13章に従います。

描画キャッシュのキーは種別・ソース・描画契約のハッシュです。`src/content/render-contract.ts` が契約を定義し、`src/server/render-cache.ts` が取得・生成権・参照同期を扱います。時間TTLはなく、最後の記事参照が消えるとDBトリガーで削除します。生成権の期限はクラッシュからの回復用です。取得はキー一覧を使った一括JOINで行います。

保存時に編集ブラウザーのMermaid SVGを受け付け、欠落分だけサーバーの `BROWSER` bindingで補完します。クライアント由来SVGは本文HTMLとして直接展開しません。数式の欠落はWorkers内のMathJaxで補完します。本文更新と参照同期は同じD1 batchで確定します。

## 画像

画像はファイル選択・ドロップ・貼り付け・差し替えに対応します。変換はブラウザーのWeb Workerと同梱libavif WASMで行い、元画像と配信用AVIFをR2へ保存します。受け入れる形式・上限・アニメーションの扱いは文書仕様第13.1節、変換器の保守は [画像変換器](image-codec.md) を参照してください。

R2キーは `images/originals/{元画像ID}` と `images/variants/{配信ID}` です。MIMEタイプはR2のHTTPメタデータに持ち、配信時はD1を参照しません。本文は `/images/variants/{配信ID}` を参照します。

記事削除・リンク解除後に未使用となった配信用R2ファイルは削除しますが、元画像と `image_variants` の対応レコードは残します。差し替え・再生成は新しいIDを発行し、同じURLを上書きしません。記事との過去の関連履歴は保持しません。`/manage/images` で現在の関連記事と紐付けのない元画像を確認し、編集終了後に未使用画像を整理できます。

## WebMCP

ツール一覧・入力スキーマの正本は [src/webmcp/catalog.ts](../src/webmcp/catalog.ts) です。ブラウザーAPIの登録・解除は `browser.ts`、未保存記事とTiptapの接続は `editor.ts`、永続操作は `src/server/webmcp.ts` が担当します。公開範囲と保存・画像・認可は通常UIと共有します。

`expectedState` は人の編集との競合、`expectedVersion` は保存済み記事との競合を検出します。作成のrequestIdは実行中だけ保持するため、終了後の再送は新規作成です。未対応ブラウザーでは登録せず、通常のUIを使います。操作・公開範囲を変える場合は [WebMCPスキル](../.agents/skills/blog-webmcp/SKILL.md) に従います。
