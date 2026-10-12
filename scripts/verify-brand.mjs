#!/usr/bin/env node
/*
 * verify-brand.mjs — mathematical + structural verification of the
 * brand asset system (v2.9).
 *
 * Runs after `node scripts/generate-brand.mjs` (and after a build for
 * the export-level checks). Unlike a "file exists" audit, this script
 * MATHEMATICALLY REPROVES the 13-point star geometry from the emitted
 * SVG bytes:
 *
 *   1. every brand star's path is parsed back into 26 vertices
 *   2. each vertex i must sit at angle -90° + i·(360/26)°, with even
 *      vertices at R and odd vertices at R·cos(5π/13)/cos(4π/13)
 *      (the exact {13/5} ratio) — within 4-decimal rounding tolerance
 *   3. the vertex set must map onto itself under rotation by 360/13°
 *      (true 13-fold rotational symmetry)
 *   4. every colour variant must carry BYTE-IDENTICAL path geometry
 *   5. the favicon star must match the same construction at its own
 *      scale (128 viewBox, R = 54)
 *
 * It also verifies the system around the star:
 *   - the full variant registry exists (canonical + runtime copies
 *     byte-identical)
 *   - the glyph library exists in both layers
 *   - project artwork exists with intrinsic dimensions
 *   - the favicon family (icon.svg/icon.png/favicon.ico/apple-icon)
 *     exists with correct formats and dimensions
 *   - og-default.png is a real 1200×630 PNG
 *   - every star/glyph/artwork file stays lightweight (perf budget)
 *
 * Zero dependencies. Exits 1 with a failure report on any violation.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");

const failures = [];
const checks = [];

function fail(message) {
  failures.push(message);
}

function pass(message) {
  checks.push(message);
}

/* ------------------------------------------------------------------ */
/* The mathematical model — kept in lockstep with generate-brand.mjs   */
/* ------------------------------------------------------------------ */

const POINTS = 13;
const VERTICES = 26;
const STEP_DEG = 360 / 26;
/* Exact {13/5} star-polygon inner/outer ratio. */
const INNER_RATIO =
  Math.cos((5 * Math.PI) / 13) / Math.cos((4 * Math.PI) / 13);
const START_ANGLE_DEG = -90;

/* Coordinates are serialised at 4 decimals; 1e-3 absorbs the rounding. */
const COORD_TOLERANCE = 1e-3;

function expectedVertex(index, cx, cy, outerRadius, innerRadius) {
  const angle =
    (START_ANGLE_DEG + index * STEP_DEG) * (Math.PI / 180);
  const radius = index % 2 === 0 ? outerRadius : innerRadius;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle)
  };
}

/** Parse "Mx y Lx y … Z" into [{x, y}]. */
function parsePathVertices(d) {
  const numbers = d.match(/-?\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length % 2 !== 0) {
    return null;
  }
  const coords = numbers.map(Number);
  const vertices = [];
  for (let i = 0; i < coords.length; i += 2) {
    vertices.push({ x: coords[i], y: coords[i + 1] });
  }
  return vertices;
}

/** Parse a <polygon points="x,y …"> into [{x, y}]. */
function parsePolygonVertices(points) {
  const pairs = points.trim().split(/\s+/);
  return pairs.map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return { x, y };
  });
}

/**
 * THE GEOMETRY PROOF. Given a vertex list believed to be the star,
 * verify all structural + mathematical properties against the polar
 * construction. Returns a list of problems (empty = exact).
 */
function proveStarGeometry(vertices, { cx, cy, outerRadius, label }) {
  const problems = [];
  const innerRadius = outerRadius * INNER_RATIO;

  if (vertices.length !== VERTICES) {
    problems.push(
      `${label}: expected ${VERTICES} vertices, found ${vertices.length}`
    );
    return problems;
  }

  /* 1. Every vertex matches its polar construction. */
  for (let i = 0; i < VERTICES; i += 1) {
    const expected = expectedVertex(i, cx, cy, outerRadius, innerRadius);
    const actual = vertices[i];
    const dx = Math.abs(actual.x - expected.x);
    const dy = Math.abs(actual.y - expected.y);
    if (dx > COORD_TOLERANCE || dy > COORD_TOLERANCE) {
      problems.push(
        `${label}: vertex ${i} is (${actual.x}, ${actual.y}), expected (${expected.x.toFixed(4)}, ${expected.y.toFixed(4)})`
      );
    }
  }

  /* 2. 13-fold rotational symmetry: rotating by 360/13° maps the set
   *    onto itself. For every vertex, a copy rotated by one outer
   *    step must exist (within tolerance). */
  const rotationAngle = (2 * Math.PI) / POINTS;
  const cosR = Math.cos(rotationAngle);
  const sinR = Math.sin(rotationAngle);

  for (const vertex of vertices) {
    const relX = vertex.x - cx;
    const relY = vertex.y - cy;
    const rotX = cx + relX * cosR - relY * sinR;
    const rotY = cy + relX * sinR + relY * cosR;

    const matched = vertices.some(
      (candidate) =>
        Math.abs(candidate.x - rotX) <= 2 * COORD_TOLERANCE &&
        Math.abs(candidate.y - rotY) <= 2 * COORD_TOLERANCE
    );
    if (!matched) {
      problems.push(
        `${label}: rotational symmetry broken — vertex (${vertex.x}, ${vertex.y}) has no counterpart at +${(360 / POINTS).toFixed(4)}°`
      );
      break;
    }
  }

  /* 3. Radial sanity: outer vertices exactly on the R circle, inner
   *    vertices exactly on the r circle (deviation beyond rounding
   *    would mean a hand-tuned shape). */
  for (let i = 0; i < VERTICES; i += 1) {
    const vertex = vertices[i];
    const radius = Math.hypot(vertex.x - cx, vertex.y - cy);
    const expectedRadius =
      i % 2 === 0 ? outerRadius : outerRadius * INNER_RATIO;
    if (Math.abs(radius - expectedRadius) > COORD_TOLERANCE) {
      problems.push(
        `${label}: vertex ${i} radius ${radius.toFixed(4)} != expected ${expectedRadius.toFixed(4)}`
      );
    }
  }

  return problems;
}

/* ------------------------------------------------------------------ */
/* PNG dimension reader (IHDR)                                          */
/* ------------------------------------------------------------------ */

function pngDimensions(buffer) {
  if (
    buffer.length < 33 ||
    buffer.readUInt32BE(0) !== 0x89504e47
  ) {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

/* ------------------------------------------------------------------ */
/* Checks                                                              */
/* ------------------------------------------------------------------ */

const BRAND_VIEWBOX = { cx: 50, cy: 50, outerRadius: 48 };
const ICON_VIEWBOX = { cx: 64, cy: 64, outerRadius: 54 };

const REQUIRED_BRAND_VARIANTS = [
  "star-red.svg",
  "star-red-hot.svg",
  "star-crimson.svg",
  "star-white.svg",
  "star-black.svg",
  "star-silver.svg",
  "star-dark.svg",
  "star-outline-red.svg",
  "star-outline-white.svg"
];

const RUNTIME_STAR_VARIANTS = [
  "star-red.svg",
  "star-red-hot.svg",
  "star-white.svg",
  "star-outline-red.svg",
  "star-silver.svg"
];

const REQUIRED_GLYPHS = [
  "star.svg",
  "star-outline.svg",
  "concentric-star.svg",
  "star-grid.svg",
  "orbit.svg",
  "signal-node.svg",
  "system-glyph.svg",
  "research-glyph.svg",
  "ai-glyph.svg",
  "engineering-glyph.svg",
  "simulation-glyph.svg",
  "link-glyph.svg",
  "arrow-right.svg",
  "arrow-up-right.svg"
];

const REQUIRED_PROJECT_ART = [
  "sheytan-agent-lab.svg",
  "uhit-intelligence-scale.svg",
  "freeiran-vpn-mesh.svg",
  "red-magic-organism.svg",
  "web-static-living-system.svg"
];

/* Perf budgets (bytes) — the asset system must never become dead weight. */
const BUDGETS = {
  brandStarSvg: 6 * 1024,
  glyphSvg: 4 * 1024,
  projectArtSvg: 8 * 1024,
  ogPng: 300 * 1024,
  iconPng: 40 * 1024,
  appleIconPng: 30 * 1024,
  faviconIco: 12 * 1024
};

function extractStarPathD(svg) {
  const match = svg.match(/<path d="([^"]+)"[^>]*fill=/);
  return match ? match[1] : null;
}

function extractPolygonPoints(svg) {
  const match = svg.match(/<polygon points="([^"]+)"/);
  return match ? match[1] : null;
}

async function fileSize(relativePath) {
  const info = await stat(path.join(ROOT, relativePath));
  return info.size;
}

async function verifyStarSystem() {
  const canonicalDir = path.join(ROOT, "assets", "brand");
  const runtimeDir = path.join(ROOT, "public", "brand");

  /* 1. Every required variant exists, proves its geometry, and stays
   *    within budget. */
  let referenceGeometry = null;

  for (const variant of REQUIRED_BRAND_VARIANTS) {
    const file = path.join(canonicalDir, variant);
    if (!existsSync(file)) {
      fail(`brand star missing: assets/brand/${variant}`);
      continue;
    }

    const svg = await readFile(file, "utf8");
    const d = extractStarPathD(svg);
    if (!d) {
      fail(`brand star has no path geometry: assets/brand/${variant}`);
      continue;
    }

    if (referenceGeometry === null) {
      referenceGeometry = d;
    } else if (d !== referenceGeometry) {
      fail(
        `brand star geometry drifted from the variant family: assets/brand/${variant}`
      );
    }

    const vertices = parsePathVertices(d);
    if (!vertices) {
      fail(`brand star path is unparseable: assets/brand/${variant}`);
      continue;
    }

    const problems = proveStarGeometry(vertices, {
      ...BRAND_VIEWBOX,
      label: `assets/brand/${variant}`
    });
    for (const problem of problems) {
      fail(problem);
    }

    const size = await fileSize(path.join("assets", "brand", variant));
    if (size > BUDGETS.brandStarSvg) {
      fail(`brand star exceeds budget: assets/brand/${variant} (${size} B)`);
    }
  }

  if (referenceGeometry !== null && failures.length === 0) {
    pass(
      `brand star: ${REQUIRED_BRAND_VARIANTS.length} variants prove the exact {13/5} construction (26 vertices, step ${STEP_DEG.toFixed(4)}°, inner ratio ${INNER_RATIO.toFixed(12)}), byte-identical geometry, ${POINTS}-fold rotational symmetry`
    );
  }

  /* 2. Runtime copies byte-identical to canonical. */
  for (const variant of RUNTIME_STAR_VARIANTS) {
    const canonicalFile = path.join(canonicalDir, variant);
    const runtimeFile = path.join(runtimeDir, variant);
    if (!existsSync(runtimeFile)) {
      fail(`runtime star missing: public/brand/${variant}`);
      continue;
    }
    const canonical = await readFile(canonicalFile);
    const runtime = await readFile(runtimeFile);
    if (!canonical.equals(runtime)) {
      fail(`runtime star drifted from canonical: public/brand/${variant}`);
    }
  }
  pass(
    `runtime star copies: ${RUNTIME_STAR_VARIANTS.length} byte-identical to assets/brand`
  );

  /* 3. viewBox law for every star variant. */
  for (const variant of REQUIRED_BRAND_VARIANTS) {
    const svg = await readFile(path.join(canonicalDir, variant), "utf8");
    if (!svg.includes('viewBox="0 0 100 100"')) {
      fail(`brand star viewBox is not stable: assets/brand/${variant}`);
    }
  }

  /* 4. Favicon star: same construction at icon scale. */
  const iconPath = path.join(ROOT, "public", "icon.svg");
  if (!existsSync(iconPath)) {
    fail("favicon missing: public/icon.svg");
  } else {
    const iconSvg = await readFile(iconPath, "utf8");
    if (!iconSvg.includes('viewBox="0 0 128 128"')) {
      fail("favicon: public/icon.svg must use the stable 128 viewBox");
    }
    const d = extractStarPathD(iconSvg);
    if (!d) {
      fail("favicon: public/icon.svg has no star path");
    } else {
      const vertices = parsePathVertices(d);
      const problems = proveStarGeometry(vertices, {
        ...ICON_VIEWBOX,
        label: "public/icon.svg"
      });
      for (const problem of problems) {
        fail(problem);
      }
      if (problems.length === 0) {
        pass("favicon star: exact {13/5} construction at icon scale (128 viewBox, R=54)");
      }
    }
  }

  /* 5. Raster favicon family. */
  const iconPng = path.join(ROOT, "public", "icon.png");
  if (!existsSync(iconPng)) {
    fail("favicon fallback missing: public/icon.png");
  } else {
    const buffer = await readFile(iconPng);
    const dims = pngDimensions(buffer);
    if (!dims || dims.width !== 192 || dims.height !== 192) {
      fail(`public/icon.png must be 192×192 (multiple of 48), found ${JSON.stringify(dims)}`);
    } else {
      pass("favicon fallback: public/icon.png 192×192 (multiple of 48 per Google guidance)");
    }
    const size = await fileSize(path.join("public", "icon.png"));
    if (size > BUDGETS.iconPng) {
      fail(`public/icon.png exceeds budget (${size} B)`);
    }
  }

  const icoPath = path.join(ROOT, "public", "favicon.ico");
  if (!existsSync(icoPath)) {
    fail("legacy favicon missing: public/favicon.ico");
  } else {
    const buffer = await readFile(icoPath);
    /* ICO header: reserved 0, type 1, count. */
    const count = buffer.readUInt16LE(4);
    if (buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1 || count < 3) {
      fail(`public/favicon.ico must contain at least 16/32/48 frames, found ${count}`);
    } else {
      pass(`legacy favicon: public/favicon.ico carries ${count} frame(s)`);
    }
    const size = await fileSize(path.join("public", "favicon.ico"));
    if (size > BUDGETS.faviconIco) {
      fail(`public/favicon.ico exceeds budget (${size} B)`);
    }
  }

  const applePath = path.join(ROOT, "public", "apple-icon.png");
  if (!existsSync(applePath)) {
    fail("Apple touch icon missing: public/apple-icon.png");
  } else {
    const buffer = await readFile(applePath);
    const dims = pngDimensions(buffer);
    if (!dims || dims.width !== 180 || dims.height !== 180) {
      fail(`public/apple-icon.png must be 180×180, found ${JSON.stringify(dims)}`);
    } else {
      pass("Apple touch icon: public/apple-icon.png 180×180, opaque square");
    }
    const size = await fileSize(path.join("public", "apple-icon.png"));
    if (size > BUDGETS.appleIconPng) {
      fail(`public/apple-icon.png exceeds budget (${size} B)`);
    }
  }
}

async function verifyGlyphLibrary() {
  const canonicalDir = path.join(ROOT, "assets", "icons");
  const runtimeDir = path.join(ROOT, "public", "brand", "icons");

  for (const glyph of REQUIRED_GLYPHS) {
    const canonicalFile = path.join(canonicalDir, glyph);
    const runtimeFile = path.join(runtimeDir, glyph);

    if (!existsSync(canonicalFile)) {
      fail(`glyph missing: assets/icons/${glyph}`);
      continue;
    }
    if (!existsSync(runtimeFile)) {
      fail(`runtime glyph missing: public/brand/icons/${glyph}`);
      continue;
    }

    const canonical = await readFile(canonicalFile);
    const runtime = await readFile(runtimeFile);
    if (!canonical.equals(runtime)) {
      fail(`runtime glyph drifted from canonical: public/brand/icons/${glyph}`);
    }

    const svg = await readFile(canonicalFile, "utf8");
    if (!svg.includes('viewBox="0 0 24 24"')) {
      fail(`glyph viewBox must be 24×24: assets/icons/${glyph}`);
    }
    if (!svg.includes("currentColor")) {
      fail(`glyph must be currentColor-recolourable: assets/icons/${glyph}`);
    }

    const size = await fileSize(path.join("assets", "icons", glyph));
    if (size > BUDGETS.glyphSvg) {
      fail(`glyph exceeds budget: assets/icons/${glyph} (${size} B)`);
    }
  }

  if (failures.length === 0) {
    pass(`glyph library: ${REQUIRED_GLYPHS.length} currentColor glyphs identical in both layers`);
  }
}

async function verifyProjectArtwork() {
  const canonicalDir = path.join(ROOT, "assets", "illustrations");
  const runtimeDir = path.join(ROOT, "public", "images", "projects");

  for (const artwork of REQUIRED_PROJECT_ART) {
    const canonicalFile = path.join(canonicalDir, artwork);
    const runtimeFile = path.join(runtimeDir, artwork);

    if (!existsSync(canonicalFile)) {
      fail(`project artwork missing: assets/illustrations/${artwork}`);
      continue;
    }
    if (!existsSync(runtimeFile)) {
      fail(`runtime artwork missing: public/images/projects/${artwork}`);
      continue;
    }

    const canonical = await readFile(canonicalFile);
    const runtime = await readFile(runtimeFile);
    if (!canonical.equals(runtime)) {
      fail(`runtime artwork drifted from canonical: public/images/projects/${artwork}`);
    }

    const svg = await readFile(canonicalFile, "utf8");
    if (!svg.includes('viewBox="0 0 1200 630"')) {
      fail(`project artwork must be 1200×630: assets/illustrations/${artwork}`);
    }
    if (!svg.includes("<title")) {
      fail(`project artwork must carry an SVG <title>: assets/illustrations/${artwork}`);
    }

    const size = await fileSize(path.join("assets", "illustrations", artwork));
    if (size > BUDGETS.projectArtSvg) {
      fail(`project artwork exceeds budget: assets/illustrations/${artwork} (${size} B)`);
    }
  }

  if (failures.length === 0) {
    pass(`project artwork: ${REQUIRED_PROJECT_ART.length} original diagrams identical in both layers, all ≤ ${BUDGETS.projectArtSvg / 1024}KB`);
  }
}

async function verifySocialFamily() {
  const ogPath = path.join(ROOT, "public", "og-default.png");
  if (!existsSync(ogPath)) {
    fail("default OG image missing: public/og-default.png");
    return;
  }

  const buffer = await readFile(ogPath);
  const dims = pngDimensions(buffer);
  if (!dims || dims.width !== 1200 || dims.height !== 630) {
    fail(`public/og-default.png must be 1200×630, found ${JSON.stringify(dims)}`);
  } else {
    pass("default OG image: public/og-default.png 1200×630 PNG");
  }

  const size = await fileSize(path.join("public", "og-default.png"));
  if (size > BUDGETS.ogPng) {
    fail(`public/og-default.png exceeds budget (${size} B)`);
  } else {
    pass(`default OG image weight: ${(size / 1024).toFixed(1)}KB (≤ ${BUDGETS.ogPng / 1024}KB budget)`);
  }

  const canonicalOg = path.join(ROOT, "assets", "social", "og-default.png");
  if (!existsSync(canonicalOg)) {
    fail("social OG canonical copy missing: assets/social/og-default.png");
  } else {
    const canonical = await readFile(canonicalOg);
    if (!canonical.equals(buffer)) {
      fail("assets/social/og-default.png drifted from public/og-default.png");
    } else {
      pass("social OG canonical copy byte-identical to served image");
    }
  }

  const squarePath = path.join(ROOT, "assets", "social", "og-square.png");
  if (!existsSync(squarePath)) {
    fail("square social variant missing: assets/social/og-square.png");
  } else {
    const buffer2 = await readFile(squarePath);
    const dims2 = pngDimensions(buffer2);
    if (!dims2 || dims2.width !== 1200 || dims2.height !== 1200) {
      fail(`assets/social/og-square.png must be 1200×1200, found ${JSON.stringify(dims2)}`);
    } else {
      pass("square social variant: assets/social/og-square.png 1200×1200");
    }
  }
}

async function verifyManifest() {
  const manifestPath = path.join(ROOT, "assets", "brand", "manifest.json");
  if (!existsSync(manifestPath)) {
    fail("brand manifest missing: assets/brand/manifest.json");
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    fail(`brand manifest does not parse: ${error.message}`);
    return;
  }

  const geometry = manifest?.geometry?.star;
  if (!geometry) {
    fail("brand manifest missing geometry.star");
    return;
  }

  if (geometry.outerVertices !== POINTS || geometry.innerVertices !== POINTS) {
    fail("brand manifest vertex counts are not 13/13");
  }
  if (geometry.totalVertices !== VERTICES) {
    fail("brand manifest total vertex count is not 26");
  }
  if (Math.abs(geometry.angularStepDeg - STEP_DEG) > 1e-9) {
    fail("brand manifest angular step is not 360/26");
  }
  if (Math.abs(geometry.innerRadiusRatio - INNER_RATIO) > 1e-12) {
    fail("brand manifest inner ratio is not the exact {13/5} value");
  }
  if (failures.length === 0) {
    pass("brand manifest: geometry registry matches the mathematical model");
  }
}

async function main() {
  if (!existsSync(path.join(ROOT, "assets"))) {
    console.error("[brand] assets/ does not exist — run scripts/generate-brand.mjs first.");
    process.exit(1);
  }

  await verifyStarSystem();
  await verifyGlyphLibrary();
  await verifyProjectArtwork();
  await verifySocialFamily();
  await verifyManifest();

  console.log(`\n[brand] ${checks.length} check(s) passed`);
  for (const entry of checks) {
    console.log(`  ✓ ${entry}`);
  }

  if (failures.length > 0) {
    console.error(`\n[brand] ${failures.length} FAILURE(S):`);
    for (const failure of failures) {
      console.error(`  ✗ ${failure}`);
    }
    process.exit(1);
  }

  console.log("\n[brand] brand asset verification passed.");
}

main().catch((error) => {
  console.error("[brand] unexpected verification failure:", error);
  process.exit(1);
});
