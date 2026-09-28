# 記事メディアの保存と配信

本文JSONが原文の正本。Mermaid・TeXの過去版を別途蓄積しない。ラスタ原本は永久保持し、AVIF・SVGは共通の参照寿命で管理する。本文の操作契約は [文書仕様](tiptap-document-spec-v1.md)。

## 台帳と寿命

| 表 | 役割 |
| --- | --- |
| image_originals | R2原本の永久台帳。未参照でも削除しない |
| media_variants | AVIF/SVGの世代別key、描画契約、寸法、数式layout、状態 |
| post_media_refs | 本文版・出現パス・生成物・上部判定・診断 |
| media_upload_leases | 保存前の一時保護。1時間で失効 |
| image_article_history | 原本と記事の関連履歴。記事単位UPSERT、記事削除後も保持 |

参照中の生成物にTTLはない。参照も有効leaseもなくなって24時間後にGC対象となる。毎時17分のscheduled handlerと画像管理の整理操作が同じGCを使う。DBでdeletingをclaimして新参照を拒否し、R2削除後に台帳を削除する。失敗は次回再試行する。原本prefixは回収しない。24時間を超えて放置した古いタブの未取得画像は再読み込みが必要になる場合がある。

既存画像URL `/images/variants/{id}` を維持する。SVGは `/media/variants/{id}` で配信する。配信物は画像と同じ公開URL契約、原本・下書き・保存操作は既存Access/Origin境界で保護する。SVG直接表示にもCSP sandboxを設定する。

## 保存と描画

通常UIとブラウザWebMCPの保存は `prepare-media.ts` → `savePostContent` → `acceptMedia` / `mediaReferenceStatements` を共有する。既存表示の生成物はキーだけを送り、足りないものを編集クライアントで生成する。編集途中はアップロードしない。メモリキャッシュは64件まで。

SVGはXMLとして要素/属性・外部参照を検証する。数式はSVGと支援MathMLに分離する。SVGは1件1MB、新規分の合計5MBまで。サーバーが本文ソースと描画契約からキーを再計算し、本文外の成果物を拒否する。受信SVGを本文の実行可能HTMLにしない。SVGの内容がソースの意味と同じかは、認可されたクライアントを信頼する境界である。

本文・参照・上部判定・履歴は同じD1 batch内で、本文とupdated_atの一致を条件に更新する。競合時に他の記事版の参照を上書きしない。不正ソースは下書きに診断付きで保存できるが、公開には生成物が必要。閲覧時の再生成、BROWSER binding、Puppeteerは使用しない。

数式は元のex単位の大きさ・baselineを画像でも維持し、支援MathMLを画像とは別に置く。Mermaidとラスタ図は共有figure fieldとqstyle境界を使用する。寸法予約、native lazy、スケルトンを共有し、図の最大高さは80svh。数式には図枠・80svhを適用しない。

## 上部判定

正本は `src/content/media-fold.ts` の `media-fold-v1`。編集端末・現在時刻・DOM・フォント測定を使わず、正規本文と保存された寸法に固定計算を適用する。

```text
embed(i) = any s: estimatedY(i,s) <= H(s) + max(2 × lineHeight(s), 0.1 × H(s))
```

固定の幅320〜3840、高さ568〜2560、文字サイズ12/16/20、小ビューポート高係数0.75/1の条件を評価する。画面の幅/高さは独立。600pxとemブレークポイントの境界も含む。本文幅36em、紙幅48em、実CSSの余白規則を使う。図は寸法と80svhから、文章は固定Unicode幅表から推定する。未対応の複合ブロックは高さ0として扱い、数式は所属段落先頭で判定する。

これは全端末への数学的保証ではなく、上部の取りこぼしを減らす決定的な近似。短段落・複雑な表が多い記事は埋め込みが多くなる。10%余裕は運用値である。本文正規化後のhash・policy versionが不一致なら埋め込みへ倒す。規則を変えるときは版を上げて参照を再構築する。

SSRはメタデータを一括取得し、上部SVGだけR2から取得する。同じ生成物は重複取得せず、同時取得は最大6件。上部はdata URLのeager画像、下部は外部URLのlazy画像。下部SVG本体を記事リクエストで取得しない。

## 移行・監査

接続先は必須。通常のdevは本番接続なので、書き込みテストは `BLOG_LOCAL_TEST=1` と `.cache/webmcp-test` に限定する。

```sh
pnpm media:migrate -- --env local
pnpm media:migrate -- --env local --apply
pnpm media:audit -- --env local
```

`--apply`なしでは原本・既存描画データを調査し、変更しない。`--audit`は参照とR2実体・本文hashを検査する。適用は原本一覧、旧AVIF台帳、現行本文、旧キャッシュから新台帳へ登録する。原本R2 key・既存画像ID・本文bytesを変更しない。再実行可能であり、途中失敗時は修正後に全体を再実行する。旧キャッシュ不足はエラーとして報告し、編集クライアントで再生成する。

適用前の本文と結果は `.cache/media-migration/` に保存する。D1全体のバックアップは別途 `wrangler d1 export` を使う。D1復旧だけでR2は復元されない。生成物を消す前に旧Workerへ戻す必要がなくなったことを確認する。

本番は `--env production` を指定する。SQLの追加migration→データ移行→監査→新Workerの順。旧表を削除するmigrationは新Worker稼働確認後に適用する。`pnpm deploy`は全未適用migrationを適用するため、削除migrationを先行リリースに含めない。

## 検証

`src/server/media.test.ts`、`media-rendering.test.ts`、`images.test.ts`は保存・寿命・共有・SVG検証を確認する。`scripts/seed-media-test.ts`はローカル専用の上部/下部SVG記事を用意する。

```sh
pnpm exec tsx scripts/seed-media-test.ts
BLOG_TEST_URL=http://127.0.0.1:4187 pnpm exec playwright test tests/layout/media-delivery.spec.ts
```

Chromium/WebKit/Firefoxと390/1280幅で埋め込み・外部URL・読み込み完了・編集2往復の寸法を確認する。画像の縦長制限と記事全体の編集位置は既存のimage-height/lazy、article-layout-parityで確認する。WebMCPの操作経路はwebmcp.spec.ts、本番bundle境界はcheck:editor-chunk。端末固有のキーボードや全ブラウザの実機検証を代替するものではない。
