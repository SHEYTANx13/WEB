import { PUBLIC_LINKS } from "@/lib/links";

import { ROUTE_REGISTRY } from "@/lib/routes";

/*
 * SITE IDENTITY + STRUCTURED DATA — SERVER SIDE.
 *
 * One coherent entity model for the whole site. Every JSON-LD object
 * on every page resolves its author/publisher references back to the
 * @id values defined here, so the site never emits two conflicting
 * WebSite or Person objects.
 *
 * Laws (SEO Architecture):
 * - Production URL is the ONLY canonical base: absolute, HTTPS,
 *   stable, /WEB-aware. No localhost, no repository URLs, no
 *   alternate hosts ever appear in metadata or structured data.
 * - The origin and site name are DERIVED from data/routes.json (the
 *   canonical registry, via lib/routes.ts) — never re-declared here
 *   as independent literals (SEO v2 hardening, v2.1).
 * - sameAs contains ONLY real public profile URLs that the site
 *   already links through lib/links.ts. Nothing invented.
 * - Every structured-data object must describe something that
 *   actually exists on the page it is emitted into.
 *
 * This module imports no generated content and stays server-side:
 * it is consumed by app/ layouts and pages only.
 */

export const SITE_URL =
  ROUTE_REGISTRY.site.origin;

export const SITE_NAME =
  ROUTE_REGISTRY.site.name;

/*
 * The person behind the site. One name, shared by metadata authors,
 * publisher entities, and BlogPosting author objects so identity is
 * spelled identically everywhere.
 */
export const PERSON_NAME = "Parsa Tak";

export const SITE_DESCRIPTION =
  "Independent software engineer, product builder, and AI systems researcher — an evolving laboratory for AI systems, local AI agents, reasoning, evaluation, software engineering, and creative technology. Home of SHEYTAN, UHIT, FreeIran, and RED MAGIC.";

export const SITE_IN_LANGUAGE = "en";

/*
 * Home route title. One wording, shared by <title>, og:title, and
 * the WebPage structured data, so every representation of the home
 * route names it identically.
 *
 * v3.2 evolution: the title names the professional positioning —
 * independent software engineer, product builder, AI systems
 * researcher — while the description keeps the laboratory's
 * systems vocabulary (SHEYTAN, UHIT, FreeIran, RED MAGIC) for the
 * discovery surface.
 */
export const HOME_TITLE =
  "Parsa Tak — Software Engineer, Product Builder & AI Systems Researcher";

/*
 * Author tagline (v3.2) — one factual wording shared by the
 * /about/ route, the article author block, and anywhere identity
 * must be stated in prose. No credentials beyond what the site
 * actually presents.
 */
export const AUTHOR_TAGLINE =
  "Independent software engineer, product builder, and AI systems researcher.";

export const AUTHOR_RESEARCH_LINE =
  "Research: AI systems · local AI · reasoning · evaluation · software architecture";

/*
 * Stable @id anchors. Referenced from structured data emitted on
 * other routes (blog index, article pages) so all graphs interlock
 * into one site-wide entity model.
 */
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const PERSON_ID = `${SITE_URL}/#person`;

/*
 * Site-level Open Graph image (1200×630 PNG, committed at
 * public/og-default.png). Existence is validated by the build
 * pipeline. Root-relative on purpose: Next resolves metadata URLs
 * against metadataBase, which already carries /WEB.
 */
export const SITE_OG_IMAGE_PATH = "/og-default.png";

export const SITE_OG_IMAGE_WIDTH = 1200;
export const SITE_OG_IMAGE_HEIGHT = 630;

/*
 * Public profile URLs that legitimately identify "Parsa Tak" on
 * external services. Selected by id from lib/links.ts (the site's
 * link source of truth) so this list can never drift from what the
 * site actually publishes. Contact channels (email, PayPal,
 * Discord invites) are deliberately excluded — sameAs is
 * for identity profiles, not contact endpoints.
 */
const PROFILE_LINK_IDS: ReadonlySet<string> = new Set([
  "github",
  "x",
  "linkedin",
  "instagram",
  "youtube",
  "tiktok",
  "telegram-channel",
  "pinterest",
  "linktree"
]);

const PROFILE_URLS: readonly string[] = [
  ...PUBLIC_LINKS.social,
  ...PUBLIC_LINKS.resources,
  ...PUBLIC_LINKS.meta
]
  .filter((link) => PROFILE_LINK_IDS.has(link.id))
  .map((link) => link.href);

/*
 * Person entity — the author/creator identity of the site.
 * No image field: the site publishes a brand mark, not a photo,
 * and structured data must stay truthful. (The 13-point star is the
 * SITE identity mark; a Person is not an Organization, so no `logo`
 * property applies here either — v2.9 audited this and deliberately
 * keeps the graph free of an invented publisher organization.)
 *
 * Identity terms (AI Instructions, REP, USEF, SHEYTAN, RED MAGIC)
 * each appear exactly once and correspond to real marks the site
 * owner claims in TRADEMARKS.md and to work actually presented on
 * this site. Nothing here is a keyword list.
 *
 * v3.2 positioning: jobTitle mirrors the home hero kicker
 * ("SOFTWARE ENGINEER · PRODUCT BUILDER · AI SYSTEMS RESEARCHER")
 * in plain, crawlable wording; knowsAbout lists the capability
 * vocabulary the site presents — the home capabilities grid plus
 * the topic hubs (now including product building, which the shipped
 * systems (SHEYTAN's product decisions, FreeIran's packaging, this
 * website's design) demonstrate. Since v3.5 the home grid is exactly
 * eight entries and "Creative technology" is backed by its
 * /creative-technology/ hub and RED MAGIC presentations instead.
 */
export function personEntity() {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: "Parsa Tak",
    url: `${SITE_URL}/`,
    description:
      "Independent software engineer, product builder, and AI systems researcher. Builder of the SHEYTAN local-agent laboratory, the UHIT/AIST measurement programme, the FreeIran VPN manager, and the RED MAGIC experiments; author of the AI Instructions, REP, and USEF framework family.",
    jobTitle:
      "Independent software engineer, product builder, and AI systems researcher",
    knowsAbout: [
      "AI systems",
      "AI agents",
      "Reasoning",
      "AI evaluation",
      "Local AI",
      "Software engineering",
      "System architecture",
      "Product building",
      "Web engineering",
      "Simulation",
      "Creative technology"
    ],
    sameAs: PROFILE_URLS
  };
}

/*
 * WebSite entity — the site itself. Emitted exactly once, in the
 * root layout, so every page shares the same site identity object.
 */
export function websiteEntity() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: `${SITE_URL}/`,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    inLanguage: SITE_IN_LANGUAGE,
    author: { "@id": PERSON_ID },
    publisher: { "@id": PERSON_ID }
  };
}

/*
 * WebPage entity for the home route (the world shell). The home
 * page is a single canonical document — the six hash scenes are an
 * interaction architecture inside it, not separate SEO documents.
 * Since v2.7 the home scene is server-rendered, so the entity
 * carries the same description the page visibly leads with, and
 * names the featured projects the page actually presents.
 */
export function homeWebPageEntity() {
  return {
    "@type": "WebPage",
    "@id": `${SITE_URL}/#webpage`,
    url: `${SITE_URL}/`,
    name: HOME_TITLE,
    description:
      "Parsa Tak — researcher, builder, programmer, writer, and artist working on AI systems, reasoning frameworks, local AI agents, software engineering, and creative technology. Featured systems: SHEYTAN Local Agent, UHIT, FreeIran, and RED MAGIC.",
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": PERSON_ID },
    inLanguage: SITE_IN_LANGUAGE
  };
}

/*
 * CONTENT ROUTE ENTITIES (v3.1) — shared builders for the static
 * content documents (/about/, /work/, topic hubs). Each route gets
 * exactly one WebPage node referencing the stable site-wide @id
 * anchors (never a duplicate Person/WebSite) plus its own
 * BreadcrumbList describing the real navigation path.
 */

export type ContentRouteInput = {
  /** Route path with trailing slash, e.g. "about/" or "local-ai/". */
  route: string;
  /** Page name as rendered in <title> / og:title / WebPage.name. */
  name: string;
  /** Page description shared by meta + WebPage.description. */
  description: string;
  /**
   * WebPage type override — schema.org subtypes such as
   * "ProfilePage" (a page whose mainEntity is a person profile)
   * keep the same properties as WebPage (v3.2, used by /about/).
   */
  pageType?: string;
  /**
   * The page's subject matter. A schema.org value or @id reference —
   * only pass entities that the page genuinely describes.
   */
  about?: Record<string, unknown> | Record<string, unknown>[];
  /** The primary entity the page is about (e.g. Person on /about/). */
  mainEntity?: Record<string, unknown>;
};

export function contentBreadcrumbEntity(
  route: string,
  trail: readonly { name: string; href: string | null }[]
) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${SITE_URL}/${route}#breadcrumb`,
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.href ? { item: `${SITE_URL}${item.href}` } : {})
    }))
  };
}

export function contentWebPageEntity({
  route,
  name,
  description,
  pageType,
  about,
  mainEntity
}: ContentRouteInput) {
  return {
    "@type": pageType ?? "WebPage",
    "@id": `${SITE_URL}/${route}#webpage`,
    url: `${SITE_URL}/${route}`,
    name,
    description,
    isPartOf: { "@id": WEBSITE_ID },
    ...(about ? { about } : {}),
    ...(mainEntity ? { mainEntity } : {}),
    inLanguage: SITE_IN_LANGUAGE
  };
}

/*
 * JSON-LD script component — the single emission point for
 * structured data across the site. Serialised at build time into
 * static HTML; no client JavaScript involved.
 */
export function JsonLd({
  data
}: {
  data: Record<string, unknown> | Record<string, unknown>[];
}) {
  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data)
      }}
    />
  );
}
