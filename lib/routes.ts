/*
 * CANONICAL ROUTE REGISTRY — typed app-side loader (SEO v2).
 *
 * data/routes.json is the single source of truth for route identity on
 * WEB: every public route's path, kind, SEO metadata, sitemap policy,
 * structured-data expectations, navigation surfaces and hub
 * relationships are declared there — once.
 *
 * Consumers:
 * - scripts/build-blog.mjs   → derives the sitemap URL list
 * - scripts/verify-seo.mjs   → derives the verified route table and
 *                              the graph-depth thresholds
 * - lib/hubs.ts              → derives route metaTitle/metaDescription
 *                              and hub topic facts (this module)
 *
 * Before this registry existed, route facts were maintained in three
 * places (build-blog's STATIC_CONTENT_ROUTES, verify-seo's
 * CONTENT_ROUTES, lib/hubs' route definitions) and could drift; the
 * registry removes the duplication while keeping the same emitted
 * values. Articles are deliberately NOT listed in the registry — they
 * derive from content/blog/*.md through the blog pipeline.
 *
 * Server-side data module: no client component imports this file.
 */

import routesJson from "@/data/routes.json";

/*
 * Type-only import (v4.0.3): the page-identity vocabulary is owned by
 * the shared document shell; no runtime coupling is created.
 */
import type {
  FullScreenPageId
} from "@/components/FullScreenPageShell";

export type RouteKind =
  | "home"
  | "identity"
  | "collection"
  | "topic-hub"
  | "blog-index";

export type RegistryRoute = {
  /** Route path segment; "" for the home document. */
  path: string;

  kind: RouteKind;

  /** The page's own content-type vocabulary (profile, portfolio, …). */
  contentType: string;

  /** schema.org `about` concept name — topic hubs only. */
  topicName?: string;

  /** Full <title> — unique per route, ends with the site name. */
  title: string;

  /** Unique meta description / WebPage.description. */
  description: string;

  sitemap: {
    include: boolean;

    /**
     * Content-revision date, null (never invented), or the literal
     * "latest-article" (blog index — derived from the content index).
     */
    lastmod: string | null | "latest-article";
  };

  /** JSON-LD types expected on the route's exported document. */
  structuredData: string[];

  /** Navigation surfaces carrying this route (documentation + verifier). */
  nav: string[];

  /** Minimum inbound pages the SEO verifier requires. */
  inboundMinimum: number;
};

export type RouteRegistry = {
  site: {
    name: string;
    origin: string;
    basePath: string;
    basePathEnv: string;
    titleSuffix: string;
  };

  routes: RegistryRoute[];

  dynamicFamilies: {
    pathPattern: string;
    source: string;
    registry: string;
    kind: string;
    contentType: string[];
    titleSuffixFrom: string;
    sitemap: { include: boolean; lastmod: string };
    structuredData: string[];
    inboundMinimum: number;
  }[];

  scenes: {
    $comment: string;
    names: string[];
  };
};

/*
 * The JSON is authored once and validated by the SEO verifier; the
 * cast keeps the app-side shape strict without duplicating a schema.
 */
export const ROUTE_REGISTRY =
  routesJson as unknown as RouteRegistry;

/** Registry order is sitemap order: home is "" and handled separately. */
export const REGISTRY_ROUTES: RegistryRoute[] =
  ROUTE_REGISTRY.routes;

/** Look up a route's registry entry by path segment ("" = home). */
export function getRegistryRoute(
  path: string
): RegistryRoute | null {
  return (
    REGISTRY_ROUTES.find(
      (route) =>
        route.path === path
    ) ?? null
  );
}

/*
 * HEADER STATUS RESOLVER (v4.0.5) — the visible header identity for
 * ContentShell routes, derived from the SAME registry that owns SEO
 * and sitemap facts (data/routes.json → lib/routes.ts). No second
 * route registry, no duplicated titles:
 *
 *   ""                      → "HOME"
 *   /about/                 → "ABOUT"
 *   /work/                  → "WORK"
 *   /research/              → "RESEARCH"
 *   /blog/                  → "BLOG"
 *   /contact/               → "CONTACT"
 *   /local-ai/              → "LOCAL AI"
 *   /ai-systems/            → "AI SYSTEMS"
 *   /ai-reasoning/          → "AI REASONING"
 *   /ai-evaluation/         → "AI EVALUATION"
 *   /software-engineering/  → "SOFTWARE ENGINEERING"
 *   /creative-technology/   → "CREATIVE TECHNOLOGY"
 *
 * The label IS the registry path — normalized to the site's uppercase
 * identity vocabulary — so every registered route resolves correctly
 * and a route added to the registry automatically earns its header
 * identity. An unregistered path resolves to null and the host
 * header renders no status: identities are never invented.
 * (World scenes are NOT resolved here — their labels come from the
 * live scene definition inside LivingShell.)
 */
export function headerStatusForRoutePath(
  path: string | undefined
): string | null {
  if (!path) {
    return null;
  }

  /* Strip leading/trailing slashes: "/about/" → "about". */
  const segment = path.replace(/^\/+/, "").replace(/\/+$/, "");

  if (segment === "") {
    return "HOME";
  }

  const route = getRegistryRoute(segment);

  if (!route) {
    return null;
  }

  return segment.replace(/-/g, " ").toUpperCase();
}

/*
 * PAGE IDENTITY RESOLVER (v4.0.3) — the shared document shell's
 * per-tab identity (FullScreenPageShell's `data-page` accent layer)
 * is derived from the route REGISTRY instead of a hardcoded switch:
 *
 *   ""                      → "home"
 *   about / work / research
 *   / blog / contact        → the route's own path IS the identity
 *   topic-hub kind          → "hub" (neutral shared identity)
 *   unregistered path       → "hub" (safe fallback)
 *
 * Adding a primary document route to data/routes.json therefore
 * grants it an identity automatically; no shell-side switch can grow
 * stale or forget a route. Topic hubs deliberately do NOT claim a
 * primary tab identity — they share the neutral "hub" accent of the
 * document shell.
 */
export function pageIdForRoutePath(
  path: string | undefined
): FullScreenPageId {
  if (!path) {
    return "hub";
  }

  /* Strip leading/trailing slashes: "/about/" → "about". */
  const segment = path.replace(/^\/+/, "").replace(/\/+$/, "");

  if (segment === "") {
    return "home";
  }

  const route = getRegistryRoute(segment);

  if (!route) {
    return "hub";
  }

  if (route.kind === "topic-hub") {
    return "hub";
  }

  const identity: FullScreenPageId[] = [
    "about",
    "work",
    "research",
    "blog",
    "contact"
  ];

  return identity.includes(route.path as FullScreenPageId)
    ? (route.path as FullScreenPageId)
    : "hub";
}


/**
 * Route meta for the static content documents — the values
 * lib/hubs.ts renders into <title>/description/canonical metadata.
 * A missing registry entry throws at module init: a content route
 * without registry facts must fail the build, never ship thin.
 */
export function requireRouteMeta(
  path: string
): RegistryRoute {
  const route =
    getRegistryRoute(path);

  if (!route) {
    throw new Error(
      `Route "${path}" is missing from data/routes.json — every content route must be registered.`
    );
  }

  return route;
}

/**
 * Hub variant: like requireRouteMeta but additionally guarantees the
 * route is a topic hub carrying a topicName (the schema.org `about`
 * concept). Used by lib/hubs.ts for the six HUB_ROUTES entries.
 */
export function requireHubMeta(
  path: string
): RegistryRoute & {
  topicName: string;
} {
  const route =
    requireRouteMeta(path);

  if (
    route.kind !==
      "topic-hub" ||
    !route.topicName
  ) {
    throw new Error(
      `Route "${path}" must be registered as a topic hub with topicName in data/routes.json.`
    );
  }

  return route as RegistryRoute & {
    topicName: string;
  };
}

/** All topic-hub paths, registry order. */
export function getHubPaths(): string[] {
  return REGISTRY_ROUTES.filter(
    (route) =>
      route.kind === "topic-hub"
  ).map((route) => route.path);
}

/** World-shell scene names (interaction states, never documents). */
export function getSceneNames(): string[] {
  return ROUTE_REGISTRY.scenes.names;
}
