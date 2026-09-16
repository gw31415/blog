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
    ├── global.css
    └── routes/      # ディレクトリベースルーティング
```

## コマンド

```shell
pnpm install

pnpm dev            # 開発サーバー（SSR、adapter 経由）
pnpm build          # 本番ビルド（型チェック・クライアント・サーバー・lint を qwik CLI が実行）
pnpm preview        # 本番ビルドのローカルプレビュー（wrangler dev）
pnpm deploy         # 本番ビルド + wrangler deploy

pnpm check          # lint（oxlint + eslint-plugin-qwik）
pnpm build.types    # TypeScript の型チェック（wrangler types 生成付き）
pnpm check.fmt      # フォーマットチェック
pnpm fmt            # フォーマット
```

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
