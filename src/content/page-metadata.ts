import type { DocumentHeadValue, DocumentMeta } from "@qwik.dev/router";
import { BLOG_NAME } from "./article";

export const SITE_DESCRIPTION = "amas.devのブログです。";
export const DEFAULT_SOCIAL_IMAGE = {
  url: "/assets/social-card.png",
  type: "image/png",
  width: 1200,
  height: 630,
  alt: "紙のカードに amas.dev と記したブログの表紙",
};

/** Pages provide ordinary Qwik head overrides; shared metadata is resolved once. */
export function resolvePageHead(head: DocumentHeadValue, location: URL): DocumentHeadValue {
  const pageTitle = head.title?.trim() || BLOG_NAME;
  const title = pageTitle === BLOG_NAME ? BLOG_NAME : `${pageTitle} - ${BLOG_NAME}`;
  const overrides = head.meta ?? [];
  const value = (name: string) =>
    overrides.find((meta) => meta.name === name || meta.property === name)?.content;
  const canonical = new URL(
    head.links?.find((link) => link.rel === "canonical")?.href || location.pathname,
    location.origin,
  );
  canonical.search = "";
  canonical.hash = "";
  const description = value("description") || SITE_DESCRIPTION;
  const defaultImage = new URL(DEFAULT_SOCIAL_IMAGE.url, location.origin).href;
  const image = new URL(value("og:image") || defaultImage, location.origin).href;
  const defaults: DocumentMeta[] = [
    { name: "description", content: description },
    { property: "og:title", content: pageTitle },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonical.href },
    { property: "og:site_name", content: BLOG_NAME },
    { property: "og:locale", content: "ja_JP" },
    { property: "og:description", content: description },
    { property: "og:image", content: image },
    ...(image.startsWith("https:") ? [{ property: "og:image:secure_url", content: image }] : []),
    ...(image === defaultImage
      ? [
          { property: "og:image:type", content: DEFAULT_SOCIAL_IMAGE.type },
          { property: "og:image:width", content: String(DEFAULT_SOCIAL_IMAGE.width) },
          { property: "og:image:height", content: String(DEFAULT_SOCIAL_IMAGE.height) },
        ]
      : []),
    {
      property: "og:image:alt",
      content: image === defaultImage ? DEFAULT_SOCIAL_IMAGE.alt : pageTitle,
    },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: value("og:title") || pageTitle },
    { name: "twitter:description", content: value("og:description") || description },
    { name: "twitter:image", content: image },
    {
      name: "twitter:image:alt",
      content:
        value("og:image:alt") || (image === defaultImage ? DEFAULT_SOCIAL_IMAGE.alt : pageTitle),
    },
  ];
  // Preserve multi-valued article:tag and page-specific metadata without duplicates.
  const meta = [
    ...defaults.filter(
      (item) =>
        !overrides.some((override) =>
          item.property ? override.property === item.property : override.name === item.name,
        ),
    ),
    ...overrides.map((item) => (item.property === "og:image" ? { ...item, content: image } : item)),
  ];
  return {
    ...head,
    title,
    meta,
    links: [
      ...(head.links ?? []).filter((link) => link.rel !== "canonical"),
      { rel: "canonical", href: canonical.href },
    ],
  };
}
