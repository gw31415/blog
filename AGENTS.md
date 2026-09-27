# 開発文書

現在の開発資料の入口は [docs/README.md](docs/README.md)。概要はルートのREADME、作業規則はこのファイルと `.agents/skills/` に置く。`docs/archive/` は過去の設計・計画・検討記録であり、現行仕様や実行すべき手順として扱わない。

# 文書形式の変更

本文JSON、記事メタデータ、Markdown変換、保存可能なコンポーネントや編集操作を変更する場合は、`.agents/skills/blog-document-contract/SKILL.md` を使用する。[docs/tiptap-document-spec-v1.md](docs/tiptap-document-spec-v1.md) が仕様の正本であり、データ構造や意味の変更は仕様書を先に編集してから実装する。

通常の実装・修正について、計画書・TDD・再承認を一律に追加しない。確認は変更に必要な範囲で行う。

# UIとコンポーネントの共通化

UIの追加・変更・共通化には `.agents/skills/blog-qstyle-components/SKILL.md` を使用する。スタイルはqstyleのCSS in JSを正本とし、同じ役割のUIは実際のコンポーネントとスタイル定義を共有する。見た目だけを寄せた別実装やコンポーネント用の別CSSを増やさない。

# WebMCPの保守

記事閲覧・検索・編集・公開・画像管理・権限・画面遷移の機能を追加変更する場合は `.agents/skills/blog-webmcp/SKILL.md` を使用し、通常UIとWebMCPの操作契約を同時に更新する。ツール一覧と入力スキーマの正本は `src/webmcp/catalog.ts`。見た目だけの変更に新規ツールや無関係な検証を追加しない。
