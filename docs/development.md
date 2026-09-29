# 開発・検証

## 環境と依存関係

Node.js 26、pnpm 12を使用します。[package.json](../package.json) の `engines` / `packageManager` と [pnpm-lock.yaml](../pnpm-lock.yaml) を基準にインストールします。

```sh
pnpm install --frozen-lockfile
```

Qwik 2 beta、vite-plus 1.0 RC、qstyleの構成です。qstyleはnpmパッケージを使用します。Vite・lint・formatter・unit testの設定は [vite.config.ts](../vite.config.ts)、Workerビルド用の追加設定は [adapters/cloudflare-workers/vite.config.ts](../adapters/cloudflare-workers/vite.config.ts) にあります。pnpmのoverrideとパッチは [pnpm-workspace.yaml](../pnpm-workspace.yaml)、目的は [依存パッチ](dependency-patches.md) を参照してください。

## データ接続先と開発時の権限

dev・preview・ローカルDB操作はMiniflareを使い、保存先を `.cache/webmcp-test` に統一しています。本番D1/R2には接続しません。binding定義の正本は [cloudflare.config.ts](../cloudflare.config.ts)、Node側のbinding接続は [scripts/local-platform.ts](../scripts/local-platform.ts) です。

| 起動方法                              | D1/R2              | 管理者判定                 |
| ------------------------------------- | ------------------ | -------------------------- |
| `pnpm dev`                            | ローカル           | 開発用「管理者目線」Cookie |
| `pnpm preview` / `pnpm preview:built` | 同じローカルデータ | Cloudflare Access JWT      |

保存先を分ける場合は、DB操作・dev・previewのすべてに同じ `BLOG_LOCAL_STATE` を指定します。Vite pluginが保存先に `v3` を付けるため、Node側のMiniflareも同じディレクトリを使います。`BLOG_LOCAL_TEST` は不要です。

旧Wranglerの `.wrangler/state` や既存のローカルファイルは削除・自動移動しません。選んだ保存先の適用履歴を確認し、未適用のマイグレーションだけを追加します。空の保存先では必要に応じてfixtureを投入してください。本番データを自動取得する処理はありません。

devでは画面右下の「管理者目線」で閲覧者・管理者のUIを切り替えます。判定は `BLOG_DEV_SERVER` と `blog_dev_manager` Cookieの組み合わせです。preview・本番ビルドにはこの認可経路は入りません。

## ローカルデータで起動する

```sh
pnpm db:migrate:local
pnpm dev --host 127.0.0.1 --port 4187 --strictPort
```

マイグレーションやresetは同じ保存先のdev・previewを停止してから実行します。このマイグレーションは空のスキーマだけを作ります。管理者目線を有効にして新規記事を作成するか、長文サンプルが必要なら別のターミナルで次を実行します。

```sh
pnpm db:seed:local
```

サンプルは下書きの `/blog/document-showcase` です。管理者目線で開き、編集して保存すると数式・MermaidのSVGを管理クライアントが生成します。SQL投入だけではSVGを生成せず、生成前は欠落の診断を表示します。固定ID・別名を使うため、同じDBへの重複投入には対応しません。生成元は [src/content/sample-document.ts](../src/content/sample-document.ts)、SQL生成処理は [scripts/seed-document.mjs](../scripts/seed-document.mjs) です。

`pnpm db:migrate:local` はcf標準の `d1 migrations apply` を使います。`pnpm db:seed:local` もdevと同じ保存先を使います。SQLを直接実行する場合は `pnpm exec cf d1 raw 74e71308-26ca-42d5-b319-6100b7823b4f --local --persist-to .cache/webmcp-test --sql @<SQLファイル>` を使います。

`pnpm db:reset:local` は既定のローカルD1の記事・メディア台帳・WebMCPリクエストを破棄し、全マイグレーションと下書きサンプルの投入をやり直します。R2オブジェクトは削除しません。本番には接続しません。分離した検証用DBでは `node scripts/reset-local-db.mjs --discard-test-data --persist-to .cache/webmcp-test` を使います。既存データを保持したい場合は、新しい保存先にマイグレーションを適用してください。

## コマンド

| コマンド                      | 処理                                                     |
| ----------------------------- | -------------------------------------------------------- |
| `pnpm dev`                    | ViteのSSR開発サーバー。ローカルD1/R2を使用               |
| `pnpm build`                  | Qwik CLI経由の型検査・クライアント／サーバービルド・lint |
| `pnpm preview`                | ビルド後にVite previewを起動。ローカルD1/R2を使用        |
| `pnpm test`                   | vite-plus経由のunit test。Playwrightは含まない           |
| `pnpm check`                  | vite-plusの統合チェック                                  |
| `pnpm lint`                   | lint                                                     |
| `pnpm build.types`            | `cf workers types` による型生成とTypeScript検査          |
| `pnpm check.fmt` / `pnpm fmt` | フォーマット確認／適用                                   |
| `pnpm check:editor-chunk`     | ビルド済みmanifestと初期HTMLの編集ランタイム分離を検査   |
| `pnpm icons:generate`         | `public/favicon.svg` からサイトアイコンを生成            |

公開コマンドは [認証・デプロイ](deployment.md) にまとめています。Qwik成果物は `dist/` と `server/` です。追加の [bundle.config.ts](../adapters/cloudflare-workers/bundle.config.ts) がcf用の `.cloudflare/output/v0/` にまとめます。通常のアプリ開発では、同梱済みの [AVIF変換器](image-codec.md) を再コンパイルする必要はありません。

Qwikの `valid-lexical-scope` と `use-async-top` はoxlintのJSプラグイン経由では必要な型情報を得られず無効化しています。lint単独を完全な検証とせず、変更に応じて型検査・ビルドを併用します。

## テストの選び方

unit testは変更した領域を指定できます。

```sh
pnpm test src/content/document.test.ts src/server/posts.test.ts
```

ブラウザーテストは [playwright.config.ts](../playwright.config.ts) が `tests/layout/` を対象にします。**`BLOG_TEST_URL` がない場合は通常の `pnpm dev` を自動起動します。** データを分離したい場合は `BLOG_LOCAL_STATE` を指定してマイグレーションを適用し、そのdevを維持した別ターミナルから接続先と対象ファイルを明示します。

```sh
BLOG_TEST_URL=http://127.0.0.1:4187 pnpm exec playwright test tests/layout/webmcp.spec.ts
```

`webmcp.spec.ts` はテスト記事を作成し、自分で作成した記事を削除します。`document-showcase` を使うテストは先にサンプルを投入します。各テストが要求する記事・認証・ブラウザーを確認して対象を選びます。編集切替・CSSの変更時は [editor-parityスキル](../.agents/skills/blog-editor-parity/SKILL.md) に従い、devと本番ビルド、デスクトップ幅とモバイル幅、ChromiumとWebKitの確認を区別して記録します。

### 本番ビルドをローカルで確認する

```sh
pnpm build
pnpm preview:built --host 127.0.0.1 --port 4188 --strictPort
```

previewのremote bindingsは常に無効です。このpreviewにはdevの管理者目線はなく、公開記事の閲覧とSSRを確認できます。別ターミナルで編集チャンクの分離を確認します。

```sh
BLOG_PREVIEW_URL=http://127.0.0.1:4188 pnpm check:editor-chunk
```

数式・Mermaidは管理クライアントで生成し、保存済みSVGを配信します。Browser Renderingは不要です。[メディア配信](media-delivery.md)のローカル移行・fixture手順を参照してください。

### Accessを含むWorkerの検証

```sh
pnpm test src/server/access.test.ts
pnpm build
pnpm exec cf deploy --prebuilt --dry-run
node tests/security/access-runtime.mjs
```

`cf deploy --prebuilt --dry-run` は既存成果物を送信せず検証します。`access-runtime.mjs` は一時D1/R2と、その場で生成したRSA署名・JWKSを使い、SSR/APIの認可を確認します。実アカウントのAccessログインや本番デプロイの動作確認とは別です。

Wranglerの直接依存と設定ファイルは削除済みです。Cloudflare Vite plugin内部の間接依存としては残ります。
