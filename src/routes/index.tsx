/* oxlint-disable qwik/jsx-img -- The single public hero is precompressed to WebP with explicit dimensions. */
import { $, component$, useSignal, useStyles$, useVisibleTask$ } from "@qwik.dev/core";
import type { DocumentHead } from "@qwik.dev/router";

const toneOptions = [
  { id: "lavender", label: "ラベンダー", soft: "#eee9ff", edge: "#cbc0f6", ink: "#5b4c8e" },
  { id: "mint", label: "ミント", soft: "#e2f6ed", edge: "#b9e5d2", ink: "#28674d" },
  { id: "peach", label: "ピーチ", soft: "#ffede4", edge: "#f5c9b5", ink: "#9a543a" },
] as const;

type ToneId = (typeof toneOptions)[number]["id"];
type CopyStatus = "idle" | "copying" | "copied" | "failed";

const toolCards = [
  {
    index: "01",
    name: "Qwik",
    href: "https://next.qwik.dev/",
    mark: "#9d8de3",
    text: "必要な瞬間まで JavaScript を読み込まない。操作したコンポーネントだけが、軽やかに動作します。",
  },
  {
    index: "02",
    name: "Qwik Router",
    href: "https://next.qwik.dev/",
    mark: "#8fcbb4",
    text: "ディレクトリ構造がそのままルーティングに。規模が大きくなっても、迷わずページを追加できます。",
  },
  {
    index: "03",
    name: "vite-plus",
    href: "https://viteplus.dev/",
    mark: "#f0aa8d",
    text: "開発、ビルド、リント、フォーマット、型チェックをひとつのワークフローに統合。開発に集中できる時間を増やします。",
  },
  {
    index: "04",
    name: "qstyle",
    href: "https://github.com/gw31415/qstyle",
    mark: "#9d8de3",
    text: "コンポーネント内にスタイルを記述。css prop から全体のレイアウトまでスムーズに見通せます。",
  },
  {
    index: "05",
    name: "Cloudflare Workers",
    href: "https://developers.cloudflare.com/workers/",
    mark: "#8fcbb4",
    text: "SSR と静的アセットをエッジ環境へ。そのまま本番公開できるデプロイ環境があらかじめ用意されています。",
  },
] as const;

const stampLabels = ["いい感じ", "もう一度", "ひらめき"] as const;
const kitOptions = ["Qwik + qstyle", "Router + vite-plus", "Workers ready"] as const;

const SectionIntro = component$(
  (props: { index: string; label: string; title: string; copy: string }) => {
    return (
      <div
        css={{
          maxWidth: "900px",
          marginBottom: "48px",
        }}
      >
        <p
          css={{
            margin: "0 0 14px",
            color: "#6d6880",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.16em",
            lineHeight: "18px",
            textTransform: "uppercase",
          }}
        >
          <span css={{ color: "#9d8de3" }}>{props.index}</span> / {props.label}
        </p>
        <h2
          css={{
            margin: "0",
            color: "#0a0d12",
            fontSize: "clamp(28px, 4.3vw, 48px)",
            fontWeight: 500,
            letterSpacing: "-0.055em",
            lineHeight: "1.3",
            whiteSpace: "pre-line",
          }}
        >
          {props.title}
        </h2>
        <p
          css={{
            maxWidth: "620px",
            margin: "22px 0 0",
            color: "#646a75",
            fontSize: "16px",
            lineHeight: "1.9",
          }}
        >
          {props.copy}
        </p>
      </div>
    );
  },
);

const ToolCard = component$(
  (props: { index: string; name: string; mark: string; text: string; href: string }) => {
    return (
      <article
        css={{
          display: "flex",
          minHeight: "236px",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "28px",
          border: "1px solid #e5e9ef",
          borderRadius: "28px",
          background: "#fafdff",
          transition: "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
          "&:hover": {
            transform: "translateY(-4px)",
            borderColor: "#cbc0f6",
          },
        }}
      >
        <div>
          <div
            css={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "34px",
            }}
          >
            <span
              style={{ backgroundColor: props.mark }}
              css={{
                display: "block",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
              }}
            />
            <span
              css={{
                color: "#667281",
                fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
                fontSize: "12px",
                lineHeight: "16px",
              }}
            >
              {props.index}
            </span>
          </div>
          <h3
            css={{
              margin: "0",
              color: "#10141c",
              fontSize: "23px",
              fontWeight: 500,
              letterSpacing: "-0.04em",
              lineHeight: "1.2",
            }}
          >
            {props.name}
          </h3>
        </div>
        <p
          css={{
            margin: "24px 0 0",
            color: "#69717e",
            fontSize: "14px",
            lineHeight: "1.8",
          }}
        >
          {props.text}
        </p>
        <a
          href={props.href}
          target="_blank"
          rel="noreferrer"
          aria-label={`${props.name} のドキュメント`}
          css={{
            alignSelf: "flex-start",
            marginTop: "20px",
            padding: "6px 0",
            color: "#535862",
            fontSize: "12px",
            textDecoration: "underline",
            textUnderlineOffset: "4px",
          }}
        >
          ドキュメントを見る ↗
        </a>
      </article>
    );
  },
);

const StampDemo = component$(() => {
  const stampCount = useSignal(0);
  const stampLabel = useSignal<(typeof stampLabels)[number]>("いい感じ");
  const stamp = $((event: PointerEvent, button: HTMLButtonElement) => {
    stampCount.value += 1;
    stampLabel.value = stampLabels[stampCount.value % stampLabels.length];
    const label = button.firstElementChild;
    if (label && event.detail > 0 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const animation of label.getAnimations()) animation.cancel();
      label.animate(
        [
          { transform: "scale(.94)" },
          { transform: "scale(1.04)", offset: 0.45 },
          { transform: "scale(1)" },
        ],
        { duration: 240, easing: "cubic-bezier(.23, 1, .32, 1)" },
      );
    }
  });
  // Warm the click handler when the demo enters view, before the first tap.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    void stamp.resolve();
  });
  return (
    <article
      css={{
        minHeight: "590px",
        padding: "28px",
        border: "1px solid rgba(255, 255, 255, 0.85)",
        borderRadius: "32px",
        background: "#fafdff",
      }}
    >
      <div css={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          css={{
            color: "#66558f",
            fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.12em",
          }}
        >
          01 / STAMP
        </span>
        <span css={{ color: "#667281", fontSize: "12px" }}>signal</span>
      </div>
      <h3
        css={{
          margin: "32px 0 0",
          color: "#0f151e",
          fontSize: "26px",
          fontWeight: 500,
          letterSpacing: "-0.055em",
          lineHeight: "1.18",
        }}
      >
        クリックすると、
        <br />
        インタラクティブに反応。
      </h3>
      <p css={{ margin: "14px 0 0", color: "#717c89", fontSize: "14px", lineHeight: "1.75" }}>
        押すたびにテキストが変わる、小さなスタンプ。何度でも自由に試せます。
      </p>
      <div
        css={{
          display: "flex",
          minHeight: "210px",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          marginTop: "25px",
          borderRadius: "24px",
          background: "#eee9ff",
        }}
      >
        <button
          type="button"
          aria-label="スタンプを押す"
          onClick$={stamp}
          css={{
            display: "grid",
            width: "116px",
            height: "116px",
            placeItems: "center",
            border: "0",
            borderRadius: "50%",
            background: "#fafdff",
            color: "#66558f",
            cursor: "pointer",
            touchAction: "manipulation",
            userSelect: "none",
            fontSize: "16px",
            fontWeight: 800,
            boxShadow: "0 12px 0 #cbc0f6, 0 22px 30px rgba(91, 76, 142, 0.16)",
            transition: "transform 220ms cubic-bezier(.2, 1.4, .4, 1)",
            "@media (hover: hover) and (pointer: fine)": {
              "&:hover": { transform: "translateY(-3px)" },
            },
            "&:active": {
              transform: "translateY(7px) scale(.97)",
              transitionDuration: "0ms",
            },
            "&:focus-visible": {
              outline: "3px solid #0a0d12",
              outlineOffset: "4px",
            },
          }}
        >
          <span>{stampLabel.value}</span>
        </button>
        <p
          aria-live="polite"
          css={{
            margin: "19px 0 0",
            color: "#66558f",
            fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          {stampCount.value} 回押しました
        </p>
      </div>
      <button
        type="button"
        onClick$={() => {
          stampCount.value = 0;
          stampLabel.value = "いい感じ";
        }}
        css={{
          marginTop: "17px",
          padding: "0",
          border: "0",
          background: "transparent",
          color: "#626c79",
          cursor: "pointer",
          fontSize: "12px",
          textDecoration: "underline",
          textUnderlineOffset: "3px",
          "&:hover": { color: "#0a0d12" },
          "&:focus-visible": { outline: "2px solid #0a0d12", outlineOffset: "3px" },
        }}
      >
        リセット
      </button>
    </article>
  );
});

const StyleDemo = component$(() => {
  const previewTone = useSignal<ToneId>("lavender");
  const previewRadius = useSignal(32);
  const previewScale = useSignal(1);
  const selectedPreviewTone =
    toneOptions.find((tone) => tone.id === previewTone.value) ?? toneOptions[0];
  return (
    <article
      css={{
        minHeight: "590px",
        padding: "28px",
        border: "1px solid rgba(255, 255, 255, 0.85)",
        borderRadius: "32px",
        background: "#fafdff",
      }}
    >
      <div css={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          css={{
            color: "#28674d",
            fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.12em",
          }}
        >
          02 / TUNE
        </span>
        <span css={{ color: "#667281", fontSize: "12px" }}>css prop</span>
      </div>
      <h3
        css={{
          margin: "32px 0 0",
          color: "#0f151e",
          fontSize: "26px",
          fontWeight: 500,
          letterSpacing: "-0.055em",
          lineHeight: "1.18",
        }}
      >
        操作しながら、
        <br />
        デザインを調整。
      </h3>
      <p css={{ margin: "14px 0 0", color: "#717c89", fontSize: "14px", lineHeight: "1.75" }}>
        カラー、角丸、サイズ。デザインのパラメータをパラメータ変更で直感的に切り替えられます。
      </p>
      <div
        css={{
          display: "flex",
          minHeight: "156px",
          alignItems: "center",
          justifyContent: "center",
          marginTop: "25px",
          borderRadius: "24px",
          background: "#f1f5f9",
        }}
      >
        <div
          style={{
            backgroundColor: selectedPreviewTone.soft,
            borderColor: selectedPreviewTone.edge,
            borderRadius: `${previewRadius.value}px`,
            color: selectedPreviewTone.ink,
            transform: `scale(${previewScale.value})`,
          }}
          css={{
            display: "grid",
            width: "180px",
            minHeight: "84px",
            placeItems: "center",
            borderWidth: "1px",
            borderStyle: "solid",
            fontSize: "14px",
            fontWeight: 700,
            transition:
              "transform 180ms ease, border-radius 180ms ease, background-color 180ms ease",
          }}
        >
          プレビュー
        </div>
      </div>
      <div css={{ marginTop: "21px" }}>
        <p css={{ margin: "0 0 9px", color: "#667281", fontSize: "11px", fontWeight: 700 }}>
          COLOR
        </p>
        <div css={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
          {toneOptions.map((tone) => (
            <button
              key={tone.id}
              type="button"
              aria-pressed={previewTone.value === tone.id}
              onClick$={() => {
                previewTone.value = tone.id;
              }}
              style={{
                backgroundColor: tone.soft,
                borderColor: tone.edge,
                color: tone.ink,
              }}
              css={{
                padding: "7px 10px",
                borderWidth: "1px",
                borderStyle: "solid",
                borderRadius: "999px",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: 700,
                transition: "transform 160ms ease",
                "&:hover": { transform: "translateY(-2px)" },
                "&:focus-visible": { outline: "2px solid #0a0d12", outlineOffset: "2px" },
              }}
            >
              {tone.label}
            </button>
          ))}
        </div>
        <div css={{ display: "grid", gap: "10px", marginTop: "16px" }}>
          <label
            for="radius"
            css={{ display: "grid", gap: "5px", color: "#535862", fontSize: "12px" }}
          >
            <span>
              角丸 <output for="radius">{previewRadius.value}px</output>
            </span>
            <input
              id="radius"
              type="range"
              min="12"
              max="48"
              step="4"
              value={previewRadius.value}
              onInput$={(_, element) => {
                previewRadius.value = Number(element.value);
              }}
              css={{
                width: "100%",
                margin: "0",
                minHeight: "28px",
                accentColor: "#66558f",
                cursor: "pointer",
              }}
            />
          </label>
          <label
            for="scale"
            css={{ display: "grid", gap: "5px", color: "#535862", fontSize: "12px" }}
          >
            <span>
              サイズ <output for="scale">{Math.round(previewScale.value * 100)}%</output>
            </span>
            <input
              id="scale"
              type="range"
              min="88"
              max="112"
              step="2"
              value={Math.round(previewScale.value * 100)}
              onInput$={(_, element) => {
                previewScale.value = Number(element.value) / 100;
              }}
              css={{
                width: "100%",
                margin: "0",
                minHeight: "28px",
                accentColor: "#66558f",
                cursor: "pointer",
              }}
            />
          </label>
        </div>
      </div>
      <button
        type="button"
        onClick$={() => {
          previewTone.value = "lavender";
          previewRadius.value = 32;
          previewScale.value = 1;
        }}
        css={{
          marginTop: "12px",
          minHeight: "36px",
          padding: "0",
          border: "0",
          background: "transparent",
          color: "#535862",
          fontSize: "12px",
          cursor: "pointer",
          textDecoration: "underline",
          textUnderlineOffset: "3px",
        }}
      >
        見た目をリセット
      </button>
    </article>
  );
});

const InvitationDemo = component$(() => {
  const invitationTone = useSignal<ToneId>("mint");
  const invitationTitle = useSignal("ひらめきをつくる会");
  const invitationKit = useSignal<(typeof kitOptions)[number]>("Qwik + qstyle");
  const selectedInvitationTone =
    toneOptions.find((tone) => tone.id === invitationTone.value) ?? toneOptions[1];
  return (
    <article
      css={{
        minHeight: "590px",
        padding: "28px",
        border: "1px solid rgba(255, 255, 255, 0.85)",
        borderRadius: "32px",
        background: "#fafdff",
      }}
    >
      <div css={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          css={{
            color: "#9a543a",
            fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.12em",
          }}
        >
          03 / COMPOSE
        </span>
        <span css={{ color: "#667281", fontSize: "12px" }}>state</span>
      </div>
      <h3
        css={{
          margin: "32px 0 0",
          color: "#0f151e",
          fontSize: "26px",
          fontWeight: 500,
          letterSpacing: "-0.055em",
          lineHeight: "1.18",
        }}
      >
        選択して、
        <br />
        1つのカードを作成。
      </h3>
      <p css={{ margin: "14px 0 0", color: "#717c89", fontSize: "14px", lineHeight: "1.75" }}>
        名前を入力し、カラーとツールを選択。自分だけの招待状を作成しましょう。
      </p>
      <div
        style={{
          backgroundColor: selectedInvitationTone.soft,
          borderColor: selectedInvitationTone.edge,
        }}
        css={{
          minHeight: "135px",
          marginTop: "25px",
          padding: "20px",
          borderWidth: "1px",
          borderStyle: "solid",
          borderRadius: "22px",
          transition: "background-color 180ms ease, border-color 180ms ease",
        }}
      >
        <p
          style={{ color: selectedInvitationTone.ink }}
          css={{
            margin: "0",
            fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          A SMALL INVITATION
        </p>
        <p
          css={{
            margin: "13px 0 0",
            color: "#17202a",
            fontSize: "18px",
            overflowWrap: "anywhere",
            fontWeight: 500,
            letterSpacing: "-0.04em",
          }}
        >
          {invitationTitle.value || "名前のない招待状"}
        </p>
        <p css={{ margin: "6px 0 0", color: "#687281", fontSize: "11px" }}>{invitationKit.value}</p>
      </div>
      <div css={{ display: "grid", gap: "13px", marginTop: "18px" }}>
        <label
          for="invitation-title"
          css={{ display: "grid", gap: "8px", color: "#535862", fontSize: "12px" }}
        >
          招待状のタイトル
          <input
            id="invitation-title"
            type="text"
            maxLength={24}
            value={invitationTitle.value}
            onInput$={(_, element) => {
              invitationTitle.value = element.value;
            }}
            css={{
              width: "100%",
              minHeight: "40px",
              padding: "8px 12px",
              border: "1px solid #dce3eb",
              borderRadius: "12px",
              background: "#ffffff",
              color: "#17202a",
              fontSize: "13px",
            }}
          />
        </label>
        <div>
          <p css={{ margin: "0 0 8px", color: "#667281", fontSize: "11px", fontWeight: 700 }}>
            ACCENT
          </p>
          <div css={{ display: "flex", gap: "6px" }}>
            {toneOptions.map((tone) => (
              <button
                key={tone.id}
                type="button"
                aria-pressed={invitationTone.value === tone.id}
                onClick$={() => {
                  invitationTone.value = tone.id;
                }}
                style={{
                  backgroundColor: tone.soft,
                  borderColor: tone.edge,
                  color: tone.ink,
                }}
                css={{
                  flex: "1",
                  minHeight: "40px",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderRadius: "9px",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 500,
                  "&:focus-visible": { outline: "2px solid #0a0d12", outlineOffset: "2px" },
                }}
              >
                {tone.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p css={{ margin: "0 0 8px", color: "#667281", fontSize: "11px", fontWeight: 700 }}>
            PARTS
          </p>
          <div css={{ display: "flex", gap: "6px" }}>
            {kitOptions.map((kit) => (
              <button
                key={kit}
                type="button"
                aria-pressed={invitationKit.value === kit}
                style={{
                  backgroundColor: invitationKit.value === kit ? "#181d27" : "#fafdff",
                  color: invitationKit.value === kit ? "#fafdff" : "#5d6978",
                }}
                onClick$={() => {
                  invitationKit.value = kit;
                }}
                css={{
                  flex: "1",
                  minHeight: "40px",
                  padding: "0 5px",
                  border: "1px solid #dce3eb",
                  borderRadius: "9px",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 500,
                  "&:focus-visible": { outline: "2px solid #0a0d12", outlineOffset: "2px" },
                }}
              >
                {kit}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick$={() => {
          invitationTone.value = "mint";
          invitationTitle.value = "ひらめきをつくる会";
          invitationKit.value = "Qwik + qstyle";
        }}
        css={{
          marginTop: "18px",
          padding: "0",
          border: "0",
          background: "transparent",
          color: "#626c79",
          cursor: "pointer",
          fontSize: "12px",
          textDecoration: "underline",
          textUnderlineOffset: "3px",
          "&:hover": { color: "#0a0d12" },
          "&:focus-visible": { outline: "2px solid #0a0d12", outlineOffset: "3px" },
        }}
      >
        組み合わせをリセット
      </button>
    </article>
  );
});

const StartCommands = component$(() => {
  const copyStatus = useSignal<CopyStatus>("idle");
  return (
    <div
      css={{
        padding: "28px",
        borderRadius: "32px",
        background: "#181d27",
        color: "#fafdff",
        "@media (width >= 768px)": {
          padding: "40px !important",
        },
      }}
    >
      <div
        css={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <p
          css={{
            margin: "0",
            color: "#cfc5f7",
            fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
            fontSize: "11px",
            letterSpacing: "0.11em",
          }}
        >
          TERMINAL / FIRST RUN
        </p>
        <span css={{ color: "#7e8899", fontSize: "11px" }}>Node 26 / pnpm 12</span>
      </div>
      <div
        css={{
          marginTop: "32px",
          padding: "22px",
          border: "1px solid #3a414f",
          borderRadius: "19px",
          background: "#11151d",
        }}
      >
        <p
          css={{
            margin: "0",
            color: "#8c95a5",
            fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
            fontSize: "12px",
            lineHeight: "1.7",
          }}
        >
          <span css={{ color: "#9d8de3" }}>$</span> pnpm install
        </p>
        <div
          css={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "14px",
            marginTop: "17px",
          }}
        >
          <p
            css={{
              margin: "0",
              color: "#fafdff",
              fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
              fontSize: "15px",
              fontWeight: 700,
              lineHeight: "1.7",
            }}
          >
            <span css={{ color: "#9d8de3" }}>$</span> pnpm dev
          </p>
          <button
            type="button"
            disabled={copyStatus.value === "copying"}
            onClick$={async () => {
              copyStatus.value = "copying";
              try {
                if (!navigator.clipboard) {
                  throw new Error("clipboard unavailable");
                }
                await navigator.clipboard.writeText("pnpm install\npnpm dev");
                copyStatus.value = "copied";
              } catch {
                copyStatus.value = "failed";
              }
            }}
            css={{
              flexShrink: 0,
              minHeight: "34px",
              padding: "0 11px",
              border: "1px solid #515a6b",
              borderRadius: "9px",
              background: "transparent",
              color: "#fafdff",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 700,
              transition: "background 160ms ease, border-color 160ms ease",
              "&:hover": { borderColor: "#cfc5f7", background: "#303746" },
              "&:focus-visible": { outline: "2px solid #fafdff", outlineOffset: "2px" },
            }}
          >
            {copyStatus.value === "copied" ? "コピー済み" : "コマンドをコピー"}
          </button>
        </div>
        <p
          aria-live="polite"
          css={{
            margin: "17px 0 0",
            color: "#8c95a5",
            fontSize: "12px",
            lineHeight: "1.7",
          }}
        >
          {copyStatus.value === "copied"
            ? "コピーしました。ターミナルで実行できます。"
            : copyStatus.value === "failed"
              ? "コピーできませんでした。表示中のコマンドを選択してコピーしてください。"
              : copyStatus.value === "copying"
                ? "コピーしています…"
                : "SSR 開発サーバーが起動します。"}
        </p>
      </div>
      <p css={{ margin: "22px 0 0", color: "#8c95a5", fontSize: "12px", lineHeight: "1.8" }}>
        本番ビルドは pnpm build、ローカルでのプレビュー確認は pnpm preview。Cloudflare
        の設定完了後、pnpm deploy で簡単にデプロイできます。
      </p>
    </div>
  );
});

const HeroArtwork = component$(() => {
  const image = useSignal<HTMLImageElement>();
  useStyles$(`@media (scripting: none) { .hero-artwork { opacity: 1 !important; } }`);
  // Decode both cached and freshly loaded images before the one-time reveal.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const element = image.value;
    if (!element) return;
    let disposed = false;
    let animation: Animation | undefined;
    cleanup(() => {
      disposed = true;
      animation?.cancel();
    });
    void element
      .decode()
      .catch(() => {})
      .then(() => {
        if (disposed) return;
        element.style.opacity = "1";
        if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
          animation = element.animate(
            [
              { opacity: 0, transform: "translateY(8px) scale(.985)" },
              { opacity: 1, transform: "none" },
            ],
            { duration: 380, easing: "cubic-bezier(.23, 1, .32, 1)" },
          );
        }
      });
  });
  return (
    <>
      <img
        ref={image}
        class="hero-artwork"
        src="/images/studio-hero.webp"
        alt=""
        width="1536"
        height="1024"
        fetchPriority="high"
        decoding="async"
        style={{ opacity: 0 }}
        css={{
          display: "block",
          width: "100%",
          height: "auto",
          maskImage: "radial-gradient(ellipse closest-side, #000 76%, transparent 100%)",
        }}
      />
    </>
  );
});

export default component$(() => {
  // Conditional qstyle declarations use explicit priority because media rules precede base rules.
  useStyles$(`
    html { scroll-behavior: auto; background: #ebf5ff; }
    body { margin: 0; }
    main, main *, main *::before, main *::after { box-sizing: border-box; }
    main button, main input { font-family: inherit; }
    main button, main a { -webkit-tap-highlight-color: transparent; }
    main button:not(:disabled):active { scale: .97; }
    main :is(a, button, input, summary):focus-visible { outline: 3px solid #0069e0; outline-offset: 4px; }
    main button[aria-pressed="true"] { outline: 2px solid currentColor; outline-offset: 2px; }
    main section { scroll-margin-top: 28px; }
    main input[type="range"] { touch-action: pan-y; }
    main button:disabled { cursor: wait; opacity: .6; }
    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      main *, main *::before, main *::after { animation: none !important; transition: none !important; }
      main button:active { scale: 1; }
      main button:hover, main button:active { transform: none !important; }
    }
  `);
  return (
    <main
      id="top"
      lang="ja"
      css={{
        minHeight: "100svh",
        overflow: "hidden",
        background: "#ebf5ff",
        color: "#0a0d12",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Yu Gothic UI", "Yu Gothic", Meiryo, sans-serif',
      }}
    >
      <header
        css={{
          display: "flex",
          flexWrap: "wrap",
          maxWidth: "1240px",
          margin: "0 auto",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "24px",
          padding: "26px 24px 10px",
          "@media (width >= 768px)": {
            padding: "32px 48px 14px !important",
          },
        }}
      >
        <a
          href="#top"
          aria-label="qwik-on-viteplus トップへ"
          css={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: "7px",
            color: "#0a0d12",
            textDecoration: "none",
          }}
        >
          <span
            css={{
              fontSize: "20px",
              fontWeight: 700,
              letterSpacing: "-0.07em",
              lineHeight: "24px",
            }}
          >
            qwik
          </span>
          <span
            css={{
              color: "#72798a",
              fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
              fontSize: "11px",
              letterSpacing: "0.03em",
              lineHeight: "16px",
            }}
          >
            on vite-plus
          </span>
        </a>
        <nav
          aria-label="メインナビゲーション"
          css={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <a
            href="#stack"
            css={{
              color: "#687181",
              fontSize: "13px",
              fontWeight: 600,
              textDecoration: "none",
              transition: "color 160ms ease",
              "&:hover": { color: "#0a0d12" },
            }}
          >
            ツール
          </a>
          <a
            href="#lab"
            css={{
              color: "#687181",
              fontSize: "13px",
              fontWeight: 600,
              textDecoration: "none",
              transition: "color 160ms ease",
              "&:hover": { color: "#0a0d12" },
            }}
          >
            プレイグラウンド
          </a>
          <a
            href="#start"
            css={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: "40px",
              padding: "0 16px",
              borderRadius: "999px",
              background: "#181d27",
              color: "#fafdff",
              fontSize: "13px",
              fontWeight: 700,
              textDecoration: "none",
              transition: "transform 160ms ease, background 160ms ease",
              "&:hover": {
                background: "#323a4a",
                transform: "translateY(-2px)",
              },
            }}
          >
            はじめる ↗
          </a>
        </nav>
      </header>

      <section
        id="intro"
        css={{
          display: "grid",
          maxWidth: "1240px",
          margin: "0 auto",
          alignItems: "center",
          gap: "48px",
          padding: "76px 24px 100px",
          "@media (width >= 900px)": {
            gridTemplateColumns: "1fr 1fr !important",
            gap: "48px !important",
            padding: "88px 48px 112px !important",
          },
        }}
      >
        <div>
          <p
            css={{
              display: "inline-flex",
              alignItems: "center",
              gap: "9px",
              margin: "0 0 24px",
              color: "#6d6880",
              fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.16em",
              lineHeight: "16px",
            }}
          >
            <span
              css={{ width: "7px", height: "7px", borderRadius: "50%", background: "#9d8de3" }}
            />
            SMALL PRODUCTION STUDIO
          </p>
          <h1
            css={{
              maxWidth: "690px",
              margin: "0",
              color: "#0a0d12",
              fontSize: "clamp(36px, 4.4vw, 60px)",
              fontWeight: 500,
              letterSpacing: "-0.055em",
              lineHeight: "1.28",
            }}
          >
            つくる楽しさを、
            <br />
            <span css={{ color: "#66558f" }}>すぐに、かたちに。</span>
          </h1>
          <p
            css={{
              maxWidth: "570px",
              margin: "30px 0 0",
              color: "#5e6876",
              fontSize: "17px",
              lineHeight: "1.9",
            }}
          >
            qwik-on-viteplus
            は、小さな制作スタジオのように動かしながら学べるスターターキットです。Qwik
            の軽量さ、qstyle の使いやすさ、そして Cloudflare
            へのデプロイ環境を、ひとつの画面に集約しました。
          </p>
          <div
            css={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "12px",
              marginTop: "34px",
            }}
          >
            <a
              href="#lab"
              css={{
                display: "inline-flex",
                minHeight: "52px",
                alignItems: "center",
                padding: "0 22px",
                borderRadius: "999px",
                background: "#181d27",
                color: "#fafdff",
                fontSize: "14px",
                fontWeight: 700,
                textDecoration: "none",
                transition: "transform 160ms ease, background 160ms ease",
                "&:hover": {
                  background: "#323a4a",
                  transform: "translateY(-2px)",
                },
              }}
            >
              体験してみる ↘
            </a>
            <a
              href="#start"
              css={{
                display: "inline-flex",
                minHeight: "52px",
                alignItems: "center",
                padding: "0 22px",
                border: "1px solid #cfd9e5",
                borderRadius: "999px",
                color: "#1b2430",
                fontSize: "14px",
                fontWeight: 700,
                textDecoration: "none",
                transition: "background 160ms ease, transform 160ms ease",
                "&:hover": {
                  background: "#fafdff",
                  transform: "translateY(-2px)",
                },
              }}
            >
              セットアップコマンドを見る
            </a>
          </div>
          <p
            css={{
              margin: "22px 0 0",
              color: "#667281",
              fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
              fontSize: "11px",
              lineHeight: "18px",
            }}
          >
            Qwik 2 beta / vite-plus 0.x / Workers ready
          </p>
        </div>

        <div css={{ position: "relative" }}>
          <HeroArtwork />
          <p
            css={{
              margin: "8px 0 0",
              color: "#667281",
              fontSize: "11px",
              textAlign: "center",
              letterSpacing: "0.06em",
            }}
          >
            アイデアを形にする、小さなツールボックス。
          </p>
        </div>
      </section>

      <section
        id="stack"
        css={{
          padding: "96px 24px 112px",
          background: "#fafdff",
          "@media (width >= 768px)": {
            padding: "128px 48px 148px !important",
          },
        }}
      >
        <div css={{ maxWidth: "1144px", margin: "0 auto" }}>
          <SectionIntro
            index="01"
            label="THE TOOL TABLE"
            title="ツールを知る。開発の幅が広がる。"
            copy="ひとつひとつは小さな選択肢です。しかし、開発の入り口からデプロイまでがひとつの環境に揃うことで、試行錯誤のスピードが格段に上がります。"
          />
          <div
            css={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "14px",
              "@media (width >= 640px) and (width < 1000px)": {
                gridTemplateColumns: "repeat(2, minmax(0, 1fr)) !important",
              },
              "@media (width >= 1000px)": {
                gridTemplateColumns: "repeat(3, minmax(0, 1fr)) !important",
              },
            }}
          >
            {toolCards.map((tool) => (
              <ToolCard
                key={tool.name}
                index={tool.index}
                name={tool.name}
                mark={tool.mark}
                text={tool.text}
                href={tool.href}
              />
            ))}
            <article
              css={{
                display: "flex",
                minHeight: "236px",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "28px",
                borderRadius: "28px",
                background: "#ebf5ff",
                "@media (width >= 640px) and (width < 1000px)": {
                  gridColumn: "span 2 !important",
                },
              }}
            >
              <p
                css={{
                  margin: "0",
                  color: "#647387",
                  fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
                  fontSize: "11px",
                  letterSpacing: "0.12em",
                  lineHeight: "16px",
                }}
              >
                THE POINT
              </p>
              <p
                css={{
                  maxWidth: "420px",
                  margin: "26px 0 0",
                  color: "#1c2a3a",
                  fontSize: "24px",
                  fontWeight: 500,
                  letterSpacing: "-0.05em",
                  lineHeight: "1.3",
                }}
              >
                最初の一歩を、
                <br />
                実際に動かせる形にする。
              </p>
              <p
                css={{
                  margin: "24px 0 0",
                  color: "#6d7a8d",
                  fontSize: "13px",
                  lineHeight: "1.7",
                }}
              >
                ドキュメントを読むだけでなく、見て、操作して、コードを変更し、取り入れる。
              </p>
            </article>
          </div>
        </div>
      </section>

      <section
        id="lab"
        css={{
          padding: "98px 24px 116px",
          background: "#ebf5ff",
          "@media (width >= 768px)": {
            padding: "132px 48px 156px !important",
          },
        }}
      >
        <div css={{ maxWidth: "1144px", margin: "0 auto" }}>
          <SectionIntro
            index="02"
            label="THE PLAYGROUND"
            title="3つのコンポーネントを、実際に体験。"
            copy="動かして、変更して、組み合わせる。説明を読む前に、まずは手を動かしてみてください。ここでの体験が、そのまま次の画面づくりのヒントになります。"
          />

          <div
            css={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "16px",
              "@media (width >= 1050px)": {
                gridTemplateColumns: "repeat(3, minmax(0, 1fr)) !important",
                alignItems: "stretch",
              },
            }}
          >
            <StampDemo />

            <StyleDemo />

            <InvitationDemo />
          </div>
        </div>
      </section>

      <section
        id="thread"
        css={{
          padding: "96px 24px 112px",
          background: "#fafdff",
          "@media (width >= 768px)": {
            padding: "128px 48px 148px !important",
          },
        }}
      >
        <div css={{ maxWidth: "1144px", margin: "0 auto" }}>
          <SectionIntro
            index="03"
            label="FROM TOUCH TO CODE"
            title="UIを動かすと、コードの仕組みが見えてくる。"
            copy="このスターターの目的は、単なる「完成品」の提供ではありません。状態管理・スタイリング・デプロイ環境がどのように連携しているかを、画面を通して理解できる点にあります。"
          />
          <div
            css={{
              display: "grid",
              gap: "16px",
              "@media (width >= 800px)": {
                gridTemplateColumns: "1.1fr 0.9fr !important",
                alignItems: "stretch",
              },
            }}
          >
            <div
              css={{
                padding: "30px",
                borderRadius: "32px",
                background: "#181d27",
                color: "#fafdff",
                "@media (width >= 768px)": {
                  padding: "42px !important",
                },
              }}
            >
              <div
                css={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                }}
              >
                <span
                  css={{
                    color: "#cfc5f7",
                    fontFamily:
                      'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
                    fontSize: "11px",
                    letterSpacing: "0.12em",
                  }}
                >
                  ONE SMALL LOOP
                </span>
                <span css={{ color: "#8c95a5", fontSize: "12px" }}>01 → 02 → 03</span>
              </div>
              <div
                css={{
                  display: "grid",
                  gap: "0",
                  marginTop: "62px",
                  "@media (width >= 768px)": {
                    gridTemplateColumns: "repeat(3, 1fr) !important",
                  },
                }}
              >
                <div
                  css={{
                    padding: "0 0 25px",
                    borderBottom: "1px solid #3a414f",
                    "@media (width >= 768px)": {
                      padding: "0 20px 0 0 !important",
                      borderRight: "1px solid #3a414f !important",
                      borderBottom: "0 !important",
                    },
                  }}
                >
                  <p css={{ margin: "0", color: "#8c95a5", fontSize: "12px" }}>01 / signal</p>
                  <p
                    css={{
                      margin: "12px 0 0",
                      color: "#fafdff",
                      fontSize: "21px",
                      fontWeight: 500,
                      letterSpacing: "-0.04em",
                    }}
                  >
                    状態を持つ
                  </p>
                  <p
                    css={{
                      margin: "10px 0 0",
                      color: "#aab3c0",
                      fontSize: "12px",
                      lineHeight: "1.7",
                    }}
                  >
                    操作によって State（状態）が変化。
                  </p>
                </div>
                <div
                  css={{
                    padding: "25px 0",
                    borderBottom: "1px solid #3a414f",
                    "@media (width >= 768px)": {
                      padding: "0 20px !important",
                      borderRight: "1px solid #3a414f !important",
                      borderBottom: "0 !important",
                    },
                  }}
                >
                  <p css={{ margin: "0", color: "#8c95a5", fontSize: "12px" }}>02 / css prop</p>
                  <p
                    css={{
                      margin: "12px 0 0",
                      color: "#fafdff",
                      fontSize: "21px",
                      fontWeight: 500,
                      letterSpacing: "-0.04em",
                    }}
                  >
                    スタイリング
                  </p>
                  <p
                    css={{
                      margin: "10px 0 0",
                      color: "#aab3c0",
                      fontSize: "12px",
                      lineHeight: "1.7",
                    }}
                  >
                    操作によって Style（見た目）が変化。
                  </p>
                </div>
                <div
                  css={{
                    padding: "25px 0 0",
                    "@media (width >= 768px)": {
                      padding: "0 0 0 20px !important",
                    },
                  }}
                >
                  <p css={{ margin: "0", color: "#8c95a5", fontSize: "12px" }}>03 / adapter</p>
                  <p
                    css={{
                      margin: "12px 0 0",
                      color: "#fafdff",
                      fontSize: "21px",
                      fontWeight: 500,
                      letterSpacing: "-0.04em",
                    }}
                  >
                    デプロイ
                  </p>
                  <p
                    css={{
                      margin: "10px 0 0",
                      color: "#aab3c0",
                      fontSize: "12px",
                      lineHeight: "1.7",
                    }}
                  >
                    完成したら、Cloudflare Workers へデプロイ。
                  </p>
                </div>
              </div>
            </div>
            <div
              css={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "30px",
                borderRadius: "32px",
                background: "#e2f6ed",
                "@media (width >= 768px)": {
                  padding: "42px !important",
                },
              }}
            >
              <p
                css={{
                  margin: "0",
                  color: "#28674d",
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                }}
              >
                THE TAKEAWAY
              </p>
              <div>
                <p
                  css={{
                    margin: "74px 0 0",
                    color: "#1a4937",
                    fontSize: "31px",
                    fontWeight: 500,
                    letterSpacing: "-0.065em",
                    lineHeight: "1.5",
                  }}
                >
                  画面を動かす。
                  <br />
                  動作を確認する。
                  <br />
                  カスタマイズする。
                </p>
                <p
                  css={{
                    margin: "24px 0 0",
                    color: "#4b7663",
                    fontSize: "13px",
                    lineHeight: "1.8",
                  }}
                >
                  最小構成だからこそ、各ツールの役割と境目が明確にわかります。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="start"
        css={{
          padding: "96px 24px 112px",
          background: "#ebf5ff",
          "@media (width >= 768px)": {
            padding: "128px 48px 148px !important",
          },
        }}
      >
        <div css={{ maxWidth: "1144px", margin: "0 auto" }}>
          <SectionIntro
            index="04"
            label="START SMALL"
            title="迷わず、最初の一行をコマンドラインへ。"
            copy="リポジトリをクローンしたら、開発サーバーを起動。UI を確認しながら、コンポーネントを追加していきましょう。"
          />
          <div
            css={{
              display: "grid",
              gap: "16px",
              "@media (width >= 850px)": {
                gridTemplateColumns: "1.05fr 0.95fr !important",
                alignItems: "stretch",
              },
            }}
          >
            <StartCommands />
            <div
              css={{
                padding: "30px",
                borderRadius: "32px",
                background: "#ffede4",
                "@media (width >= 768px)": {
                  padding: "40px !important",
                },
              }}
            >
              <p
                css={{
                  margin: "0",
                  color: "#9a543a",
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                }}
              >
                WHAT YOU GET
              </p>
              <ul
                css={{
                  display: "grid",
                  gap: "21px",
                  margin: "43px 0 0",
                  padding: "0",
                  listStyle: "none",
                }}
              >
                <li
                  css={{
                    display: "grid",
                    gridTemplateColumns: "34px 1fr",
                    gap: "12px",
                    alignItems: "start",
                  }}
                >
                  <span
                    css={{
                      color: "#d2815f",
                      fontFamily:
                        'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    01
                  </span>
                  <span>
                    <strong
                      css={{
                        display: "block",
                        color: "#5c3022",
                        fontSize: "15px",
                        fontWeight: 700,
                      }}
                    >
                      Qwik Router による直感的なページ構造
                    </strong>
                    <small
                      css={{
                        display: "block",
                        marginTop: "5px",
                        color: "#8c5b4b",
                        fontSize: "12px",
                        lineHeight: "1.6",
                      }}
                    >
                      src/routes から簡単にページを拡張できます。
                    </small>
                  </span>
                </li>
                <li
                  css={{
                    display: "grid",
                    gridTemplateColumns: "34px 1fr",
                    gap: "12px",
                    alignItems: "start",
                  }}
                >
                  <span
                    css={{
                      color: "#d2815f",
                      fontFamily:
                        'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    02
                  </span>
                  <span>
                    <strong
                      css={{
                        display: "block",
                        color: "#5c3022",
                        fontSize: "15px",
                        fontWeight: 700,
                      }}
                    >
                      css prop によるスムーズなスタイリング
                    </strong>
                    <small
                      css={{
                        display: "block",
                        marginTop: "5px",
                        color: "#8c5b4b",
                        fontSize: "12px",
                        lineHeight: "1.6",
                      }}
                    >
                      コード編集と画面確認の往復にかかるストレスを軽減します。
                    </small>
                  </span>
                </li>
                <li
                  css={{
                    display: "grid",
                    gridTemplateColumns: "34px 1fr",
                    gap: "12px",
                    alignItems: "start",
                  }}
                >
                  <span
                    css={{
                      color: "#d2815f",
                      fontFamily:
                        'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    03
                  </span>
                  <span>
                    <strong
                      css={{
                        display: "block",
                        color: "#5c3022",
                        fontSize: "15px",
                        fontWeight: 700,
                      }}
                    >
                      Cloudflare Workers へのスムーズなデプロイ
                    </strong>
                    <small
                      css={{
                        display: "block",
                        marginTop: "5px",
                        color: "#8c5b4b",
                        fontSize: "12px",
                        lineHeight: "1.6",
                      }}
                    >
                      SSR と静的アセットを一括でデプロイできます。
                    </small>
                  </span>
                </li>
              </ul>
              <a
                href="https://github.com/gw31415/qwik-on-viteplus"
                target="_blank"
                rel="noreferrer"
                css={{
                  display: "inline-flex",
                  marginTop: "44px",
                  color: "#5c3022",
                  fontSize: "13px",
                  fontWeight: 700,
                  textDecoration: "underline",
                  textUnderlineOffset: "4px",
                  "&:hover": { color: "#9a543a" },
                }}
              >
                リポジトリを見る ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      <section
        id="faq"
        css={{
          padding: "96px 24px 112px",
          background: "#fafdff",
          "@media (width >= 768px)": {
            padding: "128px 48px 148px !important",
          },
        }}
      >
        <div css={{ maxWidth: "900px", margin: "0 auto" }}>
          <SectionIntro
            index="05"
            label="A FEW HONEST ANSWERS"
            title="導入前に知っておきたいポイント。"
            copy="シンプルなスターターだからこそ、適したユースケースと事前の前提条件があります。README の重要ポイントをまとめました。"
          />
          <div css={{ borderTop: "1px solid #dfe6ee" }}>
            <details css={{ padding: "22px 0", borderBottom: "1px solid #dfe6ee" }}>
              <summary
                css={{
                  cursor: "pointer",
                  color: "#171d26",
                  fontSize: "16px",
                  fontWeight: 700,
                  listStylePosition: "inside",
                  lineHeight: "1.55",
                }}
              >
                本番環境へ導入する前に、何を確認すべき？
              </summary>
              <p
                css={{
                  maxWidth: "730px",
                  margin: "15px 0 0 22px",
                  color: "#6b7582",
                  fontSize: "14px",
                  lineHeight: "1.9",
                }}
              >
                Qwik 2.0.0-beta と vite-plus 0.x
                を組み合わせた実験的構成です。破壊的変更の可能性があるため、まずは小規模なページでビルド・型チェック・デプロイを検証してから判断してください。
              </p>
            </details>
            <details css={{ padding: "22px 0", borderBottom: "1px solid #dfe6ee" }}>
              <summary
                css={{
                  cursor: "pointer",
                  color: "#171d26",
                  fontSize: "16px",
                  fontWeight: 700,
                  listStylePosition: "inside",
                  lineHeight: "1.55",
                }}
              >
                lint のみで Qwik の安全性を検証できる？
              </summary>
              <p
                css={{
                  maxWidth: "730px",
                  margin: "15px 0 0 22px",
                  color: "#6b7582",
                  fontSize: "14px",
                  lineHeight: "1.9",
                }}
              >
                型情報を必要とする{" "}
                <code
                  css={{
                    padding: "2px 5px",
                    borderRadius: "5px",
                    background: "#eee9ff",
                    color: "#5b4c8e",
                    fontSize: "12px",
                  }}
                >
                  qwik/valid-lexical-scope
                </code>{" "}
                や{" "}
                <code
                  css={{
                    padding: "2px 5px",
                    borderRadius: "5px",
                    background: "#eee9ff",
                    color: "#5b4c8e",
                    fontSize: "12px",
                  }}
                >
                  qwik/use-async-top
                </code>{" "}
                は、現在の lint 設定では無効化されています。必ず{" "}
                <code
                  css={{
                    padding: "2px 5px",
                    borderRadius: "5px",
                    background: "#e2f6ed",
                    color: "#28674d",
                    fontSize: "12px",
                  }}
                >
                  pnpm build.types
                </code>{" "}
                によるチェックを併用してください。
              </p>
            </details>
            <details css={{ padding: "22px 0", borderBottom: "1px solid #dfe6ee" }}>
              <summary
                css={{
                  cursor: "pointer",
                  color: "#171d26",
                  fontSize: "16px",
                  fontWeight: 700,
                  listStylePosition: "inside",
                  lineHeight: "1.55",
                }}
              >
                どこからカスタマイズを始めると、この構成の強みが実感できる？
              </summary>
              <p
                css={{
                  maxWidth: "730px",
                  margin: "15px 0 0 22px",
                  color: "#6b7582",
                  fontSize: "14px",
                  lineHeight: "1.9",
                }}
              >
                まずはこのページの signal をひとつ増やし、qstyle の css prop を変更し、最後に routes
                を追加してみるのがおすすめです。小さな変更が「状態・スタイル・ルーティング」へどう反映されるかが明確に把握できます。
              </p>
            </details>
          </div>
        </div>
      </section>

      <footer
        css={{
          padding: "40px 24px 44px",
          background: "#ebf5ff",
          "@media (width >= 768px)": {
            padding: "48px !important",
          },
        }}
      >
        <div
          css={{
            display: "grid",
            maxWidth: "1144px",
            margin: "0 auto",
            gap: "24px",
            "@media (width >= 700px)": {
              gridTemplateColumns: "1fr auto !important",
              alignItems: "end",
              justifyContent: "space-between",
            },
          }}
        >
          <div>
            <p
              css={{
                margin: "0",
                color: "#0a0d12",
                fontSize: "21px",
                fontWeight: 700,
                letterSpacing: "-0.06em",
              }}
            >
              qwik-on-viteplus
            </p>
            <p css={{ margin: "10px 0 0", color: "#6d7887", fontSize: "12px", lineHeight: "1.7" }}>
              小さな制作スタジオから、次のアイデアを。
            </p>
          </div>
          <div css={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "18px" }}>
            <a
              href="#top"
              css={{
                color: "#667281",
                fontSize: "12px",
                fontWeight: 700,
                textDecoration: "none",
                "&:hover": { color: "#0a0d12" },
              }}
            >
              トップへ戻る ↑
            </a>
            <a
              href="https://qwik.dev/"
              target="_blank"
              rel="noreferrer"
              css={{
                color: "#667281",
                fontSize: "12px",
                fontWeight: 700,
                textDecoration: "none",
                "&:hover": { color: "#0a0d12" },
              }}
            >
              Qwik 公式ドキュメント ↗
            </a>
            <span
              css={{
                color: "#667281",
                fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
                fontSize: "11px",
              }}
            >
              2026 / beta studio
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
});

export const head: DocumentHead = {
  title: "qwik-on-viteplus — 小さな制作スタジオ",
  meta: [
    {
      name: "description",
      content: "Qwik、vite-plus、qstyle、Cloudflare Workersを触って試せる小さな制作スタジオ。",
    },
  ],
};
