/*
 * tests/route-progress.test.ts — the v4.0.5 ROUTE NAVIGATION
 * contract: exactly ONE lightweight mechanism for document-route
 * navigation, separated from the scene loading system.
 *
 *   navigation island (UnifiedSiteNav)
 *     → fires the intent event on a genuine internal click
 *   RouteProgress (root layout, mounted once)
 *     → grace period → 2px top line → destination commits → fade
 *
 * The v4.0.4 full-screen route overlay (GlobalRouteTransition +
 * routeIntent + the SceneLoadingScreen route variant) is gone; these
 * tests pin BOTH the new behavior and the absence of the old system.
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

async function assertFileGone(relative: string, why: string) {
  await assert.rejects(
    () => readText(relative),
    /ENOENT/,
    `${relative} must not exist (${why})`
  );
}

/* ------------------------------------------------------------------ */
/* 1. Exactly one route-loading mechanism — the old one is gone        */
/* ------------------------------------------------------------------ */

describe("the v4.0.4 route-overlay architecture is fully removed", () => {
  it("the obsolete route-loader files no longer exist", async () => {
    await assertFileGone(
      "components/GlobalRouteTransition.tsx",
      "replaced by components/RouteProgress.tsx in v4.0.5"
    );

    await assertFileGone(
      "lib/routeIntent.ts",
      "intent exclusion now lives in the navigation island itself"
    );
  });

  it("no source references the old route-transition machinery", async () => {
    for (const file of [
      "app/layout.tsx",
      "components/SceneLoadingScreen.tsx",
      "components/SceneLoadingScreen.module.css",
      "lib/loadPhase.ts"
    ]) {
      const source = await readText(file);

      assert.doesNotMatch(
        source,
        /GlobalRouteTransition|routeIntent|ROUTE_OVERLAY_DELAY_MS|ROUTE_TRANSITION_CAP_MS|data-variant="route"/,
        `${file} must not reference the removed route-overlay system`
      );
    }
  });

  it("the scene loader serves boot and scenes only — no route variant", async () => {
    const screen = await readText("components/SceneLoadingScreen.tsx");

    assert.match(screen, /"boot" \| "scene"/);
    assert.doesNotMatch(screen, /"route"/);
  });
});

/* ------------------------------------------------------------------ */
/* 2. The progress host: mounted once, non-blocking, race-safe         */
/* ------------------------------------------------------------------ */

describe("RouteProgress is the one route navigation signal", () => {
  it("the root layout mounts RouteProgress exactly once", async () => {
    const layout = await readText("app/layout.tsx");

    assert.match(layout, /<RouteProgress \/>/);
    assert.equal(
      (layout.match(/<RouteProgress \/>/g) ?? []).length,
      1,
      "exactly ONE progress host mount site-wide"
    );
  });

  it("timing constants live in loadPhase, not inline in the component", async () => {
    const loadPhase = await readText("lib/loadPhase.ts");
    const host = await readText("components/RouteProgress.tsx");

    assert.match(loadPhase, /export const ROUTE_PROGRESS_GRACE_MS = \d+/);
    assert.match(loadPhase, /export const ROUTE_PROGRESS_CAP_MS = \d+/);

    /*
     * v4.0.6: the exact contract values are pinned — the grace window
     * must stay short enough that warmed navigations never see the
     * signal, and the cap long enough to outlive any real navigation.
     */
    assert.match(loadPhase, /export const ROUTE_PROGRESS_GRACE_MS = 150/);
    assert.match(loadPhase, /export const ROUTE_PROGRESS_CAP_MS = 10000/);

    assert.match(host, /ROUTE_PROGRESS_GRACE_MS/);
    assert.match(host, /ROUTE_PROGRESS_CAP_MS/);
    assert.doesNotMatch(
      host,
      /setTimeout\(\s*\(\)\s*=>\s*\{[^}]*\},\s*\d{3,}\s*\)/,
      "no inline magic durations — both bounds are registry constants"
    );
  });

  it("the host is observational: it never blocks, traps, or delays", async () => {
    const host = await readText("components/RouteProgress.tsx");
    const css = await readText("components/RouteProgress.module.css");

    assert.doesNotMatch(
      host,
      /\.preventDefault\(/,
      "navigation is never prevented or delayed"
    );

    assert.doesNotMatch(
      host,
      /pushState|replaceState|window\.history\.|addEventListener\("popstate"/,
      "no history hacks — the pathname effect dismisses naturally"
    );

    /* Non-blocking in EVERY state. */
    assert.match(css, /pointer-events: none/);
    assert.doesNotMatch(css, /pointer-events: auto/);

    /* No focus trap, no scroll lock, decorative for AT. */
    assert.match(host, /aria-hidden="true"/);
    assert.doesNotMatch(host, /focus\(\)|tabIndex|overflow/);
  });

  it("race safety: monotonic tokens guard timers and dismissal", async () => {
    const host = await readText("components/RouteProgress.tsx");

    assert.match(host, /tokenRef/);
    assert.match(host, /\+\+tokenRef\.current/);
    assert.match(
      host,
      /pendingRef\.current\?\.token !==\s*\n?\s*token/,
      "stale timers and dismissals must no-op against the latest intent"
    );
    assert.match(
      host,
      /startedFrom/,
      "commits are compared against the intent's origin path"
    );
  });

  it("cannot remain permanently visible and never shows without JavaScript", async () => {
    const css = await readText("components/RouteProgress.module.css");

    /* The safety cap exists in the component (see timing test). */
    assert.match(
      css,
      /:global\(html\.reveal-js\)\s*\n?\s*\.routeProgress\[data-active="true"\]/,
      "visibility rides the reveal-js gate — the static export can never show the line"
    );

    assert.match(css, /opacity: 0/, "the resting state is invisible");
  });

  it("reduced motion collapses the sweep to a static line", async () => {
    const css = await readText("components/RouteProgress.module.css");

    const reduced = css.slice(
      css.indexOf("prefers-reduced-motion: reduce")
    );

    assert.match(
      reduced.slice(0, reduced.indexOf("}") + 2000),
      /routeProgress\[data-active="true"\]::after/,
      "the reduced-motion block restyles the segment"
    );

    const sweep = css.match(
      /@keyframes\s+routeProgressSweep\s*\{([\s\S]*?)\}/
    );

    assert.ok(sweep, "the sweep keyframes exist");
    assert.match(sweep[1], /translateX/, "compositor-only motion");
  });
});

/* ------------------------------------------------------------------ */
/* 2b. The v4.0.6 layered signal: track + segment, compositor-only     */
/* ------------------------------------------------------------------ */

describe("the v4.0.6 signal is a layered, compositor-only treatment", () => {
  it("the signal is a thin layered track + segment (3px, ::before + ::after)", async () => {
    const css = await readText("components/RouteProgress.module.css");

    /* Thin, top-of-viewport, fixed. */
    assert.match(css, /height:\s*3px/);
    assert.match(css, /position:\s*fixed/);
    assert.match(css, /top:\s*0/);

    /* The two layers exist: a full-width track and a moving segment. */
    assert.match(
      css,
      /\.routeProgress::before/,
      "the track layer exists"
    );
    assert.match(
      css,
      /\.routeProgress::after/,
      "the segment layer exists"
    );

    /* Both layers animate ONLY through transform/opacity. */
    const beforeBlock = css.slice(
      css.indexOf(".routeProgress::before"),
      css.indexOf(".routeProgress::after")
    );

    assert.doesNotMatch(
      beforeBlock,
      /width:|left:|right:|top:|bottom:/,
      "the track never animates layout properties"
    );
  });

  it("the segment accelerates with a transform-only timeline (translateX + scaleX)", async () => {
    const css = await readText("components/RouteProgress.module.css");

    const sweep = css.match(
      /@keyframes\s+routeProgressSweep\s*\{([\s\S]*?)\n\}/
    );

    assert.ok(sweep, "the sweep keyframes exist");
    assert.match(sweep[1], /translateX/, "horizontal travel");
    assert.match(sweep[1], /scaleX/, "the launch stretch");
    assert.doesNotMatch(
      sweep[1],
      /width|left|margin|top/,
      "no layout property inside the timeline"
    );
  });

  it("the track breathes through an opacity-only pulse", async () => {
    const css = await readText("components/RouteProgress.module.css");

    const breathe = css.match(
      /@keyframes\s+routeProgressBreathe\s*\{([\s\S]*?)\n\}/
    );

    assert.ok(breathe, "the breathe keyframes exist");
    assert.match(breathe[1], /opacity/, "opacity pulse");
    assert.doesNotMatch(
      breathe[1],
      /transform|width|left|top/,
      "the pulse never moves layout or geometry"
    );

    /* The pulse runs only under no-preference and only while active. */
    const noPreference = css.slice(
      css.indexOf("prefers-reduced-motion: no-preference")
    );

    assert.match(
      noPreference,
      /routeProgress\[data-active="true"\]::before[\s\S]*?routeProgressBreathe/,
      "the track pulse is gated on the active state and motion preference"
    );
  });

  it("reduced motion fully de-animates both layers", async () => {
    const css = await readText("components/RouteProgress.module.css");

    const reduced = css.slice(
      css.indexOf("prefers-reduced-motion: reduce")
    );

    assert.match(
      reduced,
      /\.routeProgress\[data-active="true"\]::before\s*\{[^}]*animation:\s*none/,
      "the track pulse stops"
    );

    assert.match(
      reduced,
      /\.routeProgress\[data-active="true"\]::after\s*\{[^}]*transform:\s*none/,
      "the segment collapses to a static line"
    );
  });

  it("the reveal-js gate still guards visibility in the static export", async () => {
    const css = await readText("components/RouteProgress.module.css");

    assert.match(
      css,
      /:global\(html\.reveal-js\)\s*\n?\s*\.routeProgress\[data-active="true"\]/,
      "visibility rides the reveal-js gate"
    );
  });
});

/* ------------------------------------------------------------------ */
/* 2c. Surface-ready reveals: ContentShell + scene loader (v4.0.6)     */
/* ------------------------------------------------------------------ */

describe("surface-ready entry reveals are CSS-only and reduced-motion safe", () => {
  it("every ContentShell document settles in once, gated by reveal-js and reduced motion", async () => {
    const css = await readText("components/content/content.module.css");

    const surfaceReady = css.indexOf("contentSurfaceReady");

    assert.ok(surfaceReady !== -1, "the surface-ready animation exists");

    const gated = css.slice(0, surfaceReady);

    assert.match(
      gated,
      /:global\(html\.reveal-js\)\s+\.main/,
      "the reveal is gated behind the reveal-js class"
    );

    const reduced = css.slice(css.indexOf("prefers-reduced-motion: reduce"));

    assert.match(
      reduced,
      /:global\(html\.reveal-js\) \.main\s*\{[^}]*animation:\s*none/,
      "reduced motion disables the entry reveal"
    );

    /* Compositor-only keyframes: opacity + transform, nothing else. */
    const keyframes = css.match(
      /@keyframes\s+contentSurfaceReady\s*\{([\s\S]*?)\n\}/
    );

    assert.ok(keyframes, "the keyframes exist");
    assert.match(keyframes[1], /opacity/);
    assert.match(keyframes[1], /translate3d/);
    assert.doesNotMatch(keyframes[1], /width|height|left|top|margin/);
  });

  it("the scene loader arrival is one-shot, visible-state-gated, and reduced-motion safe", async () => {
    const css = await readText("components/SceneLoadingScreen.module.css");

    /* The scene variant's content reveal starts only when visible. */
    assert.match(
      css,
      /\.sceneLoadingScreen\[data-variant="scene"\]\[data-visible="true"\] \.inner\s*\{[^}]*sceneLoadingScreenArrive/,
      "the arrival runs only on the visible state"
    );

    assert.match(
      css,
      /\.sceneLoadingScreen\[data-variant="scene"\]\[data-visible="true"\] \.mark\s*\{[^}]*sceneLoadingScreenMarkIgnite/,
      "the star ignition runs only on the visible state"
    );

    /* Keyframes stay compositor-only. */
    for (const name of [
      "sceneLoadingScreenArrive",
      "sceneLoadingScreenMarkIgnite"
    ]) {
      const keyframes = css.match(
        new RegExp(`@keyframes\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`)
      );

      assert.ok(keyframes, `the ${name} keyframes exist`);
      assert.match(keyframes[1], /opacity|transform/);
      assert.doesNotMatch(keyframes[1], /width|height|left|top|margin/);
    }

    /* Reduced motion disables both. */
    const reduced = css.slice(css.indexOf("prefers-reduced-motion: reduce"));

    assert.match(
      reduced,
      /\[data-variant="scene"\]\[data-visible="true"\] \.inner\s*\{[^}]*animation:\s*none/
    );
    assert.match(
      reduced,
      /\[data-variant="scene"\]\[data-visible="true"\] \.mark\s*\{[^}]*animation:\s*none/
    );
  });

  it("the blog route settle is untouched (one settle per surface, no new overlays)", async () => {
    const css = await readText("app/blog/template.css");

    assert.match(css, /blog-route-settle/);
    assert.match(css, /prefers-reduced-motion: reduce/);
  });
});

/* ------------------------------------------------------------------ */
/* 3. The intent event contract (island → host)                        */
/* ------------------------------------------------------------------ */

describe("the navigation island fires the intent, with the exclusion matrix", () => {
  it("both sides carry the identical event literal", async () => {
    const nav = await readText("components/UnifiedSiteNav.tsx");
    const host = await readText("components/RouteProgress.tsx");

    const EVENT = "web:route-progress";

    assert.match(
      host,
      new RegExp(`export const ROUTE_PROGRESS_EVENT = "${EVENT}"`),
      "the host owns and exports the contract"
    );

    assert.match(
      nav,
      new RegExp(`"${EVENT}"`),
      "the island carries the same literal (a local constant — see below)"
    );
  });

  it("the island excludes modifier clicks, prevented clicks, and the current route", async () => {
    const nav = await readText("components/UnifiedSiteNav.tsx");

    for (const guard of [
      "event.defaultPrevented",
      "event.button !== 0",
      "event.metaKey",
      "event.ctrlKey",
      "event.shiftKey",
      "event.altKey"
    ]) {
      assert.ok(
        nav.includes(guard),
        `missing intent guard: ${guard}`
      );
    }

    /* Same-route (active) clicks navigate nowhere — no progress. */
    assert.match(nav, /entry\.active\s*\n?\s*\?\s*undefined\s*:\s*onRouteProgress/);
  });

  it("external links and scene actions never fire the event", async () => {
    const nav = await readText("components/UnifiedSiteNav.tsx");

    /*
     * The progress intent handler is attached ONLY to the internal
     * next/link branch: the external anchor branch and the action
     * button branch are separate render paths. Extract the internal
     * Link branch (the last return of the NavEntry renderer) and the
     * external anchor branch (the preceding one) and verify the
     * handler placement.
     */
    const entryRenderer = nav.slice(
      nav.indexOf("function NavEntry("),
      nav.indexOf("Disclosure menu")
    );

    const externalReturn = entryRenderer.indexOf("entry.external");
    const internalReturn = entryRenderer.indexOf(
      "return (\n    <Link"
    );

    assert.ok(
      externalReturn !== -1 && internalReturn !== -1,
      "the entry renderer has external and internal branches"
    );

    const externalBranch = entryRenderer.slice(
      externalReturn,
      internalReturn
    );

    assert.doesNotMatch(
      externalBranch,
      /onRouteProgress/,
      "the external anchor branch never fires route progress"
    );

    const internalBranch = entryRenderer.slice(internalReturn);

    assert.match(
      internalBranch,
      /onRouteProgress/,
      "the internal Link branch carries the progress intent"
    );

    /*
     * Scene actions (the world-shell buttons) are a different KIND —
     * they render <button>, never a Link, so no navigation exists.
     */
    assert.match(
      nav,
      /kind: "action"/,
      "the action kind exists and is button-rendered"
    );
  });

  it("the navigation itself stays native — the click path never prevents default", async () => {
    const nav = await readText("components/UnifiedSiteNav.tsx");

    /*
     * The ROUTE PROGRESS handler must never prevent a click (the
     * only legitimate preventDefault in this component is the
     * disclosure menu's roving-keyboard handler — arrow-key focus
     * management, not navigation).
     */
    const fireRouteProgress = nav.slice(
      nav.indexOf("const fireRouteProgress"),
      nav.indexOf("const primary =")
    );

    assert.match(
      fireRouteProgress,
      /window\.dispatchEvent\(/,
      "the intent is a passive event dispatch"
    );

    assert.doesNotMatch(
      fireRouteProgress,
      /preventDefault|stopPropagation/,
      "the progress handler never interferes with the click"
    );
  });
});
