/*
 * tests/header-status.test.ts — the v4.0.5 HEADER identity contract:
 * ONE shared status implementation (SiteHeaderStatus) carried by
 * every major surface — the world HUD, the blog header and every
 * ContentShell document route — with labels resolved from the
 * authoritative registries (scene definitions / data/routes.json)
 * and never from route-specific code. Verified as durable behavior:
 * who implements the status, who renders it, where labels come
 * from, how the animation behaves, what reduced motion does. Never
 * x/y positions.
 */

import { describe, it } from "node:test";

import assert from "node:assert/strict";

import { readFile } from "node:fs/promises";

import path from "node:path";

import { fileURLToPath } from "node:url";

import { headerStatusForRoutePath } from "../lib/routes";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

async function readText(relative: string): Promise<string> {
  return readFile(path.join(ROOT, relative), "utf8");
}

/* ------------------------------------------------------------------ */
/* 1. One implementation, carried by every surface                     */
/* ------------------------------------------------------------------ */

describe("SiteHeaderStatus is the ONE shared status implementation", () => {
  it("the component exists exactly once, with its own stylesheet", async () => {
    const component = await readText("components/SiteHeaderStatus.tsx");
    const css = await readText("components/SiteHeaderStatus.module.css");

    assert.match(
      component,
      /export default function SiteHeaderStatus/,
      "the shared component is the canonical implementation"
    );

    assert.match(
      css,
      /headerStatusPulse/,
      "the shared pulse keyframes live in the status module"
    );

    /* No per-surface status variants exist. */
    for (const banned of [
      "components/LivingHeaderStatus.tsx",
      "components/BlogHeaderStatus.tsx",
      "components/ContentHeaderStatus.tsx"
    ]) {
      await assert.rejects(
        () => readText(banned),
        "no route-specific status variant may be created"
      );
    }
  });

  it("the world header uses it — and no duplicate status architecture remains", async () => {
    const shell = await readText("components/LivingShell.tsx");
    const shellCss = await readText("components/LivingShell.module.css");

    assert.match(
      shell,
      /import SiteHeaderStatus from "@\/components\/SiteHeaderStatus"/,
      "LivingShell imports the shared status"
    );

    assert.match(
      shell,
      /<SiteHeaderStatus\s+label=\{\s*activeSceneDefinition\?\.label/,
      "the world HUD renders the shared status with the live scene label"
    );

    /* The pre-v4.0.5 world status implementation is gone. */
    assert.doesNotMatch(
      shell,
      /livingShellStatusDot/,
      "the old livingShellStatusDot markup is removed"
    );

    assert.doesNotMatch(
      shellCss,
      /livingShellStatus|shellStatusPulse/,
      "the old world status CSS and keyframes are removed"
    );
  });

  it("the blog header uses it — and no duplicate status architecture remains", async () => {
    const header = await readText("components/blog/BlogHeader.tsx");
    const css = await readText("components/blog/BlogHeader.module.css");

    assert.match(
      header,
      /import SiteHeaderStatus from "@\/components\/SiteHeaderStatus"/,
      "BlogHeader imports the shared status"
    );

    assert.match(
      header,
      /<SiteHeaderStatus label="BLOG" \/>/,
      "the blog header renders the shared BLOG identity"
    );

    assert.doesNotMatch(
      header,
      /styles\.statusDot/,
      "the old local status markup is removed"
    );

    assert.doesNotMatch(
      css,
      /\.status\b|\.statusDot/,
      "the old blog status CSS is removed"
    );
  });

  it("ContentShell provides it to every document route automatically", async () => {
    const shell = await readText("components/content/ContentShell.tsx");

    assert.match(
      shell,
      /import SiteHeaderStatus from "@\/components\/SiteHeaderStatus"/,
      "ContentShell imports the shared status"
    );

    assert.match(
      shell,
      /<SiteHeaderStatus label=\{headerStatus\} \/>/,
      "the content header renders the shared status"
    );

    /*
     * Pages provide content only — no page renders status markup.
     */
    for (const page of [
      "app/about/page.tsx",
      "app/contact/page.tsx",
      "app/work/page.tsx",
      "app/research/page.tsx",
      "app/local-ai/page.tsx"
    ]) {
      const source = await readText(page);

      assert.doesNotMatch(
        source,
        /SiteHeaderStatus|statusDot/i,
        `${page} carries content, never header status markup`
      );
    }
  });

  it("the hub view passes route identity so hubs inherit the status", async () => {
    const hub = await readText("components/content/HubPageView.tsx");

    assert.match(
      hub,
      /activeHref=\{`\/\$\{hub\.slug\}\/`\}/,
      "HubPageView provides its registry slug as the shell's route identity"
    );
  });
});

/* ------------------------------------------------------------------ */
/* 2. Visual + animation contract                                      */
/* ------------------------------------------------------------------ */

describe("the shared status visual language", () => {
  it("the dot carries the shared red identity", async () => {
    const css = await readText("components/SiteHeaderStatus.module.css");

    const dotBlock = css.slice(
      css.indexOf(".dot {"),
      css.indexOf("@keyframes")
    );

    assert.match(dotBlock, /background:\s*var\(--red\)/, "the site red");
    assert.match(dotBlock, /border-radius:\s*50%/, "circular");
    assert.match(
      dotBlock,
      /box-shadow:[\s\S]*?rgba\(255,\s*32,\s*32/,
      "the quiet red glow"
    );
  });

  it("the pulse is transform/opacity based — no layout animation", async () => {
    const css = await readText("components/SiteHeaderStatus.module.css");

    const keyframes = css.slice(
      css.indexOf("@keyframes headerStatusPulse"),
      css.indexOf("@media")
    );

    assert.match(keyframes, /opacity:/, "opacity animates");
    assert.match(keyframes, /transform:\s*scale\(/, "transform animates");
    assert.doesNotMatch(
      keyframes,
      /\b(width|height|margin|padding|top|left)\b\s*:/,
      "no layout property animates"
    );
  });

  it("reduced motion stops the pulse but keeps the identity visible", async () => {
    const css = await readText("components/SiteHeaderStatus.module.css");

    const reduced = css.slice(
      css.indexOf("@media (prefers-reduced-motion: reduce)")
    );

    assert.match(reduced, /animation:\s*none/, "the pulse stops");
    assert.doesNotMatch(
      reduced,
      /display:\s*none/,
      "the dot and label never disappear under reduced motion"
    );
  });

  it("the component is server-safe — no client code, no animation state", async () => {
    const component = await readText("components/SiteHeaderStatus.tsx");

    assert.doesNotMatch(
      component,
      /"use client"|useEffect|useState|useRef|requestAnimationFrame|setInterval|setTimeout/,
      "a server-compatible presentational component — no new JS animation system"
    );
  });

  it("the dot is decorative; the label is the information", async () => {
    const component = await readText("components/SiteHeaderStatus.tsx");

    assert.match(
      component,
      /className=\{styles\.dot\}\s*aria-hidden="true"/,
      "the dot is aria-hidden"
    );

    /* aria-live only for genuinely dynamic hosts — never by default. */
    assert.match(
      component,
      /aria-live=\{live \? "polite" : undefined\}/,
      "static surfaces get no live region; the world shell opts in"
    );
  });

  it("only the world shell opts into live announcements", async () => {
    const shell = await readText("components/LivingShell.tsx");
    const blog = await readText("components/blog/BlogHeader.tsx");

    assert.match(
      shell,
      /<SiteHeaderStatus\s+label=\{\s*activeSceneDefinition\?\.label\s*\?\?\s*"Home"\s*\}\s+live\s*\/>/,
      "the world status announces scene changes (dynamically changing state)"
    );

    assert.doesNotMatch(
      blog,
      /<SiteHeaderStatus[^>]*\slive/,
      "the static blog status is not a live region"
    );
  });

  it("UnifiedSiteNav remains the only primary navigation renderer", async () => {
    for (const surface of [
      "components/LivingShell.tsx",
      "components/blog/BlogHeader.tsx",
      "components/content/ContentShell.tsx"
    ]) {
      const source = await readText(surface);

      assert.match(
        source,
        /import UnifiedSiteNav/,
        `${surface} renders the unified navigation`
      );

      assert.doesNotMatch(
        source,
        /PrimaryNav|HeaderNav|MainMenu(?!Nav)/,
        `${surface} creates no second navigation system`
      );
    }
  });
});

/* ------------------------------------------------------------------ */
/* 3. Status labels — resolved from the authoritative registries       */
/* ------------------------------------------------------------------ */

describe("content-route status labels resolve from the route registry", () => {
  it("primary documents resolve to their identity", () => {
    assert.equal(headerStatusForRoutePath("/"), "HOME");
    assert.equal(headerStatusForRoutePath("/about/"), "ABOUT");
    assert.equal(headerStatusForRoutePath("/contact/"), "CONTACT");
    assert.equal(headerStatusForRoutePath("/work/"), "WORK");
    assert.equal(headerStatusForRoutePath("/research/"), "RESEARCH");
    assert.equal(headerStatusForRoutePath("/blog/"), "BLOG");
  });

  it("topic hubs resolve to their visible topic identity", () => {
    assert.equal(headerStatusForRoutePath("/local-ai/"), "LOCAL AI");
    assert.equal(headerStatusForRoutePath("/ai-systems/"), "AI SYSTEMS");
    assert.equal(headerStatusForRoutePath("/ai-reasoning/"), "AI REASONING");
    assert.equal(headerStatusForRoutePath("/ai-evaluation/"), "AI EVALUATION");
    assert.equal(
      headerStatusForRoutePath("/software-engineering/"),
      "SOFTWARE ENGINEERING"
    );
    assert.equal(
      headerStatusForRoutePath("/creative-technology/"),
      "CREATIVE TECHNOLOGY"
    );
  });

  it("unregistered paths resolve to null — identities are never invented", () => {
    assert.equal(headerStatusForRoutePath("/not-a-route/"), null);
    assert.equal(headerStatusForRoutePath(undefined), null);
  });

  it("every registered route resolves a status label", async () => {
    const registry = await readText("data/routes.json");
    const routes = JSON.parse(registry) as {
      routes: { path: string }[];
    };

    for (const route of routes.routes) {
      const href = route.path === "" ? "/" : `/${route.path}/`;

      assert.ok(
        headerStatusForRoutePath(href) !== null,
        `the registered route ${href} earns its header status automatically`
      );
    }
  });

  it("world scenes use their actual scene labels", async () => {
    const shell = await readText("components/LivingShell.tsx");

    assert.match(
      shell,
      /label=\{\s*activeSceneDefinition\?\.label/,
      "the label comes from the live scene definition, not a hardcoded map"
    );

    /* The scene vocabulary keeps its actual identities. */
    for (const label of ["Home", "Systems", "RED Magic", "Work", "Media"]) {
      assert.match(
        shell,
        new RegExp(`label: "${label}"`),
        `the ${label} scene definition exists`
      );
    }
  });
});
