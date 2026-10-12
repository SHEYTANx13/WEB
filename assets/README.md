# assets/ — the WEB visual asset system (v2.9)

`assets/` is the **source of truth** for the Parsa Tak brand and visual
system. It is organized, versioned, and generated — it is not a dump.

Two layers exist on purpose:

| Layer | Location | Role |
| --- | --- | --- |
| Source of truth | `assets/…` | Canonical, hand-reviewable, generator-owned |
| Runtime copies | `public/…` | Byte-identical copies the static export serves |

`scripts/verify-brand.mjs` fails the build if the two layers ever drift.
Generated files are committed, so builds never require a hidden local
step — the generators exist so the geometry can be **regenerated and
reproduced exactly**, and so changes are made by editing the generator
and regenerating, never by hand-editing an output.

## Layout

```text
assets/
  README.md            ← this file (conventions + ownership)
  brand/               ← the 13-point star system (canonical)
    manifest.json      ← machine-readable registry of every variant
    star-*.svg         ← geometry-locked colour variants
  icons/               ← glyph library (currentColor, 24×24)
  illustrations/       ← featured-project artwork (canonical, 1200×630)
  social/              ← social/OG raster family (PNG)
```

Runtime copies:

```text
public/brand/…          ← served star variants + icons/ glyphs
public/images/projects/ ← served project artwork
public/icon.svg         ← favicon SVG (explicit metadata.icons in app/layout.tsx)
public/icon.png         ← 192×192 PNG favicon fallback
public/favicon.ico      ← 16/32/48 legacy favicon
public/apple-icon.png   ← 180×180 Apple touch icon
public/og-default.png   ← 1200×630 default Open Graph image
```

## Generators (the only way to change these assets)

| Script | Owns | Deterministic |
| --- | --- | --- |
| `scripts/generate-brand.mjs` | `assets/brand/`, `assets/icons/`, `public/brand/`, `public/icon.svg` | Yes — pure Node, zero dependencies |
| `scripts/generate-project-art.mjs` | `assets/illustrations/`, `public/images/projects/` | Yes — pure Node, zero dependencies |
| `scripts/generate-brand-raster.py` | `public/icon.png`, `public/favicon.ico`, `public/apple-icon.png`, `public/og-default.png`, `assets/social/` | Yes — Pillow only |

Regenerate everything after editing a generator:

```bash
node scripts/generate-brand.mjs
node scripts/generate-project-art.mjs
python3 scripts/generate-brand-raster.py
node scripts/verify-brand.mjs   # prove the system is coherent
```

## The 13-point star — geometry law

The star is the **primary Parsa Tak site identity**. It is a true
regular 13-point star polygon `{13/5}`, constructed in polar
coordinates — never hand-drawn:

- outer vertices: **13** (radius `R`)
- inner vertices: **13** (radius `r = R · cos(5π/13) / cos(4π/13)`,
  the exact `{13/5}` star-polygon ratio ≈ `0.624233221799`)
- total alternating vertices: **26**
- angular step between consecutive vertices: **360° / 26**
- first vertex at **−90°** (a point at exactly 12 o'clock)
- brand viewBox `0 0 100 100`, `R = 48`; favicon viewBox `0 0 128 128`,
  `R = 54` (same construction, scaled; favicon files live in `public/`
  and are linked through the root layout's explicit `metadata.icons`,
  which stays deterministic when the `/WEB` basePath is active)

**Only colour treatment may differ between variants. The path
geometry is byte-identical in every `star-*.svg`, and
`scripts/verify-brand.mjs` mathematically re-proves it** (it parses
each path, recomputes the polar construction, and checks 13-fold
rotational symmetry).

`k = 5` is deliberately chosen over `{13/6}`: both are regular
13-point stars, but `{13/5}` keeps points legible at favicon sizes.

## Brand colour variants (`assets/brand/`)

| File | Treatment | Use on |
| --- | --- | --- |
| `star-red.svg` | solid `#ff2020` | dark + light — **the primary site logo** |
| `star-red-hot.svg` | radial white-hot→deep red gradient | identity surfaces, loading, social |
| `star-crimson.svg` | solid `#a90000` | quiet accents, pressed states |
| `star-white.svg` | solid `#ffffff` | dark or red surfaces, monochrome |
| `star-black.svg` | solid `#0a0a0a` | light surfaces, documents |
| `star-silver.svg` | solid `#c9cdd4` | neutral dark-UI accents |
| `star-dark.svg` | solid `#22262e` | quiet watermarks on light UI |
| `star-outline-red.svg` | no fill, 3u `#ff2020` stroke | transparent-stroke compositions |
| `star-outline-white.svg` | no fill, 3u `#ffffff` stroke | transparent-stroke, dark surfaces |

The registry with intended usage lives in `assets/brand/manifest.json`.

## Icon system (`assets/icons/`)

Monochrome-first 24×24 glyphs using `currentColor`, so CSS decides the
ink. Every glyph states its purpose in a comment and in the manifest;
each is embeddable in article bodies through the standard markdown
image pipeline (`/brand/icons/<name>.svg` — intrinsic size and alt are
validated by the build).

## Naming conventions

- lowercase, hyphen-delimited, purpose-bearing filenames
  (`star-red-hot.svg`, `sheytan-agent-lab.svg`)
- star variants always start `star-`
- glyphs always end `-glyph` unless they are the star or arrows
- raster sizes are always encoded in metadata, never in filenames
- no `final`, `new`, `copy`, or `v2` names — the generator + git
  history own versioning

## Identity distinction (brand law)

- **13-point star = Parsa Tak / site identity** — headers, footer,
  favicon, loading surface, social artwork.
- **Red Eye = RED MAGIC / the artistic system experience** — the RED
  MAGIC scene and its article context. The eye is never used as the
  site logo; the star is never used as the RED MAGIC mark.
