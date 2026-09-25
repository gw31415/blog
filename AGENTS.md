# 文書形式の変更

本文JSON、記事メタデータ、Markdown変換、保存可能なコンポーネントや編集操作を変更する場合は、`.agents/skills/blog-document-contract/SKILL.md` を使用する。`tiptap-document-spec-v2.md` が仕様の正本であり、データ構造や意味の変更は仕様書を先に編集してから実装する。

通常の実装・修正について、計画書・TDD・再承認を一律に追加しない。確認は変更に必要な範囲で行う。

# UIとコンポーネントの共通化

UIの追加・変更・共通化には `.agents/skills/blog-qstyle-components/SKILL.md` を使用する。スタイルはqstyleのCSS in JSを正本とし、同じ役割のUIは実際のコンポーネントとスタイル定義を共有する。見た目だけを寄せた別実装やコンポーネント用の別CSSを増やさない。
