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

記事ページの右上の「編集」で、カテゴリ・公開日・タイトル・副題とMarkdown本文を編集できます。本文は見出し、各種リスト、引用、コード、表、リンク、画像、折りたたみ、補足、インライン／ブロック数式に対応します。見出し番号は本文データに持たず、見出しからCSS counterで自動生成されます。

編集内容は保存すると D1 の記事に反映されます。フッターの年号は公開日から生成する表示項目なので直接編集しません。

記事の初期表示は、MathJaxでTeXからSVGと支援技術向けMathMLを生成したSSR済みHTMLです。TipTap、ProseMirror、編集用MathJaxランタイムは最初に「編集」を押したときだけ動的に読み込み、その後は同じエディターインスタンスのeditable状態だけを切り替えます。

アプリ固有のスタイルは `src/components/editor/article-styles.tsx` の module-local な qstyle tagged template で管理し、同一モジュールの `css` prop から適用します。MathJaxは自己完結したSVGを出力するため、数式用の外部CSSやWebフォントは読み込みません。

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
pnpm deploy         # 本番ビルド + wrangler deploy

pnpm check          # lint（oxlint + eslint-plugin-qwik）
pnpm check:editor-chunk # TipTapが初期HTMLから参照されず動的chunkであることを検証
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
