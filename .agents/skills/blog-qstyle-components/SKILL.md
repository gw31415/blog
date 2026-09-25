---
name: blog-qstyle-components
description: このblogのUIを追加・変更・共通化するとき、qstyleによるCSS in JSと実際の共有コンポーネントを使い、ページ間の重複実装を防ぐ。
---

# qstyle による共有コンポーネント

このプロジェクトのUIは `@qstyle/qwik` の `css` と JSX の `css` prop で実装する。新規UIだけでなく変更対象の既存UIにも適用する。

- 見た目を似せるだけ、同じクラス名を別DOMに付けるだけでは共通化としない。同じ役割のUIは実際に同じコンポーネントを呼び、スタイルの正本も共有する。まず `src/components/{foundations,atoms,molecules,organisms,templates}` の既存部品を調べる。小さなUIから上位のページ構造へ依存させない。ページのデータ取得はroutes、描画に依存しない処理はcontent、Tiptap固有の実装と共有DOM契約はeditorに置く。
- スタイルは所有コンポーネントと同じモジュールに置く。現在のqstyleは別モジュールからimportしたスタイルハンドルを変換できないため、共有時はスタイル付きコンポーネントまたはSlotを持つスタイル境界をexportする。`article-styles.tsx` のように定義と適用を同じファイルに置く。ルート要素の宣言はcssテンプレートの直下に記述する（単独の `& { ... }` で囲わない）。ビルドの `left css occurrence(s) untouched` を見逃さない。コンポーネント用の別 `.css`、`useStyles$` / `useStylesScoped$`、文字列の `<style>` は追加しない。ベンダーresetのimportと、実測値・生成SVG等の動的寸法は静的な装飾CSSと区別する。
- 現行qstyleはメディアクエリと基底ルールの出力順がソース順とは限らない。同一詳細度で上書きを競わせず、異なる値を持つPC・モバイル指定は排他的なメディア条件に分け、両viewportでcomputed styleを確認する。
- 色・文字組み・インク表現はブログテーマのqstyle定義を正本とし、ヘッダー、フッター、タグ、記事面などは共有部品を使う。ページ側は配置・データ取得・動作の接続を担当する。配置やvariantの違いを理由に部品全体を複製しない。
- QwikとTiptap/SSR HTMLで同じ面を描く場合は、既存のsurface contractとqstyle境界を共有する。ブラウザー所有のcontenteditable内を無理にQwikコンポーネントで置き換えない。RenderOnce、モード切替時のremount、編集ランタイムの遅延ロードを保持する。
- 意味・動作が異なるものまで巨大な汎用コンポーネントへ押し込まず、共有可能な構造・スタイル・操作を切り出す。移管後は古いCSSや別実装を削除して正本を一つにする。
- 型検査とビルドでqstyle変換を検証し、実DOMとcomputed styleでページ間・viewport間の一致を確認する。記事側に触れる場合は `../blog-editor-parity/SKILL.md` の編集切替確認も行う。文書の意味を変える場合だけ `../blog-document-contract/SKILL.md` を適用する。

共通テーマやルート構造を変更した場合は、本番previewでも保存・ルート更新後にビルド注入のstylesheetが保持されることを確認する。動的メタ情報は `BlogDocumentHead` に閉じ込め、ルートのhead再描画でCSSのlinkを失わない構造を保つ。
