import { describe, expect, it } from "vite-plus/test";
import { DEFAULT_SOCIAL_IMAGE, resolvePageHead } from "./page-metadata";

const location = new URL("https://amas.dev/blog/example?edit=1#heading");

describe("page metadata", () => {
  it("provides a title, canonical URL and complete default social card", () => {
    const head = resolvePageHead({ title: "記事" }, location);
    const meta = Object.fromEntries(
      head.meta!.map((item) => [item.property || item.name, item.content]),
    );
    expect(head.title).toBe("記事 - amas.dev");
    expect(head.links).toEqual([{ rel: "canonical", href: "https://amas.dev/blog/example" }]);
    expect(meta).toMatchObject({
      "og:title": "記事",
      "og:type": "website",
      "og:url": "https://amas.dev/blog/example",
      "og:site_name": "amas.dev",
      "og:locale": "ja_JP",
      "og:image": `https://amas.dev${DEFAULT_SOCIAL_IMAGE.url}`,
      "og:image:secure_url": `https://amas.dev${DEFAULT_SOCIAL_IMAGE.url}`,
      "og:image:width": "1200",
      "og:image:height": "630",
      "og:image:type": "image/png",
      "og:image:alt": DEFAULT_SOCIAL_IMAGE.alt,
      "twitter:card": "summary_large_image",
      "twitter:title": "記事",
    });
    expect(meta["og:description"]).toBe(meta.description);
    expect(meta["twitter:image"]).toBe(meta["og:image"]);
    expect(meta["twitter:image:alt"]).toBe(meta["og:image:alt"]);
  });

  it("honors page overrides, repeated article tags, custom images and alias URLs", () => {
    const head = resolvePageHead(
      {
        title: "題名",
        links: [
          { rel: "canonical", href: "/blog/alias?edit=1#top" },
          { rel: "alternate", href: "/blog/alias.md" },
        ],
        meta: [
          { name: "description", content: "説明" },
          { property: "og:type", content: "article" },
          { property: "og:title", content: "共有用題名" },
          { property: "og:image", content: "/custom.png" },
          { property: "og:image:alt", content: "図の説明" },
          { property: "og:image:width", content: "800" },
          { property: "og:image:height", content: "400" },
          { property: "article:tag", content: "one" },
          { property: "article:tag", content: "two" },
          { name: "robots", content: "noindex, nofollow" },
        ],
      },
      location,
    );
    const get = (name: string) =>
      head
        .meta!.filter((item) => (item.property || item.name) === name)
        .map((item) => item.content);
    expect(get("og:type")).toEqual(["article"]);
    expect(get("article:tag")).toEqual(["one", "two"]);
    expect(get("twitter:title")).toEqual(["共有用題名"]);
    expect(get("twitter:description")).toEqual(["説明"]);
    expect(get("og:image")).toEqual(["https://amas.dev/custom.png"]);
    expect(get("twitter:image:alt")).toEqual(["図の説明"]);
    expect(get("og:image:width")).toEqual(["800"]);
    expect(get("og:image:type")).toEqual([]);
    expect(get("og:url")).toEqual(["https://amas.dev/blog/alias"]);
    expect(get("robots")).toEqual(["noindex, nofollow"]);
    expect(head.links).toContainEqual({ rel: "alternate", href: "/blog/alias.md" });
  });
});
