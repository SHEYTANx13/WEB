# AGENTS.md — Engineering Operating Guide for WEB

Persistent operating guide for any coding agent (human or AI) working in this
repository. Read it before your first change; re-read it before you argue with
it. The current live code always wins over documentation — including this file
— but the laws below describe *why* the code looks the way it does, so treat a
violation as a bug to be justified, not a style preference.

---

## Project identity

- **WEB** is the personal site of Parsa Tak: an evolving laboratory for AI
  systems, local AI agents, reasoning, evaluation, software engineering, and
  creative technology. It hosts the canonical **Work**, **Research**, and
  **Blog** surfaces plus six topic hubs.
- **RED MAGIC** is the site's signature: a living computational organism — a
  canvas-rendered energy field with a core, network, membrane, particles,
  energy flows and atmosphere. It is the product's visual identity, not a
  decoration. Never simplify it into a "generic animation".
- The **13-point star** (see `TRADEMARKS.md`, `lib/brand.ts`) is the brand
  mark. Preserve it everywhere it appears.
- The information architecture is **Blog-centered**: the Blog
  (`/blog/`) is the primary discovery surface for writing, work
  documentation, and research writing (content modes: ARTICLES / WORK /
  RESEARCH). The world shell (`/`) is an experiential scene navigator;
  `/work/` and `/research/` are canonical deep documents.

## Architecture

- **Next.js App Router + React + TypeScript**, `output: "export"` static
  export, deployed to **GitHub Pages** at `/WEB` (basePath applied when
  `GITHUB_ACTIONS=true`; see `next.config.ts` and the `NEXT_PUBLIC_BASE_PATH`
  env inline).
- **Public route model** (canonical registry: `data/routes.json`): home world
  shell `/`, identity documents `/about/`, `/contact/`, collections `/work/`,
  `/research/`, six topic hubs (`/local-ai/`, `/ai-systems/`,
  `/ai-reasoning/`, `/ai-evaluation/`, `/software-engineering/`,
  `/creative-technology/`), Blog index `/blog/`, articles `/blog/<slug>/`
  (derived from `content/blog/*.md`). World-shell hash scenes (`/#systems`,
  `/#magic`, `/#media`) are interaction states — never documents, never
  sitemap entries (the legacy `/#library` hash resolves as a deliberate
  backward-compatible alias of `/#media`; the former `#about` scene was
  removed in v4.0.1 — `/about/` is the only canonical About).
- **RED MAGIC is lazy-loaded.** The organism ships as a module
  family: `components/RedMagic.tsx` is a deliberately tiny React shell
  (canvas host + one effect); the engine lives in `components/redmagic/`
  (`engineConstants`, `engineState`, `simulation`, `render`, `input`,
  `lifecycle`, plus the pre-existing `engineConfig`, `engineWorld`,
  `engineSprites`). The engine chunk is dynamically imported at idle
  time (`components/HomeOriginOrganism.tsx`, MagicConsole usage) with
  a CSS seed fallback. Never move the organism into the main bundle;
  never convert the raw `import()` to `next/dynamic`/Suspense (that
  broke static export before — see the file's header comment).
- **Loading performance law (v4.0.3):** speculation obeys
  `critical load → page usable → idle → speculation`. The ONE settle
  gate is `whenPageSettled()` (`lib/loadPhase.ts`): document complete +
  one idle gap, hard-capped; the scene preloader and the RED MAGIC
  organism both wait for it — a bare `requestIdleCallback` is NOT
  permission to fetch during startup (mechanism behind the v4.0.2
  pre-FCP speculation measured in the v4.0.3 benchmark). Viewport
  prefetch is OFF site-wide: every internal `next/link` carries
  `prefetch={false}` — a Link without it floods RSC payloads
  (v4.0.2 measured: up to 11 article payloads per blog page view,
  and the whole home shell pulled onto every content page through
  the brand link). Warming is intent-only and disciplined
  (pointer-down / focus immediate; pointer-enter requires a dwell
  and is cancelled on leave; save-data/2G skip via `lib/connection.ts`;
  the current route is never warmed; dedup + failure retry in
  `UnifiedSiteNav`). Internal document-body links render through
  `next/link` (see `components/content/ContentBlocks.tsx` DocLink) so
  navigation is client-side and the global player survives every
  in-document jump — plain internal `<a>` anchors are reserved for
  no-JS-critical or external destinations. Connection/device probes
  live in ONE module (`lib/connection.ts`); the background scheduler
  re-exports them. Loading regressions are verified, not asserted:
  `npm run verify:loading` (export-level) and `npm run bench:loading`
  (real-browser medians) gate the state.
- **Route progress (v4.0.5):** REAL route/tab navigation has
  ONE tiny loading signal, mounted exactly ONCE from the root
  layout (`app/layout.tsx` → `components/RouteProgress.tsx`) — the
  same root-layout law as the global Music player. The navigation
  island (`UnifiedSiteNav`) fires the `web:route-progress` DOM
  event on a genuine internal click (normal click only — modifier,
  new-tab, external, and same-route clicks never fire; the event
  literal is duplicated deliberately so the two chunk graphs stay
  independent, and `tests/route-progress.test.ts` pins both sides
  to the identical string). Contract: 150 ms grace period
  (`ROUTE_PROGRESS_GRACE_MS`, `lib/loadPhase.ts`) so fast/warmed/
  cached navigations never show anything; then a 2px indeterminate
  red line at the top of the viewport ONLY while the navigation is
  unresolved; the destination commits (`usePathname` comparison
  against the intent's origin), paints (double rAF), and the line
  fades. The signal is display-only (pointer-events: none in every
  state), aria-hidden (the router announces the destination),
  race-safe by monotonic intent tokens, static under reduced
  motion, and never visible in the static export (the
  `html.reveal-js` gate). The v4.0.4 full-screen route overlay
  (`GlobalRouteTransition`, `lib/routeIntent.ts`, the
  `SceneLoadingScreen` route variant) is REMOVED — do not
  reintroduce a second route-loading mechanism; scene loading keeps
  its own system (`SceneLoadingScreen`, boot/scene variants only).
  Behavior regressions are pinned by `tests/route-progress.test.ts`
  and the export-level inactive check in `verify:loading`.
- **Shared header status (v4.0.5):** every major surface carries the
  same header identity — `★ Parsa Tak  ● CURRENT SURFACE` — through
  ONE shared component, `components/SiteHeaderStatus.tsx` (+ its own
  module). It owns the markup, the red dot, the 2.4s transform/opacity
  pulse, the typography, the reduced-motion behavior and the
  accessibility behavior; host headers (LivingShell, BlogHeader,
  ContentShell) own PLACEMENT only and must not restyle it. Labels
  come from the authorities: world scenes use the live scene
  definition (with `live` for polite scene-change announcements);
  BLOG is static; ContentShell routes resolve through
  `headerStatusForRoutePath()` in `lib/routes.ts` (registry path →
  uppercase identity; unregistered paths render no status). No
  route-specific status variant may be created, no status may be
  hidden at breakpoints (the compact hierarchy is brand → status →
  menu trigger), and the component stays server-safe (no client
  code, no animation state).
- **Document unification + compact footer (v4.0.5):** every
  ContentShell document renders ONE shared title system — crumbs,
  then the identity row (heroSignal BESIDE heroCopy, in normal
  document flow — no absolute positioning, never overlapping, never
  clipped) with the page-accent themed signal, compositor-only,
  static under reduced motion — and the hero is TOP-ANCHORED, so
  the crumbs/kicker/H1 sit at identical positions on every route
  regardless of lead length. Route-specific CSS may style the
  DECORATIVE field vocabulary only (heroField/heroRing/heroAxis/
  heroNode) — never the rail, crumbs, title, lead, or identity; no
  page-specific hero/shell components may be created. The footer
  is ONE deliberate region stack owned by its own stylesheet
  (`SiteFooter.module.css` — NOT LivingShell.module.css): the four
  logical groups (SITE, COLLECTIONS, WORLD, TOPICS) render as a
  responsive column grid (4 → 2 → 1); the PUBLIC NETWORK region
  presents the 14 verified links of `lib/links.ts` as exactly TWO
  rows of SEVEN on desktop (`FOOTER_LINK_ROW_SIZE = 7` —
  presentation-only slicing of the one registry; rows wrap
  order-stably below desktop) through the ONE shared FooterLink
  renderer and the shared LinkIcon system at a 19–18px box with a
  CSS-only, transform/opacity accent hover (the registry's own
  `--link-accent`, static under reduced motion); the legal row
  top-aligns without baseline hacks; and the BOTTOM-MOST row is the
  identity line (star + © 2026 Parsa Tak. All rights reserved. +
  Parsa Tak™) in normal flow.
  `SiteFooter` must NEVER carry a `data-reveal` opt-in again — the
  reveal controller mounts only on the world shell and the blog
  layout, so an opt-in there left the entire footer invisible
  (`opacity: 0`) on every ContentShell route (the v4.0.3 bug,
  verified against the v4.0.3 export before the fix).
- **Global red cursor (v4.0.5):** the cursor is a ROOT-layout
  system, mounted exactly ONCE from `app/layout.tsx` (the same
  root-layout law as the Music player and RouteProgress) — never
  from a shell or route layout. Before v4.0.5 it mounted inside
  LivingShell (and separately in the blog layout), so every
  ContentShell document route (`/about/`, `/contact/`, `/work/`,
  `/research/`, the hubs) fell back to the native pointer. The
  component itself (`components/RedCursor.tsx`) is a native CSS
  cursor: zero pointer listeners, zero rAF, zero React state, zero
  moving DOM; coarse/touch + reduced-motion visitors keep the native
  pointer, and `html.pdf-reader-active` is the embedded-viewer
  escape hatch. Pinned by `tests/global-cursor.test.ts` (one mount,
  one implementation, fallback contract).
- **Page identity artifacts (v4.0.5):** About and Contact lead
  their documents with a unique server-rendered visual artifact —
  the About identity/practice matrix (RESEARCH / ENGINEERING /
  PRODUCT on one signal rail) and the Contact transmission console
  (four collaboration intents wired to the one verified email
  action, GitHub/LinkedIn secondary). Both render through
  ContentShell's ONE generic optional `docFeature` slot (the page's
  first document block) from inside the page files — no page-specific
  shell, no client component, no canvas, no pointer tracking; CSS
  transforms/opacity only, static under reduced motion; all facts
  and links are material the site already presents. Artifact styling
  lives in `content.module.css` (page-specific ARTIFACT blocks) and
  may not redefine shared geometry. Export-level presence is
  verified by `verify:loading` (6b), source contracts by
  `tests/document-shell.test.ts`.
- Blog pipeline: `scripts/build-blog.mjs` parses/validates/renderers
  `content/blog/*.md` → `data/blog/posts.json` + `public/sitemap.xml`. A
  malformed article FAILS the build. Run before dev/build.
- **SEO registry**: `data/routes.json` is the single manually maintained
  route list. The sitemap generator, the SEO verifier, and `lib/hubs.ts` all
  derive their route facts from it. Do not create parallel route lists.
- **Information architecture (v3.9)**: the home page reads
  `Hero → Featured Work → Capabilities → Method → Systems → Writing →
  Direction → Connect`. The hero carries a START HERE `<nav>` with real
  links to `/work/`, `/research/`, `/blog/`, `/contact/` — verified in the
  exported HTML by `verify-seo.mjs` (the `first action` check). Every home
  capability card carries a `proof` link to the hub/document/article that
  demonstrates it. `/work/` and `/research/` remain canonical deep documents
  reached through content, not primary tabs.
- **Lateral content graph (v3.9)**: `lib/workRegistry.ts` holds the
  Selected Work entries (`WORK_ENTRIES`) — the same table `/work/` renders.
  `lib/blog.ts#getRelatedDestinations(slug)` derives each article's
  deterministic lateral edges from it: `project` matches a registry
  `blogProject` (or explicit `blogProjectAliases`) → a `/work/` edge naming
  that entry; `type === "research"` → a `/research/` edge. The article page
  renders them in the related section ("IN THE LABORATORY" rows) and the
  SEO verifier requires them in the exported HTML (scoped to the related
  section, because the footer also links the collections site-wide). When
  adding a Work entry, keep `blogProject` truthful; when a system is
  written about under a second project stream, declare it in
  `blogProjectAliases` instead of renaming the article frontmatter.
- Supporting engines: `lib/worldSignals.ts` (shared organism runtime state),
  `components/redmagic/engineConfig.ts` (quality budgets / runtime states /
  adaptive-DPR + pressure-DPR policies / refresh estimator / settle
  predicate), `components/redmagic/engineWorld.ts` (structural world
  construction: grid, bounded potential field, boundary, influence
  tables, flow geometry), `components/redmagic/engineSprites.ts`
  (cached offscreen sprite factory), `lib/backgroundScheduler.ts` +
  `lib/idleScheduler.ts` (idle-time loading).
- **Global Music player (v4.0.2):** the player is mounted exactly
  ONCE, from the ROOT application layout (`app/layout.tsx` →
  `components/player/GlobalMusicPlayerHost.tsx`), never from a route
  or scene — the world shell's former mount existed only on "/" and
  lost the UI on route navigation. Under the host: ONE
  `PlayerStore` (`lib/player/playerStore.ts`, module singleton) and
  ONE `<audio>` element (created by the store's factory, attached to
  `document.body`, `preload="none"` until the first playback intent
  assigns a URL). The host imports NO store code: the lazy
  `PlayerSurface` chunk mounts on the store's `web:player:engage`
  DOM event (first explicit play intent) or immediately when a
  persisted session exists (a raw localStorage probe — since v4.0.3
  the probe is `lib/player/sessionPresence.ts`, a module that holds
  ONLY the storage key and the one-line existence check; the full
  session read/write/validate lifecycle stays in
  `lib/player/persistence.ts` inside the lazy player chunk, so the
  eager host graph of every route is minimal by construction).
  MediaScene is
  a catalog/intent surface — it registers the filtered collection
  and issues intents (play / play next / add to queue); the element
  wiring and the whole Media Session integration live in the global
  player layer. Direct external media URLs (`sourceType: "direct"`
  in `data/media.json`, schema v4) are absolute http/https URLs
  validated at sync + validation time; WEB never proxies, downloads
  or range-fetches them at build time, and never fabricates GitHub
  provenance for them. Non-sensitive playback state persists
  locally (`lib/player/persistence.ts`); a full reload restores a
  PAUSED player at the persisted position and NEVER autoplays.
  Player state survives client-side route navigation by
  construction — no player API is called on route change.
- **RedMagic runtime shape (v4.0.1):** `RedMagic.tsx` mounts the engine
  through `mountRedMagicEngine(canvas)` (`redmagic/lifecycle.ts`) and
  returns its teardown. All mutable engine state lives in ONE
  `EngineState` object (`redmagic/engineState.ts`); the extracted
  simulation/render/input/lifecycle functions reach each other through
  one late-bound `Engine` object, preserving the closure semantics of
  the pre-refactor single-file engine. Stateless build-time subsystems
  live in `redmagic/engineWorld.ts` and `redmagic/engineSprites.ts`;
  pure policies live in `redmagic/engineConfig.ts`. Behavior,
  lazy-loading, idle gating, reduced-motion handling, cleanup and
  telemetry gates are unchanged by the v4.0.1 modularization.
- **Media model (v4.0.2):** `data/media.json` is schema v4 with an
  explicit `sourceType` discriminator on every item — `contents`
  (branch + source path, played through the jsDelivr CDN mirror of
  the Contents repository) or `direct` (absolute http/https audio
  URL, played as-is). The runtime (`lib/media/normalize.ts`) branches
  on the discriminator and NEVER infers source kinds from URL
  strings. Audio kinds: mp3, m4a, flac, wav. Embedded metadata for
  contents items (ID3v2 / MP4 atoms / FLAC blocks / RIFF-WAVE
  `LIST/INFO` + `fmt`/`data` duration) is extracted ONLY at build
  time by `scripts/media/audioMetadata.mjs` over range requests;
  direct items carry publisher manifest metadata and never claim
  embedded provenance.

## Core rules

1. **Inspect live code before claims.** Verify behavior in the current source
   and current commit; never trust old docs, old worklog entries, or memory.
2. **Preserve the working architecture.** Incremental, measured improvements.
   No framework migration, no speculative rewrites, no cosmetic reshuffles of
   working files.
3. **No invented metrics.** Never fabricate benchmark numbers, fps figures,
   coverage stats, or test results. Report only what you measured, and say
   how. The site's own copy never claims guaranteed frame rates — keep it
   that way.
4. **No fake performance claims** in code comments, UI copy, README, or
   commits. The organism's telemetry reports *measurements*, not trophies.
5. **The DRIFT / LISTEN / SURGE interaction modes are RETIRED.** Do not
   reintroduce them as UI modes, identifiers, or copy. (Media scene verbs
   READ/LISTEN/WATCH and historical "retired in v3.5" notes are unrelated and
   stay.) Legacy identifier example: `ANGULAR_FALLOFF_ACTIVE` (formerly
   `ANGULAR_FALLOFF_SURGE`) — neutral names, equivalent behavior.
6. **Preserve reduced-motion behavior.** `prefers-reduced-motion: reduce`
   means one static frame for RedMagic, calm CSS-only breathing for
   WorldBackground, no ripples/pulses, seed-only hero. Every change must keep
   this path working.
7. **Preserve mobile behavior.** Coarse pointers, small viewports, and
   low-memory devices resolve to lower quality tiers; quality must degrade
   gracefully and navigation must stay fast.
8. **Preserve static-export compatibility.** No server runtime, no server
   actions, no ISR/SSR assumptions. Everything ships as files. `Suspense`
   boundaries around dynamic imports are dangerous in export — know the
   history before touching loading architecture.
9. **No new dependencies** without overwhelming justification. The runtime
   dependency list is Next/React only; scripts are zero-dependency Node.
10. **No analytics, no remote runtime services, no telemetry uploads.** The
    organism's diagnostics are in-memory and development-facing only.

## Engineering workflow

Work in this order; do not skip steps:

```
INSPECT → REPRODUCE → ROOT CAUSE → PLAN → IMPLEMENT → VERIFY → REGRESSION CHECK → CLEAN-ROOM BUILD → DELIVER
```

- INSPECT: read the actual code paths involved (all of them), current `main`,
  latest commit, workflow status.
- REPRODUCE: demonstrate the bug/regression before fixing it; for
  performance work, MEASURE before and after (a micro-benchmark script is a
  legitimate artifact — see `components/redmagic/engineConfig.ts` docs and
  the bounded-potential measurement note in `components/RedMagic.tsx`).
- ROOT CAUSE: name the mechanism, not the symptom.
- PLAN: state the blast radius; choose the smallest correct change.
- IMPLEMENT: follow the file-local conventions (RedMagic.tsx uses a vertical
  formatting style; keep new code consistent with its host file).
- VERIFY: run the full pipeline below.
- REGRESSION CHECK: re-verify the unaffected behaviors listed in the mission
  of the change (mobile, reduced motion, idle, hidden tab, resize…).
- CLEAN-ROOM BUILD: fresh `npm ci` + full pipeline from a clean state;
  inspect `git status` and the final diff; no stray files, no debug code.
- DELIVER: one clean commit describing the upgrade; verify GitHub Actions on
  it.

## RED MAGIC rules

- **Quality must reduce actual work.** A tier is a concrete budget allocation
  (`components/redmagic/engineConfig.ts`): grid size, particle pool, membrane
  resolution, flow count/segments, atmosphere allowance. Changing a label
  without changing per-frame work is a bug.
- **Two-level adaptation.** SOFT adaptation (particle active limit, draw
  strides, glow/atmosphere scaling) applies immediately and is safe in any
  frame. HARD adaptation (structural rebuilds: grid, membrane boundary,
  particle pools, influence tables) happens only on settled frames — never
  mid-interaction, never every frame.
- **Avoid hot-path allocations and redundant scans.** Per-frame object
  allocation in the render loop is a forbidden regression — the
  interaction-signal record and the particle draw-options record are
  stable closures mutated in place, and stroke styles are constant
  strings with the dynamic part applied through `globalAlpha`. Aggregates
  are tracked where data is already in registers (e.g. highest node
  energy is computed in `updateGrid`, not re-scanned in `drawCore`).
  Redundant per-frame work that v2.1 removed and must not return:
  per-node `Math.pow` for frame-uniform decays, dead pre-computation
  writes, zero-fills that the next loop overwrites, and re-scanning
  the full edge array per stroke bucket (classify into per-bucket
  index lists instead).
- **Adaptive runtime behavior.** Explicit runtime states (reduced /
  suspended / idle / ambient / active / recovery) drive simulation scale and
  redraw cadence. Idle must be substantially cheaper than active; hidden must
  cost nothing. A still pointer with settled energy falls into idle.
- **Continuous interaction energy.** Energy follows measurable signals
  (proximity, speed, dwell, impulse memory, charge) with rise/fall dynamics —
  never binary "pointer exists = maximum".
- **Adaptive DPR + refresh estimation** are debounced policies in
  `engineConfig.ts`. DPR never raises while the engine under-performs;
  since v2.1 the DPR is ALSO re-evaluated on every performance
  measurement boundary (`resolvePressureDpr`): sustained degradation
  lowers the backing-store resolution one coarse step, sustained
  recovery with a healthy measured fps/refresh ratio restores it one
  fine step — no resize event required, floor 1×, always inside the
  static tier/area ceiling, and every switch resets the measurement
  windows (a DPR change is a structural event, applied through the
  single `applyDpr` path).
- **Refresh estimation (v2.1)** collects valid raw RAF intervals into a
  bounded, reused typed-array buffer and takes a robust low-percentile
  representative (rank ≥ 3) — one glitch-short interval can no longer
  pin the estimate at a phantom refresh rate. The estimate adopts only
  sustained-faster windows, decays on sustained collapse, suspends with
  the tab, and resets on real geometry/DPR changes. It is a measurement
  of the observed display, never presented as hardware truth.
- **Hard-rebuild settle rule (v2.1):** a pointer resting motionless past
  the stillness threshold with settled energy counts as settled — the
  pre-v2.1 predicate waited for `pointerleave` and starved rebuilds
  while a pointer simply parked on the canvas. The 12 s timeout is a
  FULL escape that lets a long-pending rebuild through on any
  non-active frame (`isSettledFrame` + the rebuild gate in
  engineConfig/RedMagic) — a pointer parked on the organism core holds
  proximity energy above the settle threshold by design, and that
  canvas must still rebuild eventually.
- **Shared visual/performance budget.** `WorldBackground` (low-cost ambient
  organism) and the `RedMagic` canvas (high-detail interactive organism)
  coordinate through `lib/worldSignals.ts` organism activity: the ambient
  layer backs off its pointer-energy gain and skips duplicate ripples while
  the interactive organism is visibly responding.
- **Lazy loading must remain intact** (see Architecture).

## SEO rules

- **Canonical registry**: route identity, SEO metadata, sitemap policy,
  structured-data expectations, nav surfaces and hub relationships live
  in `data/routes.json`. Sitemap (`build-blog.mjs`), verifier
  (`verify-seo.mjs`), and route metadata (`lib/routes.ts` →
  `lib/hubs.ts`) derive from it. Since v2.1 the site ORIGIN, the
  deployment BASE PATH and the world-shell scene vocabulary are ALSO
  registry-derived: `lib/seo.tsx` (`SITE_URL`/`SITE_NAME`),
  `next.config.ts` (basePath), `scripts/build-blog.mjs`,
  `scripts/verify-seo.mjs` (origin, basePath, scene hashes) and
  `scripts/verify-export-routes.mjs` all read `data/routes.json` —
  no mirror literals anywhere. Update the registry, never a derived
  copy.
- **Crawlable internal architecture**: every document reachable through real,
  descriptive internal links; no orphan content; no generic anchor text
  ("read more"); collections discoverable from home AND blog index.
- **No invented indexing/ranking claims**: verification covers repository and
  exported-artifact facts only (metadata presence, canonical correctness,
  graph connectivity/depth, sitemap/robots coherence). Nothing here claims
  rankings, indexing status, or traffic.
- **Graph verification**: `verify-seo.mjs` checks route metadata, JSON-LD
  per route, internal link graph resolution, content graph connectivity, and
  graph depth (inbound census, orphan/orphan-adjacent articles, hub
  coverage percentage, anchor quality, canonical↔sitemap equality). It fails
  loudly on structural regressions.
- **Structured data verification**: every canonical page carries its
  registered JSON-LD types; article dates/authors must match the content
  index; one coherent Person/WebSite entity graph.
- **lastmod honesty**: content-revision dates only — never the build date.
- **No query/filter URLs in the sitemap**: Blog filter state is view state.

## Validation

Exact commands (from the repository root):

```bash
npm ci                 # clean install (CI uses --legacy-peer-deps)
npm run blog           # content pipeline → data/blog/posts.json + sitemap.xml
npm run build          # blog pipeline + next build (static export → out/)
npm run lint           # eslint — must stay at 0 errors
npm run verify         # verify:seo + verify:brand + verify:export + verify:loading
npm run typecheck      # tsc --noEmit over application code AND tests
npm run typecheck:tests # focused test-suite typecheck
npm test               # node --test over the suite (architecture contract included)
npm start              # zero-dependency static preview of out/ (serve-static.mjs)
npm run verify:seo     # SEO verification alone (needs out/ from build)
npm run verify:loading # export loading verification alone (needs out/ from build)
npm run bench:loading  # real-browser loading benchmark (Playwright medians; needs out/)
node scripts/bench-redmagic.mjs    # v2.1 micro-benchmark (Node/V8,
                          # pure-function shapes + policy assertions)
```

**Measurement builds (v2.1):** `NEXT_PUBLIC_RED_MAGIC_TIMING=1 npm run
build` compiles the engine's subsystem profiling in and exposes the
in-memory telemetry store as `window.__RED_MAGIC_TELEMETRY__` for
browser harnesses. A default build inlines the gate to false and
eliminates every timing call — nothing measurement-related ships in
production or CI builds.

`npm run verify:seo` runs against `out/` after `next build` and includes the
v2 graph-depth group. `npm run verify:export` cross-checks the three-way
bijection: app routes == exported files == sitemap URLs.

Manual/behavioral checklist for organism-affecting changes (desktop +
mobile viewport, reduced motion, low-memory emulation, hidden/visible tab,
pointer interaction, stationary pointer ~10 s — the still-pointer settle
path — idle ~10 s, resize, quality downgrade/recovery, DPR pressure
lowering under sustained load, route navigation, blog filters): console
stays clean, no visual instability during quality or DPR changes, initial
page load and lazy-loading path unchanged.

**No fabricated metrics**: report only measured numbers with the method
named (micro-benchmark on Node/V8, instrumented browser build in headless
Chromium/SwiftShader, etc.). The micro-benchmark script prints its own
numbers — never copy them into user-facing copy or commit messages as
guarantees.
