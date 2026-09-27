# 履歴資料

過去の設計・計画と検討用HTMLを保存しています。本文中の依存バージョン・パス・操作手順・チェックボックスは当時のものです。現在の仕様や残タスクを表すものではなく、ここから旧手順を再実行しません。現在の入口は [開発ドキュメント](../README.md) です。

| 当時のテーマ | 記録 | 現在の参照先・主な違い |
| --- | --- | --- |
| WYSIWYGエディター | [設計](designs/2026-09-17-wysiwyg-blog-editor-design.md) / [計画](plans/2026-09-17-wysiwyg-blog-editor.md) | [文書仕様](../tiptap-document-spec-v1.md)。一時的なMarkdown編集から、D1にTiptap JSONを保存する記事編集へ移行。数式はMathJaxを使用 |
| 閲覧・編集のレイアウトと表ハンドル | [設計](designs/2026-09-17-layout-parity-table-handles-design.md) / [計画](plans/2026-09-17-layout-parity-table-handles.md) | [editor-parityスキル](../../.agents/skills/blog-editor-parity/SKILL.md) と現行の `tests/layout/`。当時の一時編集・完全一致検査の記述を現在の運用条件と混同しない |
| qstyleへのCSS移行 | [設計](designs/2026-09-17-qstyle-css-in-js-migration-design.md) / [計画](plans/2026-09-17-qstyle-css-in-js-migration.md) | [アーキテクチャ](../architecture.md) と [qstyleスキル](../../.agents/skills/blog-qstyle-components/SKILL.md)。アプリCSSはqstyleを使用し、KaTeX依存はない |
| マークアップ採用一覧 | [2026-09-25の検討用HTML](2026-09-25-markup-elements-review.html) | [文書仕様](../tiptap-document-spec-v1.md)。当時の表示・出力のスナップショット |

旧配置は `docs/superpowers/{specs,plans}/` とルートの `markup-elements-review.html` でした。現行文書への整理前の内容はGit履歴でも確認できます。
