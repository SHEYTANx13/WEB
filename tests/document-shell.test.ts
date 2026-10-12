/*
 * tests/document-shell.test.ts — the v4.0.5 DOCUMENT UNIFICATION
 * contract, pinned at the source level:
 *
 * ALL document routes (About, Contact, Work, Research, the topic
 * hubs) ride ONE document composition system. Route identity may
 * change accent and decorative geometry only — never the layout
 * contract. These tests verify the DURABLE structure (which
 * landmarks exist and who owns them), not implementation trivia
 * (exact pixel values, selector spelling of internal states).
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

const HUB_ROUTES = [
  "app/local-ai/page.tsx",
  "app/ai-systems/page.tsx",
  "app/ai-reasoning/page.tsx",
  "app/ai-evaluation/page.tsx",
  "app/software-engineering/page.tsx",
  "app/creative-technology/page.tsx"
] as const;

const DIRECT_ROUTES = [
  "app/about/page.tsx",
  "app/contact/page.tsx",
  "app/work/page.tsx",
  "app/research/page.tsx"
] as const;

/* ------------------------------------------------------------------ */
/* 1. Every document route composes the ONE shared shell               */
/* ------------------------------------------------------------------ */

describe("all document routes use the one shared document shell", () => {
  for (const route of DIRECT_ROUTES) {
    it(`${route} renders through ContentShell and nothing else`, async () => {
      const page = await readText(route);

      assert.match(
        page,
        /<ContentShell/,
        `${route} must compose the shared shell`
      );

      assert.doesNotMatch(
        page,
        /FullScreenPageShell|UnifiedSiteNav|SiteFooter|LivingShell/,
        `${route} never mounts shell internals directly — the shell owns them`
      );

      assert.doesNotMatch(
        page,
        /"use client"/,
        "document routes stay server components — no client state in the body"
      );

      assert.doesNotMatch(
        page,
        /Animation|heroSignal|heroField|heroIdentity/,
        "documents never implement hero machinery themselves"
      );
    });
  }

  /*
   * The six topic hubs render through the SHARED hub renderer
   * (HubPageView), which is itself a ContentShell composition — the
   * same contract, one more level of shared code. Route files stay
   * thin: metadata + definition lookup.
   */
  for (const route of HUB_ROUTES) {
    it(`${route} renders through the shared hub view`, async () => {
      const page = await readText(route);

      assert.match(
        page,
        /<HubPageView/,
        `${route} must compose the shared hub renderer`
      );

      assert.doesNotMatch(
        page,
        /"use client"|FullScreenPageShell|UnifiedSiteNav|SiteFooter|LivingShell/,
        `${route} stays a thin server route over the shared shell`
      );
    });
  }

  it("the shared hub renderer is itself a ContentShell composition", async () => {
    const hubView = await readText("components/content/HubPageView.tsx");

    assert.match(hubView, /<ContentShell/);
    assert.doesNotMatch(hubView, /"use client"/);
  });

  it("exactly one H1 is declared by the shared shell, once", async () => {
    const shell = await readText("components/content/ContentShell.tsx");

    assert.match(shell, /<h1 className=\{styles\.title\}>/);
    assert.equal(
      (shell.match(/<h1/g) ?? []).length,
      1,
      "the shell renders exactly one H1 per document"
    );
  });
});

/* ------------------------------------------------------------------ */
/* 2. The hero composition contract                                    */
/* ------------------------------------------------------------------ */

describe("the hero composition is one shared structure", () => {
  it("the shell renders the full landmark tree for every document", async () => {
    const shell = await readText("components/content/ContentShell.tsx");

    for (const landmark of [
      "styles.heroField",
      "styles.heroDoc",
      "styles.crumbs",
      "styles.heroIdentity",
      "styles.heroSignal",
      "styles.heroCopy",
      "styles.docKicker",
      "styles.title",
      "styles.lead",
      "styles.heroCue"
    ]) {
      assert.match(
        shell,
        new RegExp(landmark.replace(".", "\\.")),
        `the shared shell declares ${landmark}`
      );
    }
  });

  it("the hero signal belongs to the title identity, in document flow", async () => {
    const css = await readText("components/content/content.module.css");

    const signalBlock = css.slice(
      css.indexOf(".heroSignal {"),
      css.indexOf(".heroSignalRing")
    );

    assert.match(
      signalBlock,
      /position: relative/,
      "in-flow inside the identity row — not an absolute overlay"
    );

    assert.doesNotMatch(
      signalBlock,
      /bottom: calc|top: calc|left: -|right: -/,
      "no absolute positioning formulas that depend on content height"
    );

    /*
     * The identity row is a flow container: the signal sits BESIDE
     * the copy, so it can never overlap the crumbs, the H1, or the
     * lead, and can never be clipped on narrow screens.
     */
    const identityBlock = css.slice(
      css.indexOf(".heroIdentity {"),
      css.indexOf(".heroCopy")
    );

    assert.match(identityBlock, /display: flex/);
    assert.match(identityBlock, /align-items: flex-start/);
  });

  it("the hero is top-anchored — the title baseline cannot move between pages", async () => {
    const css = await readText("components/content/content.module.css");

    const heroBlock = css.slice(
      css.indexOf(".hero {"),
      css.indexOf(".heroField")
    );

    assert.match(
      heroBlock,
      /justify-content: flex-start/,
      "content starts at one consistent spacing token, never content-height-centered"
    );
  });

  it("signal motion is compositor-only and collapses under reduced motion", async () => {
    const css = await readText("components/content/content.module.css");

    const orbitBlock = css.match(
      /@keyframes\s+heroSignalOrbit\s*\{([\s\S]*?)\}/
    );

    assert.ok(orbitBlock, "the orbit keyframes exist");
    assert.match(orbitBlock[1], /rotate/);
    assert.ok(
      !/width|height|top|left|margin|padding/.test(orbitBlock[1]),
      "orbit is transform-only"
    );

    const reduced = css.slice(
      css.indexOf("prefers-reduced-motion: reduce")
    );

    assert.match(
      reduced.slice(0, reduced.indexOf("}") + 4000),
      /heroSignal::after/,
      "the reduced-motion block restyles the hero signal"
    );
  });
});

/* ------------------------------------------------------------------ */
/* 3. Route identity is accent + decorative geometry ONLY              */
/* ------------------------------------------------------------------ */

describe("route-specific CSS is decorative only", () => {
  it("data-page rules never touch layout-critical hero classes", async () => {
    const css = await readText("components/content/content.module.css");

    /*
     * Every [data-page] rule may only style the DECORATIVE field
     * vocabulary (heroField / heroRing / heroAxis / heroNode). A
     * data-page rule that styles the rail, crumbs, kicker, title,
     * lead, signal, or identity would break the one-layout contract.
     */
    const pageRules = css.match(
      /:global\(\[data-page="[a-z]+"\]\)[^{]*\{[^}]*\}/g
    ) ?? [];

    assert.ok(
      pageRules.length > 0,
      "decorative per-page motifs exist (about/work/research/contact/blog/hub)"
    );

    const layoutOffenders = pageRules.filter((rule) =>
      /\.(heroDoc|heroIdentity|heroCopy|heroSignal\b|crumbs|docKicker|title|lead|heroCue)\b/.test(
        rule
      )
    );

    assert.deepEqual(
      layoutOffenders,
      [],
      "data-page selectors must stay decorative: " +
        "layout classes may never vary per route"
    );
  });

  it("no page-specific hero/shell component files exist", async () => {
    for (const banned of [
      "components/AboutAnimation.tsx",
      "components/ContactAnimation.tsx",
      "components/content/AboutAnimation.tsx",
      "components/content/ContactAnimation.tsx",
      "components/AboutShell.tsx",
      "components/ContactShell.tsx",
      "components/content/AboutShell.tsx",
      "components/content/ContactShell.tsx"
    ]) {
      await assert.rejects(
        () => readText(banned),
        /ENOENT/,
        `${banned} must not exist — one shared shell, no route-specific layout`
      );
    }
  });

  it("the shell identity is registry-driven, not a route switch", async () => {
    const shell = await readText("components/content/ContentShell.tsx");

    assert.match(shell, /pageIdForRoutePath/);
    assert.doesNotMatch(
      shell,
      /switch \(href\)|case "\/about\/"/,
      "no hardcoded href→identity switch may return"
    );
  });
});

/* ------------------------------------------------------------------ */
/* 4. The page identity artifacts (v4.0.5)                             */
/* ------------------------------------------------------------------ */

describe("the unique page identity artifacts ride the one shared shell", () => {
  it("ContentShell exposes exactly ONE generic document-feature slot", async () => {
    const shell = await readText("components/content/ContentShell.tsx");

    assert.match(
      shell,
      /docFeature\?: ReactNode/,
      "the one optional slot: the page's first document block"
    );

    /* The slot renders inside the shared doc container, above children. */
    const docIndex = shell.indexOf("styles.doc");
    const featureIndex = shell.indexOf("{docFeature}");
    const childrenIndex = shell.indexOf("{children}", docIndex);

    assert.ok(docIndex > -1, "the shared document container exists");
    assert.ok(featureIndex > docIndex, "the slot renders inside the container");
    assert.ok(
      childrenIndex > featureIndex,
      "the slot precedes the page content"
    );

    /* No second slot, and no page-named slot masquerading as shared API. */
    assert.doesNotMatch(
      shell,
      /heroFeature|aboutFeature|contactFeature|aboutArtifact|contactArtifact/,
      "the slot stays generic — page identity lives in the pages"
    );
  });

  it("About renders its unique identity artifact as the first document block", async () => {
    const page = await readText("app/about/page.tsx");

    assert.match(
      page,
      /docFeature=\{<AboutIdentityArtifact \/>\}/,
      "the artifact fills the shared slot"
    );

    /* The artifact's own semantic structure. */
    assert.match(page, /styles\.identityArtifact/);
    assert.match(page, /aria-labelledby="about-identity-title"/);
    assert.match(page, /<h2/);
    assert.match(page, /styles\.identityArtifactTracks/);

    /* Crawlable internal links on the artifact (DocLink = next/link). */
    assert.match(page, /styles\.identityArtifactTrackLink/);
    assert.match(page, /href: "\/research\/"/);
    assert.match(page, /href: "\/work\/"/);
    assert.match(page, /href: "\/contact\/"/);

    /* Server-rendered page: still no client machinery, no animation file. */
    assert.doesNotMatch(page, /"use client"/);
    assert.doesNotMatch(page, /useState|useEffect/);
  });

  it("Contact renders its unique transmission artifact as the first document block", async () => {
    const page = await readText("app/contact/page.tsx");

    assert.match(
      page,
      /docFeature=\{<ContactTransmissionArtifact \/>\}/,
      "the artifact fills the shared slot"
    );

    /* The artifact's own semantic structure. */
    assert.match(page, /styles\.transmissionArtifact/);
    assert.match(page, /aria-labelledby="contact-transmission-title"/);
    assert.match(page, /<h2/);
    assert.match(page, /styles\.transmissionIntents/);

    /* The primary action resolves from the ONE verified link source. */
    assert.match(page, /EMAIL_LINK\?\.href \?\? "mailto:Parsaetak@gmail\.com"/);
    assert.match(page, /className="button button-primary"/);

    /* The honest no-backend model is untouched. */
    assert.doesNotMatch(page, /<form/i);
    assert.doesNotMatch(page, /"use client"/);
    assert.doesNotMatch(page, /useState|useEffect/);
  });

  it("the transmission console and the collaboration types can never disagree", async () => {
    const page = await readText("app/contact/page.tsx");

    /* Extract each const block, so no other label/title literals leak in. */
    function blockOf(name: string): string {
      const start = page.indexOf(`const ${name}`);

      assert.ok(start > -1, `${name} is declared on the page`);

      return page.slice(start, page.indexOf("];", start));
    }

    const intentLabels = [
      ...blockOf("TRANSMISSION_INTENTS").matchAll(/label: "([^"]+)"/g)
    ].map((match) => match[1]);

    const typeTitles = [
      ...blockOf("COLLABORATION_TYPES").matchAll(/title: "([^"]+)"/g)
    ].map((match) => match[1]);

    assert.ok(intentLabels.length > 0, "the console carries intents");
    assert.deepEqual(
      intentLabels,
      typeTitles,
      "the console renders exactly the collaboration-type model, in order"
    );
  });

  it("both artifacts share one header vocabulary and the per-route accent", async () => {
    const about = await readText("app/about/page.tsx");
    const contact = await readText("app/contact/page.tsx");

    for (const page of [about, contact]) {
      assert.match(page, /styles\.artifactHead/);
      assert.match(page, /styles\.artifactKicker/);
      assert.match(page, /styles\.artifactTitle/);
      assert.match(page, /BRAND_STAR\.red/, "the 13-point star identity");
    }

    /* The artifact styling is page-specific CSS, in the shared module. */
    const css = await readText("components/content/content.module.css");

    for (const block of [
      ".identityArtifact {",
      ".transmissionArtifact {",
      ".artifactKicker {"
    ]) {
      assert.ok(
        css.includes(block),
        `content.module.css carries ${block.trim()}`
      );
    }

    /* Artifact motion is gated and compositor-only: transform/opacity. */
    const identityPulse = css.match(
      /@keyframes\s+identityNodePulse\s*\{([\s\S]*?)\}/
    );

    assert.ok(identityPulse, "the identity rail pulse keyframes exist");
    assert.match(identityPulse[1], /opacity/);
    assert.ok(
      !/width|height|top|left|margin|padding/.test(identityPulse[1]),
      "the pulse animates opacity only"
    );

    const ripple = css.match(
      /@keyframes\s+transmissionRipple\s*\{([\s\S]*?)\}/
    );

    assert.ok(ripple, "the transmission ripple keyframes exist");
    assert.match(ripple[1], /transform: scale/);
    assert.match(ripple[1], /opacity/);
    assert.ok(
      !/width|height|top|left|margin|padding/.test(ripple[1]),
      "the ripple animates transform/opacity only"
    );
  });

  it("no artifact escaped into a separate component file", async () => {
    for (const banned of [
      "components/AboutArtifact.tsx",
      "components/ContactArtifact.tsx",
      "components/content/AboutArtifact.tsx",
      "components/content/ContactArtifact.tsx"
    ]) {
      await assert.rejects(
        () => readText(banned),
        /ENOENT/,
        `${banned} must not exist — artifacts render inside their page files`
      );
    }
  });
});
