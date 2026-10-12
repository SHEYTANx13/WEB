#!/usr/bin/env node
/*
 * generate-brand.mjs — the deterministic brand-asset generator (v2.9).
 *
 * SOURCE OF TRUTH for the Parsa Tak identity star. Every SVG this
 * script emits is committed, so the build never depends on a hidden
 * local step — the generator exists so the geometry can be
 * REGENERATED and REPRODUCED exactly, not so it can drift.
 *
 * THE 13-POINT STAR — mathematical construction, not a hand-drawn
 * polygon:
 *
 *   outer vertices : 13  (regular 13-gon vertices, radius R)
 *   inner vertices : 13  (radius r, at the mid-angles)
 *   total vertices : 26, strictly alternating outer/inner
 *   angular step   : 360° / 26  between consecutive vertices
 *   inner radius   : r = R · cos(5π/13) / cos(4π/13)
 *
 * The inner-radius ratio is not a taste parameter: it is the exact
 * ratio that makes the outline the regular star polygon {13/5}
 * (edges are the chords connecting every 5th 13-gon vertex — the
 * same rule that makes a pentagram out of a pentagon). k = 5 is the
 * deeper of the two regular 13-point options ({13/5} vs {13/6}) and
 * the legible one at favicon sizes.
 *
 * Consequences that the validator (verify-brand.mjs) re-proves from
 * the emitted files:
 *   - vertex i sits at angle  -90° + i · (360/26)°   (vertex 0 = top)
 *   - even i are outer vertices (radius R), odd i inner (radius r)
 *   - rotating the vertex set by 360/13° maps it onto itself
 *   - every colour variant shares byte-identical path geometry
 *
 * Writes:
 *   assets/brand/*.svg          — full star variant system (canonical)
 *   assets/icons/*.svg          — brand glyph library (currentColor)
 *   assets/brand/manifest.json  — variant registry + intended usage
 *   public/brand/…              — runtime copies the site serves
 *   public/icon.svg             — favicon SVG (explicit metadata.icons)
 *
 * Zero dependencies. Run: node scripts/generate-brand.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");

/* Template placeholders replaced with generated path data at runtime. */
const STAR_PATH_PLACEHOLDER = "__STAR_PATH__";
const GLYPH_STAR_PATH_PLACEHOLDER = "__GLYPH_STAR_PATH__";
const GLYPH_STAR_MID_PATH_PLACEHOLDER = "__GLYPH_STAR_MID_PATH__";
const GLYPH_STAR_CORE_PATH_PLACEHOLDER = "__GLYPH_STAR_CORE_PATH__";
const GLYPH_GRID_A_PLACEHOLDER = "__GLYPH_GRID_A__";
const GLYPH_GRID_B_PLACEHOLDER = "__GLYPH_GRID_B__";
const GLYPH_GRID_C_PLACEHOLDER = "__GLYPH_GRID_C__";
const GLYPH_GRID_D_PLACEHOLDER = "__GLYPH_GRID_D__";
const GLYPH_STAR_MICRO_PATH_PLACEHOLDER = "__GLYPH_STAR_MICRO_PATH__";

/* ------------------------------------------------------------------ */
/* Star mathematics                                                     */
/* ------------------------------------------------------------------ */

export const STAR = Object.freeze({
  points: 13,
  vertices: 26,
  stepDeg: 360 / 26,
  /** Exact {13/5} inner/outer ratio: cos(5π/13)/cos(4π/13). */
  innerRatio:
    Math.cos((5 * Math.PI) / 13) / Math.cos((4 * Math.PI) / 13),
  startAngleDeg: -90
});

/**
 * The 26 vertices of the regular 13-point star, in polar order.
 * When innerRadius is omitted it defaults to the exact {13/5} ratio
 * r = R · cos(5π/13)/cos(4π/13) — the mathematically derived value,
 * never a tuned constant. Returned as exact numbers; formatting
 * happens at serialisation.
 */
export function starVertices({ cx, cy, outerRadius, innerRadius }) {
  const inner = innerRadius ?? outerRadius * STAR.innerRatio;
  const vertices = [];
  for (let i = 0; i < STAR.vertices; i += 1) {
    const angle =
      (STAR.startAngleDeg + i * STAR.stepDeg) * (Math.PI / 180);
    const radius = i % 2 === 0 ? outerRadius : inner;
    vertices.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      outer: i % 2 === 0
    });
  }
  return vertices;
}

/**
 * Serialise the star outline as one path. Coordinates are rendered
 * at 4-decimal precision with trailing zeros trimmed — deterministic,
 * sub-0.0001-unit error on a 100-unit viewBox, and human-readable.
 */
export function starPathD({ cx, cy, outerRadius, innerRadius }) {
  const vertices = starVertices({ cx, cy, outerRadius, innerRadius });
  const fmt = (value) => {
    const fixed = value.toFixed(4);
    return fixed.includes(".")
      ? fixed.replace(/0+$/, "").replace(/\.$/, "")
      : fixed;
  };
  const points = vertices.map((v) => `${fmt(v.x)} ${fmt(v.y)}`);
  return `M${points[0]} L${points.slice(1).join(" L")} Z`;
}

/* ------------------------------------------------------------------ */
/* SVG emission helpers                                                 */
/* ------------------------------------------------------------------ */

const SVG_NS = 'xmlns="http://www.w3.org/2000/svg"';

const STAR_HEADER = `<!--
  Parsa Tak brand star — the regular 13-point star {13/5}.

  outer vertices : 13          inner vertices : 13
  angular step   : 360/26 deg  inner radius   : R * cos(5pi/13)/cos(4pi/13)

  Generated by scripts/generate-brand.mjs — regenerate, never hand-edit.
  Only colour treatment may differ between variants; geometry may not.
-->`;

const GLYPH_HEADER = `<!--
  Parsa Tak brand glyph library — generated by scripts/generate-brand.mjs.
  Monochrome-first: uses currentColor so CSS decides the ink.
-->`;

function starVariantSvg({ id, title, body, usage }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg ${SVG_NS} viewBox="0 0 100 100" role="img" aria-labelledby="starTitle">
  <title id="starTitle">${title}</title>
  ${STAR_HEADER.replace(/\n/g, `\n  `)}
  ${usageComment(usage)}
  ${body.trim()}
</svg>
`;
}

function usageComment(usage) {
  return `<!-- Intended use: ${usage} -->`;
}

/* ------------------------------------------------------------------ */
/* Variant definitions — colour treatments ONLY                         */
/* ------------------------------------------------------------------ */

const VIEWBOX_STAR_PARAMS = {
  cx: 50,
  cy: 50,
  outerRadius: 48
};

const brandDir = path.join(ROOT, "assets", "brand");
const publicBrandDir = path.join(ROOT, "public", "brand");
const iconsDir = path.join(ROOT, "assets", "icons");
const publicIconsDir = path.join(ROOT, "public", "brand", "icons");

const VARIANTS = [
  {
    file: "star-red.svg",
    name: "Star — brand red",
    treatment: "solid fill #ff2020 (the site's live red)",
    usage:
      "primary site logo on dark backgrounds (world HUD, blog header, loading surface); also safe on light backgrounds",
    backgrounds: ["dark", "light"],
    body: `
  <path d="${STAR_PATH_PLACEHOLDER}" fill="#ff2020"/>`
  },
  {
    file: "star-red-hot.svg",
    name: "Star — red-hot gradient",
    treatment:
      "radial gradient, white-hot core into deep red (the RED MAGIC iris ramp)",
    usage:
      "identity surfaces that want heat: loading screen, favicon companion, social artwork",
    backgrounds: ["dark", "light"],
    body: `
  <defs>
    <radialGradient id="hotCore" cx="46%" cy="42%" r="72%">
      <stop offset="0%" stop-color="#fff4ef"/>
      <stop offset="16%" stop-color="#ff6652"/>
      <stop offset="46%" stop-color="#ff2020"/>
      <stop offset="80%" stop-color="#a90000"/>
      <stop offset="100%" stop-color="#640000"/>
    </radialGradient>
  </defs>
  <path d="${STAR_PATH_PLACEHOLDER}" fill="url(#hotCore)"/>`
  },
  {
    file: "star-crimson.svg",
    name: "Star — crimson",
    treatment: "solid fill #a90000 (deep crimson)",
    usage: "quiet brand accents, pressed/hover logo states, print-adjacent uses",
    backgrounds: ["dark", "light"],
    body: `
  <path d="${STAR_PATH_PLACEHOLDER}" fill="#a90000"/>`
  },
  {
    file: "star-white.svg",
    name: "Star — white",
    treatment: "solid fill #ffffff (pure monochrome positive)",
    usage: "brand mark on dark or red surfaces; monochrome lockups",
    backgrounds: ["dark", "red"],
    body: `
  <path d="${STAR_PATH_PLACEHOLDER}" fill="#ffffff"/>`
  },
  {
    file: "star-black.svg",
    name: "Star — black",
    treatment: "solid fill #0a0a0a (pure monochrome negative)",
    usage: "brand mark on white/light surfaces, documents, monochrome lockups",
    backgrounds: ["light"],
    body: `
  <path d="${STAR_PATH_PLACEHOLDER}" fill="#0a0a0a"/>`
  },
  {
    file: "star-silver.svg",
    name: "Star — silver",
    treatment: "solid fill #c9cdd4 (neutral silver)",
    usage: "neutral brand accents on dark UI where pure white is too loud",
    backgrounds: ["dark"],
    body: `
  <path d="${STAR_PATH_PLACEHOLDER}" fill="#c9cdd4"/>`
  },
  {
    file: "star-dark.svg",
    name: "Star — dark neutral",
    treatment: "solid fill #22262e (dark neutral)",
    usage: "quiet brand watermark on light UI; dark-on-light lockups",
    backgrounds: ["light"],
    body: `
  <path d="${STAR_PATH_PLACEHOLDER}" fill="#22262e"/>`
  },
  {
    file: "star-outline-red.svg",
    name: "Star — red outline (transparent fill)",
    treatment: "no fill, 3-unit #ff2020 stroke",
    usage:
      "transparent-stroke variant: layered identity compositions, watermarks, decorative echoes of the solid star",
    backgrounds: ["dark", "light"],
    body: `
  <path d="${STAR_PATH_PLACEHOLDER}" fill="none" stroke="#ff2020" stroke-width="3" stroke-linejoin="miter"/>`
  },
  {
    file: "star-outline-white.svg",
    name: "Star — white outline (transparent fill)",
    treatment: "no fill, 3-unit #ffffff stroke",
    usage:
      "transparent-stroke variant for dark surfaces: layered compositions, watermarks, ghost echoes",
    backgrounds: ["dark", "red"],
    body: `
  <path d="${STAR_PATH_PLACEHOLDER}" fill="none" stroke="#ffffff" stroke-width="3" stroke-linejoin="miter"/>`
  }
];

/*
 * Runtime subset — the variants the site actually references.
 * Everything is canonical in assets/brand/; these copies are what
 * the static export serves, and verify-brand.mjs proves the two
 * stay byte-identical.
 */
const RUNTIME_STAR_VARIANTS = new Set([
  "star-red.svg",
  "star-red-hot.svg",
  "star-white.svg",
  "star-outline-red.svg",
  "star-silver.svg"
]);

/* ------------------------------------------------------------------ */
/* Glyph library — monochrome-first, currentColor, 24×24                */
/*                                                                      */
/* Every glyph states its purpose. Nothing here is decorative filler:  */
/* each glyph is embeddable in article bodies via standard markdown    */
/* image syntax and usable by future UI without new artwork.           */
/* ------------------------------------------------------------------ */

const GLYPHS = [
  {
    file: "star.svg",
    title: "Brand star glyph",
    purpose: "inline brand mark that inherits text colour (footer, small UI)",
    body: `
  <path d="${GLYPH_STAR_PATH_PLACEHOLDER}" fill="currentColor"/>`
  },
  {
    file: "star-outline.svg",
    title: "Brand star glyph, outlined",
    purpose: "quiet/secondary brand mark that inherits text colour",
    body: `
  <path d="${GLYPH_STAR_PATH_PLACEHOLDER}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="miter"/>`
  },
  {
    file: "concentric-star.svg",
    title: "Concentric star",
    purpose:
      "identity motif for section markers and article-body system diagrams",
    body: `
  <path d="${GLYPH_STAR_PATH_PLACEHOLDER}" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="miter"/>
  <path d="${GLYPH_STAR_MID_PATH_PLACEHOLDER}" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="miter" opacity="0.72"/>
  <path d="${GLYPH_STAR_CORE_PATH_PLACEHOLDER}" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="miter" opacity="0.5"/>`
  },
  {
    file: "star-grid.svg",
    title: "Star grid",
    purpose: "pattern glyph: catalogue/library ornament representing the asset system",
    body: `
  <g fill="none" stroke="currentColor" stroke-width="1.1">
    <path d="${GLYPH_GRID_A_PLACEHOLDER}"/>
    <path d="${GLYPH_GRID_B_PLACEHOLDER}"/>
    <path d="${GLYPH_GRID_C_PLACEHOLDER}"/>
    <path d="${GLYPH_GRID_D_PLACEHOLDER}"/>
  </g>`
  },
  {
    file: "orbit.svg",
    title: "Orbit ring",
    purpose: "state/sync motif: scheduled systems, world signals, telemetry notes",
    body: `
  <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2.6 2.6"/>
  <circle cx="12" cy="12" r="1.7" fill="currentColor"/>
  <circle cx="19.1" cy="8.4" r="1.7" fill="currentColor"/>`
  },
  {
    file: "signal-node.svg",
    title: "Signal node",
    purpose: "communication/agent-signal motif for diagrams and UI markers",
    body: `
  <circle cx="12" cy="14.6" r="1.8" fill="currentColor"/>
  <path d="M8.2 11.2a5.4 5.4 0 0 1 7.6 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M5.6 8.4a9.1 9.1 0 0 1 12.8 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.62"/>`
  },
  {
    file: "system-glyph.svg",
    title: "System glyph",
    purpose: "system-architecture marker (capabilities, project notes, diagrams)",
    body: `
  <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.3"/>
  <path d="M8 15.6 12 8l4 7.6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M9.6 13h4.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`
  },
  {
    file: "research-glyph.svg",
    title: "Research glyph",
    purpose: "research/measurement marker (UHIT, benchmark and study notes)",
    body: `
  <circle cx="10.6" cy="10.6" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4"/>
  <path d="m15.4 15.4 4.6 4.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <path d="${GLYPH_STAR_MICRO_PATH_PLACEHOLDER}" fill="currentColor"/>`
  },
  {
    file: "ai-glyph.svg",
    title: "AI glyph",
    purpose: "AI-systems marker (agent networks, model notes, capability context)",
    body: `
  <g stroke="currentColor" stroke-width="1.1" opacity="0.75">
    <path d="M5 7.2 12 4.9l7 2.3"/>
    <path d="M5 16.8l7 2.3 7-2.3"/>
    <path d="M5 7.2v9.6M19 7.2v9.6M12 4.9v14.2"/>
  </g>
  <circle cx="5" cy="7.2" r="1.5" fill="currentColor"/>
  <circle cx="19" cy="7.2" r="1.5" fill="currentColor"/>
  <circle cx="5" cy="16.8" r="1.5" fill="currentColor"/>
  <circle cx="19" cy="16.8" r="1.5" fill="currentColor"/>
  <circle cx="12" cy="12" r="2.1" fill="currentColor"/>`
  },
  {
    file: "engineering-glyph.svg",
    title: "Engineering glyph",
    purpose: "software-engineering marker (code notes, build/verify sections)",
    body: `
  <path d="m9.2 7.6-4.4 4.4 4.4 4.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="m14.8 7.6 4.4 4.4-4.4 4.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
  },
  {
    file: "simulation-glyph.svg",
    title: "Simulation glyph",
    purpose: "simulation/creative-technology marker (organisms, experiments)",
    body: `
  <path d="M3.4 12c2.4-5.4 4.9-8.1 7.3-8.1 3.6 0 6 8.1 9.9 8.1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M3.4 12c2.4 5.4 4.9 8.1 7.3 8.1 3.6 0 6-8.1 9.9-8.1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.55"/>
  <circle cx="12" cy="12" r="1.6" fill="currentColor"/>`
  },
  {
    file: "link-glyph.svg",
    title: "Link glyph",
    purpose: "link/reference marker for article bodies and navigation UI",
    body: `
  <path d="M10.4 13.6 13.6 10.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M9.2 8.2 11 6.4a3.65 3.65 0 0 1 5.2 5.2l-1.8 1.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M14.8 15.8 13 17.6a3.65 3.65 0 0 1-5.2-5.2l1.8-1.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`
  },
  {
    file: "arrow-right.svg",
    title: "Arrow right",
    purpose: "inline direction glyph for diagrams and UI compositions",
    body: `
  <path d="M4.4 12h14.2m-5.4-5.4L18.6 12l-5.4 5.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
  },
  {
    file: "arrow-up-right.svg",
    title: "Arrow up-right",
    purpose: "external-destination glyph for diagrams and link lists",
    body: `
  <path d="M7 17 17 7m-7.6-.4H17v7.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
  }
];

/* ------------------------------------------------------------------ */
/* Favicon — the star on a dark tile (public/icon.svg)                 */
/* ------------------------------------------------------------------ */

const ICON_PARAMS = {
  cx: 64,
  cy: 64,
  outerRadius: 54
};

function faviconSvg() {
  const d = starPathD(ICON_PARAMS);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg ${SVG_NS} viewBox="0 0 128 128" role="img" aria-labelledby="iconTitle">
  <title id="iconTitle">Parsa Tak</title>
  <!--
    Parsa Tak favicon — the regular 13-point star {13/5} on the site's
    dark tile. Same polar construction as assets/brand/star-*.svg
    (13 outer + 13 inner vertices, 360/26 deg step, exact {13/5}
    inner radius), scaled for the 128 viewBox and small-size clarity.
    Generated by scripts/generate-brand.mjs — regenerate, never hand-edit.
    Served from public/icon.svg and linked via the root layout's
    explicit metadata.icons (deterministic in every build mode).
  -->
  <defs>
    <radialGradient id="favCore" cx="46%" cy="42%" r="74%">
      <stop offset="0%" stop-color="#ff7a5e"/>
      <stop offset="24%" stop-color="#ff2020"/>
      <stop offset="66%" stop-color="#c40e0e"/>
      <stop offset="100%" stop-color="#7c0404"/>
    </radialGradient>
    <linearGradient id="favTile" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#101013"/>
      <stop offset="1" stop-color="#070707"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="24" fill="url(#favTile)"/>
  <path d="${d}" fill="url(#favCore)"/>
</svg>
`;
}

/* ------------------------------------------------------------------ */
/* Manifest                                                             */
/* ------------------------------------------------------------------ */

function buildManifest() {
  return {
    version: "2.9.0",
    generatedBy: "scripts/generate-brand.mjs",
    geometry: {
      star: {
        type: "regular 13-point star polygon {13/5}",
        outerVertices: STAR.points,
        innerVertices: STAR.points,
        totalVertices: STAR.vertices,
        angularStepDeg: STAR.stepDeg,
        innerRadiusRatio: STAR.innerRatio,
        innerRadiusFormula: "R * cos(5*pi/13) / cos(4*pi/13)",
        startAngleDeg: STAR.startAngleDeg,
        brandViewBox: "0 0 100 100",
        brandOuterRadius: 48,
        iconViewBox: "0 0 128 128",
        iconOuterRadius: 54,
        precision: "4 decimals, trailing zeros trimmed"
      },
      law:
        "Geometry is identical across every colour variant. Only colour treatment may differ."
    },
    brandVariants: VARIANTS.map((variant) => ({
      file: `assets/brand/${variant.file}`,
      servedAt: RUNTIME_STAR_VARIANTS.has(variant.file)
        ? `public/brand/${variant.file}`
        : null,
      name: variant.name,
      treatment: variant.treatment,
      intendedUse: variant.usage,
      suitableBackgrounds: variant.backgrounds
    })),
    glyphs: GLYPHS.map((glyph) => ({
      file: `assets/icons/${glyph.file}`,
      servedAt: `public/brand/icons/${glyph.file}`,
      title: glyph.title,
      purpose: glyph.purpose
    })),
    favicon: {
      svg: "public/icon.svg",
      pngFallback: "public/icon.png",
      ico: "public/favicon.ico",
      appleTouch: "public/apple-icon.png",
      wiredBy: "app/layout.tsx metadata.icons (explicit, basePath-safe)",
      rasterGenerator: "scripts/generate-brand-raster.py"
    }
  };
}

/* ------------------------------------------------------------------ */
/* Main                                                                 */
/* ------------------------------------------------------------------ */

async function main() {
  const brandPath = starPathD(VIEWBOX_STAR_PARAMS);

  await mkdir(brandDir, { recursive: true });
  await mkdir(publicBrandDir, { recursive: true });
  await mkdir(iconsDir, { recursive: true });
  await mkdir(publicIconsDir, { recursive: true });

  /* Star variants (geometry fixed by construction) */
  for (const variant of VARIANTS) {
    const body = variant.body.replaceAll(STAR_PATH_PLACEHOLDER, brandPath);
    const svg = starVariantSvg({
      id: variant.file,
      title: variant.name,
      body,
      usage: variant.usage
    });
    await writeFile(path.join(brandDir, variant.file), svg, "utf8");
    if (RUNTIME_STAR_VARIANTS.has(variant.file)) {
      await writeFile(path.join(publicBrandDir, variant.file), svg, "utf8");
    }
  }

  /* Glyph library (24×24 currentColor) */
  const glyphStar = starPathD({
    cx: 12,
    cy: 12,
    outerRadius: 10.6,
    innerRadius: 10.6 * STAR.innerRatio
  });
  const glyphStarMid = starPathD({
    cx: 12,
    cy: 12,
    outerRadius: 7.1,
    innerRadius: 7.1 * STAR.innerRatio
  });
  const glyphStarCore = starPathD({
    cx: 12,
    cy: 12,
    outerRadius: 3.9,
    innerRadius: 3.9 * STAR.innerRatio
  });
  const gridStar = (cx, cy) =>
    starPathD({
      cx,
      cy,
      outerRadius: 4.9,
      innerRadius: 4.9 * STAR.innerRatio
    });
  const glyphStarMicro = starPathD({
    cx: 10.6,
    cy: 10.6,
    outerRadius: 2.9,
    innerRadius: 2.9 * STAR.innerRatio
  });

  for (const glyph of GLYPHS) {
    const body = glyph.body
      .replaceAll(GLYPH_STAR_PATH_PLACEHOLDER, glyphStar)
      .replaceAll(GLYPH_STAR_MID_PATH_PLACEHOLDER, glyphStarMid)
      .replaceAll(GLYPH_STAR_CORE_PATH_PLACEHOLDER, glyphStarCore)
      .replaceAll(GLYPH_GRID_A_PLACEHOLDER, gridStar(7.1, 7.1))
      .replaceAll(GLYPH_GRID_B_PLACEHOLDER, gridStar(16.9, 7.1))
      .replaceAll(GLYPH_GRID_C_PLACEHOLDER, gridStar(7.1, 16.9))
      .replaceAll(GLYPH_GRID_D_PLACEHOLDER, gridStar(16.9, 16.9))
      .replaceAll(GLYPH_STAR_MICRO_PATH_PLACEHOLDER, glyphStarMicro);

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg ${SVG_NS} viewBox="0 0 24 24" fill="none">
  ${GLYPH_HEADER.replace(/\n/g, `\n  `)}
  <!-- Purpose: ${glyph.purpose} -->
  <title>${glyph.title}</title>
  ${body.trim()}
</svg>
`;
    await writeFile(path.join(iconsDir, glyph.file), svg, "utf8");
    await writeFile(path.join(publicIconsDir, glyph.file), svg, "utf8");
  }

  /* Favicon SVG (public/icon.svg — linked via explicit metadata.icons) */
  await writeFile(
    path.join(ROOT, "public", "icon.svg"),
    faviconSvg(),
    "utf8"
  );

  /* Manifest */
  await writeFile(
    path.join(brandDir, "manifest.json"),
    `${JSON.stringify(buildManifest(), null, 2)}\n`,
    "utf8"
  );

  console.log(
    `[brand] ${VARIANTS.length} star variant(s), ${GLYPHS.length} glyph(s), favicon + manifest written.`
  );
}

main().catch((error) => {
  console.error("[brand] generation failed:", error);
  process.exit(1);
});
