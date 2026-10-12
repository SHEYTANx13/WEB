/*
 * tests/architecture.test.ts — the v4.0.1 architecture contract,
 * pinned at the source level: the canonical architecture this
 * cleanup established, enforced so it cannot silently regress.
 *
 * These tests describe REALITY (the shipped architecture), not
 * aspirations: every assertion matches a verified property of the
 * repository as it exists today.
 */

import { describe, it } from "node:test";

import assert from "node:assert/strict";

import { readFile } from "node:fs/promises";

import path from "node:path";

import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

async function readText(relative: string): Promise<string> {
  return readFile(path.join(ROOT, relative), "utf8");
}

async function readJson(relative: string): Promise<unknown> {
  return JSON.parse(await readText(relative));
}

async function assertFileGone(relative: string, why: string) {
  await assert.rejects(
    () => readText(relative),
    /ENOENT/,
    `${relative} must not exist (${why})`
  );
}

describe("the Library → Media migration is finished (no legacy stack)", () => {
  it("no obsolete Library implementation file remains", async () => {
    await assertFileGone(
      "components/scenes/LibraryScene.tsx",
      "superseded by MediaScene"
    );

    await assertFileGone(
      "components/scenes/LibraryScene.module.css",
      "superseded by MediaScene.module.css"
    );

    await assertFileGone(
      "components/LibraryPdfReader.tsx",
      "superseded by MediaPdfReader"
    );

    await assertFileGone(
      "components/LibraryPdfReader.module.css",
      "superseded by MediaPdfReader.module.css"
    );

    await assertFileGone(
      "lib/contentRepository.ts",
      "superseded by lib/mediaRepository.ts"
    );

    await assertFileGone(
      "data/library.json",
      "superseded by data/media.json"
    );

    await assertFileGone(
      "scripts/validate-library-manifest.mjs",
      "superseded by scripts/validate-media-manifest.mjs"
    );
  });

  it("the canonical Media replacements all exist", async () => {
    const files = [
      "components/scenes/MediaScene.tsx",
      "components/MediaPdfReader.tsx",
      "lib/mediaRepository.ts",
      "data/media.json",
      "scripts/validate-media-manifest.mjs"
    ];

    for (const file of files) {
      await readFile(path.join(ROOT, file), "utf8");
    }
  });

  it("no active import references the removed Library modules", async () => {
    const sources = await readText("components/ScenePreloader.tsx");
    const registry = await readText("components/SceneRegistry.tsx");

    assert.doesNotMatch(sources, /LibraryScene|contentRepository/);
    assert.doesNotMatch(registry, /LibraryScene|contentRepository/);
  });
});

describe("one hash parser (SceneUrlSync owns the URL)", () => {
  it("the shell contains no competing hash parser", async () => {
    const shell = await readText("components/LivingShell.tsx");

    assert.ok(
      !shell.includes("readInitialScene"),
      "LivingShell must not parse the hash — SceneUrlSync owns parsing"
    );

    assert.ok(
      !shell.includes("normalizeInitialHash"),
      "LivingShell must not rewrite the URL — SceneUrlSync owns canonicalisation"
    );

    assert.doesNotMatch(
      shell,
      /location\.hash/,
      "the shell never reads the hash directly"
    );
  });

  it("SceneUrlSync resolves aliases and falls back safely", async () => {
    const sync = await readText("components/SceneUrlSync.tsx");

    assert.match(
      sync,
      /SCENE_ID_ALIASES/,
      "the deliberate compatibility alias map is consulted"
    );

    assert.match(
      sync,
      /return "home";/,
      "unrecognised hashes resolve to the safe fallback"
    );

    assert.match(
      sync,
      /decodeURIComponent/,
      "percent-encoded hashes are decoded before resolution"
    );
  });

  it("#library exists ONLY as the explicit compatibility alias", async () => {
    const sceneIds = await readText("lib/sceneIds.ts");
    const routes = (await readJson("data/routes.json")) as {
      scenes: { names: string[] };
    };

    assert.ok(
      !routes.scenes.names.includes("library"),
      "library is not a scene in the canonical registry"
    );

    assert.match(
      sceneIds,
      /library: "media"/,
      "the single deliberate alias lives in SCENE_ID_ALIASES"
    );

    const aliasBody = sceneIds.slice(
      sceneIds.indexOf("SCENE_ID_ALIASES")
    );

    const aliasEntries = aliasBody.match(/(\w+): "(\w+)"/g) ?? [];

    assert.deepEqual(
      aliasEntries,
      ['library: "media"'],
      "no other legacy scene alias exists"
    );
  });

  it("the scene vocabulary has exactly one source", async () => {
    const sceneIds = await readText("lib/sceneIds.ts");
    const sync = await readText("components/SceneUrlSync.tsx");

    assert.match(
      sceneIds,
      /export const SCENE_IDS/,
      "the ordered vocabulary list is exported once"
    );

    assert.match(
      sync,
      /SCENE_IDS\.includes/,
      "hash validation consumes the exported list"
    );
  });
});

describe("the work catalogue is unified", () => {
  it("the Work scene renders from WORK_ENTRIES (no project table of its own)", async () => {
    const scene = await readText("components/scenes/WorkScene.tsx");
    const model = await readText("components/scenes/workSceneModel.ts");

    assert.match(model, /WORK_ENTRIES/, "the scene model consumes the registry");

    assert.match(scene, /workSceneModel/, "the scene renders through the model");

    assert.doesNotMatch(
      scene,
      /github\.com\/Parsaetak/,
      "no hardcoded project URLs in the scene — every link comes from the registry"
    );
  });

  it("the homepage featured strip renders from WORK_ENTRIES", async () => {
    const home = await readText("components/scenes/HomeScene.tsx");

    assert.match(
      home,
      /WORK_ENTRIES/,
      "the homepage featured subset consumes the registry"
    );

    assert.doesNotMatch(
      home,
      /const featuredProjects: readonly FeaturedProject\[\] = \[/,
      "no independent featured-project table remains"
    );
  });

  it("the /work/ document and the scene share the same registry", async () => {
    const doc = await readText("app/work/page.tsx");

    assert.match(doc, /WORK_ENTRIES/);
  });
});

describe("canonical route model", () => {
  it("the blog link checker derives its routes from the registry", async () => {
    const pipeline = await readText("scripts/build-blog.mjs");

    assert.match(
      pipeline,
      /CANONICAL_ROUTE_PATHS = new Set\(\s*ROUTE_REGISTRY\.routes/,
      "canonical document routes are derived from data/routes.json"
    );

    assert.match(
      pipeline,
      /KNOWN_SCENES = new Set\(\[\s*\.\.\.ROUTE_REGISTRY\.scenes\.names/,
      "known hash scenes are derived from the registry"
    );
  });

  it("every canonical document route is accepted by the checker", async () => {
    const routes = (await readJson("data/routes.json")) as {
      routes: { path: string }[];
    };

    const paths = routes.routes
      .map((route) => route.path)
      .filter((p) => p !== "");

    const expected = [
      "about",
      "work",
      "research",
      "contact",
      "local-ai",
      "ai-systems",
      "ai-reasoning",
      "ai-evaluation",
      "software-engineering",
      "creative-technology",
      "blog"
    ];

    for (const route of expected) {
      assert.ok(
        paths.includes(route),
        `the registry must declare /${route}/`
      );
    }
  });

  it("articles link canonical documents, not hash stand-ins, for document intent", async () => {
    const { readdir } = await import("node:fs/promises");

    const dir = path.join(ROOT, "content", "blog");

    const files = (await readdir(dir)).filter((name) =>
      name.endsWith(".md")
    );

    for (const file of files) {
      const text = await readFile(path.join(dir, file), "utf8");

      assert.equal(
        (text.match(/\]\(\/#work\)/g) ?? []).length,
        0,
        `${file} links /#work for the work catalogue — the canonical destination is /work/`
      );
    }
  });
});

describe("the 404 is a real static document", () => {
  it("renders without client-side redirect machinery", async () => {
    const notFound = await readText("app/not-found.tsx");

    assert.ok(
      !notFound.startsWith('"use client"'),
      "the 404 is a server component — no client JS required"
    );

    assert.doesNotMatch(
      notFound,
      /window\.location/,
      "no client redirect through the location object"
    );

    assert.doesNotMatch(
      notFound,
      /usePathname|useEffect|addEventListener/,
      "no client hooks or listeners — pure static HTML"
    );
  });

  it("carries the required destinations and registry-derived areas", async () => {
    const notFound = await readText("app/not-found.tsx");

    assert.match(notFound, /routeHref\("\/"\)/, "Home link");
    assert.match(notFound, /routeHref\("\/blog\/"\)/, "Blog link");
    assert.match(notFound, /routeHref\("\/work\/"\)/, "Work link");
    assert.match(
      notFound,
      /REGISTRY_ROUTES/,
      "known areas derive from the canonical route registry"
    );

    const metadata = notFound;
    assert.match(
      metadata,
      /title: "Page not found — Parsa Tak"/,
      "proper document title"
    );
  });
});

describe("tests are typechecked", () => {
  it("the main tsconfig does not exclude the tests", async () => {
    const tsconfig = JSON.parse(await readText("tsconfig.json"));

    const exclude = tsconfig.exclude ?? [];

    assert.ok(
      !exclude.includes("tests"),
      "tests participate in the project typecheck"
    );
  });

  it("a dedicated test TypeScript configuration exists", async () => {
    const testConfig = JSON.parse(
      await readText("tsconfig.tests.json")
    );

    assert.equal(
      testConfig.extends,
      "./tsconfig.json",
      "the test config extends the project config without weakening it"
    );

    assert.ok(
      Array.isArray(testConfig.include) &&
        testConfig.include.some((entry: string) =>
          entry.startsWith("tests/")
        ),
      "the test config includes the test suite"
    );

    assert.equal(
      testConfig.compilerOptions?.strict ?? true,
      true,
      "strictness is inherited, not weakened"
    );
  });
});

describe("RED MAGIC stays lazy", () => {
  it("the scene resolves through the single dynamic import site", async () => {
    const preloader = await readText("components/ScenePreloader.tsx");

    assert.match(
      preloader,
      /import\(\s*"@\/components\/scenes\/RedMagicScene"/,
      "ScenePreloader owns the RedMagicScene dynamic import"
    );
  });

  it("the home hero mounts the organism at idle time, not statically", async () => {
    const organism = await readText(
      "components/HomeOriginOrganism.tsx"
    );

    assert.match(
      organism,
      /import\("@\/components\/RedMagic"\)/,
      "the home hero loads the engine through one dynamic import()"
    );

    assert.match(
      organism,
      /scheduleIdle/,
      "the import is scheduled at idle time"
    );

    assert.match(
      organism,
      /prefers-reduced-motion: reduce/,
      "reduced-motion visitors keep the static seed"
    );
  });

  it("the engine is split into focused modules with a thin shell", async () => {
    const shell = await readText("components/RedMagic.tsx");

    assert.ok(
      shell.length < 4000,
      "the React shell stays tiny — the engine lives in redmagic/ modules"
    );

    assert.match(
      shell,
      /mountRedMagicEngine/,
      "the shell mounts through the lifecycle entry point"
    );

    for (const engineModule of [
      "components/redmagic/engineState.ts",
      "components/redmagic/simulation.ts",
      "components/redmagic/render.ts",
      "components/redmagic/input.ts",
      "components/redmagic/lifecycle.ts"
    ]) {
      await readFile(path.join(ROOT, engineModule), "utf8");
    }
  });
});

describe("CI and the local commands describe the real pipeline", () => {
  it("CI always installs fresh (no node_modules cache)", async () => {
    const workflow = await readText(".github/workflows/deploy.yml");

    assert.ok(
      !workflow.includes("path: node_modules"),
      "node_modules is never cached"
    );

    assert.match(
      workflow,
      /run: npm ci/,
      "npm ci runs unconditionally"
    );

    assert.ok(
      !/Install dependencies[\s\S]{0,80}if:/.test(
        workflow
      ),
      "dependency installation is never conditional on a cache hit"
    );

    assert.match(
      workflow,
      /cache: npm/,
      "npm's package cache is retained"
    );
  });

  it("CI typechecks application code and tests", async () => {
    const workflow = await readText(".github/workflows/deploy.yml");

    assert.match(
      workflow,
      /run: npm run typecheck/,
      "the typecheck step runs before tests and build"
    );
  });

  it("npm start serves the static export, not next start", async () => {
    const pkg = JSON.parse(await readText("package.json"));

    assert.notEqual(
      pkg.scripts.start,
      "next start",
      "next start cannot serve output: export"
    );

    assert.match(
      pkg.scripts.start,
      /serve-static/,
      "the start script serves out/ through the zero-dependency preview"
    );

    assert.equal(
      pkg.version,
      "4.0.5",
      "the package version matches this release"
    );
  });
});

describe("retired navigation files and process diaries stay gone", () => {
  it("the retired components are not recreated", async () => {
    await assertFileGone(
      "components/CompactMenu.tsx",
      "superseded by UnifiedSiteNav's compact mode"
    );

    await assertFileGone(
      "components/SceneNavigator.tsx",
      "superseded by the unified navigation"
    );

    await assertFileGone(
      "components/blog/BlogAreaControl.tsx",
      "retired with the scene-link row"
    );
  });

  it("git history is the work log — no diary files in the tree", async () => {
    await assertFileGone(
      "worklog.md",
      "git history is the historical work log"
    );

    await assertFileGone("Updated-Files.md", "same");

    await assertFileGone("PUSH-NOTES.txt", "same");
  });
});

/* ---------------------------------------------------------------- */
/* v4.0.2 — ONE global music player, mounted from the root layout    */
/* ---------------------------------------------------------------- */

describe("the global music player architecture (v4.0.2)", () => {
  it("the ROOT layout mounts GlobalMusicPlayerHost exactly once", async () => {
    const layout = await readText("app/layout.tsx");

    assert.match(
      layout,
      /GlobalMusicPlayerHost/,
      "the root application layout renders the global player host"
    );

    assert.equal(
      (layout.match(/<GlobalMusicPlayerHost \/>/g) ?? []).length,
      1,
      "exactly ONE host mount site-wide"
    );
  });

  it("the world shell no longer owns the player (the v4.0.x gap is closed)", async () => {
    const shell = await readText("components/LivingShell.tsx");

    assert.doesNotMatch(
      shell,
      /GlobalMusicPlayerHost|PlayerRoot|PlayerSurface/,
      "LivingShell renders only on \"/\" — a player mounted there dies on route navigation"
    );

    await assertFileGone(
      "components/player/PlayerRoot.tsx",
      "superseded by GlobalMusicPlayerHost (root layout)"
    );
  });

  it("exactly ONE authoritative audio path exists (one element, one construction site)", async () => {
    const store = await readText("lib/player/playerStore.ts");

    assert.equal(
      (store.match(/new window\.Audio\(\)/g) ?? []).length,
      1,
      "the single HTMLAudioElement construction site lives in the store factory"
    );

    /* No other module creates media elements. */
    const playerSources = [
      "components/player/GlobalMusicPlayerHost.tsx",
      "components/player/PlayerSurface.tsx",
      "components/player/MiniPlayer.tsx",
      "components/player/ExpandedPlayer.tsx",
      "components/player/PlayerArtwork.tsx",
      "components/scenes/MediaScene.tsx"
    ];

    for (const file of playerSources) {
      const source = await readText(file);

      assert.doesNotMatch(
        source,
        /new Audio\(|HTMLAudioElement|createElement\("audio"\)|<audio[\s>]/,
        `${file} must not create its own audio element`
      );
    }
  });

  it("MediaScene is a catalog/intent surface, never the player owner", async () => {
    const scene = await readText("components/scenes/MediaScene.tsx");

    assert.doesNotMatch(
      scene,
      /attachElementListeners|attachMediaSession|setPlayerAudioFactory/,
      "element wiring and Media Session integration belong to the global player layer"
    );

    assert.doesNotMatch(
      scene,
      /<audio[\s>]/,
      "the scene renders no audio element"
    );

    /* Its player surface is intents + a read-only reflection. */
    assert.match(scene, /usePlayerState/);
    assert.match(scene, /getPlayerStore\(\)\.playNext/);
    assert.match(scene, /getPlayerStore\(\)\.addToQueue/);
  });

  it("the player host stays out of the main bundle discipline (no store import)", async () => {
    const host = await readText(
      "components/player/GlobalMusicPlayerHost.tsx"
    );

    assert.doesNotMatch(
      host,
      /playerStore|usePlayer|mediaRepository/,
      "the host bridges through a DOM event + a storage probe only"
    );

    assert.match(
      host,
      /hasPersistedSession/,
      "the restored-session probe is a raw storage check"
    );

    assert.match(
      host,
      /web:player:engage/,
      "the first-play engagement event drives the lazy mount"
    );
  });

  it("nothing is requested before playback intent (preload discipline)", async () => {
    const store = await readText("lib/player/playerStore.ts");

    assert.match(
      store,
      /element\.preload = "none"/,
      "the element is created with preload none"
    );

    assert.match(
      store,
      /audio\.preload = "none"/,
      "the discipline is applied by the store regardless of the factory"
    );

    assert.match(
      store,
      /element\.preload = "auto"/,
      "preload is raised exactly when a track URL is assigned"
    );

    /* The audio src assignment lives inside the playback commit. */
    assert.equal(
      (store.match(/element\.src = entry\.url/g) ?? []).length,
      1
    );
  });

  it("Media Session is centralized in the global player layer with the full action set", async () => {
    const store = await readText("lib/player/playerStore.ts");

    for (const action of [
      "play",
      "pause",
      "stop",
      "previoustrack",
      "nexttrack",
      "seekbackward",
      "seekforward",
      "seekto"
    ]) {
      assert.match(
        store,
        new RegExp(`registerAction\\("${action}"`),
        `Media Session registers ${action} with a per-action fallback`
      );
    }

    assert.match(store, /playbackState/);
    assert.match(store, /setPositionState/);
  });

  it("restoration never autoplays (the paused reload contract)", async () => {
    const store = await readText("lib/player/playerStore.ts");

    assert.match(
      store,
      /restorePersistedSession\(\): boolean/,
      "the store exposes the restore lifecycle"
    );

    const surface = await readText(
      "components/player/PlayerSurface.tsx"
    );

    assert.match(
      surface,
      /store\.restorePersistedSession\(\)/,
      "the surface restores on mount (inside the lazy chunk)"
    );

    assert.match(
      surface,
      /getMusicItems\(\)/,
      "the full catalog is registered so any route can resolve a session"
    );
  });

  it("persistence and volume use separate, versioned storage keys", async () => {
    const persistence = await readText("lib/player/persistence.ts");
    const presence = await readText("lib/player/sessionPresence.ts");
    const store = await readText("lib/player/playerStore.ts");

    /* The session key constant lives ONCE, in the presence probe module. */
    assert.match(presence, /"web-player-session"/);
    assert.match(presence, /export const SESSION_STORAGE_KEY/);

    assert.doesNotMatch(
      persistence,
      /"web-player-session"/,
      "persistence imports the key from sessionPresence — one constant, no duplicate"
    );

    assert.match(persistence, /SESSION_STORAGE_VERSION = "v1"/);

    assert.match(store, /"web-player-volume"/);
    assert.match(store, /VOLUME_STORAGE_VERSION = "v1"/);
  });

  it("the preview servers map .wav to its MIME type", async () => {
    for (const server of [
      "scripts/serve-static.mjs",
      "scripts/e2e-static-server.mjs"
    ]) {
      const source = await readText(server);

      assert.match(
        source,
        /"\.wav": "audio\/wav"/,
        `${server} serves WAV with the correct MIME`
      );
    }
  });
});
