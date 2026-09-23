import { readFileSync } from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import { INITIAL_ARTICLE } from "~/content/initial-article";
import { INITIAL_ARTICLE_HTML } from "~/content/initial-article.generated";

import {
  canApplyInsertDialog,
  canSwitchToView,
  createArticlePresentation,
  createInsertDialog,
} from "./article-shell";

describe("article shell", () => {
  it("derives visible date and footer text from the article date", () => {
    expect(createArticlePresentation(INITIAL_ARTICLE)).toEqual({
      dateLabel: "九月十七日　木曜日",
      shortDate: "2026.9.17",
      footerRight: "令和八年 / 2026",
    });
  });

  it("keeps rendering while the date input is temporarily empty", () => {
    expect(createArticlePresentation({ publishedAt: "" })).toEqual({
      dateLabel: "公開日未設定",
      shortDate: "日付未設定",
      footerRight: "年未設定",
    });
  });

  it("does not switch to view while the first editor load is pending", () => {
    expect(canSwitchToView("loading")).toBe(false);
    expect(canSwitchToView("edit")).toBe(true);
  });

  it("opens link and image forms with useful empty defaults", () => {
    expect(createInsertDialog("link")).toEqual({ kind: "link", href: "https://", error: "" });
    expect(createInsertDialog("image")).toEqual({ kind: "image", src: "", alt: "", error: "" });
  });

  it("requires a destination but keeps image alternative text optional", () => {
    expect(canApplyInsertDialog({ kind: "link", href: "https://", error: "" })).toBe(false);
    expect(canApplyInsertDialog({ kind: "link", href: "https://example.com", error: "" })).toBe(
      true,
    );
    expect(canApplyInsertDialog({ kind: "image", src: "", alt: "", error: "" })).toBe(false);
    expect(canApplyInsertDialog({ kind: "image", src: "/image.png", alt: "", error: "" })).toBe(
      true,
    );
  });

  it("keeps section numbers out of generated article content", () => {
    expect(INITIAL_ARTICLE_HTML).not.toMatch(/第[一二三四五六七八九十]+節/);
    expect(INITIAL_ARTICLE_HTML).not.toContain('class="section-number"');
    expect(INITIAL_ARTICLE_HTML.match(/<h2(?:\s|>)/g)).toHaveLength(4);
  });

  it("edits article metadata in place instead of an editor panel", () => {
    const source = readFileSync(new URL("./article-shell.tsx", import.meta.url), "utf8");
    const headerSource = readFileSync(new URL("../blog/blog.tsx", import.meta.url), "utf8");

    expect(source).not.toContain("<summary>記事情報</summary>");
    expect(headerSource).toContain('type="date"');
    expect(headerSource).toContain('class="article-date-input"');
  });

  it("preloads the editor when the edit control receives pointer or keyboard intent", () => {
    const source = readFileSync(new URL("./article-shell.tsx", import.meta.url), "utf8");
    const headerSource = readFileSync(new URL("../blog/blog.tsx", import.meta.url), "utf8");

    expect(source).toContain("preloadEditor$");
    expect(source).toContain("onPointerEnter$={preloadEditor$}");
    expect(source).toContain("onFocus$={preloadEditor$}");
    expect(headerSource).toContain("onPointerEnter$={props.onEditIntent$}");
    expect(headerSource).toContain("onFocus$={props.onEditIntent$}");
  });
});
