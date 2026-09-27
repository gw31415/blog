# amas.dev

個人ブログ [amas.dev](https://amas.dev/) のアプリケーションです。QwikによるSSRとTiptapのインライン編集を使い、記事をCloudflare D1、画像をR2に保存します。本文の正本はTiptap JSONで、Markdownは取り込み・書き出しに使います。

## 開発を始める

Node.js 26とpnpm 12を使います。正確なバージョン・依存関係は [package.json](package.json) と [pnpm-lock.yaml](pnpm-lock.yaml) を参照してください。

```sh
pnpm install --frozen-lockfile
pnpm exec wrangler d1 migrations apply blog-posts --local --persist-to .cache/webmcp-test
BLOG_LOCAL_TEST=1 pnpm dev --host 127.0.0.1 --port 4187 --strictPort
```

この起動方法ではローカルのD1/R2を使います。画面右下の「管理者目線」で開発用の編集権限を切り替えられます。サンプル記事の投入やテスト、ビルドの手順は [開発・検証](docs/development.md) にまとめています。

**通常の `pnpm dev` と `pnpm preview` は本番D1/R2に接続します。** 特にdevの「管理者目線」では保存・削除も本番データに反映されます。書き込みを伴う開発・テストには上記のローカル起動を使ってください。

## 主な機能

- 記事一覧・年月別アーカイブ、公開／非公開の記事、ID・別名による記事URL。
- タイトル・副題・説明・タグ・公開日と本文を、記事の表示位置で直接編集。
- H2〜H4、表、図、補足、トグル、数式、Mermaid。編集ランタイムは遅延ロード。
- 元画像を保持するAVIF変換・アップロードと画像管理。
- 正規形式・GitHub・Zenn・Qiita向けMarkdown出力。
- Cloudflare Accessによる管理者認証と、対応ブラウザー向けWebMCP操作。

## ドキュメント

全体の入口は [docs/README.md](docs/README.md) です。

| 文書                                              | 内容                                               |
| ------------------------------------------------- | -------------------------------------------------- |
| [開発・検証](docs/development.md)                 | 環境構築、ローカルデータ、コマンド、テスト         |
| [アーキテクチャ](docs/architecture.md)            | ソースの配置、記事・描画・画像・WebMCPの責務       |
| [認証・デプロイ](docs/deployment.md)              | Cloudflareの設定、認可、マイグレーション、公開手順 |
| [Tiptap文書仕様](docs/tiptap-document-spec-v1.md) | 本文JSON・メタデータ・Markdown・編集操作の正本     |
| [画像変換器](docs/image-codec.md)                 | 同梱WASMのソース、再ビルド、ライセンス             |
| [依存パッチ](docs/dependency-patches.md)          | パッチの目的と更新時の確認事項                     |

リポジトリ固有の作業ルールは [AGENTS.md](AGENTS.md) に置きます。過去の設計・計画・検討用HTMLは [docs/archive/](docs/archive/README.md) に保存しています。
