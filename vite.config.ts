import { qwikVite } from "@qwik.dev/core/optimizer";
import { qwikRouter } from "@qwik.dev/router/vite";
// import UnoCSS from "@qstyle/unocss"; // 未導入: 有効化時は `@qstyle/unocss` + `unocss` を deps に追加し下のコメントアウトを外す
import { qstyle } from "@qstyle/vite";
import { defineConfig, type ViteUserConfig } from "vite-plus";

export default defineConfig(async ({ command }) => {
  const proxy =
    command === "serve"
      ? await (await import("wrangler")).getPlatformProxy<Env>({ remoteBindings: false })
      : undefined;

  return {
    // qstyle は qwik optimizer より先に css prop を変換する。
    plugins: [
      // UnoCSS(), // 未導入: qstyle() より前に置く（class ユーティリティを css prop へ翻訳するため）
      qstyle(),
      qwikRouter({ trailingSlash: false, platform: proxy ? { env: proxy.env } : undefined }),
      qwikVite(),
      ...(proxy
        ? [
            {
              name: "dispose-d1-proxy",
              configureServer(server: {
                httpServer?: { once: (event: string, callback: () => void) => void };
              }) {
                server.httpServer?.once("close", () => {
                  void proxy.dispose();
                });
              },
            },
          ]
        : []),
    ],
    resolve: {
      tsconfigPaths: true,
    },
    lint: {
      options: {
        typeAware: true,
        typeCheck: true,
      },
      jsPlugins: ["eslint-plugin-qwik"],
      rules: {
        // qwik プラグイン（eslint-plugin-qwik recommended 相当）
        // valid-lexical-scope は型情報が必要なため oxlint の JS プラグインでは動作せず無効化
        // （未直列化キャプチャの検出はビルド時の qwik optimizer / 型チェックで代替）
        "qwik/valid-lexical-scope": "off",

        "qwik/use-method-usage": "error",
        "qwik/no-react-props": "error",
        "qwik/loader-location": "warn",
        "qwik/prefer-classlist": "warn",
        "qwik/jsx-no-script-url": "warn",
        "qwik/jsx-key": "warn",
        "qwik/unused-server": "error",
        "qwik/jsx-img": "warn",
        "qwik/jsx-a": "warn",
        "qwik/no-use-visible-task": "warn",
        "qwik/serializer-signal-usage": "error",
        "qwik/scope-use-task": "error",
        // use-async-top も型情報が必要なため oxlint の JS プラグインでは動作せず無効化
        "qwik/use-async-top": "off",
        "qwik/no-async-prevent-default": "warn",
        "qwik/no-await-navigate-in-use-task": "warn",
        "no-explicit-any": "off",
      },
      categories: { correctness: "warn", suspicious: "warn" },
    },
    fmt: {
      // wrangler types による生成物はフォーマット対象外
      ignorePatterns: [
        "worker-configuration.d.ts",
        // vite-plus test がテスト実行時に作る ESM 判定用ディレクトリ
        "dummy-non-existing-folder",
        // Markdown から生成した初期記事の JSON / HTML
        "src/content/initial-article.generated.ts",
        // 移植元のソースアーティファクト
        "sample.html",
      ],
    },
    test: {
      // Local feature worktrees live under the repository root but are separate projects.
      // Setting this list replaces Vitest defaults, so keep dependency/build exclusions explicit.
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.git/**",
        ".worktrees/**",
        "tests/layout/**",
      ],
    },
    server: {
      allowedHosts: true as const,
    },
  } satisfies ViteUserConfig;
});
