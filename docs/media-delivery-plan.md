# 記事メディアの配信統合・移行計画

状態: **合意した方針を実装へ落とすための設計。未実装・未移行・未デプロイ。**
作成日: 2026-09-28。現在のコードを確認したうえで記載する。実装開始前に差分を再確認する。

この文書は作業中の設計・実行計画の入口とする。現在の本文契約は [Tiptap文書仕様](tiptap-document-spec-v1.md)、現在の運用は [認証・デプロイ](deployment.md)。本書の新仕様を実装する前に、正本仕様の対象節を更新する。完了後は恒久仕様を既存文書に統合し、検証・移行結果をGit履歴へ残す。

## 1. 目的と決定事項

- ラスタ図とMermaidは、実際の共通枠コンポーネント・qstyle定義を使用する。通常の図の使い心地、caption/alt、クリックからのソース編集、キャンセル、Undoを維持する。
- AVIF・Mermaid SVG・数式SVGは管理権限を持つクライアントで生成し、サーバーは検証して保存する。閲覧時にMermaid/MathJaxを実行しない。
- ラスタ画像の原本は永久保持する。Mermaid/TeXの原文は現行の本文JSONに保持し、編集のたびのソース・生成物履歴は蓄積しない。
- AVIF/SVGは共通の参照寿命で管理する。参照中の完成物に時間TTLを設けない。参照切れ後の削除猶予は24時間、一時アップロードの期限は1時間を初期運用値とする。
- SVGのうちページ上部にある可能性があるものは初期HTMLに画像として埋め込む。その他は外部URLとnative `loading="lazy"`。カスタムIntersectionObserverによる読み込みは追加しない。
- 判定は本文・メタデータ・固定規則だけからサーバーで計算する。編集端末のウィンドウ・フォント・DOM測定・UA・訪問者のClient Hintsに依存させない。
- 画像とMermaidは寸法を先に確保し、共通スケルトンと最大80svhを使う。数式はem寸法・baseline・支援MathMLを維持し、行内数式に図枠や80svhを適用しない。
- SVGが足りない記事を閲覧時に再生成する経路を廃止し、移行完了後にBROWSER bindingとサーバーPuppeteerを削除する。
- 今回の作業範囲は文書化。以下の実装・本番移行・公開は未実施。将来の実装依頼と本番公開の権限は区別する。

## 2. 現行と移行後のデータ

現行は `migrations/0001_initial.sql` に以下の4表がある。原本台帳の独立表は現行DBにはない。

| 現行 | 内容 | 移行後 |
| --- | --- | --- |
| image_variants | AVIF ID、original_id、幅・高さ | media_variantsとimage_originals |
| post_images | 記事→AVIF参照 | post_media_refs |
| render_cache | 原文、renderer、SVG/数式HTML、診断、生成ロック | 本文の原文＋media_variants＋記事の派生診断 |
| post_render_refs | 記事→描画キー参照 | post_media_refs |

`posts.body_json` の数式latex属性とMermaid codeBlockはそのまま正本とする。SVG、寸法、判定結果は本文JSONへ加えない。新しい本文ノードやスキーマ版の追加は原則不要。既存画像srcも移行のためだけに書き換えない。

### 2.1 新しい表の契約

以下は実装対象の論理スキーマ。SQL migrationそのものはまだ作成していない。時刻はUTC epoch秒、サイズはbytesとする。

**image_originals**

- `id TEXT PRIMARY KEY`、`object_key TEXT UNIQUE NOT NULL`、`mime TEXT`、`byte_length INTEGER`、`created_at INTEGER`。
- 既存原本ID・R2 keyを保持。過去の時刻不明はNULLとして扱い、移行日時を作成日時に偽装しない。
- 通常保存・記事削除・GCによる削除禁止。参照なしも管理画面から取得できる。

**media_variants**

- `id TEXT PRIMARY KEY`、`kind` = raster/mermaid/inlineMath/blockMath。
- `original_id` はrasterのみ必須、image_originalsへFK。SVGはNULL。
- `render_key` はSVGのみ必須。種別・完全一致ソース・描画契約のSHA-256。行内/独立数式を区別する。
- `recipe TEXT NOT NULL`、`content_hash TEXT NOT NULL`、`object_key TEXT UNIQUE NOT NULL`、`mime TEXT NOT NULL`。
- `width REAL > 0`、`height REAL > 0`、`byte_length INTEGER > 0`、`layout_json`。
- 数式layoutはwidthEm/heightEm/verticalAlignEmと検証済み支援MathML。元ソースや任意HTMLを格納しない。
- `state` = uploading/ready/deleting、`created_at`、`unreferenced_at`、`upload_expires_at`。
- `(render_key) WHERE state='ready' AND render_key IS NOT NULL` の一意索引。削除中は別IDで再生成できる。object_keyは世代固有で再使用しない。
- 逆引き・GC用索引: original_id、state/unreferenced_at、state/upload_expires_at。
- 同じrender_keyで生成bytesが異なっても既存readyを上書きしない。renderer契約が同じなら既存の検証済み成果物を再利用する。

**post_media_refs** — 同じSVGの上部/下部を区別するため、出現単位。

- `(post_id, node_path) PRIMARY KEY`。post_idはpostsへFK ON DELETE CASCADE。
- node_pathはその本文版でのJSON content配列のindex列。永久node IDとして扱わない。
- `body_hash TEXT NOT NULL`、`variant_id`（media_variantsへFK、参照中の物理削除を禁止）、`render_key`（SVGのみ）。
- `embed_initial INTEGER CHECK IN (0,1)`、`policy_version TEXT NOT NULL`。
- `diagnostic_json`。不正ソースを保存した下書きではvariant_id=NULLを許可し、ソースは本文から取得する。
- variant_idの逆引き索引、post_id/embed_initialの索引。数式や図の過去参照は保存しない。
- 閲覧は必ずbody_hashと現在本文を照合。古い判定を新しい本文に適用しない。

**media_upload_leases** — 未保存挿入と並行保存を保護する。

- `token PRIMARY KEY`、`variant_id` FK、`post_id` FK ON DELETE CASCADE、`expires_at`。
- variant_idとexpires_atに索引。完了/中止時に自分のtokenを削除する。共有物に単一の所有者欄を置かない。
- 編集権限・記事を照合して発行。期限更新は認証済み編集クライアントのみ。失効後の保存は再取得する。

**image_article_history** — ラスタ原本の関連履歴に限定する。

- `(original_id, post_id_snapshot) PRIMARY KEY`。original_idはFK、post_id_snapshotはFKにしない。
- `post_title_snapshot`、`first_linked_at`、`last_linked_at`、`last_unlinked_at`。同じ記事での挿入・削除ごとに行を追加せずUPSERT。
- 数式/Mermaidの履歴は入れない。現在の関連はpost_media_refsから求める。
- 現行DBに存在しない過去の関連は復元できない。移行時に取得できる現行関連と移行後の履歴から開始する。

表数を3つに抑える案から、用途を明確に分けた5表に修正する。追加の2表は生成履歴ではなく、競合を防ぐ一時leaseとラスタ原本の関連履歴である。

### 2.2 R2とURL

- 既存 `images/originals/{id}`、`images/variants/{id}` はそのまま使う。全オブジェクトのリネームを移行条件にしない。
- 新規成果物は `media/variants/{generationId}.avif` / `.svg`。URL `/media/variants/{id}` はDBに記録されたkeyを引く。
- 既存 `/images/variants/{id}` は恒久互換ルートとして新台帳へ解決する。旧テーブルを削除しても動作すること。
- 原本URL・管理操作は既存canManagePostsとOrigin境界を維持。配信AVIF/SVGは現行画像と同じ公開URLの契約を維持する。URLが分かる配信物を下書きだけの秘密情報として扱う設計ではない。
- 配信は正しいContent-Type、nosniff、`Cache-Control: public, max-age=0, must-revalidate`とETagを基準にする。参照切れで消すため長期immutableを無条件に付けない。
- SVGを直接開いた場合も実行可能ページにしないCSP/sandboxを配信ルートで設定し、許可した内部style等が描画できることを確認する。

## 3. 保存・生成・回収

### 3.1 共通保存プロトコル

1. サーバーが本文の種別・完全一致ソース・RENDERERSから必要キーを計算。管理クライアントは既存readyの再利用・lease取得を一括要求する。
2. 足りないAVIF/SVGだけ編集クライアントで生成。入力中はメモリ内プレビューのみでアップロードしない。有限件数/容量のキャッシュにする。
3. 新しいgeneration IDを予約しuploading行とleaseを作成。R2 put後に検証済みメタデータとともにready化。R2 put失敗は再試行できる状態として期限回収する。
4. 記事保存はexpectedVersionを照合し、本文更新・現在参照の差分・診断・判定・画像関連履歴・自分のlease解除を単一のD1トランザクションで確定。
5. 競合時は本文も参照も変更しない。`db.batch()`でUPDATEが0行でも後続SQLは自動停止しない点に注意。後続変更も同一の成功条件でガードするか、競合をSQLエラーとしてトランザクション全体を中断する仕組みを実装・検証する。
6. 最後の参照/有効leaseを失った時刻を設定する。再参照時は同じトランザクションで解除する。元画像は触らない。

既存の本文が公開済みの場合、生成不足の新本文で公開内容を置き換えない。不正TeX/Mermaidは下書きとして原文と診断を保存できるが、正常な公開には全成果物を要求する。現行postsは1本文であり、公開版と下書きの二重保持は今回追加しない。公開/下書き切替の既存操作契約を維持する。

### 3.2 受信契約

- `requireManager` / canManagePosts・Origin検証を通常UIとWebMCPで共有する。信頼したクライアントとは認可された編集クライアントであり、無検証の任意HTML受信ではない。
- SVGは1件1,000,000 UTF-8 bytes、1保存対象の新規SVG合計5,000,000 bytesを初期上限とする。超過は明示し黙って落とさない。既存の文字数ベースの上限と区別する。
- namespace、有限正数のviewBox/寸法、実byte長、kind/recipe/render_keyをサーバーで検証する。DOCTYPE/ENTITY、script、イベント属性、外部URL参照を拒否。`#id`の内部参照は許可する。
- MermaidのforeignObjectが必要な現行出力を壊さない。許可する内包XHTMLは明示的な要素/属性allowlistとし、script/iframe/object等は許可しない。実際の全対応図種のfixturesで確認する。regexだけをSVG検証器にしない。
- 数式の支援MathMLは独立した構造検証・allowlistを通す。任意MathJax HTMLをそのまま本文へ差し込まない。ソース改変や数式の意味を検証できると主張しない。クライアント生成物を信頼する境界は残る。
- SVG内IDは画像単位に閉じる。支援MathMLにIDを許す場合は出現単位で再採番する。
- AVIFは既存の変換品質・寸法・容量・アニメーション・メタデータ除去契約を維持する。

### 3.3 GCと競合

- 全kind共通: readyかつ参照なし・有効leaseなし・unreferenced_atから24時間経過を削除候補とする。参照中の生成物に24時間TTLはない。
- D1で条件付き更新してdeletingへ遷移する。この時点以降の新しい参照/lease作成をDB制約またはトランザクションの検証で拒否する。
- 次にR2を削除し、成功/既に不存在を確認して台帳行を削除。R2障害時はdeletingを残して再試行する。削除後に同じobject_keyへputしない。
- uploadingの期限切れもclaimして回収。遅いuploadがGC後にputを完了する競合を想定し、状態確認失敗時のアップロード側清掃と、世代固有keyの孤立オブジェクト照合を実装する。
- DBとR2に分散トランザクションはない。定期照合は期限より新しいputを消さず、原本prefixを対象外にする。
- 現行の管理操作から呼ぶ回収を共通化。定期回収を必要とするため、毎時Cronと既存Worker entryのscheduled handlerを追加する。1回の件数・実行時間を制限しcursorで再開する。移行期間はGC停止フラグを持つ。
- 24時間は閲覧中の古いHTMLへの猶予であり無期限保証ではない。古いタブの未取得SVGが期限後に消えた場合は再読み込みで回復できるエラー表示にする。

## 4. 編集端末に依存しない上部判定

### 4.1 入力と式

`policy_version = media-fold-v1` を定義する。入力は正規本文、保存された寸法/数式em情報、固定レイアウト定数だけ。現在時刻、DOM、UA、画面情報、Intlの実装差を入力にしない。

画面条件sの高さをH、推定ページ位置をY、本文行高をLとして:

```text
E(s) = max(2 × L(s), 0.10 × H(s))
embed(i) = any s in S: estimatedY(i,s) <= H(s) + E(s)
```

Sは固定仮想条件の直積。初期候補を以下に固定し、検証後にv1の確定値として採用する。

- 幅: 320, 360, 390, 430, 504, 505, 600, 601, 640, 672, 768, 1024, 1440, 3840 CSS px。
- 高さ: 568, 960, 1440, 1920, 2160, 2560 CSS px。
- 基準文字サイズ: 12, 16, 20 CSS px。小さい文字で多くの内容が画面内に入る条件も含める。
- 小ビューポート高: 仮想Hの0.75倍および1倍。図のsvh上限が小さく後続が上がる条件も評価する。
- 基準文字サイズが変わる条件ではemブレークポイントの直前/直後も追加する。

これは実ユーザーの分布や全端末を保証する集合ではない。最大高さ2560はQHD縦置きまでを扱う運用範囲。4K縦置き、大幅な縮小ズーム、任意のユーザーCSSは保証外。通常の外部URL画像としては引き続き表示される。

### 4.2 決定的な推定器の実装開始仕様

本文幅は現行CSSの紙幅48em、本文幅36em、余白clamp(1.5em,5vw,3em)、600px以下の左右1.5emから算出する。safe-areaは0として上側に寄せる。タイトル・ヘッダーの高さは初版では0として扱い、過大評価を避ける。

推定器は実レイアウトの複製ではない。以下を**実装・校正の開始値**とし、ブラウザ検証に不合格なら過大評価した規則を小さくする。検証を終えるまで確定値と称しない。

- テキストは固定Unicode範囲表によりem幅を積算する。ASCII空白0.25、ASCII印字0.45、CJK文字0.8、約物0.3、その他0.5、結合文字/variation selector/ZWJは0。実端末のmeasureTextやIntl.Segmenterは使わない。
- 明示改行ごとに分割し、各区間の行数を `max(1, floor(advance / availableWidth))` とする。通常のceilより少なめに数える。空段落は0。
- テキストブロックの寄与は `max(0, lines × 1.5 × fontSize - 2 × 1.5 × fontSize)`。段落余白・text-indentは初版では加算しない。短い段落の寄与が0となり埋め込み過多になることを許す。
- 見出しも初版は本文サイズで計算する。インライン数式の推定文字幅は0とし、当該数式は段落先頭で上部判定する。段落内の数式は同じ判定とする。
- 既知寸法の独立図: `min(min(intrinsicDisplayWidth, availableWidth) / aspectRatio, 0.8 × smallViewportHeight)`。拡大しない表示契約に合わせる。caption/枠/余白は初版では高さに加えない。
- 独立数式は検証済みheightEm×基準文字サイズ。枠余白は加えない。横スクロール契約を維持する。
- 表、リスト、引用、トグル、インライン画像を含む混在段落など、初版で正しく扱えない複合ブロックの高さ寄与は0。内部SVGの位置はそのコンテナ先頭とする。非表示内容は後続位置に加算しない。
- その他未知ノードや寸法欠落も0寄与。負値・NaNを蓄積しない。JSONの深さ/サイズは既存本文制約に従う。

この式は保守的に倒す**近似**で、文字幅による値は数学的に証明された下限ではない。実際より下に見積もる誤判定が検証で残るブロックは0寄与に退避する。0寄与が多い記事で全SVGが埋め込まれても、個数/bytes上限で密かにlazyへ変更しない。

計算は保存/移行時に行い、1回の走査で全出現位置を求める。すべての条件で境界を越えた後続については、非負寄与の契約のもと計算を打ち切れる。リクエスト時に全条件を再計算しない。

### 4.3 失効と検証

- 本文・寸法・recipe・レイアウト規則が変われば再計算する。保存したbody_hash/policy_versionが合わない間は全SVGを埋め込み側へ倒す。
- 判定器の出力は端末・プロセス・実行時の時刻によらず一致することをunit testする。
- 開発時だけ固定環境のChromium/Firefox/WebKitで実位置と比較する。長文日本語、英数字、短段落列、表、トグル、数式、縦長/横長図の組合せ、幅境界と中間幅を含める。
- 合格基準: 検証集合において実際の初期画面に交差するSVGのlazy誤判定0件。余分な埋め込み数・圧縮HTML bytes・保存時間も計測する。未知の全環境への保証とは区別する。
- 前案の編集iframe測定、固定ページ座標2560px、先頭N件だけの判定は採用しない。10%/2行の余裕は運用初期値でありブラウザ標準ではない。

## 5. 配信DOM・共通UI

下部Mermaid（ラスタ図は同じ枠でAVIF srcに替える）:

```html
<figure>
  <div class="figure-field" data-blog-surface="figure">
    <img data-article-image data-image-state="pending"
      data-variant-id="V2" src="/media/variants/V2"
      loading="lazy" decoding="async" width="600" height="2000"
      style="aspect-ratio:600 / 2000;--article-image-ratio:600 / 2000"
      alt="処理の流れ">
  </div>
  <figcaption><p>処理の流れ</p></figcaption>
</figure>
```

上部は同じSVG bytesを `src="data:image/svg+xml,..." loading="eager"` で埋め込む。任意SVGをHTMLの子要素として挿入しない。data-variant-idを保持し、編集切替で再生成しない。これはDOM例でありcaption/altの既存本文意味を自動変更する指示ではない。

行内数式:

```html
<span class="math-inline" data-media-path="0.1">
  <img class="math-image" src="/media/variants/V3"
    loading="lazy" decoding="async" width="96" height="24"
    style="width:6em;height:1.5em;vertical-align:-0.25em"
    alt="" aria-hidden="true">
  <span class="math-assistive"><!-- 検証済みのMathML --></span>
</span>
```

数式の支援情報は画像読込前から存在し、読み上げを二重にしない。ソース編集・コピーは本文JSONとnode_pathに対応させる。数式のpending表示は寸法枠内で行いベースラインを変えない。SSRと編集で同一の構築関数を使う。

実装対象は既存 `src/components/molecules/figure.tsx` と図フィールドの構築処理を調査して決める。名前だけ同じ別DOMを増やさない。`article-image.ts` のload/error/キャッシュ済み判定を共有し、Qwik RenderOnce・Tiptap NodeViewのignoreMutation契約を維持する。reduced-motionではスケルトンアニメーションを止める。

SSRは本文＋全出現の軽いメタデータを一括取得し、上部variant IDを重複除去してR2から取得する。下部SVG本体はR2 getしない。数式の支援情報は全出現分必要。同じvariantが上部と下部にあっても、下部は外部URLのままでよい。

## 6. 通常UI・WebMCP・欠落時

- `src/webmcp/catalog.ts`を正本として既存の保存/公開/画像挿入/整理の入出力を更新する。共通prepareArtifactsを通常UIとブラウザWebMCPが呼ぶ。通常利用者にSVG文字列を手入力させない。
- サーバーだけのMarkdown/JSON取込みも、公開前に認証済みブラウザクライアントで不足生成物を用意する。下書き保存は診断付きで可能。閲覧側やサーバーが黙って補完しない。
- expectedState/expectedVersion、dirty状態、未確定ソース、アップロード中の競合を維持。ソース編集のキャンセルで本文/参照を更新しない。
- 公開後の予期せぬR2欠落はログ・診断と寸法保持したエラー表示。本文/ソースを消さない。認証済み修復クライアントによる再生成を用意する。
- renderer契約変更時は旧成果物を即失効させず、現行記事ごとの採用recipeを参照に保持して配信を継続。新recipeへの再生成・参照切替を段階的に行う。GCまで旧generationを保持する。

## 7. 実装順序と対象

- [ ] 正本仕様4.3/4.4、5.7、13.1、13.3/13.4、14を更新。現在の「サーバー生成」「D1のoutput」「最後の参照で即削除」を新契約へ変更し、現行実装との差を明示する。
- [ ] 共通描画契約・artifact入力検証・型、決定的判定器を追加。`src/content/render-contract.ts`のrecipeは出力契約が変わる場合に更新。
- [ ] 追加DB migration、R2保存、lease、GC、画像原本履歴、互換URLを実装。
- [ ] `src/server/accept-render-artifacts.ts`、`posts.ts`、`images.ts`を共通保存経路へ。`render-document.ts`/`render-post.ts`を配信専用へ。
- [ ] `mermaid-renderer.ts`/`mathjax-renderer.ts`、図/数式NodeView、ArticleMedia、共有枠、記事loaderを更新。
- [ ] WebMCP経路と画像管理画面のID/原本関連を更新。
- [ ] 移行ツール、監査、互換リリース、段階切替、GC、削除用migrationを準備。
- [ ] 全移行と閲覧/編集確認後に`src/server/render-mermaid.ts`、旧render-cache生成ロック等の不要コード、`@cloudflare/puppeteer`、BROWSER binding/型を削除。ローカルテスト用Playwrightは残す。
- [ ] architecture/development/deploymentと該当skillの古い描画/キャッシュ説明を新実装へ合わせる。

## 8. データ移行とデプロイの順序

### 8.1 準備と移行ツール

現行migrationは0001〜0003。次番号は着手時に再確認し、適用済みSQLは編集しない。ローカルresetやseedを本番移行に使わない。

移行ツールを新設する。以下は**要求するインターフェースであり現在存在するコマンドではない**。

```text
pnpm media:migrate -- --env local|production --dry-run
pnpm media:migrate -- --env local|production --apply --resume <checkpoint>
pnpm media:audit -- --env local|production
```

- 接続先を必須にし、dry-runを既定とする。DB/R2のID・対象件数・予定変更を出力。秘密や記事本文全体はログしない。
- 原本prefixを含むR2一覧をページングし、DBに紐付かない原本も台帳へ登録。mime/bytesを検証し、不明や欠落を別一覧にする。
- AVIFは既存ID/keyを登録し実ファイル存在・寸法を照合。既に回収済みの配信物はreadyとしない。
- 現行body_jsonを走査して参照を構築。render_cacheだけをソースの正本にしない。
- 既存Mermaid SVGを検証してR2へ保存。数式HTMLはSVG・寸法・支援MathMLに分解して検証する。形式不適合/不足は認証済みクライアントの移行画面で再生成する。旧HTMLを無条件に採用しない。
- ページング、再実行、重複排除、body_hashによる変更検出、checkpoint、移行manifest（旧key→新ID・hash・結果）を備える。記事の版が変わったらスキップ/再試行し上書きしない。
- 本番実行前にD1の復旧点/エクスポート、旧Worker版、R2原本・既存成果物の保全方法と復元手順を確認する。D1復旧だけではR2は戻らない。

### 8.2 段階リリース

| 段階 | DB/コード | 完了条件 |
| --- | --- | --- |
| A: 拡張 | 新表・索引のみ追加。旧表/trigger維持。新旧読取可能、GC停止 | 旧Workerが動く。新書込みは旧参照にも整合する互換コードを確認 |
| B: 移行 | 新生成物を保存、記事単位の移行、旧読取fallbackを維持 | 全公開記事の参照/ファイル/hash/支援情報/上部判定の監査合格 |
| C: 切替 | 新配信・新保存を既定に。閲覧生成を停止 | 未移行下書きも編集/保存できる。旧Browser依存へのfallbackが0 |
| D: 安定化 | BROWSER/Puppeteer削除。新GCを有効化 | 本番スモーク、回収dry-run、失敗再試行、監視確認 |
| E: 縮小 | 旧trigger/4表/互換書込みを別migrationで削除 | 旧Workerへ戻す期間を終了。全記事/管理操作が新表だけで動作 |

互換期間に旧Workerへ戻す可能性がある間は、旧形式で読める成果物と参照を残す。数式は旧サーバー検証/生成経路をこの期間に限り保持できる。新規保存まで含めて旧データへ反映できないリリースは「旧Workerへ単純rollback可能」と扱わない。その場合は互換版への修正デプロイで復旧する。

既存の旧キャッシュ削除trigger、旧画像GCが新配信で必要なファイルを消さないよう、Aの互換版でGCを止める。E用DROP migrationをA〜Dの配布物へ先に含めない。`pnpm deploy`は全未適用migrationを適用するため、一度に置くと段階分離できない。

### 8.3 実行コマンドと確認

以下は現行設定で確認できるコマンド。実装後に追加migrationを含む状態で実行する。今回は実行していない。

```sh
pnpm exec wrangler d1 migrations apply blog-posts --local --persist-to .cache/webmcp-test
BLOG_LOCAL_TEST=1 pnpm dev --host 127.0.0.1 --port 4187 --strictPort
```

別ターミナルから接続先を明示して、今回追加するunit/browserテストと既存の関連テストを実行する。`BLOG_TEST_URL`なしのPlaywrightは通常dev（本番接続）を起動し得るため使わない。

```sh
pnpm build
BLOG_TEST_URL=http://127.0.0.1:4187 pnpm exec playwright test tests/layout/article-image-lazy.spec.ts tests/layout/article-image-height.spec.ts tests/layout/webmcp.spec.ts
pnpm exec wrangler dev --local --port 4188 --persist-to .cache/webmcp-test
```

ビルド済みローカルpreviewに対して:

```sh
BLOG_PREVIEW_URL=http://127.0.0.1:4188 pnpm check:editor-chunk
```

本番公開が許可された作業でのみ、各段階の監査を確認して `pnpm deploy` を使う。現在はbuild→remote migration→Worker deployの順。Worker配布失敗でもDB migrationは戻らないので、Aは追加のみ・Eは旧Worker非互換の境界として扱う。R2 backfillはSQL migrationでは実行できず、Bの専用ツールで別途行う。

### 8.4 本番スモークと復旧

- 公開記事の上部SVGがHTML内にあり、下部SVG bytesが含まれない。JSなしで画像が表示される。
- 下部URL、旧画像URL、ETag/Content-Type、原本の認証、未認証の保存拒否を確認。
- Accessでログインし、通常UIとWebMCPの編集→保存→再読込をそれぞれ確認。確認用記事は識別し、既存本文をテスト用途に変更しない。
- 数式読み上げ・TeXコピー、Mermaid編集キャンセル、portrait cap、スケルトン終了、表示/編集の位置を確認。
- Workerログでmissing object、検証失敗、旧fallback利用、GC失敗を確認。テスト/build/本番反映を別々に記録。
- A/Bの障害: 新GCを停止し互換版へ戻す。移行データは消さず再開する。
- C/Dの障害: 新GC停止、互換版の範囲内で戻すか修正配布。既に削除したR2はWorker rollbackでは復元されない。
- E後: 旧Workerへ単純rollbackしない。新スキーマ対応版へ修正配布、必要なら保全データを別環境へ復元して検証後に切替。原本を削除する復旧手順は禁止。

## 9. 必須の受入条件

- [ ] 編集端末・ウィンドウ・時刻を変えても同じ本文/メタデータ/規則から同じ判定になる。
- [ ] 画像/Mermaid共有枠、数式baseline、閲覧/編集切替、選択、キャンセル、Undo、モバイル操作に退行がない。
- [ ] 上部判定の実画面検証でlazy誤判定0件。過剰埋め込み量と計算時間を報告する。
- [ ] 正常公開には全成果物があり、不正ソース下書きは消えず診断付きで保存できる。
- [ ] 同じソースの共有、同一記事の重複出現、上部/下部の混在が正しく動く。
- [ ] 記事競合時に参照だけが変わらない。GCと保存/再利用/遅いputの競合で参照中の物が消えない。
- [ ] 参照中のAVIF/SVGにTTLなし。参照切れの生成物と台帳は回収される。原本と画像記事履歴は残る。
- [ ] 移行再実行・中断再開・更新中の記事・キャッシュ欠落・孤立原本を検証。移行前後の本文hashは一致する。
- [ ] BROWSERなしのビルド済みWorkerで閲覧/保存が動く。閲覧bundleにMermaid/MathJax生成器が混ざらない。
- [ ] 新URLと旧URLの配信、画像管理、WebMCP、Access境界が動作する。
- [ ] 本番公開は別途実際に確認し、未確認事項を完了扱いしない。

## 10. 調査根拠

画面サイズ統計はビューポート分布ではない。以下は方式選定の根拠であり、本書の10%余裕や固定文字幅を保証する資料ではない。

- [MDN: CSS pixelとdevicePixelRatio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)
- [MDN: svh/lvh/dvh](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length)
- [Statcounter: 全プラットフォーム画面解像度](https://gs.statcounter.com/screen-resolution-stats/desktop-mobile-tablet)（調査時2026年8月表示）
- [Playwright: viewportとscreenの分離](https://playwright.dev/docs/emulation)
- [Google: CMSの上部画像に対する近似判定](https://web.dev/articles/browser-level-lazy-loading-for-cmss)
- [WordPress 6.3: 先頭付近のlazy除外](https://make.wordpress.org/core/2023/07/13/image-performance-enhancements-in-wordpress-6-3/)
- [Shopify: section位置不明ならeager](https://shopify.dev/docs/storefronts/themes/best-practices/performance/use-section-index)
