/*
 * tests/footer.test.ts — the v4.0.5 FOOTER contract: one deliberate
 * site-chrome stack (document nav → public network 7 + 7 → legal →
 * bottom identity row) that preserves every important link. Verified
 * as BEHAVIOR (which groups exist, what stays crawlable, who owns
 * the styles, how the 14 links are presented) — not pixel trivia.
 */

import { describe, it } from "node:test";

import assert from "node:assert/strict";

import { readFile } from "node:fs/promises";

import path from "node:path";

import { fileURLToPath } from "node:url";

import { ALL_PUBLIC_LINKS } from "../lib/links";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

async function readText(relative: string): Promise<string> {
  return readFile(path.join(ROOT, relative), "utf8");
}

/*
 * The canonical 14-link registry order (v4.0.5) — the verified
 * public network, in its exact presentation order:
 * row 1 = entries 1–7, row 2 = entries 8–14 on desktop.
 */
const CANONICAL_LINK_ORDER = [
  "x",
  "instagram",
  "email",
  "linkedin",
  "github",
  "discord",
  "tiktok",
  "youtube",
  "patreon",
  "pinterest",
  "telegram-channel",
  "telegram-account",
  "support",
  "linktree"
] as const;

/* ------------------------------------------------------------------ */
/* 1. The four logical navigation groups                               */
/* ------------------------------------------------------------------ */

describe("the footer carries the four logical navigation groups", () => {
  it("SiteDocNav renders Site, Collections, World, and Topics", async () => {
    const nav = await readText("components/SiteDocNav.tsx");

    for (const heading of ["Site", "Collections", "World", "Topics"]) {
      assert.match(
        nav,
        new RegExp(`heading="${heading}"`),
        `the ${heading} group exists`
      );
    }

    /* The groups are data-driven from the navigation source of truth. */
    assert.match(nav, /PRIMARY_NAV/);
    assert.match(nav, /CONTENT_NAV/);
    assert.match(nav, /WORLD_NAV/);
  });

  it("every destination the old footer carried is still reachable", async () => {
    const nav = await readText("components/SiteDocNav.tsx");
    const navigation = await readText("lib/navigation.ts");

    /* Primary: HOME / ABOUT / BLOG / CONTACT. */
    for (const href of ["/", "/about/", "/blog/", "/contact/"]) {
      assert.ok(
        navigation.includes(`href: "${href}"`),
        `primary destination ${href} remains in the navigation source`
      );
    }

    /* Collections: WORK / RESEARCH. */
    for (const href of ["/work/", "/research/"]) {
      assert.ok(navigation.includes(`href: "${href}"`));
    }

    /* World scenes: SYSTEMS / RED MAGIC / MEDIA. */
    for (const href of ["/#systems", "/#magic", "/#media"]) {
      assert.ok(navigation.includes(`href: "${href}"`));
    }

    /* Topics: all six hubs, rendered by the footer itself. */
    for (const href of [
      "/local-ai/",
      "/ai-systems/",
      "/ai-reasoning/",
      "/ai-evaluation/",
      "/software-engineering/",
      "/creative-technology/"
    ]) {
      assert.ok(
        nav.includes(`href: "${href}"`),
        `topic hub ${href} remains footer-crawlable`
      );
    }
  });

  it("footer links stay crawlable soft navigations", async () => {
    const nav = await readText("components/SiteDocNav.tsx");

    assert.match(
      nav,
      /import Link from "next\/link"/,
      "footer links render through next/link (crawlable anchors in the export)"
    );

    assert.match(nav, /prefetch=\{false\}/, "viewport prefetch stays off");
  });
});

/* ------------------------------------------------------------------ */
/* 2. The public network — 14 verified links, 7 + 7 presentation       */
/* ------------------------------------------------------------------ */

describe("the public network is the verified 14-link registry", () => {
  it("FooterLinks renders ALL_PUBLIC_LINKS — the only data authority", async () => {
    const links = await readText("components/FooterLinks.tsx");

    assert.match(
      links,
      /import \{\s*ALL_PUBLIC_LINKS/,
      "the network renders from lib/links.ts's ALL_PUBLIC_LINKS"
    );

    assert.doesNotMatch(
      links,
      /href:\s*"https?:/,
      "no link record is duplicated in the presentation component"
    );
  });

  it("the registry holds exactly 14 links with unique ids", () => {
    assert.equal(
      ALL_PUBLIC_LINKS.length,
      14,
      "the verified registry is exactly 14 links — no truncation, no invention"
    );

    const ids = ALL_PUBLIC_LINKS.map((link) => link.id);

    assert.equal(
      new Set(ids).size,
      ids.length,
      "no duplicate link ids"
    );
  });

  it("the registry preserves the canonical order", () => {
    assert.deepEqual(
      ALL_PUBLIC_LINKS.map((link) => link.id),
      [...CANONICAL_LINK_ORDER],
      "the canonical presentation order is preserved"
    );
  });

  it("WhatsApp is not part of the network", async () => {
    const registry = await readText("lib/links.ts");
    const links = await readText("components/FooterLinks.tsx");

    for (const source of [registry, links]) {
      assert.doesNotMatch(
        source,
        /whatsapp/i,
        "no functional or stale WhatsApp remnant in the network source"
      );
    }
  });
});

describe("the desktop presentation contract is 7 + 7", () => {
  it("FooterLinks slices the registry into two explicit rows of seven", async () => {
    const links = await readText("components/FooterLinks.tsx");

    assert.match(
      links,
      /FOOTER_LINK_ROW_SIZE = 7/,
      "the row size is declared once as presentation logic"
    );

    assert.match(
      links,
      /ALL_PUBLIC_LINKS\.slice\(\s*0,\s*FOOTER_LINK_ROW_SIZE\s*\)/,
      "row 1 = registry entries 1–7"
    );

    assert.match(
      links,
      /ALL_PUBLIC_LINKS\.slice\(\s*FOOTER_LINK_ROW_SIZE,\s*FOOTER_LINK_ROW_SIZE \* 2\s*\)/,
      "row 2 = registry entries 8–14"
    );

    assert.match(
      links,
      /<FooterLinkRow\s+links=\{\s*firstRow\s*\}\s*\/>/,
      "row 1 renders"
    );

    assert.match(
      links,
      /<FooterLinkRow\s+links=\{\s*secondRow\s*\}\s*\/>/,
      "row 2 renders"
    );
  });

  it("exactly two row containers hold the whole network — nothing omitted, nothing duplicated", async () => {
    const links = await readText("components/FooterLinks.tsx");

    const rowUsages =
      links.match(/<FooterLinkRow/g)?.length ?? 0;

    assert.equal(
      rowUsages,
      2,
      "the desktop presentation has exactly two row containers"
    );

    /* The registry is rendered exactly once — through the two rows. */
    assert.equal(
      links.match(/ALL_PUBLIC_LINKS\.slice\(/g)?.length,
      2,
      "the registry is sliced exactly twice (row 1 + row 2) — no third rendering path"
    );
  });

  it("the 7 + 7 slices cover all 14 links in order", () => {
    const rowSize = 7;

    const firstRow = ALL_PUBLIC_LINKS.slice(0, rowSize);

    const secondRow = ALL_PUBLIC_LINKS.slice(
      rowSize,
      rowSize * 2
    );

    assert.equal(firstRow.length, 7, "row 1 holds exactly seven links");
    assert.equal(secondRow.length, 7, "row 2 holds exactly seven links");

    assert.deepEqual(
      [...firstRow, ...secondRow].map((link) => link.id),
      [...CANONICAL_LINK_ORDER],
      "the two rows together are the full registry, in canonical order"
    );
  });

  it("one shared FooterLink renderer is used by both rows", async () => {
    const links = await readText("components/FooterLinks.tsx");

    const definitions =
      links.match(/function FooterLink\(/g)?.length ?? 0;

    assert.equal(
      definitions,
      1,
      "exactly one FooterLink renderer exists"
    );

    assert.match(
      links,
      /<FooterLink\s+link=\{\s*link\s*\}\s*\/>/,
      "the row renderer uses the shared FooterLink"
    );
  });

  it("the rows stay wrap-safe below desktop — order-stable degradation", async () => {
    const css = await readText("components/FooterLinks.module.css");

    assert.match(
      css,
      /\.linkRow\s*\{[\s\S]*?flex-wrap:\s*wrap/,
      "each row wraps deliberately below desktop — no overflow, no clipping"
    );

    assert.match(
      css,
      /\.linkRow\s*\{[\s\S]*?list-style:\s*none/,
      "rows render as semantic lists without list chrome"
    );
  });
});

/* ------------------------------------------------------------------ */
/* 3. The icons — shared system, larger presentation, signal animation */
/* ------------------------------------------------------------------ */

describe("the public-link icons are a primary attention anchor", () => {
  it("footer links keep using LinkIcon from PublicLinks", async () => {
    const links = await readText("components/FooterLinks.tsx");

    assert.match(
      links,
      /import\s*\{\s*LinkIcon\s*\}\s*from\s*"@\/components\/PublicLinks"/,
      "the shared icon system is the only icon source"
    );

    assert.match(
      links,
      /<LinkIcon\s+icon=\{\s*link\.icon\s*\}\s*\/>/,
      "the icon renders through LinkIcon"
    );
  });

  it("the icon box is materially larger than the old 13px presentation", async () => {
    const css = await readText("components/FooterLinks.module.css");

    /* The base .linkIcon box — the v4.0.5 contract is 18–20px. */
    const baseBlock = css.slice(
      css.indexOf(".linkIcon {"),
      css.indexOf(".linkIcon svg")
    );

    const baseSize = baseBlock.match(/width:\s*(\d+)px/)?.[1];

    assert.ok(
      baseSize,
      "the base .linkIcon declares an explicit box size"
    );

    const base = Number(baseSize);

    assert.ok(
      base >= 18 && base <= 20,
      `the base icon box is 18–20px (got ${base}px) — the old 13px accessory scale is gone`
    );

    /* Every breakpoint override stays materially larger than the old 12–13px. */
    for (const match of css.matchAll(/\.linkIcon\s*\{[^}]*?width:\s*(\d+)px/g)) {
      assert.ok(
        Number(match[1]) >= 17,
        `icon box ${match[1]}px stays materially larger than the old 12–13px`
      );
    }
  });

  it("hover and focus activate the accent — transform/opacity/color only", async () => {
    const css = await readText("components/FooterLinks.module.css");

    assert.match(
      css,
      /\.link:hover \.linkIcon\s*\{[\s\S]*?color:\s*var\(--link-accent/,
      "the registry's per-link accent activates on hover"
    );

    assert.match(
      css,
      /\.link:hover \.linkIcon\s*\{[\s\S]*?transform:\s*scale\(/,
      "the icon scales subtly on hover (transform, not layout)"
    );

    assert.match(
      css,
      /\.link:focus-visible \.linkIcon\s*\{[\s\S]*?transform:\s*scale\(/,
      "focus gets the same activation language"
    );

    assert.match(
      css,
      /\.link:focus-visible\s*\{[\s\S]*?outline:[\s\S]*?var\(--red-hot\)/,
      "keyboard focus keeps a strong visible boundary"
    );

    /* No layout geometry is ever animated. */
    const animated = css.match(/transition:[^;]+;/g)?.join("\n") ?? "";

    assert.doesNotMatch(
      animated,
      /\b(width|height|margin|padding|top|left|font-size|flex-basis)\b/,
      "no width/height/margin/padding/top/left/font-size transitions"
    );
  });

  it("reduced motion stops the movement but keeps the icons", async () => {
    const css = await readText("components/FooterLinks.module.css");

    const reduced = css.slice(
      css.indexOf("@media (prefers-reduced-motion: reduce)")
    );

    assert.ok(
      reduced.includes("transition: none"),
      "decorative transitions stop under reduced motion"
    );

    assert.doesNotMatch(
      reduced,
      /display:\s*none/,
      "no icon or link is hidden under reduced motion"
    );
  });
});

/* ------------------------------------------------------------------ */
/* 4. Legal block + bottom identity row                                */
/* ------------------------------------------------------------------ */

describe("the legal block keeps its wording and links", () => {
  it("copyright, trademark notice, legal text, LICENSE and TRADEMARKS remain", async () => {
    const footer = await readText("components/SiteFooter.tsx");

    assert.match(footer, /© 2026 Parsa Tak\. All rights reserved\./);
    assert.match(footer, /Parsa Tak™/);
    assert.match(
      footer,
      /Original website design, visual identity/,
      "the legal notice keeps its meaning — only the presentation changed"
    );
    assert.match(footer, /LICENSE\.md/);
    assert.match(footer, /TRADEMARKS\.md/);
  });

  it("the legal row top-aligns without baseline hacks", async () => {
    const css = await readText("components/SiteFooter.module.css");

    const legalBlock = css.slice(
      css.indexOf(".footerLegal {"),
      css.indexOf(".footerLegal > p")
    );

    assert.match(
      legalBlock,
      /align-items: start/,
      "top-aligned — no end-alignment or negative-margin tricks"
    );
  });
});

describe("the copyright/trademark identity row is the bottom-most footer row", () => {
  it("the bottom identity region renders after the legal region", async () => {
    const footer = await readText("components/SiteFooter.tsx");

    const legalIndex = footer.indexOf('className={styles.footerLegal}');

    const bottomIndex = footer.indexOf('className={styles.footerBottom}');

    assert.ok(legalIndex > -1, "the legal region exists");
    assert.ok(bottomIndex > -1, "the bottom identity region exists");
    assert.ok(
      bottomIndex > legalIndex,
      "the identity row comes AFTER the legal region — it is the final footer row"
    );

    /* The identity row carries the star, the copyright and the trademark. */
    const bottomBlock = footer.slice(bottomIndex);

    assert.match(bottomBlock, /BRAND_STAR\.red/, "the 13-point star is present");
    assert.match(bottomBlock, /© 2026 Parsa Tak\. All rights reserved\./);
    assert.match(bottomBlock, /Parsa Tak™/);
  });

  it("the identity row sits in normal flow — no positioning hacks", async () => {
    const css = await readText("components/SiteFooter.module.css");

    const bottomBlock = css.slice(
      css.indexOf(".footerBottom {"),
      css.indexOf(".footerMark {")
    );

    assert.match(bottomBlock, /display:\s*flex/, "normal flow — a flex row");
    assert.doesNotMatch(
      bottomBlock,
      /position:\s*absolute|margin(-top|-left)?:\s*-|transform:\s*translate/,
      "no absolute positioning, negative margins, or transform offsets"
    );
  });

  it("the public network owns its own region between the doc nav and the legal region", async () => {
    const footer = await readText("components/SiteFooter.tsx");

    const navIndex = footer.indexOf("footerNavRegion");
    const networkIndex = footer.indexOf('className={styles.footerNetwork}');
    const legalIndex = footer.indexOf('className={styles.footerLegal}');

    assert.ok(
      navIndex > -1 && networkIndex > navIndex && legalIndex > networkIndex,
      "the stack reads doc nav → public network → legal → bottom identity"
    );

    const css = await readText("components/SiteFooter.module.css");

    assert.match(
      css,
      /\.footerNetworkHeading\s*\{[\s\S]*?text-transform:\s*uppercase/,
      "the network region carries its own heading"
    );
  });
});

/* ------------------------------------------------------------------ */
/* 5. Style ownership + responsiveness                                 */
/* ------------------------------------------------------------------ */

describe("footer styles live in the footer's own module", () => {
  it("SiteFooter imports its dedicated stylesheet", async () => {
    const footer = await readText("components/SiteFooter.tsx");

    assert.match(
      footer,
      /from "@\/components\/SiteFooter\.module\.css"/,
      "the footer owns SiteFooter.module.css"
    );
  });

  it("the living-world shell no longer carries footer styles", async () => {
    const living = await readText("components/LivingShell.module.css");

    assert.doesNotMatch(
      living,
      /livingShellLegal|livingShellFooter/,
      "LivingShell.module.css owns the world shell only — footer styles moved out"
    );

    /* The world HUD's own responsive rules survive the split. */
    assert.match(living, /\.livingShellHudInner/);
    assert.match(living, /\.livingShellHudActions/);
  });

  it("the footer grid responds 4 → 2 → 1 without overflow", async () => {
    const docNav = await readText("components/SiteDocNav.module.css");

    /* Desktop: a multi-column grid (four fractional tracks). */
    const desktop = docNav.slice(0, docNav.indexOf("@media"));
    assert.match(
      desktop,
      /grid-template-columns:[\s\S]*?fr[\s\S]*?fr[\s\S]*?fr[\s\S]*?fr/,
      "desktop renders the groups as a four-column grid"
    );

    /* Tablet (≤980px): two columns. */
    const tabletBlock = docNav.slice(
      docNav.indexOf("max-width: 980px"),
      docNav.indexOf("max-width: 560px")
    );
    assert.match(
      tabletBlock,
      /repeat\(\s*\n?\s*2\s*,/,
      "tablet collapses to two columns"
    );

    /* Phone (≤560px): one column; lists flow horizontally. */
    const phoneBlock = docNav.slice(docNav.indexOf("max-width: 560px"));
    assert.match(
      phoneBlock,
      /grid-template-columns:\s*\n?\s*minmax\(0, 1fr\)/,
      "phone collapses to one column"
    );
  });

  it("the footer never opts into a route-scoped reveal system", async () => {
    const footer = await readText("components/SiteFooter.tsx");

    assert.doesNotMatch(
      footer,
      /data-reveal=/,
      "reveal controllers mount only on the world shell and blog — an opt-in here hides the footer on every content route (the v4.0.3 bug)"
    );
  });
});
