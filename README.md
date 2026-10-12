# Parsa Tak — WEB

A statically exported Next.js portfolio that behaves like a living system: five hash-navigated scenes, a markdown-driven blog, a generated SEO graph, and a canvas organism that loads only when the browser can afford it — plus a connected knowledge base of real, indexable topic documents.

**Live Site:** https://parsaetak.github.io/WEB/
**Repository:** https://github.com/Parsaetak/WEB

---

## What this is

This is the personal website of **Parsa Tak** — independent software engineer, product builder, and AI systems researcher. It presents the work in one place: AI systems, reasoning and evaluation, software engineering, product building, and creative technology. The site itself is also a project: it is built as a static-first Next.js application that demonstrates how far a static export can go before it needs a server.

Everything a visitor and every search crawler receives is pre-rendered HTML. There is no server runtime, no database, and no client-rendered content gate: the homepage's full semantic content — identity, capabilities, featured work, method, systems, writing, and links — ships in the initial HTML.

## Why it exists

The site has three jobs. First, it is the professional index of the work: every project, article, and experiment is reachable from a public, permanent URL. Second, it is an engineering demonstration: static export, crawlability, performance budgets, accessibility, and verification gates are all treated as first-class features rather than afterthoughts. Third, it is the substrate for RED MAGIC, a long-running computational-organism experiment that needed a real website as its host.

## What you will find here

### First actions (v3.9)
The home hero states who Parsa Tak is and, directly beneath the identity, a **START HERE** strip exposes the site's four real discovery paths — **Selected Work** (`/work/`), **Research** (`/research/`), **Blog** (`/blog/`), and **Contact** (`/contact/`) — as plain crawlable links. The first screen therefore answers both "who is this?" and "what can I do next?" without requiring the visitor to infer the site's architecture. The featured systems (the concrete proof) immediately follow the hero, before the capability explainer; each capability card then routes to its own public evidence — a topic hub, the Selected Work document, or the field notes that demonstrate it.

### Work
The **Work scene** (the `#work` hash scene) is the experiential portfolio. The canonical **Selected Work document** (`/work/`) is the indexable deep portfolio: every system card links its repository, its field notes, its topic hub, and the Blog's project-filtered stream. The homepage carries the featured subset and routes to the document.

### Research
The **Systems scene** (`#systems`) presents the framework family — AI Instructions, REP (Reasoning & Evaluation Protocol), and USEF (Unified System Evolution Framework) — plus the measurement programme behind UHIT/AIST. The **Media scene** (`#media`) hosts longer-form documents, PDFs, music, and video. The canonical **Research document** (`/research/`) maps the programme as research lines (question → method → framework → measurement → artifact → system), each line linking the system that executes it.

### Writing
The **blog** is real content, not a stub: markdown articles under `content/blog/` become fully static `/blog/<slug>/` routes with generated metadata, related-article graphs, and structured data. The homepage's Writing section links the strongest articles, selected on the server at build time.

### Topic hubs and content documents (v3.1, extended v3.2)
Beyond the living-world homepage, the site carries real indexable documents that own the site's most important search and research themes:

- `/about/` — the entity/author page: identity, what I do, how I work (the research → product direction → architecture → implementation → testing → verification → delivery pipeline), research, engineering, product building, selected systems, current direction, both collaboration tracks, writing, profiles, and contact. JSON-LD: `ProfilePage` referencing the site-wide `Person` `@id`
- `/work/` — the canonical professional portfolio: every significant system with what it is, the problem it addresses, why it matters, and real destinations
- `/research/` — the research programme: the questions, the six topic hubs as the research map, the framework family, the UHIT/AIST measurement programme, and selected research writing
- `/contact/` — the single honest contact document: primary CTA **Email Parsa Tak** (resolved from `lib/links.ts`), secondary GitHub/LinkedIn, and the four collaboration types (academic/research, business/engineering, project collaboration, open technical collaboration). No form, no backend
- `/local-ai/`, `/ai-systems/`, `/ai-reasoning/`, `/ai-evaluation/`, `/software-engineering/`, `/creative-technology/` — six topic hubs, each a self-contained document: topic definition, what I work on in the area, the systems built in the area, genuinely related articles, and a next exploration path

The distinction between URL kinds is deliberate: a **real URL** (`/about/`, `/work/`, `/research/`, `/contact/`, hubs, blog) is an indexable document; a **hash** (`/#work`, `/#magic`) is an interactive scene state of the living world, not a separate page. Every content route is statically rendered from server components — the document bodies ship as static semantic HTML with zero route-specific content JavaScript, and the shared navigation is each route's one small client island that still renders as complete server-side markup (crawlers and no-JS readers get the full navigation). They remain the lightest pages on the site.

### Navigation (v3.7 — Blog-centered content architecture, one system everywhere)
The primary navigation is four destinations — identity (About), the laboratory's publication and discovery surface (Blog), and contact — with the experimental world one click away. **BLOG is the main content discovery surface**: articles, work documentation, and research writing all live inside it as content modes (`ALL · ARTICLES · WORK · RESEARCH`, shareable as `/blog/?type=work`, `/blog/?type=research`). Work and Research are no longer primary tabs; their canonical routes remain real, crawlable deep landing pages (the "collections" row of the footer document nav and the Blog's lab map keep both reachable from every surface):

```
PRIMARY:     HOME · ABOUT · BLOG · CONTACT
COLLECTIONS: WORK · RESEARCH              (canonical deep documents, footer + lab map)
WORLD:       SYSTEMS · RED MAGIC · MEDIA (quieter, contextual)
```

One navigation system renders every surface: `components/UnifiedSiteNav.tsx` consumes `lib/navigation.ts` (the single source of truth) and drives the world HUD desktop track, the blog header, the content-shell header on every content document and topic hub, and their shared ≤860px disclosure menu — desktop and mobile are two responsive modes of the same component, same labels, same ordering, same accents, same active/focus language. The five-scene world (v4.0.1) runs on scene ids (`home / systems / magic / work / media` — the orphaned `#about` scene was removed with the About document as the only canonical About) with hash routing, browser history, and hover-to-preload all behaving exactly as before; the experiential `#work` scene remains a portfolio scene inside the living world, distinct from the canonical `/work/` document.

**Content-type model (v3.7):** every article carries a required frontmatter `type` — `article` (field notes / essays), `work` (built-system documentation), `research` (research-programme writing) — validated by the build pipeline and carried through the generated content index. The type drives the Blog's content modes, the card type badges, the article at-a-glance strip, and the home writing list, and `scripts/verify-seo.mjs` proves no content type is orphaned in the export.

v3.5 adds **intent warming** to the same component without touching its visual identity: pointer enter, focus, or pointer-down on an entry fetches its destination before the click commits. Scene actions preload their module immediately through `preloadScene` (unchanged contract, deduplicated by the scene preloader); internal route links prefetch their RSC payload once through `router.prefetch()` with viewport prefetch still disabled — nothing is fetched continuously and no heavy page asset is pulled, so a warmed tab click is a router-cache hit.

Each primary tab also carries its own ~1-second hover identity, replayed on every re-enter: **HOME** ignites an orbit ring with a core flash · **BLOG** sweeps a type caret as the ink line writes itself · **ABOUT** swings open an identity halo with an aura bloom · **CONTACT** radiates transmission ripples with an outbound packet. All effects are compositor-only (`transform`/`opacity`/`clip-path` on dedicated decorative layers — the label never moves), gated behind `(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)`, and collapse to static state changes under reduced motion.

**The Blog as visual laboratory (v3.7):** the Blog's first screen is an instrument, not a text document — the hero pairs the positioning copy with a live instrument panel (featured cover, real per-type counts, latest signal), the featured article renders as a large visual card with its content type, and the **Lab Map** orients the whole territory: the six research territories (each linking its topic hub and key system) plus the two canonical collections (`/work/`, `/research/`). `/work/` presents every system as a visual project card — real cover artwork (or a truthful geometric identity card built from the 13-point star and the system's own technology labels, never a fabricated screenshot), one-sentence purpose, key signal, tech stack, links — with the deep what/problem/why documentation inside the same card. `/research/` opens with three research modules rendered as `QUESTION → METHOD → FRAMEWORK → MEASUREMENT → ARTIFACT` chains. Everything is CSS/SVG/DOM over server-rendered HTML — no new client JavaScript beyond the existing BlogIndex island, which stays metadata-only.

### The unified page-frame contract (v3.6.1)
Every primary tab composes from ONE set of layout primitives, declared once in `app/globals.css` and consumed everywhere (no per-page literals):

```
--page-content-width: 1240px   the shared alignment rail (header, heroes, footer)
--page-doc-width:      860px   the long-form reading measure below the hero
--page-lead-measure:   720px   the shared lead paragraph measure
--page-h1-scale:               one shared H1 scale for document tabs
--page-gutter:         32/24/20px  one responsive gutter scale (≤860/≤560)
--page-header-height:  76/68px     one header height contract (≤860)
--page-hero-min-height: 440/380px  one first-screen content floor
--page-footer-spacing:  88px    one footer spacing value
```

The rail formula is `x = max(--page-gutter, (viewport − --page-content-width)/2)` — at 1440×900 the header brand, the H1 of every tab, the blog hero, and the footer all start at x=100; at 390×844 they all start at x=24. All three headers (world HUD, content header, blog header) are `position: sticky`, in normal flow at z-index 1000, so the first screen is exactly `header + hero` on every tab and no page carries scroll-compensation padding. The first-screen formula is one token-owned stack: `min-height = max(--page-hero-min-height, 100vh/svh/dvh − --page-header-height)`. Full-screen means composition, not confinement: the first composition fills the viewport consistently and expands naturally when content is longer (HOME's living-world hero does exactly that). Per-tab identity (`data-page` accents, hero motif fields, hover identities) is layered on top of the shared geometry — same geometry, different identity. BLOG rides the same contract with its editorial voice intact, article routes are untouched, and v3.5 scene navigation/preloading is unaffected. Every header carries the same identity line (v4.0.5): `★ Parsa Tak  ● CURRENT SURFACE` — one shared `SiteHeaderStatus` component (red pulsing light + mono uppercase label, transform/opacity animation, static under reduced motion) renders the active world scene (HOME · SYSTEMS · RED MAGIC · WORK · MEDIA), BLOG, or the route-registry identity of every ContentShell document (ABOUT · CONTACT · WORK · RESEARCH · the six topic hubs); labels derive from the scene definitions and `data/routes.json` through `lib/routes.ts` — no route-specific header code, and the identity stays visible at every viewport width.

**The footer rides the same rail as one deliberate region stack (v4.0.5):** the four navigation groups (SITE · COLLECTIONS · WORLD · TOPICS) render as a responsive column grid (4 → 2 → 1, the six-entry TOPICS group through two sub-columns); below them the PUBLIC NETWORK region presents the 14 verified public links of `lib/links.ts` as exactly two rows of seven on desktop (presentation-only slicing — the registry stays the only data authority), wrapping order-stably below desktop; icons render through the shared LinkIcon system at a materially larger 19–18px box with a CSS-only accent hover (transform/opacity, the registry's own per-link accent, static under reduced motion); the legal paragraph and the LICENSE/TRADEMARKS links share one end-aligned grid on the same rail; and the bottom-most row is the identity line — the 13-point star, `© 2026 Parsa Tak. All rights reserved.`, `Parsa Tak™` — in normal flow, no positioning hacks. The footer never opts into a route-scoped reveal system — the pre-v4.0.4 opt-in left the entire footer invisible (`opacity: 0`) on every ContentShell route, because the reveal controller only mounts on the world shell and the blog layout. The footer is now permanently visible on every route, verified at export time.

### Page identity artifacts and the global cursor (v4.0.5)
About and Contact now lead their documents with the same kind of strong, page-specific visual artifact that Work (project cards) and Research (module chains) use — without leaving the shared ContentShell:

- **About — the identity/practice matrix:** RESEARCH · ENGINEERING · PRODUCT as three connected cards on one signal rail (scope vocabulary, one honest note, and a real link per track), leading directly into "What I do" and "How I work". Themed by the About accent.
- **Contact — the transmission console:** the four collaboration intents (academic/research, business/engineering, project, open technical) rendered as packet-dotted channels wired to the ONE primary action — the verified `mailto:` — with GitHub / LinkedIn as secondary paths. The visual language extends the unified nav's contact identity (ripple/packet) at document scale. Same honest contact model: no form, no backend, no tracking.

Both artifacts are plain server-rendered HTML inside their page files, composed through ContentShell's one generic optional `docFeature` slot (the page's first document block). No page-specific shell, header, navigation, or client component exists for either route: the artifacts work without JavaScript, animate only via compositor-friendly CSS (transform/opacity) behind `prefers-reduced-motion` gates, and ship in the exported HTML (verified by `npm run verify:loading`).

The **red cursor is a root-level global system (v4.0.5)**: mounted exactly once from `app/layout.tsx` — the same root-layout law as the global Music player and RouteProgress — so it now works identically on the world shell, the blog, and every ContentShell document route. Previously it mounted only inside the world shell (and separately in the blog layout), leaving `/about/`, `/contact/`, `/work/`, `/research/`, and the topic hubs on the native pointer. The cursor remains a native CSS cursor with zero pointer listeners, zero requestAnimationFrame, and zero React state; coarse/touch pointers and reduced-motion users keep the native cursor, and `html.pdf-reader-active` still exempts embedded PDF viewing.

### RED MAGIC
RED MAGIC is the site's living-layer experiment: a canvas-based computational organism with adaptation, perception, and visible state. It is deliberately **not** part of the critical path — visitors receive a CSS-only seed first, and the organism loads at idle time only when motion is permitted and the device can afford it.

**One organism, one sound (v3.6).** The RED MAGIC sound engine is a single ambient synthesis graph — a low body (52/78 Hz), a warm harmonic, a breathing shimmer, and an activity-driven noise texture — behind one master SOUND ON / SOUND OFF state. The former DRIFT / LISTEN / SURGE selector is retired: interaction changes intensity and timbre, never personality. The engine is browser-policy honest: the AudioContext is constructed only after a real user activation (never during hydration), the ON/OFF preference persists in localStorage, a hidden tab suspends the graph and a visible one resumes it, and OFF fades out before suspending. With sound on, the same pointer energy that drives the organism drives the voice.

## Key projects

| Project | What it is | Where |
| --- | --- | --- |
| **SHEYTAN** | A local-first AI laboratory: managed llama.cpp (local LLM runtime) inference, a real agent loop, isolated coding workspaces, objective verification | [GitHub repository](https://github.com/Parsaetak/SHEYTAN-local-agent) + [field notes](https://parsaetak.github.io/WEB/blog/sheytan-the-local-first-laboratory/) |
| **UHIT** | The Universal Human Intelligence Test — measurement programme realised as the AIST-2026.09 standard and the ASI-100-Elite benchmark | [Specifications](https://github.com/Parsaetak/Contents/tree/AI-Tests) + [article](https://parsaetak.github.io/WEB/blog/measuring-machine-intelligence/) |
| **FreeIran** | Free, open-source VPN configuration manager for Windows: a Go multi-core runtime that discovers, tests, maintains, and runs public proxy configurations | [GitHub repository](https://github.com/Parsaetak/FreeIran) + [engineering notes](https://parsaetak.github.io/WEB/blog/freeiran-engineering-notes/) |
| **RED MAGIC** | The living canvas organism experiment hosted by this website | [Live experiment](https://parsaetak.github.io/WEB/#magic) + [article](https://parsaetak.github.io/WEB/blog/why-the-website-is-a-living-system/) |
| **WEB** | This website itself — a statically exported living system | [This repository](https://github.com/Parsaetak/WEB) + [how it works](https://parsaetak.github.io/WEB/blog/the-anatomy-of-a-fast-static-site/) |

## Experience architecture

The whole site is one route with five hash-navigated scenes, wrapped in a persistent "world shell":

```
one canonical URL ( / )
├── #home      ← statically rendered into the HTML (crawlable)
├── #systems   ← lazily loaded scene
├── #magic     ← lazily loaded scene (RED MAGIC)
├── #work      ← lazily loaded scene
└── #media     ← lazily loaded scene (Media: books, music, video, art)
/blog/          ← real routes, one static page per article
/about/ /work/ /research/ /contact/        ← canonical content documents
/local-ai/ /ai-systems/ /ai-reasoning/     ← canonical topic hubs
/ai-evaluation/ /software-engineering/
/creative-technology/
```

Scene changes are URL-addressable (`#systems` is a shareable state), handled by the shell's navigation, and never produce separate documents. The blog earns one indexable route per article, and the content documents and topic hubs are indexable canonical routes of their own — the full route model is declared once in `data/routes.json` (the canonical route registry) and cross-verified by the sitemap and the SEO verifier.

## Technical architecture

- **Next.js 16** (App Router, Turbopack builds) with **React 19** and **TypeScript**
- **Static export** (`output: "export"`) — the entire site compiles to plain files in `out/`
- **GitHub Pages** hosting behind the `/WEB` basePath, deployed by GitHub Actions
- Server components pick content at build time; client components receive only minimal serializable props
- Blog bodies exist only in generated static HTML — never in client JavaScript bundles
- Zero runtime **package** dependencies beyond React/Next, and dependency-free Node.js for the build, blog, brand, and verification tooling. One deliberate external runtime dependency exists by design: Media items (PDFs, audio, covers) stream from the jsDelivr CDN mirroring of the Contents repository — see the Media foundation notes below
- **Lateral content graph (v3.9)**: `lib/workRegistry.ts` is the single source of truth for the Selected Work entries; `lib/blog.ts` resolves each article's deterministic lateral destinations from it — an article whose `project` documents a registry system links `/work/`, and `type=research` articles link `/research/`. Article pages render these as crawlable rows in the related section, connecting topic ↔ article ↔ work ↔ research in exported HTML
- **Home first-action model (v3.9)**: the hero's START HERE strip (a labeled `<nav>`) links the four canonical destinations in exported HTML, and featured work precedes the capabilities grid — proof before practice, every capability carrying its proof link
- **Media foundation (v4.0.0)**: the former Library scene is now **Media** (`#media`), rendering one discriminated `MediaItem` model — Book, Music, Video, Art — from `data/media.json` (synced from the Contents repository, external `library.json` contract intact; `#library` survives as a normalised alias)
- **Global Music player (v4.0.2)**: the player is mounted exactly once from the ROOT application layout (`GlobalMusicPlayerHost`), so playback, queue, and position survive every client-side route navigation (Home, About, Blog, Work, Research, Contact, topic hubs, Media) without pause, src reset, or store recreation. One store, ONE `<audio>` element (created only on explicit playback intent, `preload="none"` until then); the store owns queue semantics (current / upcoming / history / play now / play next / add / remove / clear / select), deterministic shuffle (an ordering of the one queue, never a second queue), repeat, stop and retry, honest previous behaviour, and the full Media Session integration (play / pause / stop / previoustrack / nexttrack / seekbackward / seekforward / seekto, playbackState + positionState — feature-detected per action, never required). The player UI (desktop bottom bar, mobile sticky bar, expanded overlay with queue) mounts lazily after the first play intent — no audio request ever precedes user intent. The Media scene is a catalog/intent surface: Play / Play Next / Add to Queue plus a read-only now-playing reflection
- **Player persistence (v4.0.2)**: non-sensitive playback state (volume, muted, repeat, shuffle, queue, current track, position) persists to localStorage at meaningful transitions and on page hide. A full browser reload restores the session as a PAUSED player at the persisted position — autoplay never happens; resuming applies the position once, after the track's metadata loads. Client-side navigation never touches storage at all
- **Direct media sources (v4.0.2)**: `data/media.json` (schema v4) carries an explicit `sourceType` discriminator — `contents` (repository-backed branch path, played through the Contents CDN) or `direct` (absolute http/https URL, played as-is by the browser). Direct URLs are validated at manifest-sync and validation time (malformed URLs fail the build), never proxied, downloaded, or copied into `public/` by WEB, and never fetch at build time — the browser receives the URL only when playback is requested. Direct items are audio-only in this release and never fabricate provenance (no GitHub source link where none exists)
- **WAV support (v4.0.2)**: `.wav` joins `.mp3` / `.m4a` / `.flac` everywhere Media audio types are defined — kind unions, manifest schema (v4) and extension validation, sync normalization, download labels, MIME mapping (app + preview servers), and the build-time metadata extractor (RIFF/WAVE: `fmt` byte rate + `data` size for exact duration, `LIST`/`INFO` tags; range-request friendly — the data body is never needed)
- **Build-time audio metadata (v4.0.0)**: ID3v2 (MP3), MP4 atoms (M4A), FLAC blocks and RIFF/WAVE chunks are parsed by zero-dependency scripts over HTTP range requests during the Media manifest sync; cover art resolves deterministically (explicit path → matching basename → folder cover → UI fallback, `.jpeg`/`.png` only). The browser never downloads audio to discover metadata, and an absent Music source renders an honest empty state — never fabricated tracks

## Repository structure

```
app/                 routes: home, blog index, blog articles, 404,
                     and the content documents (about, work, research,
                     contact, and the six topic hubs)
components/          world shell, scenes, navigation, RED MAGIC systems
components/content/  shared server-rendered content-route system
                     (shell, building blocks, hub view)
components/scenes/   the five scene components (HomeScene is static)
components/redmagic/ RED MAGIC engine modules (v4.0.1): engine
                     constants, state, simulation, render, input,
                     lifecycle — plus the pre-existing config,
                     sprites, and world builders
content/blog/        markdown article source (frontmatter + body)
lib/                 data access, SEO graph, hub definitions, brand,
                     schedulers, links, route-registry loader
scripts/             build-blog, brand generators, verification suite
data/blog/           GENERATED posts.json (never edited by hand)
data/routes.json     canonical route/content registry (SEO source of
                     truth for sitemap, verifier, and route metadata)
public/              static assets: brand art, icons, sitemap, robots
assets/              brand system source (star variants, glyphs, social)
.github/workflows/   the Pages deployment pipeline
out/                 GENERATED static export (deployed artifact)
```

## Blog/content pipeline

`scripts/build-blog.mjs` runs before every build:

1. **Parse** markdown + frontmatter from `content/blog/*.md`
2. **Validate** records and the relationship graph (a malformed article fails the build with the file and reason)
3. **Render** a trusted markdown subset to fully escaped HTML
4. **Normalize** reading time, cover URLs, and link base paths
5. **Index** tags, categories, related articles (explicit `related` frontmatter plus a deterministic scoring model), and prev/next adjacency
6. **Emit** `data/blog/posts.json` (content + indexes) and `public/sitemap.xml`

The sitemap is generated from the **same** content index that produces the routes, so it can never disagree with the site. `lastmod` values come from the articles' own dates — freshness is never faked.

## SEO

- Every canonical route ships exactly one `<title>`, meta description, canonical link, Open Graph image, and robots directive
- JSON-LD structured data: `Person` + `WebSite` anchors in the root layout, plus `WebPage`, `ProfilePage` (on `/about/`), `Blog`, `BlogPosting`, and `BreadcrumbList` on the right routes — all cross-referenced by `@id`, never duplicated. The content routes add route-specific `WebPage` + `BreadcrumbList` nodes (and a truthful `ItemList` on `/work/`) referencing the same stable entities
- Google Search Console ownership meta tag emitted once per route and byte-verified on every build
- `sitemap.xml` + `robots.txt` generated and verified against the actual export, including the content routes; article `lastmod` reflects content dates, never the build date
- Semantic internal-link graph: every article carries a `TOPIC HUB` chip to its honest primary hub; every hub links its systems and ≥3 genuinely related articles; the shared footer exposes every content document site-wide — the verifier rejects orphan routes and link-count padding
- Related-content graph verified in the exported HTML (v3.9): every article with declared related entries must render at least one of them as a real link, every project-tagged article must link `/work/` from its related section, and every `type=research` article must link `/research/` — the `related-graph-covered` metric is measured against crawlable HTML, never the pipeline's internal schema
- First-action model verified (v3.9): the exported home document must expose the START HERE entry points to `/work/`, `/research/`, `/blog/`, and `/contact/` above the featured-work section
- Visible author authority: every article ends with a factual author block (independent software engineer, product builder, and AI systems researcher) linking to `/about/`
- Social metadata (OG/Twitter) with stable, production-absolute image URLs, image dimensions, and alt text on both the OG and Twitter card images (v4.0.4)
- Site-wide metadata quality census (v4.0.4): every indexable page's title and description are unique with sanity-checked lengths; each canonical URL is claimed by exactly one indexable page; per-page JSON-LD keeps unique `@id`s and singular `Person`/`WebSite` identity nodes; any WhatsApp remnant anywhere in the export is a build failure (the contact channel was removed from the project in v4.0.4)
- RSS is **intentionally absent** — the export must contain no feed and no residual feed references, and verification enforces that

`scripts/verify-seo.mjs` checks all of the above against the generated HTML in `out/` — the same artifacts crawlers receive.

## Brand system

- The **13-point star** is the primary site identity: favicon family (SVG + PNG + ICO + Apple touch), hero mark, and brand assets — all generated by `scripts/generate-brand.mjs` and `scripts/generate-brand-raster.py`
- The **Red Eye** belongs to RED MAGIC and is used within that system's surfaces
- Glyph library and project artwork are generated, deterministic, and verified: CI regenerates them and fails if anything drifts
- Source assets live in `assets/`; runtime assets ship from `public/`

## Performance architecture

The loading strategy is static-first with intent-gated enhancement:

```
static HTML + CSS seed
→ hydration of the shell
→ idle time / interaction
→ heavy enhancement (canvas organism, secondary scenes)
```

- The **home scene is statically imported** — its content is the initial HTML, never behind a Suspense gate
- The five **secondary scenes are dynamically imported** one at a time, on navigation
- **Scene transitions have no minimum duration (v3.5)** — the registry renders the destination the moment its module is resident. A warmed/cached scene swaps in before the next paint (fast path, no loader ever painted); a genuinely slow fetch keeps the current scene dipped and shows the viewport loading surface only after `SCENE_OVERLAY_DELAY_MS` (slow path). Race protection keeps rapid navigation correct: only the latest requested scene may commit
- **Route navigation warms on intent (v3.5, hover visual-only in v4.0.5)** — pointer-down and keyboard focus warm the destination's RSC payload immediately; hover is VISUAL ONLY (measured in v4.0.5: even the 130 ms dwell warm fetched payloads on a cursor sweep without genuine intent, and warmed fetches did not measurably reduce click-to-commit time); save-data and 2G connections never warm; the current route is never warmed; every warm is deduplicated. No continuous prefetching of any page
- **The post-load settle gate (v4.0.3)** — all speculative loaders (predicted scene chunks, the RED MAGIC organism) wait for `whenPageSettled()` (lib/loadPhase.ts): the document fully loads, then one idle gap is granted. Idle callbacks are low-priority, not permission to run during critical startup
- **The RED MAGIC organism loads after the settle gate** and only when reduced-motion, save-data, and memory constraints allow; otherwise the CSS seed stays permanently
- **Viewport prefetch is off site-wide (v4.0.3)** — every internal `next/link` carries `prefetch={false}`; the only fetches are intent-warmed payloads (see above). v4.0.2's brand-link viewport prefetch pulled the whole home shell (~115 KB of JS plus payloads) onto every content page — measured, then eliminated
- **The player host initial graph is minimal (v4.0.3)** — GlobalMusicPlayerHost imports only the raw session-presence probe (lib/player/sessionPresence.ts); the full session read/write/validate module stays in the lazy player chunk
- **Document-body internal links are soft (v4.0.3)** — the content blocks (cards, link rows, prose links) render through `next/link` with prefetch disabled: crawlable exported anchors, client-side navigation when hydrated, so the ONE global player never dies on an in-document jump (the v4.0.2 footer upgrade, extended)
- **Loading is verified, not asserted (v4.0.3)** — `npm run verify:loading` proves the exported HTML carries no player surface, no scene/organism code in initial chunks, and an identical document skeleton across tabs; `npm run bench:loading` measures real browser numbers (HTML/JS bytes, DCL/load/FCP, speculative request counts, navigation times, player continuity) with medians over repeated cold runs
- **Route progress (v4.0.5)** — real route/tab navigation shows ONE tiny loading signal, mounted once from the root layout (`RouteProgress`): the navigation island fires a `web:route-progress` DOM event on a genuine internal click (normal click only — modifier/new-tab/external/same-route clicks never fire), and after a 150 ms grace period (`ROUTE_PROGRESS_GRACE_MS`, `lib/loadPhase.ts`) a 2px indeterminate red line appears at the very top of the viewport ONLY while the navigation is still unresolved; the destination pathname commits (`usePathname`), paints (double rAF), and the line fades. Fast navigations show almost nothing. The signal is display-only — pointer-events none in every state, no fake percentage, no minimum duration, no navigation delay, aria-hidden (the router announces the destination) — race-safe under rapid clicks (monotonic intent tokens, latest navigation wins), static under reduced motion, and never visible in the static export (the `html.reveal-js` gate). The v4.0.4 full-screen route overlay (`GlobalRouteTransition`, `lib/routeIntent.ts`, the `SceneLoadingScreen` route variant) was REMOVED — document navigation and world-scene loading are two separate systems with one visual language
- **The document-tab hero identity (v4.0.5)** — every ContentShell document (About, Contact, Work, Research, the topic hubs) carries one shared title system: breadcrumbs above, then the identity row — the signal mark (a node inside a thin ring with the scene loader's transmission arc) BESIDE the kicker/H1/lead copy, in normal document flow (no absolute positioning, no overlap, no content-height dependence, nothing can clip on narrow screens), themed per tab through the page accent, compositor-only (`transform`/`opacity`), and static under reduced motion. The hero is TOP-ANCHORED: the crumbs, kicker and H1 start at identical positions on every route, so the amount of lead text can never move the title baseline between pages
- Motion is CSS-first (transform/opacity), driven by one shared IntersectionObserver with one-shot reveals — no per-frame React state, no scroll listeners
- Images carry intrinsic dimensions, lazy-load below the fold, and use stable static URLs

## Accessibility

- Semantic HTML: one `<h1>` inside `<main>`, real headings, real links and buttons, landmark structure
- Full keyboard operability for menus, scenes, and interactive surfaces; visible focus states
- `prefers-reduced-motion` is honoured everywhere — reveals flatten and the heavy organism never mounts
- Without JavaScript, content stays fully visible: the reveal system hides nothing unless its pre-paint gate class is present
- Decorative visuals are `aria-hidden`; icon-only controls carry accessible names

## Local development

Requires Node.js 22+ (the version GitHub Actions uses).

```bash
npm install
npm run dev
```

`npm run dev` regenerates blog data first, then serves at `http://localhost:3000` with no base path.

## Production build

```bash
npm run build
```

Runs the blog pipeline, then `next build`, producing the static export in `out/`. Locally the export uses root-relative URLs; in CI (`GITHUB_ACTIONS=true`) every href carries the `/WEB` base path — the deployment target's shape.

## Production preview

```bash
npm start
```

`next start` cannot serve `output: "export"` (there is no server runtime), so `npm start` runs `scripts/serve-static.mjs` — a zero-dependency static server for `out/` that mirrors the GitHub Pages contract: directories resolve to `index.html`, unknown paths serve `404.html` with a real 404 status, and byte-range requests are honoured. Run `npm run build` first; the preview serves whatever `out/` currently holds.

## Typecheck and tests

```bash
npm run typecheck   # tsc --noEmit over application code AND tests
npm test            # node --test over the suite (118 tests)
```

Tests are part of the TypeScript project (no exclusions — `tsconfig.json` covers them, `tsconfig.tests.json` scopes them for focused runs) and CI typechecks them before every build. The suite includes `tests/architecture.test.ts`, which pins the v4.0.1 architecture contract: no legacy Library stack, Media as the canonical media layer, `#library` only as the deliberate compatibility alias, one hash parser, one work catalogue, a real static 404, fresh `npm ci` in CI, and RED MAGIC's lazy loading.

## Verification

```bash
npm run verify
```

Runs the two gates CI enforces:

- `verify:seo` — static SEO/export verification against `out/` (page metadata, structured data, homepage crawlability, blog links, interaction anchors, link graph, sitemap, robots, RSS absence, favicon family, brand assets)
- `verify:brand` — brand asset coherence and determinism

Both read only generated artifacts, so they check what actually ships.

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) deploys `main` to GitHub Pages:

Pages source check → fresh `npm ci` (no `node_modules` cache — npm's package cache only) → Media manifest sync + validation → typecheck (app + tests) → unit tests → blog pipeline validation → `next build` → SEO verification → brand verification (with regeneration/drift check) → static export validation → deployment manifests → Pages upload → deploy → live revision probe.

The pipeline is concurrency-gated and verifies the deployed revision is publicly observable before reporting success.

## For developers and AI agents

Read this section before changing anything. It is the safety net that keeps the site's guarantees intact.

**Source of truth (edit these):**
`app/` (routes and metadata) · `components/` (shell, scenes, systems) · `lib/` (data access, SEO, brand, schedulers) · `content/blog/` (articles) · `scripts/` (pipeline, generators, verification)

**Generated (never hand-edit):**
`data/blog/posts.json` · `data/media.json` (rewritten by `npm run media:sync` in CI) · `public/sitemap.xml` · `public/brand/` and `public/images/projects/` (regenerate with `npm run brand`) · `out/` (build artifact)

**Static export:**
`out/` is the whole site. If a change works in `next dev` but breaks the export, the export is right and the change is wrong — `npm run build && npm run verify` decides.

**Deployment base:**
`/WEB`. Determined in three mirrored places — `next.config.ts`, `scripts/build-blog.mjs`, and `scripts/verify-seo.mjs` — all keyed off `GITHUB_ACTIONS === "true"`. If you add href-building code, derive the prefix from `NEXT_PUBLIC_BASE_PATH` or the existing `BASE_PATH` constants; never hard-code `/WEB` a second time.

**Critical invariants:**
- Home is statically crawlable: one `<h1>` inside `<main>`, full semantic content in the visible HTML, no Suspense loading gate
- Secondary scenes remain lazy; the home scene never regresses to a dynamic import
- RED MAGIC and its subsystems stay out of the critical path (CSS seed → idle import)
- Client components must not import `lib/blog` (it contains article HTML); they receive metadata as serializable props via `lib/homeWriting`
- The Google verification meta tag must remain byte-exact; canonical URLs use production `/WEB` URLs
- RSS is intentionally absent — do not add a feed or references to one
- The 13-point star is the site identity; the Red Eye belongs to RED MAGIC
- The SEO verifier requires ≥3 crawlable, resolvable article links on the home route, detected in a base-path-aware way

**Site voice (v3.3):**
All user-facing personal and author copy speaks in first person ("I build…", "My research…", "I write…") — the site is Parsa Tak speaking directly. The rule splits by subject: personal story is first person; projects and systems keep their natural entity voice ("SHEYTAN runs…", "FreeIran provides…"); structured data and SEO surfaces (meta descriptions, page titles, `Person`/JSON-LD, bylines, ogAlt) stay in technically correct third-person/entity form, as do legal attribution and CTA wording ("Email Parsa Tak"). Do not reintroduce he/him/his for Parsa in visible prose, and do not force first person into machine-readable entity data.

**Verification law:** a change is not done until `npm run build` and `npm run verify` pass and the generated `out/` has been inspected.

## Project status

- Next.js 16.3.4 / React 19.2.8 / TypeScript 5.9, static export, Node 22 in CI
- 9 published articles; the home Blog section links them from the homepage
- 8 static content documents (v3.1): `/about/`, `/work/`, and six topic hubs forming the site's knowledge base
- v3.9 information architecture: hero START HERE entry points, proof-first home ordering, capability→evidence links, and a fully crawlable lateral content graph (related-graph-covered 9/9 in the build verification)
- Full verification suite green: SEO + brand gates pass on every build
- Known limitations: GitHub Pages serves the site under `/WEB`, so the bare root URL redirects; hash-scene states are not individually indexable documents by design (the content routes and articles carry the indexable concepts)

### Search Console workflow (v3.1)

The site ships no analytics; discovery is measured through Google Search Console, which is already ownership-verified. The intended review loop:

```text
Search Console
  ↓ queries with impressions
pages ranking 8–20
  ↓ improve page depth / links / title
queries generating unexpected impressions
  ↓ consider a dedicated authoritative hub
```

In practice: a query cluster that repeatedly produces impressions for a page ranking outside the top positions is a signal that the topic deserves more depth — a stronger hub section, more genuine internal links from related articles, or a clearer title. New hubs are created only when real material exists to support them; thin pages are worse than no pages.

## Licence

Original design, writing, artwork, and creative materials are licensed under the terms of [`LICENSE.md`](LICENSE.md) — all rights reserved by Parsa Tak. Brand and trademark notices live in [`TRADEMARKS.md`](TRADEMARKS.md). Third-party runtime libraries are governed by their own licences.
