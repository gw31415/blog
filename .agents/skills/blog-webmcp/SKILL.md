---
name: blog-webmcp
description: このblogの記事閲覧・検索・編集・公開・画像管理・権限・画面遷移を追加変更するとき、WebMCPツールと通常UIの操作契約を保つ。
---

# WebMCPと通常操作を一緒に保守する

機能追加・変更時は `src/webmcp/catalog.ts` のツール一覧・入力スキーマ・公開範囲を確認する。ユーザーの目的に対応する操作を追加し、DOMクリックの細分化や同じ処理の別実装を増やさない。見た目だけの変更に新規ツールは不要。

- 登録・互換性・破棄は `src/webmcp/browser.ts` と `WebMcpTools`、記事の未保存状態とTiptap接続は `src/webmcp/editor.ts`、永続データ取得と管理は `src/server/webmcp.ts` が担当する。スキーマと実行時入力検証の正本はcatalog。ツールを追加したら実行先も追加し、未対応分岐へ落ちないことを確認する。
- 通常UIと `savePostContent` / `requireManager` / 文書正規化 / 公開検証 / 画像ライフサイクルを共有する。クライアントのツール非表示やannotationsは認可ではない。公開・下書きの境界、Origin検証、private/no-storeを維持する。
- Tiptap JSONを正本とし、本文変更はTiptapのトランザクションに通す。ブラウザ所有のヘッダーDOMと状態も同期する。未確定フォーム・アップロード中は上書きしない。新しい編集フィールドや選択操作を追加したら状態取得・stateToken・保存・dirty判定も合わせて更新する。
- `expectedState` は人の入力との競合、`expectedVersion` はDBの条件付き更新を保護する。作成のrequestIdは実行中だけ保持し、成功・失敗のfinallyで所有者を照合して削除する。10分の期限と次の作成時の期限切れ回収は終了処理失敗時の保険であり、通常の削除をTTL任せにしない。終了後の再試行は新規作成となるため永続的な冪等性を案内しない。公開・削除などの確認を、引数のconfirmed=trueだけで代替しない。公開状態変更と保存は区別し、元画像は消さない。
- ページ・権限の変更時は古いツールを解除する。未対応ブラウザに登録の代替グローバルを作らず通常の動作を維持する。エディターを閲覧者の初期ロードに混ぜない。
- API自体を変更するときは [最新仕様](https://webmachinelearning.github.io/webmcp/) と [Chrome公式資料](https://developer.chrome.com/docs/ai/webmcp) を確認する。2026-09-28時点の最新ドラフトはdocument.modelContext、旧実装はnavigator.modelContext。プロトコルの変更をアダプター内に閉じ込める。

## 検証

変更に応じて `src/webmcp/*.test.ts`、`src/server/webmcp.test.ts`、`tests/layout/webmcp.spec.ts` を実行する。認可・作成の再試行・削除の条件を変えたら `tests/security/access-runtime.mjs` の実際の署名付きAccessセッション検証も使う。ブラウザテストの登録アダプターと実際のブラウザエージェント経由の実行は区別して報告する。型・ビルド・`check:editor-chunk`でSSR/遅延ロードも確認する。

通常のdevはremoteBindingsを使うため、本番データで書込みテストをしない。`BLOG_LOCAL_TEST=1` のdevと `.cache/webmcp-test` のローカルD1/R2を利用する。初期化は全データ削除ではなくマイグレーションを適用する。テストは自分で作成した記事だけを削除する。

本文や編集の意味が変わる場合は [blog-document-contract](../blog-document-contract/SKILL.md) に従い [docs/tiptap-document-spec-v1.md](../../../docs/tiptap-document-spec-v1.md) を先に更新する。UIを変える場合は既存のqstyle・editor-parityスキルも適用する。未検証のブラウザや本番デプロイを成功扱いしない。

ローカル検証の起動例（別ターミナルでdevを維持）:

```sh
pnpm exec wrangler d1 migrations apply blog-posts --local --persist-to .cache/webmcp-test
BLOG_LOCAL_TEST=1 pnpm dev --host 127.0.0.1 --port 4187 --strictPort
BLOG_TEST_URL=http://127.0.0.1:4187 pnpm exec playwright test tests/layout/webmcp.spec.ts
```

本番ビルドの確認は `pnpm run build` 後に `pnpm exec wrangler dev --local --port 4188 --persist-to .cache/webmcp-test` を起動し、`BLOG_PREVIEW_URL=http://127.0.0.1:4188 pnpm run check:editor-chunk` を使う。署名付き認可検証は `pnpm exec wrangler deploy --dry-run --outdir .cache/access-bundle` のローカル出力に対して `node tests/security/access-runtime.mjs` を実行する。dry-runと本番deployは区別する。
