# アーキテクチャ

## 実装の配置

| パス                                   | 責務                                                          |
| -------------------------------------- | ------------------------------------------------------------- |
| `src/routes/`                          | ページ、loader/action、HTTPエンドポイント                     |
| `src/server/`                          | Access認可、記事保存、D1/R2、メディア配信台帳、WebMCPの永続操作 |
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

MathJaxはTeXからSVGと支援技術向けMathMLを生成します。Mermaidも初期HTMLへSVG画像として含め、閲覧時のJavaScriptによる描画を必要としません。編集時のプレビューはブラウザー側で生成します。描画器は編集時に動的importし、外部CDNは使いません。

## 保存とメディア配信

本文JSONを正本とし、AVIF・Mermaid SVG・MathJax SVGを共通台帳とR2で管理する。管理クライアントで生成し、閲覧時は保存済み画像を配信する。原本画像は永久保持し、生成物は最終参照とleaseを失って24時間後に回収する。

DB構成、上部の埋め込み判定、保存・GC・移行・検証は [メディア配信](media-delivery.md) を参照。既存の画像URLと画像管理操作は維持する。`posts`と`webmcp_requests`は既存の役割を継続する。

DBのformat_versionとcontent_schema_versionは1、保存入力のformatVersionは2。今回の変更で本文ノードのスキーマは変更しない。

## WebMCP

ツール一覧・入力スキーマの正本は [src/webmcp/catalog.ts](../src/webmcp/catalog.ts) です。ブラウザーAPIの登録・解除は `browser.ts`、未保存記事とTiptapの接続は `editor.ts`、永続操作は `src/server/webmcp.ts` が担当します。公開範囲と保存・画像・認可は通常UIと共有します。

`expectedState` は人の編集との競合、`expectedVersion` は保存済み記事との競合を検出します。作成のrequestIdは実行中だけ保持するため、終了後の再送は新規作成です。未対応ブラウザーでは登録せず、通常のUIを使います。操作・公開範囲を変える場合は [WebMCPスキル](../.agents/skills/blog-webmcp/SKILL.md) に従います。
