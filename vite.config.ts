import { fileURLToPath } from "node:url";
import { qwikVite } from "@qwik.dev/core/optimizer";
import { qwikRouter } from "@qwik.dev/router/vite";
import { qstyle } from "@qstyle/vite";
import { defineConfig, type ViteUserConfig } from "vite-plus";
import { discoveryPaths } from "./src/webmcp/discovery";

export default defineConfig(async ({ command, mode }) => {
  const proxy =
    command === "serve" && mode !== "test"
      ? await (
          await import("wrangler")
        ).getPlatformProxy<Env>({
          remoteBindings: process.env.BLOG_LOCAL_TEST !== "1",
          ...(process.env.BLOG_LOCAL_TEST === "1"
            ? { persist: { path: ".cache/webmcp-test/v3" } }
            : {}),
        })
      : undefined;

  return {
    define: {
      "import.meta.env.BLOG_DEV_SERVER": JSON.stringify(
        command === "serve" && mode !== "test" && !process.env.VITEST,
      ),
    },
    // Concurrent local dev servers must not replace each other's optimized
    // dependency URLs while a page is importing the editor on demand.
    ...(command === "serve" ? { cacheDir: `node_modules/.vite/dev-${process.pid}` } : {}),
    // qstyle は qwik optimizer より先に css prop を変換する。
    plugins: [
      {
        name: "ai-catalog-well-known",
        enforce: "pre",
        configureServer(server) {
          // Match the Worker entry rewrite before Qwik skips /.well-known.
          server.middlewares.use((req, _res, next) => {
            if (req.url?.split("?")[0] === discoveryPaths.catalog) {
              req.url = req.url.replace(discoveryPaths.catalog, "/ai-catalog.json");
              req.originalUrl = req.url;
            }
            next();
          });
        },
      },
      qstyle(),
      qwikRouter({ trailingSlash: false, platform: proxy ? { env: proxy.env } : undefined }),
      // The shared stylesheet is ~18 KiB compressed. Shipping it with the SSR
      // document avoids an extra render-blocking round trip on mobile networks.
      qwikVite({ optimizerOptions: { inlineStylesUpToBytes: 100_000 } }),
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
      // SVG imports a default font even when fontData is supplied. Reuse the
      // renderer's TeX font so the unused NewCM font is not bundled as well.
      alias: {
        "#default-font/svg/default.js": fileURLToPath(
          import.meta.resolve("@mathjax/mathjax-tex-font/js/svg/default.js"),
        ),
      },
    },
    lint: {
      ignorePatterns: ["public/codecs/**"],
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
        "typescript/no-explicit-any": "error",
      },
      categories: { correctness: "warn", suspicious: "warn" },
    },
    fmt: {
      // wrangler types による生成物はフォーマット対象外
      ignorePatterns: [
        "public/codecs/**",
        "worker-configuration.d.ts",
        // vite-plus test がテスト実行時に作る ESM 判定用ディレクトリ
        "dummy-non-existing-folder",
        // 正本仕様は文意に無関係な表・フェンスの全面整形を避ける
        "docs/tiptap-document-spec-v1.md",
        // 当時の記録は移動時に全面整形しない
        "docs/archive/**",
      ],
    },
    test: {
      // Local feature worktrees live under the repository root but are separate projects.
      // Setting this list replaces Vitest defaults, so keep dependency/build exclusions explicit.
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.git/**",
        ".cache/**",
        ".worktrees/**",
        "tests/layout/**",
      ],
    },
    server: {
      allowedHosts: true as const,
    },
  } satisfies ViteUserConfig;
});
