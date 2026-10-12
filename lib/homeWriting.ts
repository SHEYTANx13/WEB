import {
  getBlogMetaList,
  getInboundCounts
} from "@/lib/blog";

import type {
  BlogPostMeta
} from "@/lib/blogFormat";

/*
 * HOME WRITING SELECTION — SERVER SIDE (v3.0).
 *
 * The home scene gains a Writing section, but it must never drag
 * the blog content pipeline into the client graph: lib/blog imports
 * the full generated posts.json (article HTML included), so this
 * module stays server-only and its output crosses to the client as
 * a tiny array of serializable props (app/page.tsx → LivingShell →
 * SceneRegistry → HomeScene).
 *
 * Selection law (honest, deterministic, no keyword stuffing):
 *   1. the author-flagged featured article, if any;
 *   2. then articles ordered by real inbound internal links
 *      (the "referenced by" graph), then by date, newest first.
 * Exactly three entries — the strongest signals the catalogue has.
 */

export type HomeWritingPost = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  category: string;
  /* Content type (v3.7) — the Blog content-mode classification. */
  type: "article" | "work" | "research";
  readingTime: string;
  /* Real inbound internal-link count from the site's own graph. */
  inbound: number;
};

const HOME_WRITING_COUNT = 3;

const EXCERPT_LIMIT = 190;

function toHomeWritingPost(
  post: BlogPostMeta,
  inbound: number
): HomeWritingPost {
  return {
    slug: post.slug,
    title: post.title,
    excerpt:
      post.excerpt.length > EXCERPT_LIMIT
        ? `${post.excerpt.slice(0, EXCERPT_LIMIT - 1).trimEnd()}…`
        : post.excerpt,
    date: post.date,
    category: post.category,
    type: post.type,
    readingTime: post.readingTime,
    inbound
  };
}

export function getHomeWritingPosts(): readonly HomeWritingPost[] {
  const posts = getBlogMetaList();

  if (posts.length === 0) {
    return [];
  }

  const inboundCounts =
    getInboundCounts();

  const ranked = [...posts].sort(
    (a, b) => {
      const featuredDelta =
        Number(b.featured) -
        Number(a.featured);

      if (featuredDelta !== 0) {
        return featuredDelta;
      }

      const inboundDelta =
        (inboundCounts[b.slug] ?? 0) -
        (inboundCounts[a.slug] ?? 0);

      if (inboundDelta !== 0) {
        return inboundDelta;
      }

      return a.date < b.date
        ? 1
        : a.date > b.date
          ? -1
          : a.slug < b.slug
            ? -1
            : 1;
    }
  );

  return ranked
    .slice(0, HOME_WRITING_COUNT)
    .map((post) =>
      toHomeWritingPost(
        post,
        inboundCounts[post.slug] ?? 0
      )
    );
}
