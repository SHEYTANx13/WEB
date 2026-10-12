#!/usr/bin/env node
/*
 * verify-seo.mjs — static SEO verification for the exported site.
 *
 * Runs against out/ AFTER `next build` (static export). Checks the
 * generated HTML/XML directly — the same artifacts crawlers receive
 * — and fails loudly with a report when something is wrong.
 *
 * Zero runtime dependencies. Checked in so the same verification
 * runs locally, in CI, and on any future clone.
 *
 * Check groups (each group is one function, run from main()):
 * - page metadata          verifyPage            — title, description,
 *   canonical, og:image, robots, Search Console token, JSON-LD types
 *   per canonical route; canonical/og URLs must be absolute, HTTPS,
 *   production-host, /WEB-aware (no localhost, no repository URLs,
 *   no /blog/undefined)
 * - articles               main()                — BlogPosting
 *   headline/date/author match the content index; BreadcrumbList
 *   present
 * - homepage content       verifyHomeContent     — one h1 inside <main>,
 *   no streamed-Suspense wrapper, capability/project/workflow
 *   vocabulary in the visible HTML
 * - writing links          verifyContentDiscoveryLinks — ≥3 crawlable
 *   article links, every target a real exported route, basePath-aware
 *   (local /blog/<slug>/, GitHub Pages /WEB/blog/<slug>/)
 * - blog content discovery verifyBlogContentDiscovery (v3.7) — the
 *   Blog is the content hub: crawlable article links, crawlable
 *   /work/ and /research/ links (the canonical collections), the
 *   content-type modes present, every content type valid and
 *   non-orphaned, and the new four-entry primary navigation
 * - interaction anchors    verifyInteractivity   — no dead anchors,
 *   every internal href resolves to an exported file, media src
 *   resolves, label punctuation QA
 * - link graph             verifyInternalLinkGraph — article/scene
 *   hrefs resolve, no localhost, no repository-clone URLs, orphan
 *   report
 * - sitemap                verifySitemap         — URL set equals the
 *   exported route set (incl. v3.1 content routes), production HTTPS,
 *   content-date lastmod
 * - robots                 verifyRobots          — production sitemap
 *   directive
 * - RSS policy             verifyNoRss           — feed.xml absent and
 *   unreferenced anywhere (the blog deliberately has no feed)
 * - favicon + brand assets verifyFaviconFamily / verifyBrandAssetsInExport
 * - content graph (v3.1)   verifyContentGraph    — /about/, /work/, and
 *   the topic hubs exist with full metadata, are linked from the home
 *   document, link ≥3 related articles (hubs), and have ≥3 inbound
 *   pages each — no SEO islands
 * - graph depth (SEO v2)   verifySeoGraphDepth   — graph QUALITY:
 *   inbound census per content page, orphan/orphan-adjacent articles,
 *   hub/collection representation percentage, collection
 *   discoverability, anchor-text quality, canonical↔sitemap coherence
 * - metadata quality (v4.0.4) verifyMetadataQuality — site-wide title/
 *   description uniqueness census, length sanity, twitter:card +
 *   twitter:image:alt coherence, og:image dimension declarations
 * - canonical integrity (v4.0.4) verifyCanonicalUniqueness — each
 *   canonical URL is claimed by exactly one exported page
 * - entity graph (v4.0.4)  verifyEntityGraphIntegrity — per-page
 *   unique JSON-LD @ids; singular Person/WebSite identity nodes
 * - WhatsApp ban (v4.0.4)  verifyNoWhatsAppRemnants — the channel was
 *   removed from the project; any occurrence in the export fails
 */

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const OUT_DIR = path.join(ROOT, "out");

/*
 * CANONICAL SITE FACTS (SEO v2 hardening, v2.1): origin, basePath and
 * the world-shell scene vocabulary are DERIVED from data/routes.json —
 * the single manually maintained registry (the same file
 * build-blog.mjs and lib/routes.ts read). No mirror literals here.
 */
const ROUTE_REGISTRY = JSON.parse(
  await readFile(path.join(ROOT, "data", "routes.json"), "utf8")
);

const SITE_ORIGIN = ROUTE_REGISTRY.site.origin;

/*
 * Google Search Console verification token (v2.9). Emitted once from
 * the root layout's metadata.verification field; every canonical page
 * must carry it EXACTLY, and CI fails the moment it disappears or is
 * altered. This is a public verification token, not a secret.
 */
const GOOGLE_SITE_VERIFICATION =
  "K8PQwvcGcrpBCyR-6XbmnDhv2IFPxpxjXV90UY7glTo";

/*
 * Mirror next.config.ts / build-blog.mjs: exported hrefs carry the
 * deployment basePath in CI, but the out/ tree itself is NOT
 * basePath-prefixed — strip it before resolving hrefs to files. The
 * VALUE comes from the registry; only the CI gate is environmental.
 */
const BASE_PATH =
  process.env.GITHUB_ACTIONS === "true"
    ? ROUTE_REGISTRY.site.basePath
    : "";

/*
 * Hash scenes of the world shell — interaction states, not
 * documents (registry scenes.names; see LivingShell.tsx SCENES).
 * Legal hrefs on the home route; never sitemap entries; exempt from
 * in-page anchor resolution because the shell handles them through
 * SceneUrlSync.
 */
const SCENE_HASHES = new Set(
  ROUTE_REGISTRY.scenes.names
);

/*
 * v4.0.0 Media migration: the former #library scene hash resolves as
 * a backward-compatible alias of the canonical #media (see
 * LivingShell.tsx SCENE_ID_ALIASES / SceneUrlSync). Links published
 * before the migration must keep verifying.
 */
SCENE_HASHES.add("library");

/*
 * CANONICAL ROUTE REGISTRY (SEO v2) — data/routes.json is the single
 * manually maintained route list (read once above); the route table
 * below (titles, JSON-LD type expectations, hub classification,
 * inbound minimums) is DERIVED from it. The same registry drives the
 * sitemap generator in scripts/build-blog.mjs and lib/routes.ts on
 * the app side, so the sitemap, the app routes and this verifier can
 * never drift apart silently — a route added to one place but not the
 * registry fails here, and a registry route without an export fails
 * too.
 */
const CONTENT_ROUTES = ROUTE_REGISTRY.routes
  .filter(
    (route) =>
      route.path !== "" && route.path !== "blog"
  )
  .map((route) => ({
    route: route.path,
    kind: route.kind,
    title: route.title,
    types: route.structuredData,
    inboundMinimum:
      route.inboundMinimum ?? 3
  }));

const failures = [];
const checks = [];

function fail(message) {
  failures.push(message);
}

function pass(message) {
  checks.push(message);
}

function requireString(haystack, needle, label, file) {
  if (!haystack.includes(needle)) {
    fail(`${file}: missing ${label} (expected "${needle}")`);
    return false;
  }
  return true;
}

/* Decode the small set of entities Next escapes into <title>. */
function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'");
}

function extractMatch(haystack, pattern, label, file) {
  const match = haystack.match(pattern);
  if (!match) {
    fail(`${file}: could not extract ${label}`);
    return null;
  }
  return match[1];
}

function extractJsonLdBlocks(html) {
  const blocks = [];
  const pattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

async function readText(relativePath) {
  return readFile(path.join(OUT_DIR, relativePath), "utf8");
}

/*
 * Visible-text projection: strip scripts, styles, and markup so the
 * checks below read exactly what a crawler's renderer sees before
 * any JavaScript runs.
 */
function toVisibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

/* -------------------------------------------------------------------------- */

async function verifyPage(route, file, expectations) {
  if (!existsSync(path.join(OUT_DIR, file))) {
    fail(`${route}: exported file missing: ${file}`);
    return;
  }

  const html = await readText(file);

  /*
   * RSS must not exist anywhere (v2.5). The blog deliberately has no
   * feed: no autodiscovery <link>, no feed.xml href, nothing.
   */
  if (html.includes("application/rss+xml")) {
    fail(`${route}: RSS autodiscovery found (RSS was removed in v2.5)`);
  }
  if (html.includes("feed.xml")) {
    fail(`${route}: reference to feed.xml found (RSS was removed in v2.5)`);
  }

  /* Exactly one <title> */
  const titleMatches = html.match(/<title[^>]*>([\s\S]*?)<\/title>/g) ?? [];
  const titleText =
    titleMatches.length === 1
      ? decodeEntities(titleMatches[0].replace(/<\/?title[^>]*>/g, ""))
      : null;
  if (titleMatches.length !== 1) {
    fail(`${route}: expected exactly one <title>, found ${titleMatches.length}`);
  } else if (expectations.title && titleText !== expectations.title) {
    fail(`${route}: title is "${titleText}", expected "${expectations.title}"`);
  } else {
    pass(`${route}: one <title> "${titleText ?? "(present)"}"`);
  }

  /* Description */
  const description = extractMatch(
    html,
    /<meta name="description" content="([^"]*)"/,
    "meta description",
    file
  );
  if (description) {
    if (description.trim() === "") {
      fail(`${route}: empty meta description`);
    } else if (expectations.description && description !== expectations.description) {
      fail(`${route}: description mismatch — expected "${expectations.description}" got "${description}"`);
    } else {
      pass(`${route}: meta description present`);
    }
  }

  /* Canonical */
  const canonical = extractMatch(
    html,
    /<link rel="canonical" href="([^"]*)"/,
    "canonical link",
    file
  );
  if (canonical) {
    const expected = expectations.canonical;
    if (canonical !== expected) {
      fail(`${route}: canonical is "${canonical}", expected "${expected}"`);
    } else if (!/^https:\/\/parsaetak\.github\.io\/WEB\//.test(canonical)) {
      fail(`${route}: canonical is not a production HTTPS URL: "${canonical}"`);
    } else {
      pass(`${route}: canonical ${canonical}`);
    }
  }

  /* Open Graph URL */
  const ogUrl = extractMatch(html, /<meta property="og:url" content="([^"]*)"/, "og:url", file);
  if (ogUrl && !ogUrl.startsWith(SITE_ORIGIN)) {
    fail(`${route}: og:url is not production: "${ogUrl}"`);
  }

  /* OG image present and production-resolvable */
  const ogImage = extractMatch(html, /<meta property="og:image" content="([^"]*)"/, "og:image", file);
  if (ogImage) {
    if (!ogImage.startsWith(SITE_ORIGIN)) {
      fail(`${route}: og:image is not an absolute production URL: "${ogImage}"`);
    } else {
      const assetPath = ogImage.replace(SITE_ORIGIN, "");
      if (!existsSync(path.join(OUT_DIR, assetPath.replace(/^\//, "")))) {
        fail(`${route}: og:image asset missing from export: ${assetPath}`);
      } else {
        pass(`${route}: og:image ${assetPath}`);
      }
    }
  } else {
    fail(`${route}: og:image missing`);
  }

  /* Robots policy (Next emits "index, follow") */
  if (!/<meta name="robots" content="index,\s?follow"\/>/.test(html)) {
    fail(`${route}: missing robots meta (expected index,follow)`);
  } else {
    pass(`${route}: robots meta index,follow`);
  }

  /*
   * SEARCH CONSOLE VERIFICATION (v2.9): every canonical page must
   * carry the exact google-site-verification meta tag, exactly once,
   * with the token byte-preserved. Disappearing or mutated tokens are
   * a build failure — the tag is the site's ownership proof for
   * Google Search Console.
   */
  const verificationPattern = new RegExp(
    `<meta name="google-site-verification" content="${GOOGLE_SITE_VERIFICATION}"\\s*/>`,
    "g"
  );
  const verificationCount = (html.match(verificationPattern) ?? []).length;
  if (verificationCount !== 1) {
    fail(
      `${route}: google-site-verification meta tag must appear exactly once with the exact token (found ${verificationCount})`
    );
  } else {
    pass(`${route}: google-site-verification token present and exact`);
  }

  /* JSON-LD validity + expected types */
  const blocks = extractJsonLdBlocks(html);
  if (blocks.length === 0) {
    fail(`${route}: no JSON-LD emitted`);
  }

  const presentTypes = new Set();
  for (const block of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(block);
    } catch (error) {
      fail(`${route}: JSON-LD does not parse: ${error.message}`);
      continue;
    }

    const graph = parsed["@graph"] ?? [parsed];
    for (const node of graph) {
      const type = node?.["@type"];
      if (typeof type === "string") {
        presentTypes.add(type);
      }
    }

    /* No localhost / undefined anywhere inside structured data */
    if (block.includes("localhost") || block.includes("/blog/undefined")) {
      fail(`${route}: JSON-LD contains forbidden URL fragments`);
    }
  }

  for (const expectedType of expectations.types) {
    if (!presentTypes.has(expectedType)) {
      fail(`${route}: expected ${expectedType} structured data, found [${[...presentTypes].join(", ")}]`);
    }
  }
  if (expectations.types.length > 0) {
    pass(`${route}: structured data [${expectations.types.join(", ")}] valid`);
  }

  /* Forbidden strings anywhere in the document head area */
  if (html.includes("localhost")) {
    fail(`${route}: page references localhost`);
  }
  if (html.includes("/blog/undefined")) {
    fail(`${route}: page references /blog/undefined`);
  }
}

/* -------------------------------------------------------------------------- */

async function collectArticleRoutes() {
  const blogDir = path.join(OUT_DIR, "blog");
  const entries = await readdir(blogDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && entry.name !== "images")
    .map((entry) => entry.name)
    .sort();
}

/* -------------------------------------------------------------------------- */
/* Interaction audit (v2.4)                                                    */
/* -------------------------------------------------------------------------- */

async function collectHtmlFiles(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectHtmlFiles(full, base)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(path.relative(base, full));
    }
  }
  return files.sort();
}

/*
 * Interaction audit (v2.4).
 *
 * Hash scene hrefs (#magic, #systems, …) are interaction states of
 * the home route — legal hrefs, never sitemap entries. In-page
 * anchors (#top) are likewise legal. Everything else must resolve.
 */
async function verifyInteractivity() {
  const htmlFiles = await collectHtmlFiles(OUT_DIR);
  if (htmlFiles.length === 0) {
    fail("interaction: no exported HTML files found");
    return;
  }

  let hrefsChecked = 0;
  let fragmentsChecked = 0;
  let labelIssues = 0;

  for (const file of htmlFiles) {
    const html = await readFile(path.join(OUT_DIR, file), "utf8");
    const label = file;

    /* Dead anchor targets */
    if (/\shref="#["\s>]/.test(html)) {
      fail(`${label}: dead href="#" found (placeholder destination)`);
    }
    if (/\shref="["\s>]/.test(html)) {
      fail(`${label}: empty href found`);
    }
    if (/href="javascript:/i.test(html)) {
      fail(`${label}: javascript: URL found`);
    }

    /* Every href must be absolute-external or resolvable-internal */
    const hrefs = [...html.matchAll(/\shref="([^"]*)"/g)].map((match) =>
      decodeEntities(match[1])
    );

    /*
     * SAME-PAGE FRAGMENT VALIDATION (v2.5.2): every in-document
     * anchor (`href="#section"` — TOC links, heading self-links)
     * must point at a REAL id in the same document. A heading rename
     * that breaks a deep-link is now a build failure, not a silent
     * dead anchor. (Bare `href="#"` placeholders are already
     * rejected above.)
     */
    const documentIds = new Set(
      [...html.matchAll(/\sid="([^"]+)"/g)].map((match) =>
        decodeEntities(match[1])
      )
    );

    for (const href of hrefs) {
      if (href.startsWith("#") && href.length > 1) {
        /*
         * SCENE HASHES (v2.7 / v4.0.0): #home, #about, #systems,
         * #magic, #work, #media are interaction states of the world
         * shell handled by SceneUrlSync (#library remains legal as a
         * backward-compatible alias of #media). They are not document
         * anchors and are exempt from in-page id resolution (they
         * were invisible to this check before the home scene became
         * server-rendered in v2.7).
         */
        if (SCENE_HASHES.has(href.slice(1))) {
          continue;
        }
        fragmentsChecked += 1;
        if (!documentIds.has(href.slice(1))) {
          fail(`${label}: in-page href "${href}" matches no id in the document`);
        }
      }
    }

    for (const href of hrefs) {
      hrefsChecked += 1;

      if (
        /^https?:\/\//i.test(href) ||
        /^mailto:/i.test(href) ||
        href.startsWith("#")
      ) {
        continue;
      }

      /*
       * Root-relative path. Strip the deployment basePath first (CI
       * hrefs are /WEB/… while out/ holds the un-prefixed tree),
       * then drop any fragment/query before resolving to a file.
       */
      const unbased = BASE_PATH !== "" && href.startsWith(BASE_PATH)
        ? href.slice(BASE_PATH.length)
        : href;
      const clean = unbased.split("#")[0].split("?")[0];
      if (clean === "" || clean === "/") {
        continue;
      }

      const target = path.join(OUT_DIR, clean.replace(/^\//, ""));
      const targetDir = `${target}${target.endsWith("/") ? "" : "/"}`;
      const indexCandidates = [
        target.endsWith("/") ? `${target}index.html` : target,
        targetDir.length > 0 ? `${targetDir}index.html` : null,
        target
      ].filter(Boolean);

      if (!indexCandidates.some((candidate) => existsSync(candidate))) {
        fail(`${label}: internal href does not resolve to an exported route: "${href}"`);
      }
    }

    /* Uppercase label-style text must not end with a terminal "." */
    const labelMatches = html.match(
      />([^<>{}]*[A-Z]{2,}[^<>{}]*?)\.+</g
    );
    if (labelMatches) {
      for (const match of labelMatches) {
        const text = match.slice(1, -2).trim();
        /*
         * Only flag text that is essentially label-case: letters,
         * digits, spaces, and separators, dominated by uppercase
         * words (prose sentences are sentence-case and never match).
         */
        if (
          /^[A-Z0-9][A-Z0-9 ·,/&—–-]*(?:\s+[A-Z0-9][A-Z0-9 ·,/&—–-]*)*$/.test(
            text
          ) &&
          (text.match(/[A-Z]/g) ?? []).length >
            (text.match(/[a-z]/g) ?? []).length
        ) {
          fail(`${label}: uppercase label ends with a terminal period: "${text}."`);
          labelIssues += 1;
        }
      }
    }
  }

  /*
   * MEDIA EXISTENCE (v2.8.1): every internal <img src> and favicon
   * reference in the export must point at a file that actually ships.
   * Broken image references were previously invisible to this
   * pipeline (href auditing never looked at src attributes) — a
   * renamed or deleted asset is now a build failure instead of a
   * silent 404 for visitors and crawlers.
   */
  let mediaChecked = 0;

  for (const file of htmlFiles) {
    const html = await readFile(path.join(OUT_DIR, file), "utf8");
    const label = file;
    const srcs = [...html.matchAll(/\ssrc="([^"]+)"/g)].map((match) =>
      decodeEntities(match[1])
    );

    for (const src of srcs) {
      if (!/\.(png|jpe?g|svg|webp|avif|gif|ico)(\?|$)/i.test(src)) {
        continue;
      }

      if (/^(https?:)?\/\//i.test(src) || src.startsWith("data:")) {
        continue;
      }

      mediaChecked += 1;

      const unbased =
        BASE_PATH !== "" && src.startsWith(BASE_PATH)
          ? src.slice(BASE_PATH.length)
          : src;
      const clean = unbased.split("?")[0].split("#")[0];

      if (!existsSync(path.join(OUT_DIR, clean.replace(/^\//, "")))) {
        fail(`${label}: image src does not resolve to an exported file: "${src}"`);
      }
    }
  }

  pass(
    `interaction: ${htmlFiles.length} page(s), ${hrefsChecked} href(s) audited, ${fragmentsChecked} in-page fragment(s), ${mediaChecked} media reference(s) resolved — no dead anchors${labelIssues === 0 ? ", no label punctuation violations" : ""}`
  );
}

async function verifySitemap(articleRoutes) {
  if (!existsSync(path.join(OUT_DIR, "sitemap.xml"))) {
    fail("sitemap.xml: missing from export");
    return;
  }

  const xml = await readText("sitemap.xml");

  if (!xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')) {
    fail("sitemap.xml: unexpected urlset namespace");
  }

  const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);
  const expected = [
    `${SITE_ORIGIN}/`,
    `${SITE_ORIGIN}/blog/`,
    /* Static content routes (v3.1): /about/, /work/, topic hubs. */
    ...CONTENT_ROUTES.map((entry) => `${SITE_ORIGIN}/${entry.route}/`),
    ...articleRoutes.map((slug) => `${SITE_ORIGIN}/blog/${slug}/`)
  ].sort();

  const actual = [...locs].sort();

  if (actual.length !== expected.length || actual.some((url, index) => url !== expected[index])) {
    fail(`sitemap.xml: URL set does not match exported routes\n    sitemap: ${actual.join(", ")}\n    routes:  ${expected.join(", ")}`);
  } else {
    pass(`sitemap.xml: ${actual.length} URLs match exported routes`);
  }

  for (const url of locs) {
    if (!/^https:\/\/parsaetak\.github\.io\/WEB(\/|$)/.test(url)) {
      fail(`sitemap.xml: non-production URL "${url}"`);
    }
  }

  const lastmods = [...xml.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)].map((match) => match[1]);
  for (const lastmod of lastmods) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) {
      fail(`sitemap.xml: invalid lastmod "${lastmod}"`);
    }
  }

  /* lastmod must reflect article dates, not the build date */
  const postsIndex = JSON.parse(
    await readFile(path.join(ROOT, "data", "blog", "posts.json"), "utf8")
  );
  for (const post of postsIndex.posts) {
    const entry = `<loc>${SITE_ORIGIN}/blog/${post.slug}/</loc><lastmod>${post.updated ?? post.date}</lastmod>`;
    if (!xml.replace(/\s+/g, "").includes(entry.replace(/\s+/g, ""))) {
      fail(`sitemap.xml: ${post.slug} lastmod does not match its content date`);
    }
  }
}

async function verifyRobots() {
  if (!existsSync(path.join(OUT_DIR, "robots.txt"))) {
    fail("robots.txt: missing from export");
    return;
  }

  const robots = await readText("robots.txt");
  requireString(robots, "User-agent: *", "User-agent directive", "robots.txt");
  requireString(robots, "Allow: /", "Allow directive", "robots.txt");
  requireString(robots, `Sitemap: ${SITE_ORIGIN}/sitemap.xml`, "Sitemap directive", "robots.txt") &&
    pass("robots.txt: crawlable, sitemap identified");
}

async function verifyNoRss() {
  /*
   * RSS removal (v2.5) — verified positively: the export contains NO
   * feed.xml, NO RSS XML, and no residual feed references in any
   * served artifact (HTML, sitemap, robots, deployment manifest).
   */
  if (existsSync(path.join(OUT_DIR, "blog", "feed.xml"))) {
    fail("blog/feed.xml: still present in export (RSS was removed in v2.5)");
  } else {
    pass("blog/feed.xml: absent from export as intended");
  }

  const htmlFiles = await collectHtmlFiles(OUT_DIR);
  let rssRefs = 0;

  for (const file of htmlFiles) {
    const html = await readFile(path.join(OUT_DIR, file), "utf8");
    if (html.includes("application/rss+xml") || html.includes("feed.xml")) {
      fail(`${file}: residual RSS reference found`);
      rssRefs += 1;
    }
  }

  if (rssRefs === 0) {
    pass(`RSS: no references in ${htmlFiles.length} exported page(s)`);
  }

  const sitemap = existsSync(path.join(OUT_DIR, "sitemap.xml"))
    ? await readText("sitemap.xml")
    : "";
  if (sitemap.includes("feed.xml")) {
    fail("sitemap.xml: feed URL found (RSS was removed in v2.5)");
  }

  const robots = existsSync(path.join(OUT_DIR, "robots.txt"))
    ? await readText("robots.txt")
    : "";
  if (robots.includes("feed")) {
    fail("robots.txt: feed reference found (RSS was removed in v2.5)");
  }
}

/*
 * HOME CONTENT VERIFICATION (v2.7, tightened v3.0).
 *
 * The home scene is now server-rendered into the static export, so
 * its semantic content is crawlable. This check proves the
 * information-priority release actually shipped: one meaningful h1,
 * the capability vocabulary, the featured project names, the
 * workflow stages, and crawlable links to the real destinations.
 * It reads the same exported HTML a search engine receives.
 *
 * v3.0 additions — the P0 crawlability guarantees:
 * - the h1 must sit INSIDE <main> in the real DOM, not inside a
 *   React streamed-Suspense completion wrapper (<div hidden id="S:0">)
 *   and not inside a <template> or script payload;
 * - the visible <main> surface itself must carry the core content,
 *   independent of what the flight data contains.
 */
async function verifyHomeContent(articleRoutes) {
  const html = await readFile(path.join(OUT_DIR, "index.html"), "utf8");

  const visible = toVisibleText(html);

  /*
   * P0 (v3.0): the visible document — the part a search engine's
   * renderer and every social scraper see before any JavaScript —
   * is the <main>…</main> slice with scripts stripped. The home
   * scene's core message must live THERE, verbatim.
   */
  const mainMatch = html.match(/<main[\s\S]*?<\/main>/);
  const mainVisible = toVisibleText(mainMatch ? mainMatch[0] : "");

  if (!mainMatch) {
    fail("home: no <main> element found in exported HTML");
  }

  const h1Matches = html.match(/<h1[^>]*>/g) ?? [];
  if (h1Matches.length !== 1) {
    fail(`home: expected exactly one h1, found ${h1Matches.length}`);
  } else {
    pass("home: exactly one h1 in exported HTML");
  }

  /*
   * P0 (v3.0): React's streamed-Suspense completion lands in a
   * <div hidden id="S:0"> wrapper. Its presence means the visible
   * document shipped a loading gate instead of content.
   */
  if (/<div hidden id="S:0">/.test(html)) {
    fail(
      "home: streamed Suspense wrapper <div hidden id=\"S:0\"> found — home scene content is not in the visible document"
    );
  } else {
    pass("home: no hidden streamed-Suspense wrapper (content renders inline)");
  }

  const h1InMain = /<main[^>]*>[\s\S]*?<h1[\s\S]*?<\/main>/.test(html);
  if (!h1InMain) {
    fail("home: h1 is not inside <main> in the exported HTML");
  } else {
    pass("home: h1 renders inside <main> (visible initial document)");
  }

  const requiredPhrases = [
    ["identity", "PARSA TAK"],
    ["identity roles", "SOFTWARE ENGINEER"],
    ["identity roles", "PRODUCT BUILDER"],
    ["identity roles", "AI SYSTEMS RESEARCHER"],
    ["capability", "AI systems"],
    ["capability", "Reasoning"],
    ["capability", "Software"],
    ["capability", "Product building"],
    ["capability section", "What I can do"],
    ["capability term", "Local AI"],
    /*
     * v3.5: the home capabilities grid is exactly eight entries
     * (4 + 4). "Creative technology" was consolidated out of the
     * grid — it keeps its dedicated /creative-technology/ topic hub
     * and RED MAGIC presentation — so this check pins "System
     * architecture", a term that must remain visible in the grid.
     */
    ["capability term", "System architecture"],
    ["projects section", "What I have actually built"],
    ["project name", "SHEYTAN Local Agent"],
    ["project name", "Universal Human Intelligence Test"],
    ["project name", "FreeIran"],
    ["project name", "RED MAGIC"],
    ["workflow section", "How I work"],
    ["workflow stage", "RESEARCH"],
    ["workflow stage", "PRODUCT DIRECTION"],
    ["workflow stage", "ARCHITECTURE"],
    ["workflow stage", "IMPLEMENTATION"],
    ["workflow stage", "TESTING"],
    ["workflow stage", "VERIFICATION"],
    ["workflow stage", "DELIVERY"]
  ];

  for (const [kind, phrase] of requiredPhrases) {
    if (!visible.includes(phrase)) {
      fail(`home: ${kind} phrase missing from visible HTML: "${phrase}"`);
    }
  }

  if (!failures.some((entry) => entry.startsWith("home:"))) {
    pass(
      `home: ${requiredPhrases.length} capability/project/workflow phrase(s) present in visible HTML`
    );
  }

  /*
   * P0 (v3.0): the core professional message must be present in
   * the VISIBLE main document — not merely in the flight payload.
   * These are the same phrases the mission defines as the minimum
   * crawlable home content.
   */
  const mainRequiredPhrases = [
    ["h1", "AI systems"],
    ["positioning", "SOFTWARE ENGINEER"],
    ["positioning", "I research intelligence"],
    ["capabilities", "What I can do"],
    ["featured work", "SHEYTAN Local Agent"],
    ["featured work", "FreeIran"],
    ["writing section", "Field notes"],
    ["writing section", "Open the Blog"],
    ["contact CTA", "Email Parsa Tak"]
  ];

  for (const [kind, phrase] of mainRequiredPhrases) {
    if (!mainVisible.includes(phrase)) {
      fail(`home: ${kind} missing from visible <main> content: "${phrase}"`);
    }
  }

  if (
    !failures.some((entry) =>
      entry.includes("missing from visible <main> content")
    )
  ) {
    pass(
      `home: ${mainRequiredPhrases.length} core phrase(s) present in visible <main> before JavaScript`
    );
  }

  verifyContentDiscoveryLinks(html, articleRoutes);

  /* Crawlable destinations from the home scene. */
  const requiredHrefs = [
    "https://github.com/Parsaetak/SHEYTAN-local-agent",
    "https://github.com/Parsaetak/FreeIran",
    "https://github.com/Parsaetak/WEB",
    "https://github.com/Parsaetak/Contents/tree/AI-Tests"
  ];

  for (const href of requiredHrefs) {
    if (!html.includes(`href="${href}"`)) {
      fail(`home: crawlable destination missing: ${href}`);
    }
  }

  if (!failures.some((entry) => entry.includes("crawlable destination"))) {
    pass("home: repository destinations crawlable in exported HTML");
  }
}

/*
 * CONTENT-DISCOVERY LINK VERIFICATION (v3.0, basePath-aware;
 * renamed v3.7 to match the Blog-centered content architecture).
 *
 * The home route must link real articles with descriptive
 * destinations, not just the blog index.
 *
 * The href pattern is built from BASE_PATH — the same source of
 * truth next.config.ts and build-blog.mjs use — so the check sees
 * the links exactly as crawlers receive them in both deployment
 * shapes:
 *   local:        /blog/<slug>/
 *   GitHub Pages: /WEB/blog/<slug>/
 *
 * Every detected href must resolve to an article route actually
 * present in the export: a renamed or deleted slug, `/blog/undefined`,
 * or any malformed target is a failure, not a silent dead link.
 */
const HOME_WRITING_MIN_LINKS = 3;

const ARTICLE_SLUG_PATTERN = "[a-z0-9-]+";

function verifyContentDiscoveryLinks(html, articleRoutes) {
  const articleHref = new RegExp(
    `href="(${BASE_PATH}/blog/${ARTICLE_SLUG_PATTERN}/)"`,
    "g"
  );
  const writingHrefs = [...html.matchAll(articleHref)].map(
    (match) => match[1]
  );

  if (writingHrefs.length < HOME_WRITING_MIN_LINKS) {
    fail(
      `home: expected ≥${HOME_WRITING_MIN_LINKS} crawlable article links from the Writing section, found ${writingHrefs.length}`
    );
    return;
  }

  const exportedSlugs = new Set(articleRoutes);

  const invalid = writingHrefs.filter((href) => {
    if (href.includes("localhost") || href.includes("/blog/undefined")) {
      return true;
    }
    /* Strip the deployment prefix and route prefix to the raw slug. */
    const slug = href
      .slice(BASE_PATH.length)
      .replace(/^\/blog\//, "")
      .replace(/\/$/, "");
    return !exportedSlugs.has(slug);
  });

  if (invalid.length > 0) {
    for (const href of invalid) {
      fail(`home: writing link does not resolve to an exported article route: ${href}`);
    }
    return;
  }

  pass(
    `home: ${writingHrefs.length} crawlable article link(s) in home HTML, all resolve to exported routes`
  );
}

/*
 * BLOG CONTENT-DISCOVERY VERIFICATION (v3.7).
 *
 * The Blog is the site's content hub — the discovery surface for
 * articles, work documentation, and research writing. This check
 * proves the exported /blog/ document actually plays that role:
 *
 * - it links real articles (≥3, every target an exported route)
 * - it links the canonical /work/ and /research/ collections —
 *   neither deep landing page may become orphaned just because it
 *   left the primary navigation
 * - it carries the content-type modes (ALL / ARTICLES / WORK /
 *   RESEARCH) over the generated catalogue
 * - every post in the content index has a valid content type, and
 *   no type present in the catalogue is missing from the selector
 * - the primary navigation is the v3.7 four-entry topology
 *   (HOME · ABOUT · BLOG · CONTACT) — no stale six-tab layout
 */
const BLOG_ARTICLE_MIN_LINKS = 3;

const CONTENT_TYPES = ["article", "work", "research"];

async function verifyBlogContentDiscovery(articleRoutes, postsIndex) {
  const blogFile = path.join("blog", "index.html");

  const html = await readText(blogFile);

  /* Crawlable article links — every one must be a real route. */
  const articleHref = new RegExp(
    `href="(${BASE_PATH}/blog/${ARTICLE_SLUG_PATTERN}/)"`,
    "g"
  );

  const blogArticleHrefs = [
    ...new Set([...html.matchAll(articleHref)].map((match) => match[1]))
  ];

  if (blogArticleHrefs.length < BLOG_ARTICLE_MIN_LINKS) {
    fail(
      `blog index: expected ≥${BLOG_ARTICLE_MIN_LINKS} crawlable article links, found ${blogArticleHrefs.length}`
    );
  } else {
    const exportedSlugs = new Set(articleRoutes);

    const invalid = blogArticleHrefs.filter((href) => {
      if (href.includes("localhost") || href.includes("/blog/undefined")) {
        return true;
      }
      const slug = href
        .slice(BASE_PATH.length)
        .replace(/^\/blog\//, "")
        .replace(/\/$/, "");
      return !exportedSlugs.has(slug);
    });

    if (invalid.length > 0) {
      for (const href of invalid) {
        fail(`blog index: article link does not resolve to an exported route: ${href}`);
      }
    } else {
      pass(
        `blog index: ${blogArticleHrefs.length} crawlable article link(s), all resolve to exported routes`
      );
    }
  }

  /*
   * Work and Research discoverable from the Blog: the canonical
   * collections must be crawlable hrefs on the blog index (the lab
   * map and the footer both carry them).
   */
  for (const collection of ["work", "research"]) {
    const collectionHref = `href="${BASE_PATH}/${collection}/"`;

    if (!html.includes(collectionHref)) {
      fail(
        `blog index: canonical /${collection}/ collection is not linked from the Blog (expected ${collectionHref})`
      );
    }
  }

  if (!failures.some((entry) => entry.includes("collection is not linked from the Blog"))) {
    pass("blog index: /work/ and /research/ canonical collections crawlable from the Blog");
  }

  /*
   * Content-type model: every generated post carries a valid type,
   * and every type present in the catalogue appears in the exported
   * selector (no orphaned content mode).
   */
  const typeCounts = { article: 0, work: 0, research: 0 };

  for (const post of postsIndex.posts) {
    if (!CONTENT_TYPES.includes(post.type)) {
      fail(
        `blog index: post "${post.slug}" has invalid content type ${JSON.stringify(post.type)} (expected one of: ${CONTENT_TYPES.join(", ")})`
      );
    } else {
      typeCounts[post.type] += 1;
    }
  }

  const catalogueTypes = CONTENT_TYPES.filter(
    (type) => typeCounts[type] > 0
  );

  for (const type of catalogueTypes) {
    if (!html.includes(`data-type="${type}"`)) {
      fail(
        `blog index: content type "${type}" is present in the catalogue (${typeCounts[type]} post(s)) but missing from the exported content-mode selector`
      );
    }
  }

  if (
    !failures.some(
      (entry) =>
        entry.includes("invalid content type") ||
        entry.includes("missing from the exported content-mode selector")
    )
  ) {
    pass(
      `blog index: content-type model valid (${catalogueTypes.map((type) => `${type} ×${typeCounts[type]}`).join(", ")}), no orphaned content mode`
    );
  }

  /*
   * Primary navigation topology (v3.7): the header nav must carry
   * the four primary destinations. The full-order assertion lives
   * on the four hrefs being present in the unified nav markup.
   */
  const primaryNavHrefs = [
    `${BASE_PATH}/`,
    `${BASE_PATH}/about/`,
    `${BASE_PATH}/blog/`,
    `${BASE_PATH}/contact/`
  ];

  const missingNav = primaryNavHrefs.filter(
    (href) => !html.includes(`href="${href}"`)
  );

  if (missingNav.length > 0) {
    fail(
      `blog index: primary navigation incomplete — missing ${missingNav.join(", ")} (v3.7 topology: HOME · ABOUT · BLOG · CONTACT)`
    );
  } else {
    pass("blog index: primary navigation carries the v3.7 topology (HOME · ABOUT · BLOG · CONTACT)");
  }
}

/*
 * FAVICON FAMILY (v2.9): the export must carry the complete brand
 * icon set built from the 13-point star, and the home page HTML must
 * link every piece of it. Google surfaces favicons in search when the
 * icon is crawlable, square, stable, and larger than minimum — the
 * checks below keep that true.
 */
async function verifyFaviconFamily() {
  const requiredIcons = [
    { file: "icon.svg", label: "SVG favicon (public/icon.svg)" },
    { file: "icon.png", label: "PNG favicon fallback (192×192)" },
    { file: "favicon.ico", label: "legacy multi-size favicon" },
    { file: "apple-icon.png", label: "Apple touch icon (180×180)" }
  ];

  for (const icon of requiredIcons) {
    if (!existsSync(path.join(OUT_DIR, icon.file))) {
      fail(`${icon.file}: ${icon.label} missing from export`);
    } else {
      pass(`${icon.file}: ${icon.label} present in export`);
    }
  }

  const html = await readText("index.html");
  /*
   * The icon link set must be complete AND correctly prefixed: Next
   * emits metadata.icons hrefs verbatim (metadataBase does not apply),
   * so under the /WEB deployment the hrefs must carry the basePath —
   * an unprefixed href would 404 on GitHub Pages.
   */
  const linkExpectations = [
    { file: "favicon.ico", label: "favicon.ico icon link" },
    { file: "icon.svg", label: "SVG icon link" },
    { file: "icon.png", label: "PNG icon link" },
    { file: "apple-icon.png", label: "apple-touch-icon link" }
  ];

  for (const expectation of linkExpectations) {
    const hrefPattern = new RegExp(
      `<link rel="(?:icon|apple-touch-icon)"[^>]*href="${BASE_PATH}/${expectation.file.replace(/\./g, "\\.")}"`,
      ""
    );
    if (!hrefPattern.test(html)) {
      fail(
        `home: ${expectation.label} missing or not basePath-prefixed (expected href="${BASE_PATH}/${expectation.file}")`
      );
    } else {
      pass(`home: ${expectation.label} present (${BASE_PATH}/${expectation.file})`);
    }
  }
}

/*
 * BRAND ASSETS IN EXPORT (v2.9): the generated brand system must
 * actually ship — star variants, the glyph library, and the project
 * artwork the home scene references.
 */
async function verifyBrandAssetsInExport() {
  const requiredRuntime = [
    "brand/star-red.svg",
    "brand/star-red-hot.svg",
    "brand/star-white.svg",
    "brand/star-outline-red.svg",
    "brand/star-silver.svg",
    "images/projects/sheytan-agent-lab.svg",
    "images/projects/uhit-intelligence-scale.svg",
    "images/projects/freeiran-vpn-mesh.svg",
    "images/projects/red-magic-organism.svg",
    "images/projects/web-static-living-system.svg"
  ];

  for (const asset of requiredRuntime) {
    if (!existsSync(path.join(OUT_DIR, asset))) {
      fail(`brand asset missing from export: ${asset}`);
    }
  }

  const iconCount = existsSync(path.join(OUT_DIR, "brand", "icons"))
    ? (await readdir(path.join(OUT_DIR, "brand", "icons"))).filter((name) => name.endsWith(".svg")).length
    : 0;
  if (iconCount < 14) {
    fail(`brand glyph library incomplete in export: ${iconCount}/14 icons`);
  }

  if (failures.length === 0 || !failures.some((entry) => entry.startsWith("brand asset missing") || entry.startsWith("brand glyph library"))) {
    pass(
      `brand assets: ${requiredRuntime.length} runtime asset(s) + ${iconCount} glyph(s) ship in the export`
    );
  }
}

/*
 * INTERNAL LINK GRAPH AUDIT (v3.0).
 *
 * Mission §7: identify orphan pages and weak links, and validate
 * that internal links resolve. This audit:
 *  1. FAILS on any internal href in the exported HTML that points
 *     to an article slug or scene hash that does not exist
 *     (broken internal links);
 *  2. FAILS on accidental repository-clone URLs and localhost
 *     destinations;
 *  3. REPORTS the inbound internal-link count per article from the
 *     build-time graph plus the exported HTML, and WARNs on zero-
 *     inbound articles without failing the build (warnings must be
 *     fixed with real links, never artificial ones).
 */
async function verifyInternalLinkGraph(articleRoutes) {
  /*
   * collectHtmlFiles() (defined with the v2.4 interaction audit)
   * returns export-relative HTML paths (index.html, blog/<slug>/
   * index.html, …). Reuse it — one file-walk across the script.
   */
  const htmlFiles = await collectHtmlFiles(OUT_DIR);

  /*
   * BasePath tolerance: the export rewrites internal hrefs to carry
   * the /WEB prefix when building for GitHub Pages. The audit must
   * accept both shapes — BASE_PATH mirrors next.config.ts /
   * build-blog.mjs and is the single source of truth in this script.
   */
  const internalHrefs = new Set();

  const broken = [];

  const articleSlugSet = new Set(articleRoutes);

  for (const relFile of htmlFiles) {
    const file = path.join(OUT_DIR, relFile);

    const html = await readFile(file, "utf8");

    const hrefs = [
      ...html.matchAll(/href="([^"]+)"/g)
    ].map((match) => match[1]);

    for (const href of hrefs) {
      if (href.startsWith("http://localhost") || href.includes("127.0.0.1")) {
        broken.push(`${relFile}: localhost link ${href}`);
        continue;
      }

      if (href.startsWith("git@") || href.endsWith(".git")) {
        broken.push(`${relFile}: repository-clone URL ${href}`);
        continue;
      }

      const articleMatch = href.match(
        new RegExp(`^${BASE_PATH}/blog/([a-z0-9-]+)/?$`)
      );

      if (articleMatch) {
        internalHrefs.add(`blog/${articleMatch[1]}`);

        if (!articleSlugSet.has(articleMatch[1])) {
          broken.push(
            `${relFile}: link to unknown article ${href}`
          );
        }

        continue;
      }

      /*
       * Fragment hrefs, two distinct kinds (v3.7):
       * - "/#scene" (leading slash): a world-shell scene link —
       *   validated against the known scene set.
       * - "#fragment" (bare): an in-page anchor on the CURRENT page
       *   (e.g. the Blog's #browse jump to the discovery grid) —
       *   validated against the element ids present in this page's
       *   own exported HTML.
       */
      const sceneMatch = href.match(
        new RegExp(`^${BASE_PATH}/#([a-z]+)$`)
      );

      if (
        sceneMatch &&
        !SCENE_HASHES.has(sceneMatch[1]) &&
        sceneMatch[1] !== "top"
      ) {
        broken.push(
          `${relFile}: link to unknown scene ${href}`
        );
      }

      const inPageMatch = href.match(/^#([a-z][a-z0-9-]*)$/);

      if (inPageMatch && inPageMatch[1] !== "top") {
        /*
         * The world shell (index.html) is the one document where a
         * bare hash routes a SCENE — the same vocabulary as /#scene
         * links. Every other document treats a bare hash as an
         * in-page anchor and must carry the matching element id.
         */
        if (relFile === "index.html") {
          if (!SCENE_HASHES.has(inPageMatch[1])) {
            broken.push(
              `${relFile}: link to unknown scene ${href}`
            );
          }
        } else if (!html.includes(`id="${inPageMatch[1]}"`)) {
          broken.push(
            `${relFile}: in-page anchor #${inPageMatch[1]} matches no element id on the page`
          );
        }
      }
    }
  }

  if (broken.length > 0) {
    for (const entry of broken) {
      fail(`link graph: ${entry}`);
    }
  } else {
    pass(
      `link graph: all internal article/scene hrefs across ${htmlFiles.length} exported page(s) resolve`
    );
  }

  /*
   * Inbound report: build-time body links + template edges
   * (project chips / scene chips / writing section are all real
   * anchors in the exported HTML, so the HTML scan above catches
   * them — the per-slug count below reuses the same set).
   */
  const inboundCounts = {};

  for (const slug of articleRoutes) {
    inboundCounts[slug] = 0;
  }

  for (const href of internalHrefs) {
    const slug = href.replace(/^blog\//, "");

    if (slug in inboundCounts) {
      inboundCounts[slug] += 1;
    }
  }

  const orphans = articleRoutes.filter(
    (slug) => (inboundCounts[slug] ?? 0) === 0
  );

  for (const slug of articleRoutes) {
    console.log(
      `  · link graph: /blog/${slug}/ has ${inboundCounts[slug]} inbound internal link(s)`
    );
  }

  if (orphans.length > 0) {
    console.warn(
      `[seo] WARNING — ${orphans.length} article(s) with zero inbound internal links (fix with real links, never artificial ones): ${orphans.join(", ")}`
    );
  } else {
    pass("link graph: no orphan articles — every article has ≥1 inbound internal link");
  }
}

/* -------------------------------------------------------------------------- */
/* Content route verification + graph (v3.1)                                   */
/* -------------------------------------------------------------------------- */

/*
 * CONTENT GRAPH (v3.1) — the static content documents must be a
 * connected, crawlable part of the site, never SEO islands.
 * Deliberately concise: the checks below cover only the NEW
 * invariants (existence/metadata/graph for the content routes);
 * everything else continues to run through the existing groups.
 */
async function verifyContentGraph() {
  const failureCountBefore = failures.length;

  const htmlFiles = await collectHtmlFiles(OUT_DIR);

  const pages = [];
  for (const file of htmlFiles) {
    pages.push({
      file,
      html: await readFile(path.join(OUT_DIR, file), "utf8")
    });
  }

  const routeHref = (route) => `${BASE_PATH}/${route}/`;
  const routeFile = (route) => path.join(route, "index.html");

  /* Reachability: the home document links every content route. */
  const home = pages.find((page) => page.file === "index.html");

  if (!home) {
    fail("content graph: home page not found in export");
  } else {
    let missing = 0;

    for (const entry of CONTENT_ROUTES) {
      if (!home.html.includes(`href="${routeHref(entry.route)}"`)) {
        fail(
          `content graph: /${entry.route}/ is not linked from the home document (expected href="${routeHref(entry.route)}")`
        );
        missing += 1;
      }
    }

    if (missing === 0) {
      pass(
        `content graph: all ${CONTENT_ROUTES.length} content routes linked from the home document`
      );
    }
  }

  /* Outbound edges: sibling routes on every route, ≥3 articles per hub. */
  /*
   * Hub routes (v3.2) — the six topic hubs, which must link ≥3
   * related articles. The identity/professional routes (about, work,
   * research, contact) are content routes but not hubs, and are
   * therefore exempt from the article-count check.
   */
  const NON_HUB_ROUTES = new Set(["about", "work", "research", "contact"]);

  const hubRoutes = CONTENT_ROUTES.filter(
    (entry) => !NON_HUB_ROUTES.has(entry.route)
  );

  let hubArticleShortfalls = 0;

  let siblingShortfalls = 0;

  for (const entry of CONTENT_ROUTES) {
    const ownPage = pages.find((page) => page.file === routeFile(entry.route));

    if (!ownPage) {
      /* Missing export is already reported by verifyPage(). */
      continue;
    }

    const siblings = new Set(
      [...ownPage.html.matchAll(/href="[^"]*\/([a-z-]+)\/"/g)]
        .map((match) => match[1])
        .filter(
          (slug) =>
            slug !== entry.route &&
            CONTENT_ROUTES.some((candidate) => candidate.route === slug)
        )
    );

    if (siblings.size < 2) {
      fail(
        `content graph: /${entry.route}/ links fewer than 2 sibling content routes (found ${siblings.size})`
      );
      siblingShortfalls += 1;
    }

    if (hubRoutes.some((hub) => hub.route === entry.route)) {
      const articles = new Set(
        [...ownPage.html.matchAll(/href="[^"]*\/blog\/([a-z0-9-]+)\/"/g)].map(
          (match) => match[1]
        )
      );

      if (articles.size < 3) {
        fail(
          `content graph: hub /${entry.route}/ links fewer than 3 related articles (found ${articles.size})`
        );
        hubArticleShortfalls += 1;
      }
    }
  }

  if (siblingShortfalls === 0 && hubArticleShortfalls === 0) {
    pass(
      "content graph: every content route links ≥2 sibling documents; every hub links ≥3 related articles"
    );
  }

  /* Inbound edges: no orphan content route (footer nav carries it site-wide). */
  let orphans = 0;

  for (const entry of CONTENT_ROUTES) {
    const inbound = pages.filter(
      (page) =>
        page.file !== routeFile(entry.route) &&
        page.html.includes(`href="${routeHref(entry.route)}"`)
    );

    if (inbound.length < 3) {
      fail(
        `content graph: /${entry.route}/ has only ${inbound.length} inbound page(s) (expected ≥3 — the footer nav carries every route site-wide)`
      );
      orphans += 1;
    }
  }

  if (orphans === 0) {
    pass(
      "content graph: no orphan content routes (every route has ≥3 inbound pages)"
    );
  }

  /*
   * The group-level passes above must never print alongside
   * failures from this group — belt and braces for report clarity.
   */
  if (failures.length > failureCountBefore) {
    fail(`content graph: ${failures.length - failureCountBefore} content-graph failure(s) listed above`);
  }
}

/*
 * SEO GRAPH DEPTH (SEO v2) — graph-QUALITY verification beyond
 * "route exists" and "no orphan". While verifyInternalLinkGraph and
 * verifyContentGraph establish that links resolve and the route set is
 * connected, this group validates the SHAPE of the discovery graph:
 *
 * 1. inbound links per content page (articles AND content routes),
 *    with the registered per-route minimums
 * 2. orphan / orphan-adjacent content (zero-inbound FAILS now; an
 *    article reachable only through the Blog index is warned as
 *    orphan-adjacent — it has exactly one discovery path)
 * 3. article/project/topic/hub relationships: how much of the article
 *    catalogue is represented by the topic hubs, the collections
 *    (/work/, /research/), or the home document — reported as a
 *    percentage, with a hard floor
 * 4. Work/Research/Article discoverability: the collections must be
 *    linked from the home document AND the Blog index
 * 5. anchor-text quality on internal content links: generic anchors
 *    ("read more", "click here", …) fail — anchors must be descriptive
 * 6. canonical/robots/sitemap coherence: every content page's
 *    canonical must match the sitemap <loc> exactly
 * 7. graph depth report: hub-coverage and multi-path percentages
 *
 * Only repository/exported facts are verified here — no external
 * ranking or indexing claims are made or implied.
 */
const GENERIC_ANCHORS = new Set([
  "read more",
  "click here",
  "here",
  "this link",
  "more",
  "link",
  "this page",
  "learn more",
  "details"
]);

const HUB_COVERAGE_FLOOR = 0.5;

function stripHtmlToText(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function verifySeoGraphDepth(articleRoutes, postsIndex) {
  const failureCountBefore = failures.length;

  const htmlFiles = await collectHtmlFiles(OUT_DIR);

  const pages = [];
  for (const file of htmlFiles) {
    pages.push({
      file,
      html: await readFile(path.join(OUT_DIR, file), "utf8")
    });
  }

  const routeHref = (route) => `${BASE_PATH}/${route}/`;
  const articleHref = (slug) => `${BASE_PATH}/blog/${slug}/`;
  const routeFile = (route) => path.join(route, "index.html");

  /* ---------- 1. Inbound census per content page ---------------------- */

  const inboundPagesByRoute = new Map(
    CONTENT_ROUTES.map((entry) => [entry.route, []])
  );

  const inboundPagesByArticle = new Map(
    articleRoutes.map((slug) => [slug, []])
  );

  for (const page of pages) {
    for (const entry of CONTENT_ROUTES) {
      if (
        page.file !== routeFile(entry.route) &&
        page.html.includes(`href="${routeHref(entry.route)}"`)
      ) {
        inboundPagesByRoute.get(entry.route).push(page.file);
      }
    }

    for (const slug of articleRoutes) {
      if (
        page.file !== path.join("blog", slug, "index.html") &&
        page.html.includes(`href="${articleHref(slug)}"`)
      ) {
        inboundPagesByArticle.get(slug).push(page.file);
      }
    }
  }

  for (const entry of CONTENT_ROUTES) {
    const inbound = inboundPagesByRoute.get(entry.route).length;

    if (inbound < entry.inboundMinimum) {
      fail(
        `graph depth: /${entry.route}/ has ${inbound} inbound page(s), below the registry minimum ${entry.inboundMinimum}`
      );
    } else {
      console.log(
        `  · graph depth: /${entry.route}/ has ${inbound} inbound page(s) (minimum ${entry.inboundMinimum})`
      );
    }
  }

  for (const slug of articleRoutes) {
    const inbound = inboundPagesByArticle.get(slug).length;

    if (inbound === 0) {
      fail(
        `graph depth: article /blog/${slug}/ has ZERO inbound internal links — an orphan document cannot be discovered (fix with real links, never artificial ones)`
      );
    } else {
      console.log(
        `  · graph depth: /blog/${slug}/ has ${inbound} inbound page(s)`
      );
    }
  }

  /* ---------- 2. Orphan-adjacent articles ----------------------------- */

  const orphanAdjacent = articleRoutes.filter((slug) => {
    const inbound = inboundPagesByArticle.get(slug);

    if (inbound.length !== 1) {
      return false;
    }

    return inbound[0] === path.join("blog", "index.html");
  });

  if (orphanAdjacent.length > 0) {
    console.warn(
      `[seo] WARNING — ${orphanAdjacent.length} orphan-adjacent article(s) reachable ONLY through the Blog index (add real cross-links from related articles, hubs, or the home document): ${orphanAdjacent.join(", ")}`
    );
  } else {
    pass(
      "graph depth: no orphan-adjacent articles — every article has at least one discovery path beyond the Blog index"
    );
  }

  /* ---------- 3. Hub / collection / home representation ---------------- */

  const hubEntries = CONTENT_ROUTES.filter(
    (entry) => entry.kind === "topic-hub"
  );

  const hubCovered = new Set();

  for (const slug of articleRoutes) {
    const inbound = inboundPagesByArticle.get(slug);

    const fromHub = inbound.some((file) =>
      hubEntries.some((hub) => file === routeFile(hub.route))
    );

    if (fromHub) {
      hubCovered.add(slug);
    }
  }

  const collectionCovered = new Set();

  for (const slug of articleRoutes) {
    const inbound = inboundPagesByArticle.get(slug);

    const fromCollection = inbound.some(
      (file) =>
        file === routeFile("work") ||
        file === routeFile("research") ||
        file === "index.html"
    );

    if (fromCollection) {
      collectionCovered.add(slug);
    }
  }

  /*
   * RELATED-GRAPH COVERAGE (v3.9) — measured against the EXPORTED
   * HTML, not the pipeline's in-memory schema.
   *
   * v3.8 regression this replaces: the old check read `post.related`
   * from the emitted post records — a field the pipeline has never
   * emitted (related sets live under data.indexes.related[slug]).
   * The metric therefore read 0/9 even though the pipeline computed
   * 53 real edges and every article page rendered them as crawlable
   * links. The fix is to verify the truth on the ground:
   *
   * 1. ARTICLE EDGES — for every article with declared related
   *    entries (indexes.related), the exported article page must
   *    contain at least one of those exact /blog/<slug>/ hrefs. This
   *    validates BOTH presence (the related section rendered) and
   *    truthfulness (the links are the declared ones, not invented
   *    anchors).
   *
   * 2. LATERAL COLLECTION EDGES (v3.9 relationship model) — every
   *    article whose `project` is documented in the Selected Work
   *    registry must link /work/ from its page, and every
   *    type=research article must link /research/. These are the
   *    deterministic article→collection edges that connect the four
   *    content types (topic ↔ article ↔ work ↔ research).
   *
   * A covered article satisfies (1) or (2). Missing expected edges
   * FAIL — the metric cannot be gamed by deleting the section.
   */
  const relatedIndex = postsIndex.indexes?.related ?? {};

  const articleBodyCrossLinks = new Set();

  let lateralWorkCovered = 0;
  let lateralResearchCovered = 0;

  for (const slug of articleRoutes) {
    const articleFile = path.join("blog", slug, "index.html");

    const page = pages.find((candidate) => candidate.file === articleFile);

    if (!page) {
      continue; /* missing export already reported by verifyPage() */
    }

    const post = postsIndex.posts.find((candidate) => candidate.slug === slug);

    const declaredRelated = Array.isArray(relatedIndex[slug])
      ? relatedIndex[slug]
      : [];

    /* (1) Declared article→article edges rendered in the export. */
    let renderedDeclared = 0;

    for (const entry of declaredRelated) {
      if (
        entry &&
        typeof entry.slug === "string" &&
        page.html.includes(`href="${articleHref(entry.slug)}"`)
      ) {
        renderedDeclared += 1;
      }
    }

    if (declaredRelated.length > 0 && renderedDeclared === 0) {
      fail(
        `graph depth: /blog/${slug}/ declares ${declaredRelated.length} related article(s) in the content index but its exported HTML renders NONE of them — the related layer regressed`
      );
    } else if (renderedDeclared > 0) {
      articleBodyCrossLinks.add(slug);
    }

    /*
     * (2) Lateral article→collection edges — scoped to the article's
     * RELATED SECTION, never the whole page. The shared footer
     * document nav links /work/ and /research/ on every page of the
     * site, so a whole-page search would trivially pass regardless
     * of the related layer. The related section contains no nested
     * <section> elements, so the first </section> after its kicker
     * closes exactly this block.
     */
    const relatedKickerAt = page.html.indexOf("RELATED TRANSMISSIONS");

    const relatedSectionEnd =
      relatedKickerAt === -1
        ? -1
        : page.html.indexOf("</section>", relatedKickerAt);

    const relatedScope =
      relatedKickerAt === -1 || relatedSectionEnd === -1
        ? ""
        : page.html.slice(relatedKickerAt, relatedSectionEnd);

    const hasWorkEdge =
      post?.project != null &&
      relatedScope.includes(`href="${routeHref("work")}"`);

    const hasResearchEdge =
      post?.type === "research" &&
      relatedScope.includes(`href="${routeHref("research")}"`);

    if (post?.project != null && !hasWorkEdge) {
      fail(
        `graph depth: /blog/${slug}/ documents the "${post.project}" project but its related section never links the canonical /work/ document`
      );
    } else if (hasWorkEdge) {
      lateralWorkCovered += 1;
    }

    if (post?.type === "research" && !hasResearchEdge) {
      fail(
        `graph depth: /blog/${slug}/ is type=research but its related section never links the canonical /research/ document`
      );
    } else if (hasResearchEdge) {
      lateralResearchCovered += 1;
    }

    if (hasWorkEdge || hasResearchEdge) {
      articleBodyCrossLinks.add(slug);
    }
  }

  if (articleBodyCrossLinks.size === articleRoutes.length) {
    pass(
      `graph depth: related-content graph fully crawlable — every article renders its declared related links or lateral collection edges`
    );
  }

  const connectedCount = articleRoutes.filter((slug) => {
    return (
      hubCovered.has(slug) ||
      collectionCovered.has(slug) ||
      articleBodyCrossLinks.has(slug)
    );
  }).length;

  const connectedShare =
    articleRoutes.length > 0
      ? connectedCount / articleRoutes.length
      : 0;

  if (connectedShare < HUB_COVERAGE_FLOOR) {
    fail(
      `graph depth: only ${Math.round(connectedShare * 100)}% of articles are connected to a hub, collection, or related-article path (floor ${Math.round(HUB_COVERAGE_FLOOR * 100)}%)`
    );
  } else {
    pass(
      `graph depth: ${Math.round(connectedShare * 100)}% of articles (${connectedCount}/${articleRoutes.length}) are connected to meaningful hub/collection/topic paths`
    );
  }

  /* ---------- 4. Collection discoverability ---------------------------- */

  const home = pages.find((page) => page.file === "index.html");

  const blogIndex = pages.find((page) => page.file === path.join("blog", "index.html"));

  for (const collection of ["work", "research"]) {
    for (const [label, page] of [["home document", home], ["blog index", blogIndex]]) {
      if (page && !page.html.includes(`href="${routeHref(collection)}"`)) {
        fail(
          `graph depth: /${collection}/ is not linked from the ${label} — the canonical collections must stay discoverable from both surfaces`
        );
      }
    }
  }

  if (failures.every((entry) => !entry.includes("discoverable from both surfaces"))) {
    pass(
      "graph depth: /work/ and /research/ are discoverable from the home document and the blog index"
    );
  }

  /*
   * FIRST-ACTION MODEL (v3.9) — the home hero must expose the site's
   * primary discovery paths before the featured-work section begins.
   * Verified against the exported home HTML: inside the substring
   * from the top of the document to the FEATURED WORK section
   * marker (the hero + everything above the proof), the START HERE
   * entry-point nav must exist and carry all four canonical
   * destinations — Selected Work, Research, Blog, Contact — as real
   * crawlable hrefs. This keeps the first screen an orientation
   * surface, not a scroll puzzle: a first-time visitor always has an
   * obvious next action without JavaScript.
   */
  if (home) {
    const featuredMarker = home.html.indexOf("FEATURED WORK");

    const heroScope =
      featuredMarker > 0 ? home.html.slice(0, featuredMarker) : home.html;

    const heroExpectedHrefs = [
      routeHref("work"),
      routeHref("research"),
      routeHref("blog"),
      routeHref("contact")
    ].filter((href) => !href.startsWith("undefined"));

    const heroMissing = heroExpectedHrefs.filter(
      (href) => !heroScope.includes(`href="${href}"`)
    );

    if (!heroScope.includes("Start here")) {
      fail(
        "first action: the home hero's START HERE entry-point nav is missing from the exported HTML"
      );
    } else if (heroMissing.length > 0) {
      fail(
        `first action: the home hero entry points are missing canonical destinations: ${heroMissing.join(", ")}`
      );
    } else {
      pass(
        "first action: the home hero exposes START HERE entry points to /work/, /research/, /blog/, and /contact/ above the featured work"
      );
    }
  }

  /* ---------- 5. Anchor-text quality ----------------------------------- */

  const anchorPattern = new RegExp(
    `<a\\s[^>]*href="(${BASE_PATH}/(?:blog/[a-z0-9-]+/?|[a-z-]+/?))"[^>]*>([\\s\\S]*?)</a>`,
    "g"
  );

  const genericAnchors = [];

  for (const page of pages) {
    let match;

    anchorPattern.lastIndex = 0;

    while ((match = anchorPattern.exec(page.html)) !== null) {
      const text = stripHtmlToText(match[2]);

      if (!text) {
        continue;
      }

      if (GENERIC_ANCHORS.has(text)) {
        genericAnchors.push(
          `${page.file}: generic anchor text "${text}" → ${match[1]}`
        );
      }
    }
  }

  if (genericAnchors.length > 0) {
    for (const entry of genericAnchors) {
      fail(`graph depth: ${entry} (anchor text must be descriptive)`);
    }
  } else {
    pass(
      "graph depth: no generic anchor text — every internal content link is descriptive"
    );
  }

  /* ---------- 6. Canonical ↔ sitemap coherence ------------------------- */

  const sitemapText = await readText(path.join("sitemap.xml"));

  const sitemapLocs = new Set(
    [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
  );

  let canonicalMismatches = 0;

  const canonicalChecks = [
    ...CONTENT_ROUTES.map((entry) => ({ route: entry.route })),
    ...articleRoutes.map((slug) => ({ route: `blog/${slug}` }))
  ];

  for (const { route } of canonicalChecks) {
    const file = path.join(route, "index.html");

    const page = pages.find((candidate) => candidate.file === file);

    if (!page) {
      continue; /* missing export already reported by verifyPage() */
    }

    const canonical = page.html.match(
      /<link rel="canonical" href="([^"]+)"/
    );

    if (!canonical) {
      fail(`graph depth: /${route}/ has no canonical link element`);

      canonicalMismatches += 1;

      continue;
    }

    if (!sitemapLocs.has(canonical[1])) {
      fail(
        `graph depth: /${route}/ canonical ${canonical[1]} does not exactly match any sitemap <loc> — canonical and sitemap disagree`
      );

      canonicalMismatches += 1;
    }
  }

  if (canonicalMismatches === 0) {
    pass(
      "graph depth: every content page's canonical exactly matches a sitemap <loc>"
    );
  }

  /* ---------- 7. Graph depth report ------------------------------------ */

  console.log(
    `  · graph depth: hub-covered articles ${hubCovered.size}/${articleRoutes.length}, collection/home-covered ${collectionCovered.size}/${articleRoutes.length}, related-graph-covered ${articleBodyCrossLinks.size}/${articleRoutes.length} (declared-article + lateral work:${lateralWorkCovered} research:${lateralResearchCovered})`
  );

  if (failures.length > failureCountBefore) {
    fail(
      `graph depth: ${failures.length - failureCountBefore} graph-depth failure(s) listed above`
    );
  }
}

/* -------------------------------------------------------------------------- */
/* v4.0.4 — metadata QUALITY census + repository cleanliness on the export     */
/*                                                                            */
/* verifyMetadataQuality       — uniqueness + length sanity of titles and     */
/*   descriptions across every canonical route and article, twitter card      */
/*   coherence (card + image alt), og:image dimension declarations            */
/* verifyCanonicalUniqueness   — no two exported pages declare the same       */
/*   canonical URL (duplicate canonical identities fail loudly)               */
/* verifyEntityGraphIntegrity  — per page: JSON-LD @id values are unique and  */
/*   the page carries at most ONE Person and ONE WebSite node (the identity   */
/*   graph stays singular; duplicates are a v2-era regression class)          */
/* verifyNoWhatsAppRemnants    — WhatsApp was removed from the project in     */
/*   v4.0.4; ANY occurrence in the exported site (HTML, XML, JSON, TXT) is a  */
/*   build failure                                                           */
/* -------------------------------------------------------------------------- */

const WHATSAPP_PATTERN = /whatsapp|wa\.me/i;

async function verifyNoWhatsAppRemnants() {
  const files = [];

  async function collect(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await collect(full);
      } else if (/\.(html|xml|json|txt)$/.test(entry.name)) {
        files.push(full);
      }
    }
  }

  await collect(OUT_DIR);

  let scanned = 0;
  const hits = [];

  for (const file of files) {
    const content = await readFile(file, "utf8");
    scanned += 1;

    if (WHATSAPP_PATTERN.test(content)) {
      hits.push(path.relative(OUT_DIR, file));
    }
  }

  if (hits.length > 0) {
    fail(
      `whatsapp: removed-in-v4.0.4 contact channel reappeared in the export: ${hits.join(", ")}`
    );
  } else {
    pass(`whatsapp: zero remnants across ${scanned} exported file(s)`);
  }
}

/*
 * Canonical metadata census: every indexable exported page's title,
 * description, twitter card and og:image declarations, keyed by route.
 * verifyPage already asserts per-route exactness against the registry;
 * this census asserts the SITE-WIDE properties (uniqueness, sane
 * lengths, coherence) that per-route checks cannot see.
 */
async function verifyMetadataQuality(articleRoutes) {
  const pages = [{ route: "/", file: "index.html" }];

  for (const entry of CONTENT_ROUTES) {
    pages.push({ route: `/${entry.route}/`, file: path.join(entry.route, "index.html") });
  }

  pages.push({ route: "/blog/", file: path.join("blog", "index.html") });

  for (const slug of articleRoutes) {
    pages.push({
      route: `/blog/${slug}/`,
      file: path.join("blog", slug, "index.html")
    });
  }

  const titles = new Map();
  const descriptions = new Map();
  let missingTwitterAlt = 0;
  let missingOgDimensions = 0;

  for (const page of pages) {
    const file = page.file;

    if (!existsSync(path.join(OUT_DIR, file))) {
      continue; // verifyPage already reports the missing file
    }

    const html = await readText(file);

    const titleMatches = html.match(/<title[^>]*>([\s\S]*?)<\/title>/g) ?? [];
    const title =
      titleMatches.length === 1
        ? decodeEntities(titleMatches[0].replace(/<\/?title[^>]*>/g, "")).trim()
        : null;

    if (title) {
      titles.set(title, [...(titles.get(title) ?? []), page.route]);

      if (title.length < 15 || title.length > 80) {
        fail(
          `metadata quality: ${page.route} title length ${title.length} outside 15–80 ("${title}")`
        );
      }
    }

    const description = extractMatch(
      html,
      /<meta name="description" content="([^"]*)"/,
      "meta description",
      file
    );

    if (description) {
      descriptions.set(description, [
        ...(descriptions.get(description) ?? []),
        page.route
      ]);

      if (description.length < 50 || description.length > 320) {
        fail(
          `metadata quality: ${page.route} description length ${description.length} outside 50–320`
        );
      }
    }

    if (!/<meta name="twitter:card" content="summary_large_image"\/>/.test(html)) {
      fail(`metadata quality: ${page.route} missing twitter:card summary_large_image`);
    }

    if (!/<meta name="twitter:image:alt" content="[^"]+"\/>/.test(html)) {
      missingTwitterAlt += 1;
    }

    if (
      !/<meta property="og:image:width" content="\d+"\/>/.test(html) ||
      !/<meta property="og:image:height" content="\d+"\/>/.test(html)
    ) {
      missingOgDimensions += 1;
    }
  }

  for (const [title, routes] of titles) {
    if (routes.length > 1) {
      fail(`metadata quality: duplicate title "${title}" on ${routes.join(", ")}`);
    }
  }

  for (const [description, routes] of descriptions) {
    if (routes.length > 1) {
      fail(
        `metadata quality: duplicate meta description (${description.slice(0, 60)}…) on ${routes.join(", ")}`
      );
    }
  }

  if (missingTwitterAlt === 0) {
    pass(`metadata quality: twitter:image:alt present on all ${pages.length} indexable page(s)`);
  } else {
    fail(
      `metadata quality: ${missingTwitterAlt} page(s) missing twitter:image:alt (card image must not ship unlabelled)`
    );
  }

  if (missingOgDimensions === 0) {
    pass(`metadata quality: og:image width/height declared on all ${pages.length} indexable page(s)`);
  } else {
    fail(
      `metadata quality: ${missingOgDimensions} page(s) missing og:image:width/height declarations`
    );
  }

  if (titles.size === pages.length && descriptions.size === pages.length) {
    pass(
      `metadata quality: ${pages.length} page(s) carry ${titles.size} unique titles and ${descriptions.size} unique descriptions`
    );
  }
}

/*
 * Canonical identity census: at most one INDEXABLE page may claim a
 * canonical URL. Two pages declaring the same canonical is a
 * duplicate-identity regression that per-route checks cannot see.
 * Non-indexable documents (the exported 404s — Next emits noindex for
 * them, they inherit the root layout metadata and stay out of the
 * sitemap) are excluded: a noindex page's canonical is ignored by
 * search engines and cannot create a duplicate indexed identity.
 */
async function verifyCanonicalUniqueness() {
  const htmlFiles = await collectHtmlFiles(OUT_DIR);
  const canonicals = new Map();
  let skippedNonIndexable = 0;

  for (const file of htmlFiles) {
    if (file.endsWith("index.html") === false) {
      continue;
    }

    const html = await readFile(path.join(OUT_DIR, file), "utf8");

    if (/content="noindex/.test(html)) {
      skippedNonIndexable += 1;
      continue;
    }

    const canonical = extractMatch(
      html,
      /<link rel="canonical" href="([^"]*)"/,
      "canonical link",
      file
    );

    if (!canonical) {
      continue; // verifyPage/interactivity already report missing canonicals
    }

    canonicals.set(canonical, [...(canonicals.get(canonical) ?? []), file]);
  }

  let duplicates = 0;

  for (const [canonical, files] of canonicals) {
    if (files.length > 1) {
      duplicates += 1;
      fail(
        `canonical integrity: ${canonical} is declared by ${files.length} page(s): ${files.join(", ")}`
      );
    }
  }

  if (duplicates === 0) {
    pass(
      `canonical integrity: ${canonicals.size} canonical URL(s) across the export, each claimed by exactly one indexable page (${skippedNonIndexable} non-indexable document(s) excluded)`
    );
  }
}

/*
 * Per-page entity graph integrity: every JSON-LD @id appears once per
 * page, and the identity nodes stay singular (≤1 Person, ≤1 WebSite).
 */
async function verifyEntityGraphIntegrity() {
  const htmlFiles = await collectHtmlFiles(OUT_DIR);
  let pagesChecked = 0;
  let violations = 0;

  for (const file of htmlFiles) {
    if (!file.endsWith("index.html")) {
      continue;
    }

    const html = await readFile(path.join(OUT_DIR, file), "utf8");
    const blocks = extractJsonLdBlocks(html);

    if (blocks.length === 0) {
      continue;
    }

    pagesChecked += 1;

    const ids = new Map();
    const typeCounts = new Map();

    for (const block of blocks) {
      let parsed;

      try {
        parsed = JSON.parse(block);
      } catch {
        continue; // verifyPage already reports unparseable blocks
      }

      const graph = parsed["@graph"] ?? [parsed];

      for (const node of graph) {
        if (node?.["@id"]) {
          const id = node["@id"];
          ids.set(id, (ids.get(id) ?? 0) + 1);
        }

        if (typeof node?.["@type"] === "string") {
          typeCounts.set(
            node["@type"],
            (typeCounts.get(node["@type"]) ?? 0) + 1
          );
        }
      }
    }

    const label = file === "index.html" ? "/" : `/${file.replace(/\/index\.html$/, "")}/`;

    for (const [id, count] of ids) {
      if (count > 1) {
        violations += 1;
        fail(`entity graph: ${label} declares @id "${id}" ${count}× — duplicated entity node`);
      }
    }

    for (const singular of ["Person", "WebSite"]) {
      const count = typeCounts.get(singular) ?? 0;

      if (count > 1) {
        violations += 1;
        fail(
          `entity graph: ${label} emits ${count} ${singular} nodes — the identity graph must stay singular`
        );
      }
    }
  }

  if (violations === 0) {
    pass(
      `entity graph: ${pagesChecked} structured-data page(s) checked — unique @ids, singular Person/WebSite nodes`
    );
  }
}

async function main() {
  if (!existsSync(OUT_DIR)) {
    console.error("[seo] out/ does not exist — run `npm run build` first.");
    process.exit(1);
  }

  const articleRoutes = await collectArticleRoutes();

  const postsIndex = JSON.parse(
    await readFile(path.join(ROOT, "data", "blog", "posts.json"), "utf8")
  );

  const postBySlug = new Map(postsIndex.posts.map((post) => [post.slug, post]));

  /* Duplicate slug check */
  const slugs = postsIndex.posts.map((post) => post.slug);
  if (new Set(slugs).size !== slugs.length) {
    fail("data/blog/posts.json: duplicate article slug detected");
  }

  await verifyPage("home", "index.html", {
    title: "Parsa Tak — Software Engineer, Product Builder & AI Systems Researcher",
    canonical: `${SITE_ORIGIN}/`,
    types: ["WebSite", "Person", "WebPage"]
  });

  await verifyHomeContent(articleRoutes);

  await verifyPage("blog index", path.join("blog", "index.html"), {
    title: "Blog — Parsa Tak",
    canonical: `${SITE_ORIGIN}/blog/`,
    types: ["WebSite", "Person", "Blog"]
  });

  /*
   * Blog content-discovery checks (v3.7): articles, canonical
   * collections, content-type modes, and the primary-nav topology —
   * verified against the exported HTML, not the source tree.
   */
  await verifyBlogContentDiscovery(articleRoutes, postsIndex);

  for (const slug of articleRoutes) {
    const post = postBySlug.get(slug);
    if (!post) {
      fail(`blog/${slug}/: exported route has no matching content record`);
      continue;
    }

    await verifyPage(`blog/${slug}/`, path.join("blog", slug, "index.html"), {
      title: `${post.title} — Parsa Tak`,
      canonical: `${SITE_ORIGIN}/blog/${slug}/`,
      /*
       * Articles reference the Blog collection through the
       * /blog/#blog @id interlock — they do not embed the Blog node
       * itself (that lives on /blog/).
       */
      types: ["WebSite", "Person", "BlogPosting", "BreadcrumbList"]
    });

    /* Article-specific structured data: date + author + breadcrumb */
    const html = await readText(path.join("blog", slug, "index.html"));
    const blocks = extractJsonLdBlocks(html);
    for (const block of blocks) {
      const parsed = JSON.parse(block);
      const graph = parsed["@graph"] ?? [parsed];
      const posting = graph.find(
        (node) => node?.["@type"] === "BlogPosting"
      );
      if (!posting) continue;

      if (posting.datePublished !== post.date) {
        fail(`blog/${slug}/: JSON-LD datePublished ${posting.datePublished} != content date ${post.date}`);
      }
      if (posting.dateModified !== (post.updated ?? post.date)) {
        fail(`blog/${slug}/: JSON-LD dateModified does not match content updated/date`);
      }
      if (posting.author?.name !== post.author) {
        fail(`blog/${slug}/: JSON-LD author "${posting.author?.name}" != "${post.author}"`);
      }

      const breadcrumb = graph.find(
        (node) => node?.["@type"] === "BreadcrumbList"
      );
      if (!breadcrumb || !Array.isArray(breadcrumb.itemListElement)) {
        fail(`blog/${slug}/: BreadcrumbList missing or malformed`);
      } else {
        const names = breadcrumb.itemListElement.map((item) => item?.name);
        if (names[0] !== "Home" || names[1] !== "Blog" || names[2] !== post.title) {
          fail(`blog/${slug}/: breadcrumb names [${names.join(" → ")}] do not match Home → Blog → title`);
        }
      }
    }

    /* og article metadata */
    const file = path.join("blog", slug, "index.html");
    requireString(html, `<meta property="article:published_time" content="${post.date}"`, "article:published_time", file);
    requireString(html, `<meta property="article:modified_time" content="${post.updated ?? post.date}"`, "article:modified_time", file);
  }

  for (const entry of CONTENT_ROUTES) {
    await verifyPage(entry.route, path.join(entry.route, "index.html"), {
      title: entry.title,
      canonical: `${SITE_ORIGIN}/${entry.route}/`,
      types: entry.types
    });
  }

  await verifySitemap(articleRoutes);
  await verifyRobots();
  await verifyNoRss();
  await verifyInteractivity();
  await verifyInternalLinkGraph(articleRoutes);
  await verifyContentGraph();

  /*
   * SEO v2 graph-depth group: validates the SHAPE of the discovery
   * graph (hub representation, orphan-adjacency, anchor quality,
   * canonical↔sitemap coherence) beyond bare connectivity.
   */
  await verifySeoGraphDepth(articleRoutes, postsIndex);

  /* Favicon family + brand assets (v2.9) — checked with the export. */
  await verifyFaviconFamily();
  await verifyBrandAssetsInExport();

  /*
   * v4.0.4 quality + cleanliness group: site-wide metadata quality
   * census, canonical identity integrity, per-page entity graph
   * integrity, and the WhatsApp-remnant ban.
   */
  await verifyMetadataQuality(articleRoutes);
  await verifyCanonicalUniqueness();
  await verifyEntityGraphIntegrity();
  await verifyNoWhatsAppRemnants();

  console.log(`\n[seo] ${checks.length} check(s) passed`);
  for (const entry of checks) {
    console.log(`  ✓ ${entry}`);
  }

  if (failures.length > 0) {
    console.error(`\n[seo] ${failures.length} FAILURE(S):`);
    for (const failure of failures) {
      console.error(`  ✗ ${failure}`);
    }
    process.exit(1);
  }

  console.log("\n[seo] static SEO verification passed.");
}

main().catch((error) => {
  console.error("[seo] unexpected verification failure:", error);
  process.exit(1);
});
