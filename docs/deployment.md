# 認証・デプロイ

## Cloudflare構成

リポジトリ側の設定の正本は [cloudflare.config.ts](../cloudflare.config.ts) です。ここでは設定と運用手順を記し、Cloudflare側の現在のデプロイ・データ・ポリシーの状態を保証するものではありません。

| 項目             | 設定                                |
| ---------------- | ----------------------------------- |
| Worker           | `blog`                              |
| 公開ドメイン     | `amas.dev`（Custom Domain）         |
| Workerエントリー | `dist/_worker.js`                   |
| 静的アセット     | `dist/`、binding `ASSETS`           |
| D1               | `blog-posts`、binding `DB`          |
| R2               | `blog-images`、binding `IMAGES`     |
| 定期処理         | 毎時17分、未参照AVIF/SVGの回収      |
| Access設定       | `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` |

workers.devとpreview URLは無効です。R2の画像はWorker経由で配信し、r2.dev公開やR2カスタムドメインを前提にしません。Qwikのアダプターとエントリーファイル名に `cloudflare-pages` が残っていますが、公開先はWorkersです。

## Accessによる管理者認証

公開記事は認証不要です。ログインボタンは置かず、`https://amas.dev/auth/login` に直接アクセスし、Access認証後に `/` へ戻ります。Cloudflare AccessのSelf-hostedアプリは `amas.dev/auth/login` を保護し、許可ポリシーを管理者に限定します。公開ルート全体をAccessで保護する構成ではありません。

AccessアプリのAudienceとチームドメインを `ACCESS_AUD` / `ACCESS_TEAM_DOMAIN` に合わせます。認証Cookieは `/auth/login` 限定にせず、公開ルートにも送られるホスト全体のPath `/` を使います。CookieはHttpOnly・SameSite=Laxを使用します。Accessアプリを変更したらAUDも更新します。

`src/server/access.ts` は保護パスの `Cf-Access-Jwt-Assertion`、ヘッダーがない場合の `CF_Authorization` Cookieを検証します。署名、issuer、audience、有効期限、利用者トークンの条件を確認し、メールヘッダーだけでは許可しません。不正なヘッダーがある場合にCookieへフォールバックしません。

preview・本番では未設定・未認証・不正なトークンの管理操作を拒否します。記事作成・保存・削除、画像アップロード・整理はサーバーで再検証し、変更リクエストに同一Originを要求します。下書きのHTML・Qwikデータ・Markdown、画像管理、元画像取得も保護します。公開記事と配信用画像は認証不要です。

devには別の管理者目線切替があります。[開発・検証](development.md) の接続先と権限の表を参照してください。`amas.dev` のCookieはlocalhostへ共有されないため、previewで本番ログインを引き継げるとは扱いません。

公開パスではAccessポリシーの再評価ではなく、WorkerによるJWT検証を行います。独自のユーザー・セッションDBや即時失効照会はなく、期限切れ後は `/auth/login` で再認証します。セッション期間はこの動作に合わせて設定します。

SSRとloader/action応答は `private, no-store`。管理者の一覧をIndexedDB/sessionStorageに保存しません。署名付き認可のローカル検証は [開発・検証](development.md) にあります。

## マイグレーションと公開

本番への公開時だけ、次のコマンドを使います。

```sh
pnpm deploy
```

`deploy` はビルド後に `deploy:built` を実行します。`deploy:built` は `db:migrate:remote` で本番D1の未適用マイグレーションを適用し、成功した場合だけ `cf deploy --prebuilt` します。直接 `cf deploy --prebuilt` する設定ではマイグレーションが省略されます。

Workers Buildsを使う場合のコマンドは次の組み合わせです。Node 26・pnpm 12とlockfileを使用し、本番デプロイは本番ブランチに限定します。

| 項目     | コマンド                |
| -------- | ----------------------- |
| ビルド   | `pnpm run build`        |
| デプロイ | `pnpm run deploy:built` |

マイグレーションは `0001`（初期スキーマ）、`0002`・`0003`（WebMCPリクエスト管理）、`0004`〜`0007`（メディア台帳統合・関連履歴・回収猶予・旧表削除）です。既に適用したマイグレーションを変更しても適用済みDBは更新されません。以後のスキーマ変更は追加マイグレーションで行います。

WorkerのロールバックはDBを巻き戻しません。旧Workerと互換性を保つスキーマ変更を先に適用します。初期開発時の旧スキーマの破棄や `db:reset:local` を、本番の更新手順として使いません。seedの本番投入も公開コマンドには含みません。

公開後は対象Workerの更新、公開ページ、Accessログイン、管理操作をそれぞれ確認します。ローカルのビルド・dry-run・テストの成功と、本番への反映・ログイン確認は分けて記録します。

メディア統合の移行・監査は [メディア配信](media-delivery.md) を参照。0004で共通台帳、0005で画像原本の関連履歴削除時記録を追加する。0006でlease終了後の回収猶予を統一し、0007で移行済み旧メディア4表を削除する。0007以後は旧スキーマ用Workerへ単純rollbackしない。Worker entryはbuild.serverの末尾でfetchとscheduledを公開する形に仕上げる。
