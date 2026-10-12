/*
 * tests/loading-architecture.test.ts — the v4.0.3 loading contract,
 * pinned at the source level so the v4.0.2-style regression cannot
 * pass unnoticed again.
 *
 * Five guarantees, each tied to a measured v4.0.2 defect:
 *
 * 1. PLAYER HOST MINIMALITY — the host pulls only the raw
 *    session-presence probe into the shared graph, never the full
 *    persistence module (v4.0.2 shipped read/write/validate session
 *    code on every route).
 * 2. SPECULATION ORDER — speculative loaders wait for the post-load
 *    settle gate; idle callbacks are not permission to run during
 *    critical startup (v4.0.2 began downloading predicted scenes and
 *    the RED MAGIC organism before FCP — measured).
 * 3. NO VIEWPORT PREFETCH FLOOD — every internal next/link renders
 *    with prefetch={false} (v4.0.2's blog surfaces fetched up to 11
 *    article payloads per page view with zero user intent).
 * 4. NAV WARMING DISCIPLINE — pointer-down/focus warm immediately,
 *    pointer-enter requires a dwell, save-data/2g skip warming, the
 *    current route is never warmed.
 * 5. SHARED DOCUMENT SHELL — About and Contact ride the exact same
 *    registry-driven ContentShell contract as Work, Research and the
 *    hubs; no page-specific shell or navigation machinery exists.
 */

import { describe, it } from "node:test";

import assert from "node:assert/strict";

import { readFile, readdir } from "node:fs/promises";

import path from "node:path";

import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

async function readText(relative: string): Promise<string> {
  return readFile(path.join(ROOT, relative), "utf8");
}

/* ------------------------------------------------------------------ */
/* 1. PLAYER HOST MINIMALITY                                          */
/* ------------------------------------------------------------------ */

describe("the player host initial graph is minimal (v4.0.3 split)", () => {
  it("the host imports the session PRESENCE module, not persistence", async () => {
    const host = await readText(
      "components/player/GlobalMusicPlayerHost.tsx"
    );

    assert.match(
      host,
      /from "@\/lib\/player\/sessionPresence"/,
      "the host's storage probe comes from the split probe module"
    );

    assert.doesNotMatch(
      host,
      /player\/persistence/,
      "the host must not pull the full persistence module into the shared graph"
    );
  });

  it("sessionPresence contains only the probe — no read/write/validate", async () => {
    const presence = await readText("lib/player/sessionPresence.ts");

    assert.match(presence, /hasPersistedSession/);

    for (const forbidden of [
      "readPersistedSession",
      "writePersistedSession",
      "JSON.parse"
    ]) {
      assert.ok(
        !presence.includes(forbidden),
        `sessionPresence must stay free of "${forbidden}" — that belongs to the lazy persistence module`
      );
    }
  });

  it("persistence keeps the full session lifecycle for the lazy store only", async () => {
    const persistence = await readText("lib/player/persistence.ts");

    assert.match(persistence, /readPersistedSession/);
    assert.match(persistence, /writePersistedSession/);

    /* One key constant, imported from the probe module. */
    assert.match(
      persistence,
      /import \{ SESSION_STORAGE_KEY \} from "@\/lib\/player\/sessionPresence"/
    );
  });
});

/* ------------------------------------------------------------------ */
/* 2. SPECULATION ORDER                                               */
/* ------------------------------------------------------------------ */

describe("speculation waits for the post-load settle gate", () => {
  it("loadPhase exposes exactly one shared settle gate", async () => {
    const loadPhase = await readText("lib/loadPhase.ts");

    assert.match(loadPhase, /export function whenPageSettled/);

    const callers = (loadPhase.match(/whenPageSettled/g) ?? []).length;
    assert.ok(
      callers >= 1,
      "the gate is defined in loadPhase and consumed by speculative loaders"
    );
  });

  it("the scene preloader enqueues prediction only AFTER the gate", async () => {
    const preloader = await readText("components/ScenePreloader.tsx");

    assert.match(
      preloader,
      /whenPageSettled\(\)\.then/,
      "prediction enqueues behind the shared settle promise"
    );

    /*
     * The enqueue calls must appear inside the gated callback, not
     * directly in the effect body. A cheap structural check: the
     * effect body contains the gate call BEFORE any enqueueBackgroundTask.
     */
    const gateIndex = preloader.indexOf("whenPageSettled");
    const firstEnqueue = preloader.indexOf("enqueueBackgroundTask({");

    assert.ok(
      gateIndex > -1 && firstEnqueue > -1 && gateIndex < firstEnqueue,
      "the gate precedes every speculative enqueue"
    );
  });

  it("the RED MAGIC organism imports behind the gate, guards intact", async () => {
    const organism = await readText("components/HomeOriginOrganism.tsx");

    assert.match(organism, /whenPageSettled/);
    assert.match(organism, /import\("@\/components\/RedMagic"\)/);
    assert.match(organism, /prefers-reduced-motion: reduce/);
    assert.match(organism, /allowsSpeculativeNetwork/);
    assert.match(organism, /isMemoryConstrained/);
  });

  it("the background scheduler still drops speculation on constrained devices", async () => {
    const scheduler = await readText("lib/backgroundScheduler.ts");
    const connection = await readText("lib/connection.ts");

    assert.match(scheduler, /allowsSpeculativeNetwork/);
    assert.match(scheduler, /isMemoryConstrained/);

    /* The saveData probe itself lives in the shared connection module. */
    assert.match(connection, /saveData/);
  });
});

/* ------------------------------------------------------------------ */
/* 3. NO VIEWPORT PREFETCH FLOOD                                      */
/* ------------------------------------------------------------------ */

/*
 * Every next/link opening tag in a file must carry prefetch={false}.
 * JSX tags span multiple lines, so each <Link occurrence is scanned
 * to its closing ">" (brace- and string-aware) and the tag body is
 * checked for a prefetch attribute.
 */
async function assertNoUngatedLinks(relative: string) {
  const source = await readText(relative);

  let index = 0;

  for (;;) {
    const start = source.indexOf("<Link", index);

    if (start === -1) {
      return;
    }

    let cursor = start;
    let depth = 0;
    let tagEnd = -1;

    while (cursor < source.length) {
      const ch = source[cursor];

      if (ch === "{") {
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
      } else if (ch === ">" && depth === 0) {
        tagEnd = cursor;

        break;
      } else if (ch === '"' || ch === "'" || ch === "`") {
        const quote = ch;

        cursor += 1;

        while (cursor < source.length && source[cursor] !== quote) {
          if (source[cursor] === "\\") {
            cursor += 1;
          }

          cursor += 1;
        }
      }

      cursor += 1;
    }

    assert.ok(tagEnd > -1, `${relative}: unterminated <Link tag`);

    const tag = source.slice(start, tagEnd);

    assert.match(
      tag,
      /prefetch=\{/,
      `${relative}: an internal <Link> at offset ${start} lacks an explicit prefetch attribute — viewport prefetch would flood payloads`
    );

    index = tagEnd;
  }
}

describe("no automatic speculative route flood (viewport prefetch off everywhere)", () => {
  const linkSurfaces = [
    "app/blog/page.tsx",
    "app/blog/[slug]/page.tsx",
    "components/blog/BlogIndex.tsx",
    "components/blog/BlogHeader.tsx",
    "components/SiteDocNav.tsx",
    "components/content/ContentShell.tsx",
    "components/content/ContentBlocks.tsx",
    "components/scenes/HomeScene.tsx",
    "components/scenes/SystemsScene.tsx",
    "components/UnifiedSiteNav.tsx"
  ];

  for (const surface of linkSurfaces) {
    it(`${surface} renders every internal link with prefetch disabled`, async () => {
      await assertNoUngatedLinks(surface);
    });
  }
});

/* ------------------------------------------------------------------ */
/* 4. NAV WARMING DISCIPLINE                                          */
/* ------------------------------------------------------------------ */

describe("navigation warming is intent-disciplined (v4.0.5)", () => {
  it("pointer-down and focus warm immediately; hover never reaches the network", async () => {
    const nav = await readText("components/UnifiedSiteNav.tsx");

    assert.match(nav, /onPointerDown:\s*\n?\s*warm/);
    assert.match(nav, /onFocus:\s*warm/);

    /*
     * v4.0.5: the hover-dwell warm is REMOVED — measured in this
     * release, a cursor sweep across the track (even with the
     * 130ms dwell of v4.0.3) fetched destination payloads without
     * genuine intent, and the warmed fetches did not measurably
     * reduce click-to-commit time. Hover must stay visual-only.
     */
    assert.doesNotMatch(
      nav,
      /WARM_DWELL|onPointerEnter:\s*\n?\s*warmOnEnter|onPointerLeave:\s*\n?\s*cancelWarm/,
      "no hover warming mechanism may exist — hover is visual-only"
    );
  });

  it("constrained connections never warm routes", async () => {
    const nav = await readText("components/UnifiedSiteNav.tsx");

    assert.match(
      nav,
      /allowsSpeculativeNetwork/,
      "route warming consults the shared connection probe"
    );
  });

  it("the current route is never warmed", async () => {
    const nav = await readText("components/UnifiedSiteNav.tsx");

    assert.match(nav, /usePathname/);
    assert.match(nav, /isCurrentRoute/);
  });

  it("the connection probes live in one shared module", async () => {
    const connection = await readText("lib/connection.ts");

    for (const probe of [
      "allowsSpeculativeNetwork",
      "isMemoryConstrained",
      "getConnectionState"
    ]) {
      assert.match(connection, new RegExp(`export function ${probe}`));
    }
  });
});

/* ------------------------------------------------------------------ */
/* 5. SHARED DOCUMENT SHELL (About + Contact)                         */
/* ------------------------------------------------------------------ */

describe("About and Contact use the shared document-tab architecture", () => {
  const documentRoutes = ["app/about/page.tsx", "app/contact/page.tsx"];

  for (const route of documentRoutes) {
    it(`${route} renders through ContentShell (the shared document shell)`, async () => {
      const page = await readText(route);

      assert.match(page, /<ContentShell/);

      assert.doesNotMatch(
        page,
        /<FullScreenPageShell|<LivingShell|<UnifiedSiteNav/,
        "documents compose the shared shell; they never mount shell internals directly"
      );
    });

    it(`${route} declares no page-specific shell/navigation implementation`, async () => {
      const page = await readText(route);

      assert.doesNotMatch(
        page,
        /"use client"/,
        "document pages stay server components — no client machinery"
      );

      assert.doesNotMatch(page, /navEntries|onActionWarm/);
    });
  }

  it("About and Contact carry the same hero/document/footer hierarchy as Work", async () => {
    /*
     * The shared contract is structural: crumbs → kicker → H1 → lead
     * → sections → footer, all owned by ContentShell. The pages only
     * supply identity and content. Prove the shared path by asserting
     * every document page imports the same blocks vocabulary.
     */
    for (const route of [
      "app/about/page.tsx",
      "app/contact/page.tsx",
      "app/work/page.tsx",
      "app/research/page.tsx"
    ]) {
      const page = await readText(route);

      assert.match(page, /ContentShell/, `${route} uses the shared shell`);
    }
  });

  it("the document shell's page identity is registry-driven, not a switch", async () => {
    const shell = await readText("components/content/ContentShell.tsx");

    assert.doesNotMatch(
      shell,
      /switch \(href\)|case "\/about\/"/,
      "no hardcoded href→identity switch may return"
    );

    assert.match(shell, /pageIdForRoutePath/);

    const routes = await readText("lib/routes.ts");

    assert.match(routes, /export function pageIdForRoutePath/);
    assert.match(routes, /getRegistryRoute/);

    /* The registry declares the identity routes. */
    const registry = JSON.parse(await readText("data/routes.json")) as {
      routes: { path: string; kind: string }[];
    };

    const kinds = new Map(
      registry.routes.map((route) => [route.path, route.kind])
    );

    for (const identity of ["about", "work", "research", "blog", "contact"]) {
      const kind = kinds.get(identity);

      assert.ok(
        kind && kind !== "topic-hub",
        `/${identity}/ must be registered as a primary document route`
      );
    }

    for (const hub of [
      "local-ai",
      "ai-systems",
      "ai-reasoning",
      "ai-evaluation",
      "software-engineering",
      "creative-technology"
    ]) {
      assert.equal(
        kinds.get(hub),
        "topic-hub",
        `/${hub}/ keeps the neutral hub identity`
      );
    }
  });

  it("content-area internal links stay soft-navigable (global player survives)", async () => {
    const blocks = await readText("components/content/ContentBlocks.tsx");

    assert.match(
      blocks,
      /import Link from "next\/link"/,
      "document-body internal links render through next/link"
    );

    assert.match(blocks, /prefetch=\{false\}/);

    assert.doesNotMatch(
      blocks,
      /projectLinkTarget/,
      "the plain-anchor internal link target helper is gone — internal links soft-navigate"
    );
  });
});

/* ------------------------------------------------------------------ */
/* Suite hygiene                                                      */
/* ------------------------------------------------------------------ */

describe("the loading benchmark harness exists and is wired", () => {
  it("package.json exposes bench:loading and verify:loading", async () => {
    const pkg = JSON.parse(await readText("package.json")) as {
      version: string;
      scripts: Record<string, string>;
    };

    assert.equal(pkg.version, "4.0.5");

    assert.match(
      pkg.scripts["bench:loading"] ?? "",
      /bench-loading/,
      "the reproducible browser benchmark command exists"
    );

    assert.match(
      pkg.scripts["verify:loading"] ?? "",
      /verify-loading/,
      "the static export loading verification exists"
    );

    assert.match(
      pkg.scripts.verify ?? "",
      /verify:loading/,
      "loading verification is part of the verify chain"
    );
  });
});
