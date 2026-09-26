# Qwik on vite-plus ⚡️

Qwik（`@qwik.dev/core` / `@qwik.dev/router` 2.0.0-beta）をビルドツールとしての [vite-plus](https://github.com/voidzero-dev/vite-plus) 上で動かす、ミニマルなスターターリポジトリです。

vite-plus が dev / build / lint / fmt を兼ねるため、専用の ESLint・Prettier・Vite の設定ファイルは不要で、ツール設定は `vite.config.ts` 1つに集約されています（Cloudflare 用は `adapters/` に分離、デプロイ設定は `wrangler.jsonc`）。結果としてファイル数が非常に少なくシンプルな構成になっています。

## 特徴

- **Qwik 2.0.0-beta** + **QwikRouter** によるディレクトリベースルーティング
- **vite-plus** による統合ツールチェイン（dev / build / preview / lint / fmt / 型チェック）
- **qstyle** による `css` prop スタイリング
- **Cloudflare Workers** デプロイ対応（`adapters/cloudflare-workers`, `wrangler.jsonc`）
- 指紋付きアセットの長期キャッシュ（`public/_headers`）で初期表示を高速化
- 設定ファイルは `vite.config.ts`（lint・fmt 設定含む）と `tsconfig.json` のみ
- Node 26 / pnpm 12
- D1 に保存した記事の閲覧・編集に対応

## 記事編集

`pnpm dev` / `pnpm preview` はローカルでコードを実行し、本番D1 `blog-posts` と本番R2 `blog-images` に接続します。WranglerでのCloudflareログインが必要です。保存・削除も本番データに反映されます。Accessの認可は維持され、`amas.dev` のログインCookieはlocalhostには共有されません。自動テストは従来どおり一時DB・R2を使用し、`db:*:local` はローカルDBだけを操作します。

記事の別名は `posts.canonical_alias` の現在値のみを保持します。変更・解除後の旧別名URLは404となり、ULIDのURLは維持されます。

記事ページの「編集」でタイトル・副題・タグと本文を編集します。本文の正本は **Tiptap JSON** です。通常の保存・再読込でMarkdownへ変換しません。初回公開日時は初めて公開したときに記録し、再公開でも保持します。

段落の先頭または空白の後で `/`、選択範囲には `Mod+/`、タッチ操作では「コマンド」を使用します。固定ツールバーには表挿入と画像アップロードを配置しています。図のキャプション、入れ子の補足・トグル、H2〜H6、数式、Mermaidも編集できます。未確定の入力は下書きの編集状態に保持できます。

保存済み記事の正規化Markdownは `/blog/{IDまたはalias}.md` から取得します。`?type=github`、`?type=zenn`、`?type=qiita` でサイト別形式を指定できます。書き出しメニューや目次は表示しません。タグはヘッダーの既存位置で直接編集し、「、」で区切ります。説明の編集UIは提供しません。

文書データ仕様の正本は [tiptap-document-spec-v1.md](tiptap-document-spec-v1.md) です。構造や意味を変える際は、[ローカルSkill](.agents/skills/blog-document-contract/SKILL.md) に従い、仕様書を先に変更します。

ローカルDBを初期化して長文サンプルを作る場合は `pnpm db:reset:local` を実行します。**ローカルの記事・画像をすべて破棄します。** 初期マイグレーションを適用し、`/blog/document-showcase` に全コンポーネントを含む記事を生成します。リモートDBは変更しません。

記事の初期表示は、MathJaxでTeXからSVGと支援技術向けMathMLを生成したSSR済みHTMLです。TipTap、ProseMirror、編集用MathJaxランタイムは最初に「編集」を押したときだけ動的に読み込み、その後は同じエディターインスタンスのeditable状態だけを切り替えます。

アプリ固有のスタイルは各コンポーネントと同一モジュールの qstyle tagged template / `css` prop で管理します。色・文字組みは `src/components/foundations/theme.tsx`、記事と編集DOMの共通規則は `ArticleStyleBoundary` / `ArticleSurfaceBoundary` が所有します。ページ間ではスタイル付きコンポーネントを共有し、独自の別CSSは使用しません。詳細は `.agents/skills/blog-qstyle-components/SKILL.md` を参照してください。MathJaxは自己完結したSVGを出力するため、数式用の外部CSSやWebフォントは読み込みません。

### 画像の保存と管理

画像はファイル選択・ドロップ・貼り付けで挿入できます。静止画PNG/JPEG/GIF/WebP/AVIFとアニメーションGIF（最大25MB）を受け付け、ブラウザーのWeb Workerで向き補正・長辺2560px以内への縮小・AVIF変換を行います。配信用AVIFには元のEXIF等をコピーしません。画像・図の属性編集からファイルを差し替えると、altやキャプション等を保持します。

静止画とアニメーションは同じlibavif WASMを使用します。ビルド済みの変換器を同梱しており、通常の開発にネイティブコンパイラーは不要です。[変換器のソース・再ビルド手順](scripts/image-codec/README.md)

画像本体はR2 binding `IMAGES` に保存します。元画像は `images/originals/{ULID}.{ext}`、配信用画像は `images/variants/{別のULID}.{ext}`。MIMEタイプはR2のHTTPメタデータに保存し、配信時はD1を参照しません。

画像関連のD1は `image_variants(id, original_id, width, height)` と `post_images(post_id, variant_id)` の2テーブルです。記事保存で参照を同期し、リンク解除・記事削除で未使用になった配信用ファイルをR2から削除します。対応レコードと元画像は残し、履歴は持ちません。再生成・差し替えには新しいIDを発行します。

`/manage/images` では現在の関連記事と紐付けのない元画像を確認できます。未使用画像の整理は編集終了後に実行してください。削除失敗も整理操作で再試行できます。管理操作はCloudflare Accessの検証済みユーザーだけに許可します。

初期スキーマは `migrations/0001_initial.sql` の1本です。空のDBに5テーブルと必要なインデックス・トリガーだけを作成し、記事・画像データは投入しません。`pnpm db:migrate:local` でローカルへ適用します。旧0001〜0009を適用済みのDBへの追加入力には対応しません。旧ローカルDBを残したい場合は、別の `--persist-to` ディレクトリで検証してください。GIF以外のアニメーションは未対応です。

## プロジェクト構成

```
├── adapters/        # Cloudflare 用 Vite 設定（dev のみ workerd）
├── patches/         # @qwik.dev/router へのパッチ（SSG 警告・package.json 修正）
├── public/          # 静的アセット（favicon、manifest、_headers など）
├── server/          # ワーカーバンドルのビルド成果物（git 管理外）
└── src/
    ├── root.tsx
    ├── entry.ssr.tsx
    ├── entry.cloudflare-pages.tsx
    ├── components/
    │   └── editor/
    │       └── article-styles.tsx # qstyle によるアプリ固有スタイル
    └── routes/      # ディレクトリベースルーティング
```

## コマンド

```shell
pnpm install

pnpm dev            # 開発サーバー（SSR、adapter 経由）
pnpm build          # 本番ビルド（型チェック・クライアント・サーバー・lint を qwik CLI が実行）
pnpm preview        # 本番ビルドのローカルプレビュー（wrangler dev）
pnpm deploy         # 本番ビルド + 本番D1マイグレーション + wrangler deploy
pnpm deploy:built   # ビルド済み成果物に対し、本番D1マイグレーション + wrangler deploy

pnpm check          # lint（oxlint + eslint-plugin-qwik）
pnpm check:editor-chunk # TipTapが初期HTMLから参照されず動的chunkであることを検証
pnpm build.types    # TypeScript の型チェック（wrangler types 生成付き）
pnpm check.fmt      # フォーマットチェック
pnpm fmt            # フォーマット
```

## 数式・Mermaidの描画キャッシュ

数式・Mermaidはソース・描画バージョン・種別をキーにした共通のD1永続キャッシュを使います。時間TTLはなく、中間テーブル `post_render_refs` の外部キーと削除トリガーで、最後のソース参照がなくなった結果を削除します。キャッシュ取得はキー一覧を渡す一括JOINで、記事JSONの全体走査は行いません。編集ブラウザーが生成したMermaid SVGは本文と同時に保存し、閲覧時にはSVG画像として初期HTMLへ含めます。欠落したMermaidだけCloudflare Browser Rendering（`BROWSER` binding）で補完します。数式の欠落はWorkers内のMathJaxで補完し、SVGと支援MathMLを保持します。閲覧側のJavaScriptは不要です。編集フォームのプレビューのみブラウザー側で描画します。Mermaidの配布ファイルは開発・ビルド時に依存パッケージから生成し、外部CDNへ依存しません。

`pnpm dev` / `pnpm preview` はローカルChromiumを使います。初回はWranglerがChromiumをダウンロードします。本番実行にはCloudflare側のBrowser Renderingが必要です（今回の変更はローカルで検証、デプロイは行っていません）。[公式の設定・ローカル実行手順](https://developers.cloudflare.com/browser-run/reference/wrangler/)

## カスタマイズ

- UnoCSS を使う場合：`@qstyle/unocss` + `unocss` を deps に追加し、`vite.config.ts` のコメントアウト（`UnoCSS()`）を有効化してください（`qstyle()` より前に置く）。
- qstyleはnpm公開前のため、Git上のmainブランチをlockfileで固定して利用します。
- `worker-configuration.d.ts` は `pnpm build.types`（`wrangler types`）で生成されます。

## Limitations

- **Qwik / vite-plus ともにベータ版**です。破壊的な変更や挙動の変化があり得ます。特に `@qwik.dev/core` 2.0.0-beta と vite-plus 0.x の組み合わせは正式サポート構成ではないため、アップデート時に注意してください。

- **lint チェックの不具合 / 制限**：vite-plus の lint は oxlint ベースで、`eslint-plugin-qwik` は JS プラグイン（型情報なし）として実行されます。そのため**型情報を必要とする Qwik ルールは動作せず、意図的に無効化**しています（`vite.config.ts` 参照）:
  - `qwik/valid-lexical-scope` — 無効化。未直列化キャプチャの検出はできないため、ビルド時の qwik optimizer や `pnpm build.types` での代替検出に頼ることになります。
  - `qwik/use-async-top` — 同様に型情報が必要なため無効化。
  - これらの検出漏れを避けるため、**型チェック（`pnpm build.types`）を必ず併用**してください。

- `server/` 以下はワーカーバンドルのビルド成果物です（git 管理外）。

## 参考

- [Qwik Docs](https://qwik.dev/)
- [Qwik GitHub](https://github.com/QwikDev/qwik)
- [Vite](https://vitejs.dev/)

## コンポーネントの構成

Atomic Designを参考に、UIの責務で配置しています。ルートはデータ取得とページへの接続を担当します。

| 配置                     | 責務・代表例                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `components/foundations` | テーマ、文字組み、メタ情報、入力イベントの基盤                                           |
| `components/atoms`       | 編集ボタン、サイト名リンク、方眼レイヤー、紙面コンテナーなどの小さな部品                 |
| `components/molecules`   | タグ群、トップバー、フッター、記事カード、確認ダイアログなどの複合部品                   |
| `components/organisms`   | 記事ヘッダー、年月ごとの記事一覧などのまとまったUI                                       |
| `components/templates`   | 紙面、一覧レイアウト、記事画面、ソフトウェアキーボード対応の画面構造                     |
| `components/editor`      | Tiptapの実装、SSRと編集DOMの共有契約・スタイル境界。UI階層に押し込まない編集サブシステム |
| `routes`                 | ページ。loader/actionとテンプレートを接続                                                |

小さなUIから上位のページ構造へ依存しないようにし、qstyleの定義と適用は同じモジュールに置きます。共有時はそのコンポーネントを直接importします。スタイルだけの再exportや全体のbarrel exportで編集ランタイムの遅延ロード境界を曖昧にしません。日時のグループ化のような描画に依存しない処理は `content` に置きます。

## Cloudflare Accessによる認可

`ACCESS_TEAM_DOMAIN`（`https://TEAM.cloudflareaccess.com`）と `ACCESS_AUD`（AccessアプリのAudience）を設定します。未設定・トークン不正の場合は管理を拒否し、ローカル開発にも自動的な認可バイパスはありません。

公開・編集ともに `amas.dev` を使います。ログインボタンは設けず、`https://amas.dev/auth/login` に直接アクセスするとAccess認証後に `/` へ戻ります。ユーザー・セッション管理DBや独自の認証Cookieは作りません。

Cloudflare OneでSelf-hostedアプリを作り、Public hostnameを `amas.dev`、Pathを `/auth/login` に設定します。Allowポリシーは所有者のメールアドレスだけを許可します。公開ルートやホスト全体はAccessで保護せず、Bypassポリシーも不要です。Cookie設定ではPathを `/`（既定のホスト全体）にし、認証パス限定のCookie Path設定は有効にしないでください。HttpOnlyを有効にし、SameSiteはLaxを使用します。設定方法は[Access Cookieの公式説明](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/)を参照してください。

Workerは保護パスの `Cf-Access-Jwt-Assertion`、ヘッダーがない公開パスでは `CF_Authorization` CookieのJWTを検証します。署名・issuer・audience・期限・利用者トークンを確認し、メールヘッダーだけでは許可しません。不正なヘッダーがある場合にCookieへフォールバックはしません。記事作成・保存・削除・画像アップロード・整理はサーバー側で再検証し、変更リクエストには同一Originを要求します。下書きのHTML・Qwikデータ・Markdown、画像管理、元画像取得も保護します。公開記事と配信用画像は認証不要です。

公開パスではAccessによるリクエストごとのポリシー再評価は行われず、WorkerがJWTの有効期限まで検証します。利用者の即時失効を確認する独自セッション照会はありません。セッション期間はこの動作を踏まえて設定してください。

SSRとloader/action応答は `private, no-store`。管理者の一覧はIndexedDB/sessionStorageへ保存しません。設定を別のAccessアプリへ変更した場合は、そのAUDを更新してください。

認可の検証は `pnpm exec vp test run src/server/access.test.ts`。実WorkerでのSSR/API検証は `pnpm run build`、`pnpm exec wrangler deploy --dry-run --outdir .cache/access-bundle`、`node tests/security/access-runtime.mjs` の順に実行します。テストは一時D1/R2と、その場で生成したRSA署名・JWKSを使い、実アカウントやデプロイ先にはアクセスしません。

## amas.devへの初回デプロイ

公開ドメインは `amas.dev`。既存Worker `blog` とWorkers Buildsの自動デプロイを使用します。`wrangler.jsonc` にCustom Domainを定義し、workers.devとプレビューURLは無効にしています。追加ドメインは不要です。Accessは `amas.dev/auth/login` を対象にします。Access未設定の段階では公開記事の閲覧だけが可能で、管理操作は拒否します。

本番D1 `blog-posts` は既存の空DBを確認し、`0001_initial.sql` を適用済みです。IDは `wrangler.jsonc` の値を使用します。本番R2 `blog-images` も作成済みで、r2.dev公開は無効、R2カスタムドメインは未接続です。非公開のまま `IMAGES` bindingから利用します。記事・画像の投入やローカルデータ移行は行っていません。

既存のWorkers Builds設定は、ビルドコマンドを `pnpm run build`、デプロイコマンドを `pnpm run deploy:built` に合わせます（依存関係はlockfileに従ってインストール）。Node 26・pnpm 12を使用してください。`deploy:built` は本番D1の未適用マイグレーションが成功してからWorkerを更新し、失敗時はデプロイしません。直接 `wrangler deploy` する設定ではマイグレーションが省略されます。本番への適用は本番ブランチだけに限定し、開発ブランチから実行しないでください。

初期マイグレーションは `0001`、記事の `format_version=1`、本文の `content_schema_version=1`、仕様書はv1に統一しています。公開後の変更は新しいマイグレーションを追加します。DBスキーマを変更した後のWorkerロールバックはDBを巻き戻さないため、以後は旧Workerと互換性を保つ変更を先に適用します。

ローカルで空のDBへの初期化だけを検証する場合は、通常の開発DBと別の保存先を指定します。seedや `db:reset:local` は実行しません。

```sh
pnpm exec wrangler d1 migrations apply blog-posts --local --persist-to .cache/initial-schema-check
pnpm exec wrangler d1 execute blog-posts --local --persist-to .cache/initial-schema-check --command 'SELECT count(*) AS posts FROM posts'
```

Accessアプリ `Blog Editor` は作成済みです。Cloudflareアカウント認証のみを使用し、IDプロバイダーはこのCloudflareアカウントのメンバーに限定、`Blog Owner` ポリシーは所有者のメールアドレスだけを許可します。アプリセッションは1か月、ポリシーの期間はアプリ設定に従います。期限切れ後は `/auth/login` に直接アクセスして再認証します。独自セッションや自動更新処理は追加しません。発行されたAUDとチームドメインは `wrangler.jsonc` に反映済みです。

Workers Buildsのコマンド変更、今回の設定を含む実デプロイ、本番ログインの動作確認は未実施です。Workerの設定変更は次回デプロイで反映されます。
