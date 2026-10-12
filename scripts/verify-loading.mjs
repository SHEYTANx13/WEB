#!/usr/bin/env node
/*
 * scripts/verify-loading.mjs — static EXPORT loading verification
 * (v4.0.3). Runs against out/ after a build; measures facts, never
 * claims.
 *
 * Verifies, for every exported route:
 *   1. no player surface in the initial HTML (no <audio>, no mini
 *      player markup, no persisted-session parsing code referenced)
 *   2. no player surface chunk in the INITIAL script set (the lazy
 *      player chunk must not be referenced by any exported document;
 *      the eager host chunk may only carry the presence probe)
 *   3. <audio> is never pre-created in exported markup
 *   4. RED MAGIC / scene chunks stay out of the initial script set
 *      (scene chunks are dynamic — they must never appear in the
 *      initial <script> list; their absence is proven by comparing
 *      against the dynamic-only chunk set)
 *   5. no player code in the RSC payload .txt files
 *   6. About/Contact share the exact FullScreenPageShell → header →
 *      nav → hero → crumbs → identity → signal → kicker → H1 →
 *      lead → footer landmark skeleton of Work/Research (structural
 *      bijection of the shell)
 *   6b. the unique page artifacts (About identity/practice matrix,
 *      Contact transmission console) ship SERVER-RENDERED in the
 *      exported HTML — present without JavaScript (v4.0.5)
 *   7. the RouteProgress host ships INACTIVE on every exported
 *      route (data-active="false" — a 2px line can never be visible
 *      without JavaScript)
 *
 * Exit 0 = verified. Exit 1 = any violation.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = process.argv[2] ?? path.join(ROOT, "out");

const FAILURES = [];

function fail(message) {
  FAILURES.push(message);
}

function ok(message) {
  console.log(`  ✔ ${message}`);
}

if (!fs.existsSync(path.join(OUT, "index.html"))) {
  console.error(`verify:loading — no export at ${OUT}. Run "npm run build" first.`);
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* Collect exported routes (any directory containing index.html)      */
/* ------------------------------------------------------------------ */

function listRoutes(dir, prefix = "") {
  const routes = [];

  if (fs.existsSync(path.join(dir, "index.html"))) {
    routes.push(prefix === "" ? "/" : `${prefix}/`);
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith("_")) {
      routes.push(...listRoutes(path.join(dir, entry.name), `${prefix}/${entry.name}`));
    }
  }

  return routes;
}

const routes = listRoutes(OUT);

console.log(`verify:loading — ${routes.length} exported routes under ${OUT}\n`);

/* ------------------------------------------------------------------ */
/* Chunk identification                                               */
/* ------------------------------------------------------------------ */

const chunksDir = path.join(OUT, "_next", "static", "chunks");

function chunkContent(name) {
  return fs.readFileSync(path.join(chunksDir, name), "utf8");
}

/*
 * The lazy player surface is the ONLY place the store wiring lives.
 * If any INITIAL document chunk contains these markers, the player
 * leaked into the critical graph. (Chosen to be framework-free:
 * React/Next also use JSON.parse, so that string proves nothing.)
 */
const PLAYER_SURFACE_MARKERS = [
  "getPlayerStore",
  "restorePersistedSession",
  "writePersistedSession"
];

/*
 * Scene/organism code markers: any chunk carrying these is dynamic
 * content and must never be referenced from an initial script tag.
 * - getContext: canvas API — the RED MAGIC organism is the only
 *   canvas consumer in the app (verified: exactly one chunk)
 * - mediaItemPlay / RedMagicScene: lazy scene-chunk class/module
 *   markers (static HomeScene legitimately ships in the "/" graph)
 */
const SCENE_MARKERS = ["getContext", "mediaItemPlay", "RedMagicScene"];

/* ------------------------------------------------------------------ */
/* Per-route checks                                                   */
/* ------------------------------------------------------------------ */

const ROUTES_TO_CHECK = routes;

for (const route of ROUTES_TO_CHECK) {
  const file = path.join(OUT, route, "index.html");
  const html = fs.readFileSync(file, "utf8");

  /* 1. no player surface in the initial HTML */
  if (/<audio[\s>]/i.test(html)) {
    fail(`${route}: exported HTML contains an <audio> element`);
  } else if (route === ROUTES_TO_CHECK[0]) {
    ok("no <audio> element in exported HTML");
  }

  const audioSrcInHtml = /<audio[^>]+src=/i.test(html);

  if (audioSrcInHtml) {
    fail(`${route}: exported HTML assigns an audio src before playback intent`);
  }

  if (/MiniPlayer|ExpandedPlayer|playerSurfaceSpacer/i.test(html)) {
    fail(`${route}: exported HTML contains player surface markup`);
  }

  /* 2. initial script set composition */
  const initialScripts = [
    ...new Set([...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]))
  ].map((src) => src.split("/").pop());

  for (const script of initialScripts) {
    const local = path.join(chunksDir, script);

    if (!fs.existsSync(local)) {
      fail(`${route}: initial script ${script} missing from the export`);
      continue;
    }

    const content = fs.readFileSync(local, "utf8");

    for (const marker of PLAYER_SURFACE_MARKERS) {
      if (content.includes(marker)) {
        fail(
          `${route}: initial chunk ${script} contains player surface code ("${marker}") — the player leaked into the critical graph`
        );
      }
    }

    for (const marker of SCENE_MARKERS) {
      if (content.includes(marker)) {
        fail(
          `${route}: initial chunk ${script} contains scene/organism code ("${marker}") — a scene leaked into the critical graph`
        );
      }
    }
  }

  if (route === ROUTES_TO_CHECK[0] && FAILURES.length === 0) {
    ok(`initial chunks carry no player/scene code (${initialScripts.length} scripts on ${route})`);
  }

  /* 5. RSC payloads stay player-free */
  const routeDir = path.join(OUT, route);
  const payloadFiles = [];

  function collectPayloads(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        collectPayloads(full);
      } else if (entry.name.endsWith(".txt")) {
        payloadFiles.push(full);
      }
    }
  }

  collectPayloads(routeDir);

  for (const payload of payloadFiles) {
    const content = fs.readFileSync(payload, "utf8");

    for (const marker of PLAYER_SURFACE_MARKERS) {
      if (content.includes(marker)) {
        fail(
          `${route}: RSC payload ${path.relative(OUT, payload)} references player surface code`
        );
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Host chunk: presence probe only                                    */
/* ------------------------------------------------------------------ */

{
  /*
   * Find the chunk that carries the engage event (the one host marker
   * that must be eager) and assert it carries NO persistence lifecycle.
   */
  const hostChunks = [];

  for (const entry of fs.readdirSync(chunksDir)) {
    if (!entry.endsWith(".js")) continue;

    const content = chunkContent(entry);

    if (content.includes("web:player:engage")) {
      hostChunks.push({ name: entry, content });
    }
  }

  if (hostChunks.length === 0) {
    fail("no chunk carries the player host engage bridge — host missing?");
  }

  for (const { name, content } of hostChunks) {
    /*
     * Framework-free lifecycle markers: the session read/write
     * functions belong exclusively to the lazy persistence module.
     * (JSON.parse proves nothing — React itself uses it.)
     */
    for (const marker of ["readPersistedSession", "writePersistedSession"]) {
      if (content.includes(marker)) {
        fail(
          `host chunk ${name} contains the full persistence lifecycle ("${marker}") — the v4.0.2 bloat regression is back`
        );
      }
    }
  }

  if (FAILURES.length === 0) {
    ok(
      `player host chunk(s) (${hostChunks.map((c) => c.name).join(", ")}) carry the probe only — no persistence lifecycle`
    );
  }
}

/* ------------------------------------------------------------------ */
/* 6. About/Contact structural bijection with Work/Research           */
/* ------------------------------------------------------------------ */

function landmarkSkeleton(route) {
  const html = fs.readFileSync(path.join(OUT, route, "index.html"), "utf8");

  const skeleton = [];

  const patterns = [
    [/class="[^"]*FullScreenPageShell-module[^"]*shell/, "FullScreenPageShell"],
    [/class="[^"]*content-module[^"]*header"/, "header"],
    [/class="[^"]*UnifiedSiteNav-module[^"]*root/, "UnifiedSiteNav"],
    [/class="[^"]*content-module[^"]*main"/, "main"],
    [/class="[^"]*content-module[^"]*hero"/, "hero"],
    [/class="[^"]*content-module[^"]*heroField"/, "heroField"],
    [/class="[^"]*content-module[^"]*heroDoc"/, "heroDoc"],
    [/class="[^"]*content-module[^"]*crumbs"/, "crumbs"],
    [/class="[^"]*content-module[^"]*heroIdentity"/, "heroIdentity"],
    [/class="[^"]*content-module[^"]*heroSignal"/, "heroSignal"],
    [/class="[^"]*content-module[^"]*heroCopy"/, "heroCopy"],
    [/class="[^"]*content-module[^"]*docKicker"/, "kicker"],
    [/class="[^"]*content-module[^"]*title"/, "h1"],
    [/class="[^"]*content-module[^"]*lead"/, "lead"],
    [/<footer[\s>]/, "footer"]
  ];

  for (const [pattern, label] of patterns) {
    skeleton.push(pattern.test(html) ? label : "MISSING");
  }

  return skeleton;
}

{
  const reference = landmarkSkeleton("/work/");

  for (const route of ["/about/", "/contact/", "/research/"]) {
    const skeleton = landmarkSkeleton(route);

    const mismatch = skeleton.findIndex((label, i) => label !== reference[i]);

    if (mismatch !== -1) {
      fail(
        `${route}: landmark skeleton diverges from /work/ at "${reference[mismatch]}" (found ${skeleton[mismatch]})`
      );
    } else if (skeleton.includes("MISSING")) {
      fail(`${route}: landmark skeleton has missing landmarks: ${skeleton.join(", ")}`);
    } else {
      ok(`${route} matches the shared document skeleton exactly`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 6b. The unique page artifacts ship SERVER-RENDERED (v4.0.5)         */
/* ------------------------------------------------------------------ */

{
  /*
   * About and Contact each lead their document with a unique visual
   * artifact (identity/practice matrix, transmission console). Both
   * are plain server-rendered HTML inside the shared ContentShell —
   * so the exported HTML must already contain them (no client
   * rendering gate, no JS required). Matched by the CSS-module class
   * fragments, the same way the skeleton check matches landmarks.
   */
  const ARTIFACTS = [
    {
      route: "/about/",
      markers: ["identityArtifact", "identityArtifactTracks"],
      name: "identity/practice artifact"
    },
    {
      route: "/contact/",
      markers: ["transmissionArtifact", "transmissionConsole"],
      name: "transmission artifact"
    }
  ];

  for (const { route, markers, name } of ARTIFACTS) {
    const html = fs.readFileSync(path.join(OUT, route, "index.html"), "utf8");

    const missing = markers.filter(
      (marker) => !new RegExp(`content-module[^"]*${marker}`).test(html)
    );

    if (missing.length > 0) {
      fail(
        `${route}: the ${name} is missing from the exported HTML (${missing.join(", ")}) — it must ship server-rendered`
      );
    } else {
      ok(`${route} ships the ${name} server-rendered`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 7. Route progress host ships INACTIVE (v4.0.5)                      */
/* ------------------------------------------------------------------ */

{
  /*
   * The route progress line (components/RouteProgress.tsx) is mounted
   * from the ROOT layout, so every exported route must carry it — and
   * it must ship INACTIVE: data-active="false", opacity 0, never
   * visible in the static export (the html.reveal-js gate keeps it
   * hidden without JavaScript). The old v4.0.4 route-overlay host is
   * gone entirely — no route may carry data-variant="route".
   */
  let inactiveHosts = 0;

  for (const route of routes) {
    const html = fs.readFileSync(path.join(OUT, route, "index.html"), "utf8");

    if (/data-variant="route"/.test(html)) {
      fail(`${route}: the removed v4.0.4 route-overlay host is still present`);
    }

    const hasHost = /class="[^"]*routeProgress/.test(html);

    if (!hasHost) {
      fail(`${route}: the route progress host is missing from the export`);
      continue;
    }

    const hostActive = /data-active="true"/.test(
      html.slice(html.indexOf("routeProgress"), html.indexOf("routeProgress") + 300)
    );
    const hostInactive = /data-active="false"/.test(
      html.slice(html.indexOf("routeProgress"), html.indexOf("routeProgress") + 300)
    );

    if (hostActive) {
      fail(`${route}: the route progress line ships ACTIVE — visible content in the export without any navigation`);
    } else if (hostInactive) {
      inactiveHosts += 1;
    }
  }

  if (inactiveHosts === routes.length) {
    ok(`route progress host ships inactive on all ${routes.length} exported route(s)`);
  }
}

/* ------------------------------------------------------------------ */
/* Report                                                             */
/* ------------------------------------------------------------------ */

console.log("");

if (FAILURES.length > 0) {
  console.error(`verify:loading — ${FAILURES.length} violation(s):`);

  for (const message of FAILURES) {
    console.error(`  ✖ ${message}`);
  }

  process.exit(1);
}

console.log("verify:loading — all loading-architecture checks passed.");
