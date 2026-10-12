#!/usr/bin/env node
/*
 * verify-export-routes.mjs — route-set verification for the static export.
 *
 * Runs against out/ AFTER `next build`. Replaces the obsolete workflow
 * inline check (`article_count + 2`), which hard-failed the moment v3.1
 * added eight indexable content routes: the sitemap correctly listed 19
 * URLs while the formula expected 11.
 *
 * Design law: NO hardcoded route counts. The expected route set is
 * DERIVED from the two real sources of truth and cross-checked against
 * the two real artifacts in a three-way bijection:
 *
 *   app/**\/page.tsx (+ data/blog/posts.json slug registry)
 *        ==  exported out/**\/index.html
 *        ==  out/sitemap.xml <loc> set
 *
 * This stays correct when article count changes, hubs change, routes
 * are added or removed — any drift between source, export, and sitemap
 * fails the build instead of shipping.
 *
 * Deliberately catches:
 * - sitemap route exists but export missing
 * - exported indexable route omitted from sitemap
 * - duplicate sitemap URL
 * - wrong basePath / non-production / localhost URL
 * - temporary, hash, query, _next, feed, deployment URLs in sitemap
 * - unknown route in sitemap (no exported route)
 * - article route missing
 * - content hub missing
 * - app source route that never made it into the export
 *
 * Zero runtime dependencies, same as verify-seo.mjs. The sitemap path
 * set is additionally compared against the source-derived set by
 * verify-seo.mjs (CONTENT_ROUTES registry), so registry drift is
 * enforced transitively: sitemap is GENERATED from build-blog.mjs's
 * registry, so registry != app tree fails here.
 */

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const OUT_DIR = path.join(ROOT, "out");
const APP_DIR = path.join(ROOT, "app");

/*
 * CANONICAL SITE ORIGIN (SEO v2 hardening, v2.1): derived from
 * data/routes.json — the same registry lib/seo.tsx, build-blog.mjs and
 * verify-seo.mjs read — instead of a mirror literal. The production
 * origin is the only legal sitemap URL base; anything else (localhost,
 * http://, repository URLs, a missing /WEB basePath) is a deployment
 * bug and must fail CI.
 */
const SITE_ORIGIN = JSON.parse(
  await readFile(path.join(ROOT, "data", "routes.json"), "utf8")
).site.origin;

/*
 * Exported routes that exist on disk but are deliberately NOT
 * indexable documents. Everything else carrying an index.html is an
 * indexable route and MUST appear in the sitemap exactly once. A new
 * private/implementation route must be consciously added here — the
 * default is "indexable", so forgetting is a build failure, not a
 * silent SEO hole.
 */
const NON_INDEXABLE_ROUTES = new Set([
  "404", /* served from 404.html; never a crawlable document */
  "_not-found" /* Next.js internal mirror of the not-found page */
]);

/*
 * Directory subtrees that are implementation assets, never routes.
 * Pruned from the export walk for speed and clarity.
 */
const PRUNED_EXPORT_DIRS = new Set(["_next"]);

const failures = [];
const checks = [];

function fail(message) {
  failures.push(message);
}

function pass(message) {
  checks.push(message);
}

/* ------------------------------------------------------------------ */
/* Source route set: app/**\/page.tsx + posts.json slug registry      */
/* ------------------------------------------------------------------ */

/*
 * Walks app/ for page.tsx files and converts directory structure into
 * route paths. Route groups (dir), parallel (@dir) and dynamic
 * ([dir]) segments are understood; dynamic segments are expanded from
 * the content registry they belong to (currently the blog slug
 * registry — the only dynamic route in the app).
 */
async function collectSourceRoutes() {
  const routes = new Set();
  const dynamicRoutes = [];

  /* The root route: app/page.tsx directly under app/. */
  if (existsSync(path.join(APP_DIR, "page.tsx"))) {
    routes.add("/");
  }

  async function walk(dir, segments) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      /* Route groups / parallel routes do not appear in URLs. */
      if (entry.name.startsWith("(") || entry.name.startsWith("@")) {
        await walk(path.join(dir, entry.name), segments);
        continue;
      }

      const nextSegments = [...segments, entry.name];
      const dirPath = path.join(dir, entry.name);
      const hasPage = existsSync(path.join(dirPath, "page.tsx"));

      if (entry.name.startsWith("[")) {
        if (hasPage) {
          dynamicRoutes.push(nextSegments);
        }
        continue;
      }

      if (hasPage) {
        routes.add(segmentsToRoute(nextSegments));
      }

      await walk(dirPath, nextSegments);
    }
  }

  await walk(APP_DIR, []);

  /* Expand dynamic routes from their content registries. */
  for (const segments of dynamicRoutes) {
    const dynamicIndex = segments.findIndex((name) => name.startsWith("["));

    if (
      dynamicIndex !== segments.length - 1 ||
      segments[dynamicIndex] !== "[slug]" ||
      segments[0] !== "blog"
    ) {
      fail(
        `source route ${segmentsToRoute(segments)}: dynamic segment not registered with a content registry — extend verify-export-routes.mjs`
      );
      continue;
    }

    const postsIndex = JSON.parse(
      await readFile(path.join(ROOT, "data", "blog", "posts.json"), "utf8")
    );
    const slugs = postsIndex.posts.map((post) => post.slug);

    if (slugs.length === 0) {
      fail("data/blog/posts.json: no articles registered");
    }

    for (const slug of slugs) {
      routes.add(segmentsToRoute([...segments.slice(0, dynamicIndex), slug]));
    }
  }

  return routes;
}

function segmentsToRoute(segments) {
  return `/${segments.join("/")}/`;
}

/* ------------------------------------------------------------------ */
/* Exported route set: out/**\/index.html                             */
/* ------------------------------------------------------------------ */

async function collectExportedRoutes() {
  const routes = new Set();

  async function walk(dir, segments) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (PRUNED_EXPORT_DIRS.has(entry.name)) {
          continue;
        }

        await walk(fullPath, [...segments, entry.name]);
        continue;
      }

      if (entry.name === "index.html") {
        routes.add(
          segments.length === 0 ? "/" : segmentsToRoute(segments)
        );
      }
    }
  }

  await walk(OUT_DIR, []);

  return routes;
}

/* ------------------------------------------------------------------ */
/* Sitemap path set                                                   */
/* ------------------------------------------------------------------ */

function collectSitemapPaths(xml) {
  const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(
    (match) => match[1]
  );

  const paths = new Set();
  const seenRaw = new Map();

  for (const loc of locs) {
    seenRaw.set(loc, (seenRaw.get(loc) ?? 0) + 1);

    if (!loc.startsWith(`${SITE_ORIGIN}/`)) {
      fail(
        `sitemap.xml: non-production URL (wrong basePath, localhost, or http): "${loc}"`
      );
      continue;
    }

    const routePath = loc.slice(SITE_ORIGIN.length);

    if (routePath.includes("#") || routePath.includes("?")) {
      fail(`sitemap.xml: temporary/hash/query URL included: "${loc}"`);
      continue;
    }

    if (
      routePath.includes("_next") ||
      routePath.includes("feed.xml") ||
      routePath.includes("deployments/") ||
      routePath.endsWith(".json") ||
      routePath.endsWith(".xml") ||
      routePath.endsWith(".txt")
    ) {
      fail(
        `sitemap.xml: implementation/metadata URL included: "${loc}"`
      );
      continue;
    }

    if (!routePath.endsWith("/")) {
      fail(`sitemap.xml: URL without trailing slash: "${loc}"`);
      continue;
    }

    paths.add(routePath);
  }

  for (const [loc, count] of seenRaw) {
    if (count > 1) {
      fail(`sitemap.xml: duplicate sitemap URL (${count}×): "${loc}"`);
    }
  }

  return { locs, paths };
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  if (!existsSync(OUT_DIR)) {
    console.error(
      "[export] out/ does not exist — run `npm run build` first."
    );
    process.exit(1);
  }

  /* Core artifacts must exist before route analysis is meaningful. */
  for (const artifact of [
    "index.html",
    "blog/index.html",
    "sitemap.xml",
    "robots.txt",
    "og-default.png"
  ]) {
    if (existsSync(path.join(OUT_DIR, artifact))) {
      pass(`artifact present: ${artifact}`);
    } else {
      fail(`required artifact missing from export: ${artifact}`);
    }
  }

  if (existsSync(path.join(OUT_DIR, "blog", "feed.xml"))) {
    fail("blog/feed.xml: present in export (RSS was removed in v2.5)");
  } else {
    pass("blog/feed.xml: absent from export as intended");
  }

  const sourceRoutes = await collectSourceRoutes();
  const exportedRoutes = await collectExportedRoutes();

  /* Split the export into indexable documents and known private routes. */
  const indexableExported = new Set();
  const nonIndexableExported = new Set();

  for (const route of exportedRoutes) {
    const key = route.replace(/^\/|\/$/g, "");

    if (NON_INDEXABLE_ROUTES.has(key)) {
      nonIndexableExported.add(route);
    } else {
      indexableExported.add(route);
    }
  }

  for (const route of nonIndexableExported) {
    pass(`non-indexable route exported (excluded from sitemap): ${route}`);
  }

  /* BIJECTION 1: source routes must exist in the export. */
  for (const route of sourceRoutes) {
    if (!indexableExported.has(route)) {
      fail(`source route never exported (app/ has page.tsx, out/ does not): ${route}`);
    }
  }

  for (const route of indexableExported) {
    if (!sourceRoutes.has(route)) {
      fail(`unknown exported route (out/ has index.html, app/ has no page for it): ${route}`);
    }
  }

  if (failures.length === 0) {
    pass(
      `source ↔ export: ${sourceRoutes.size} app route(s) all exported, no unknown exports`
    );
  }

  /* Article + hub sanity (explicit, for precise error messages). */
  let articleCount = 0;
  let hubCount = 0;

  for (const route of sourceRoutes) {
    if (route.startsWith("/blog/") && route !== "/blog/") {
      articleCount += 1;
    }
  }

  for (const route of sourceRoutes) {
    if (
      route !== "/" &&
      route !== "/blog/" &&
      !route.startsWith("/blog/")
    ) {
      hubCount += 1;
    }
  }

  if (articleCount === 0) {
    fail("No blog article pages were exported.");
  } else {
    pass(`${articleCount} article route(s), ${hubCount} content hub route(s)`);
  }

  /* BIJECTION 2: sitemap must mirror the indexable export exactly. */
  const sitemapXml = await readFile(
    path.join(OUT_DIR, "sitemap.xml"),
    "utf8"
  );
  const { locs, paths } = collectSitemapPaths(sitemapXml);

  if (locs.length === 0) {
    fail("sitemap.xml: no <loc> entries found");
  }

  for (const route of paths) {
    if (!indexableExported.has(route)) {
      if (exportedRoutes.has(route)) {
        fail(`sitemap route exists but export is non-indexable: ${route}`);
      } else {
        fail(`sitemap route exists but export missing: ${route}`);
      }
    }
  }

  for (const route of indexableExported) {
    if (!paths.has(route)) {
      fail(`exported indexable route omitted from sitemap: ${route}`);
    }
  }

  if (failures.length === 0) {
    pass(
      `sitemap ↔ export: ${paths.size} URL(s) match ${indexableExported.size} indexable route(s) exactly, no duplicates`
    );
  }

  console.log(`\n[export] ${checks.length} check(s) passed`);
  for (const entry of checks) {
    console.log(`  ✓ ${entry}`);
  }

  if (failures.length > 0) {
    console.error(`\n[export] ${failures.length} FAILURE(S):`);
    for (const failure of failures) {
      console.error(`  ✗ ${failure}`);
    }
    process.exit(1);
  }

  console.log("\n[export] static export route verification passed.");
}

main().catch((error) => {
  console.error("[export] unexpected verification failure:", error);
  process.exit(1);
});
