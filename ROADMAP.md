# WEB — Future Roadmap

## Purpose

This roadmap defines the next product layer for WEB beyond the current portfolio, research laboratory, knowledge graph, and RED MAGIC world.

The goal is to evolve WEB into a unified personal **portfolio + research lab + media library + storefront + publication system**, while preserving:

- the RED MAGIC / living-world identity
- the professional information architecture
- the static-first / crawlable document layer
- the Blog-centered knowledge graph
- the current GitHub Pages deployment model unless a future feature genuinely requires another runtime
- performance, accessibility, reduced-motion support, and mobile usability
- truthful content and metadata
- a clean, maintainable repository

The roadmap is intentionally staged. Do not implement every feature as one large rewrite.

---

# Current Product Direction

WEB should gradually become:

```text
                         PARSA TAK
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
     PROFESSIONAL        KNOWLEDGE           MEDIA
     / PORTFOLIO         / RESEARCH          / ART
        │                   │                   │
      WORK               BLOG              MEDIA
      ABOUT              RESEARCH          MUSIC
      CONTACT            TOPIC HUBS        VIDEO
                                            ART
                                                │
                                             SHOP
                                                │
                                           DIGITAL SALES
````

The existing world layer remains the experiential layer:

```text
#home
#systems
#magic
#work
#media (done in v4.0.0; #library kept as a normalised backward-compatible
       alias; the #about scene was removed in v4.0.1 — /about/ is the only
       canonical About)
```

The document layer remains the canonical, crawlable web architecture.

---

# Priority Order

The recommended implementation sequence is:

```text
PHASE 1 — Repository / Information Hygiene
        ↓
PHASE 2 — Media Architecture + Library → Media
        ↓
PHASE 3 — Music Player
        ↓
PHASE 4 — Video Player
        ↓
PHASE 5 — Shop / Digital Products
        ↓
PHASE 6 — News
        ↓
PHASE 7 — Final Product-System Polish
```

This order minimizes rework because Media becomes the common foundation for music, video, artwork, and eventually the Shop.

---

# PHASE 1 — Repository, Files & Documentation Hygiene

## Objective

Make the entire WEB repository clean, coherent, polished, predictable, and easy for both humans and AI agents to understand.

## Scope

Audit and reorganize, without changing public behavior unnecessarily:

* source files
* Markdown documents
* project notes
* generated documentation
* scripts
* content directories
* static assets
* media assets
* route metadata
* configuration files
* naming conventions
* obsolete files
* duplicated documentation
* temporary/debug files
* stale architectural references
* version references
* comments that no longer match implementation

## Documentation model

Establish clear roles:

```text
README.md
    ↓
what the project is / architecture / local development

AGENTS.md
    ↓
engineering rules / constraints / agent workflow

ROADMAP.md
    ↓
future product direction

Git history
    ↓
historical implementation record (the only one — the former
worklog.md / Updated-Files.md diaries were removed in v4.0.1;
commit messages and diffs are the record)
```

Do not allow these documents to become overlapping copies of one another.

## Cleanup rules

* Remove obsolete documentation.
* Remove dead code and unused assets only after verifying they are not referenced.
* Normalize filenames where safe.
* Keep generated files clearly distinguished from hand-authored sources.
* Eliminate stale version numbers.
* Eliminate contradictory architecture descriptions.
* Make directory responsibilities obvious.
* Keep public content separate from engineering metadata.
* Keep temporary research/agent artifacts outside production content paths.
* Do not break existing imports or static export behavior.

## Completion

A clean repository should allow a new engineer/agent to understand:

1. what WEB is,
2. where source code lives,
3. where content lives,
4. where media lives,
5. where future product data belongs,
6. what is generated,
7. what is canonical,
8. how the site is deployed,
9. what is planned next.

---

# PHASE 2 — Media Architecture + Library → Media

> **STATUS: DELIVERED in v4.0.0.** The Library scene is now Media (`#media`),
> backed by `data/media.json` (version 4 since v4.0.2) and the discriminated `MediaItem`
> model (Book / Music / Video / Art). The external Contents
> `Projects/library.json` contract is intact; the optional Music source
> (`Projects/music.json`) is supported and currently absent — the Media scene
> renders an honest empty state with zero fabricated tracks. Embedded audio
> metadata (ID3v2 / MP4 atoms / FLAC / RIFF-WAVE) is extracted at build time over
> HTTP range requests; covers resolve deterministically (explicit → basename →
> folder → fallback). The global player (one store, one `<audio>` element,
> full queue semantics, Media Session) ships lazy-mounted so the initial
> bundle and the RED MAGIC runtime are untouched.

## Objective

Rename the conceptual `Library` area to **Media** and make it the common discovery layer for all media types.

## New Media model

Media should eventually contain:

```text
MEDIA
├── ART
├── MUSIC
├── VIDEO
└── OTHER
```

Potential future subtypes:

```text
ART
├── digital art
├── illustrations
├── experiments
├── wallpapers
└── printable assets

MUSIC
├── tracks
├── albums
├── beats
├── instrumentals
└── sound experiments

VIDEO
├── videos
├── experiments
├── documentaries
├── project footage
└── presentations
```

## Rename requirements

Carefully migrate:

* `Library` labels
* navigation labels
* route/scene naming where appropriate
* world-shell terminology
* metadata
* accessibility labels
* documentation
* route comments
* internal references

Important:

* Preserve backward compatibility where needed.
* Do not break existing hashes/URLs without a migration strategy.
* DECIDED (v4.0.0): `#library` remains as a normalised backward-compatible alias; `#media` is canonical. The address bar is rewritten to the canonical form after resolution.
* Do not create unnecessary duplicate canonical documents.

## Media content model

Introduce a unified media metadata model capable of describing:

```text
id
title
slug
type
description
thumbnail
source
directUrl
repositoryPath
mimeType
duration
dimensions
license
visibility
freeVariant
premiumVariant
price
tags
relatedProjects
relatedArticles
relatedResearch
publishedAt
updatedAt
```

Not every field needs to be populated for every media item.

## Media source modes

Support:

1. local/content repository assets
2. direct external media URLs

All external sources must be explicit and validated.

## Completion

Media becomes the single conceptual home for personal media rather than a collection of unrelated player components.

---

# PHASE 3 — Music Player

> **STATUS: DELIVERED across v4.0.0 + v4.0.2.** v4.0.0 shipped the store,
> queue semantics, and lazy player surfaces. v4.0.2 completed the phase:
> the player is now mounted once from the ROOT application layout, so
> playback continues across every client-side route navigation site-wide;
> direct external media URLs are supported (explicit `sourceType`
> discriminator in the manifest, absolute http/https URLs validated at
> sync/validation time, never proxied or downloaded by WEB); WAV is
> supported everywhere audio types are defined (MP3 / M4A / FLAC / WAV);
> non-sensitive playback state persists locally and a full reload restores
> a PAUSED player at the persisted position (autoplay never happens); the
> store owns deterministic shuffle, stop, retry, and the full Media Session
> action set with per-action feature detection.
>
> Remaining Phase 3 work that is intentionally NOT shipped: keyboard
> shortcuts, premium/free playback states, and cross-session resume
> beyond the paused-restore contract (these stay future polish).

## Objective

Add an integrated music experience capable of playing personal music from repository content or approved direct URLs.

## Required capabilities

### Sources

Support:

```text
repository/content file
+
direct URL
```

At minimum:

* MP3
* WAV

The architecture should remain extensible for other browser-supported audio formats.

## Player

Core controls:

```text
play / pause
seek
volume
mute
duration
current time
next / previous
track selection
```

Useful secondary features:

```text
loop
shuffle
playlist
queue
keyboard shortcuts
media-session integration where supported
```

Do not ship every advanced feature immediately if the simpler player is more reliable.

## Media metadata

Each track should support:

* title
* artist
* artwork
* album/collection
* duration
* description
* tags
* project/creative context
* free/premium state
* source

## Performance

* Do not eagerly load every audio file.
* Load metadata and audio progressively.
* Avoid downloading WAV files before the user chooses them.
* Prefer streaming/range-request compatible delivery.
* Keep the initial page bundle small.
* Do not block the Home route on the media player.

## Completion

A visitor can open Media, select a track, and play it reliably on desktop and mobile without loading the whole media collection.

---

# PHASE 4 — Video Player

## Objective

Add a unified video playback experience using repository-hosted content or direct media URLs.

## Sources

Support:

```text
repository/content video
+
direct URL
```

Start with browser-friendly formats and do not assume every external provider behaves identically.

## Player

Core:

```text
play / pause
seek
volume
mute
fullscreen
duration
poster
```

Later:

```text
captions
playback speed
quality selection
picture-in-picture
```

Add advanced controls only where browser/provider support is reliable.

## Media metadata

Support:

* title
* description
* poster
* duration
* dimensions
* source
* tags
* related project
* related article
* related research
* free/premium state

## Performance

* poster-first loading
* lazy player initialization
* no autoplay with sound
* no eager download of large videos
* no player initialization for videos outside the viewport unless intent justifies it

## Completion

A visitor can discover and watch personal videos through Media using a consistent player architecture.

---

# PHASE 5 — Art + Shop / Digital Products

## Objective

Turn the personal art/media system into a real digital-product storefront.

The Shop should sell high-quality digital work while keeping appropriate low-quality/free versions accessible.

## Product model

A product should support:

```text
product
├── preview/free asset
├── premium asset
├── metadata
├── price
├── purchase state
└── delivery state
```

## Art licensing model

Example intended product structure:

```text
ARTWORK
├── preview / low-resolution → FREE
└── high-resolution PNG → PAID
```

Do not expose the original high-quality asset through public static paths.

The premium asset delivery architecture must prevent accidental public indexing or direct unauthenticated access.

## Music licensing model

Example:

```text
TRACK
├── MP3 → FREE
└── WAV → PAID
```

The free MP3 may remain directly playable/downloadable.

The premium WAV must be delivered only after successful purchase/authorization.

## Shop requirements

Plan for:

* product catalogue
* product detail pages
* preview gallery
* pricing
* purchase flow
* payment provider integration
* receipt/order state
* secure download delivery
* entitlement verification
* download limits where appropriate
* refund/support information
* licensing terms
* product metadata
* related articles/projects

## Important architectural constraint

GitHub Pages is static hosting.

A serious digital shop will likely require a secure backend/service for:

* payment confirmation
* user/order state
* entitlement validation
* secure file delivery

Do not pretend client-side JavaScript can protect premium files.

Keep the static/public site as the presentation layer and introduce a backend only where the commercial requirements actually need it.

## Product discovery

Shop content should connect to Media:

```text
Media → Artwork → Product
Media → Track → Product
Media → Video → Product
Project → Media → Product
Article → Media → Product
```

## Completion

A visitor can:

1. discover an artwork/track,
2. inspect the free version,
3. understand what the premium version contains,
4. purchase it,
5. receive the correct digital asset securely.

---

# PHASE 6 — News

## Objective

Add a **News** area where Parsa Tak can publish personal news, project updates, observations, and selected world news commentary.

## Content model

Separate at least:

```text
PERSONAL / PROJECT NEWS
WORLD NEWS / COMMENTARY
```

Do not merge reporting and personal updates into one ambiguous content type.

## Suggested content fields

```text
title
slug
summary
body
date
updated
type
source
sourceUrl
tags
relatedProjects
relatedResearch
relatedMedia
```

For world-news posts:

* clearly identify the original source,
* distinguish sourced facts from commentary,
* preserve publication dates,
* use direct source links,
* avoid presenting third-party claims as original reporting,
* make the author's perspective explicit.

## News architecture

Potential structure:

```text
NEWS
├── Latest
├── Parsa Tak
├── Projects
└── World
```

Use the existing Blog/content system where practical rather than creating a second completely separate CMS/content pipeline.

The final implementation should avoid duplicated content registries.

## Discovery

News can connect to:

* Blog
* projects
* research
* media
* topic hubs

Example:

```text
News item
   ↓
related project
   ↓
related article
   ↓
related media
```

## Completion

News becomes a first-class publishing surface without turning the entire site into a generic news portal.

---

# PHASE 7 — FINAL PRODUCT-SYSTEM POLISH

## Objective

After Media, Music, Video, Shop and News exist, perform a complete architectural cleanup pass.

Audit:

### Information architecture

```text
Home
About
Blog
News
Media
Contact
```

with:

```text
Work
Research
Topic Hubs
Shop
```

as deeper destinations where appropriate.

Do not automatically add every destination to the primary nav.

The navigation must stay understandable.

## Unified navigation

One source of truth.

One renderer.

Consistent desktop/mobile behavior.

Consistent active/focus semantics.

## Unified content registry

Avoid independent registries for:

* articles
* news
* media
* products
* projects

Use shared primitives where appropriate while keeping content types semantically distinct.

## Unified relationship graph

Eventually support:

```text
Person
│
├── Project
│    ├── Article
│    ├── Research
│    ├── Media
│    └── Product
│
├── Research
│    ├── Article
│    ├── Project
│    └── Media
│
├── Media
│    ├── Music
│    ├── Video
│    └── Art
│
└── News
     ├── Project
     ├── Research
     └── Media
```

This should strengthen discovery without creating an unreadable graph for users.

---

# CROSS-CUTTING ENGINEERING RULES

## Performance

Never:

* eagerly load the whole media library,
* download large premium files before intent,
* preload every song/video,
* put heavy media logic into the critical Home bundle,
* initialize players unnecessarily,
* regress RED MAGIC's lazy boundary.

Prefer:

```text
metadata first
→ preview
→ user intent
→ full media
```

## Accessibility

All new features must support:

* keyboard access
* visible focus
* semantic labels
* captions/subtitles where applicable
* reduced motion
* touch controls
* usable mobile layouts
* no hover-only information

## SEO

Every new public document must have:

* unique title
* unique description
* canonical URL
* correct Open Graph metadata
* structured data when appropriate
* descriptive internal links
* sitemap policy
* export verification

Do not index:

* private purchase state,
* payment callbacks,
* temporary downloads,
* internal player state,
* arbitrary query-state combinations unless they are intentionally canonical documents.

## Security

Especially for Shop:

* never expose premium source files in the public static directory,
* never treat hidden URLs as authentication,
* verify payment server-side,
* protect download entitlement,
* do not trust client-side purchase state.

## Content truthfulness

Never fabricate:

* artwork metadata
* publication dates
* prices
* download counts
* audience metrics
* sales
* performance metrics
* news facts
* external sources

---

# VERSION / RELEASE STRATEGY

Suggested major milestones:

```text
v3.9  Information Architecture + Discovery                (shipped)
v4.0  Media Architecture + Library → Media + Music Player (shipped — the
      Music Player was folded into v4.0 rather than split into v4.1,
      because the Media model without a player would have shipped a
      listening surface that could not listen)
v4.0.1 Repository cleanup + architecture-integrity pass (shipped — no new
      product features: Library migration finished, one hash parser, one
      work catalogue, real static 404, RED MAGIC engine modularization,
      tests under typecheck, fresh CI installs, working static preview)
v4.0.2 Global Music + Direct Sources + WAV (shipped — the player is
      mounted once from the root application layout so playback
      continues across the full site; direct external media URLs are
      supported through an explicit manifest source discriminator,
      validated at build time and never proxied or downloaded by WEB;
      WAV joins MP3/M4A/FLAC everywhere audio types are defined;
      playback state persists locally with a paused, never-autoplaying
      reload restore. Shop, secure purchases, and News remain future
      phases — nothing beyond the Music Player scope is claimed)
v4.1  Video Player enhancements
v4.2  Art + Digital Shop foundation
v4.3  Secure digital delivery / purchase flow
v4.4  News
v4.5  Full repository + product-system polish
```

These version numbers are planning labels, not commitments. Keep the actual repository version consistent with the scope actually shipped.

---

# LONG-TERM TARGET

The mature WEB product should allow a visitor to move naturally through:

```text
DISCOVER
   ↓
UNDERSTAND
   ↓
EXPLORE
   ↓
READ / WATCH / LISTEN
   ↓
CONNECT
   ↓
SUPPORT / BUY
```

while preserving the deeper identity:

```text
PORTFOLIO
+
RESEARCH LAB
+
KNOWLEDGE GRAPH
+
MEDIA LIBRARY
+
LIVING WORLD
+
DIGITAL STORE
+
PUBLICATION
```

The system should feel like one coherent product, not seven separate websites attached to one domain.

---

# ROADMAP COMPLETION RULE

Every future feature should pass the same gates:

```text
INSPECT
→ DEFINE
→ DESIGN
→ IMPLEMENT
→ VERIFY
→ REGRESSION CHECK
→ CLEAN UP
→ DOCUMENT
→ RELEASE
```

A roadmap item is not complete merely because its UI exists.

It is complete when:

* the architecture is coherent,
* the feature works,
* accessibility works,
* mobile works,
* static/crawlable behavior is correct,
* performance remains controlled,
* security is appropriate,
* documentation is updated,
* verification passes,
* no unrelated regressions remain.

```

---

# PHASE 8 — LOADING PERFORMANCE + UNIFIED DOCUMENT TABS

> **STATUS: DELIVERED in v4.0.3.**

## Objective

A measured performance/regression pass on v4.0.2: find the real mechanism
behind the felt loading slowdown, fix the smallest correct boundaries, and
add the verification layer so the class of regression cannot pass unnoticed.

## Root causes found (measured, not assumed)

1. **Viewport prefetch of the home shell from every content route** — the
   document shell's brand link and Home crumb rendered `next/link` without
   `prefetch={false}`, so each content page prefetch-hydrated the full "/"
   graph (LivingShell + HomeScene chunks, ~115 KB, plus 3 RSC payloads) in
   the background right after hydration.
2. **Blog payload flood** — blog-index and article surfaces carried up to
   11 internal links without `prefetch={false}`; a cold /blog/ visit fetched
   6+ article payloads with zero user intent.
3. **Hard navigations to /work/ and /research/** — document-body links
   (cards, link rows, prose anchors) rendered plain `<a>`; clicking them
   reloaded the whole document, killing the global player.
4. **Speculation before first paint** — predicted scene chunks and the
   RED MAGIC organism began downloading at the first idle callback, which
   on fast connections fires before FCP.
5. **Host chunk carried the full persistence module** — v4.0.2's root-layout
   player host shipped session read/write/validate code on every route
   (+5,987 B raw / +1,761 B gzip per route) although only a raw storage
   probe is needed eagerly.
6. **Instant hover warming** — pointer-enter prefetch fired with no dwell,
   no save-data guard, and warmed the current route.

## Delivered

- `whenPageSettled()` (lib/loadPhase.ts): load → idle → speculation, one
  shared promise, hard cap; consumed by the scene preloader and the RED
  MAGIC organism.
- `lib/player/sessionPresence.ts`: the raw session-presence probe split
  out of persistence.ts; the host's initial graph is minimal by design.
- `lib/connection.ts`: the one connection/device probe module, shared by
  the scheduler and the navigation.
- Warming discipline: pointer-down/focus immediate, pointer-enter dwell +
  cancel, save-data/2G skip, current-route skip, deduplicated with retry.
- `prefetch={false}` on every internal `next/link` site-wide; document-body
  internal links upgraded to `next/link` (DocLink) so the global player
  survives every in-document jump.
- Registry-driven page identity (`pageIdForRoutePath`, lib/routes.ts):
  About and Contact ride the exact shared ContentShell contract of Work,
  Research and the hubs; the href→identity switch is gone.
- `npm run verify:loading`: export-level proof (no player surface in HTML,
  no scene/organism code in initial chunks, host chunk probe-only, About/
  Contact/Research skeleton bijection with Work).
- `npm run bench:loading`: reproducible Playwright benchmark measuring
  cold-load bytes/timings, speculative request classification, navigation
  medians, and real player continuity — medians over repeated cold runs.

## Measured results (same harness, same environment, medians of 5)

- /blog/ cold load: 8 cross-route payload fetches → 0; dynamic JS on
  content routes: 4 chunks (the prefetched home shell) → 0.
- Client navigation blog→work: 791 ms → 111 ms; work→research:
  702 ms → 94 ms (hard reloads became client-side navigations).
- Player continuity across the full route flow: playback continues
  (verified playing at t+5.5 s after six navigations); reload restoration
  stays paused; fresh visitors create no audio element.
- Speculation (scene chunks + organism) now starts strictly after the
  load event plus one idle gap; in v4.0.2 it began before FCP.

---

# PHASE 9 — VISUAL IDENTITY, FOOTER, ROUTE LOADING, SEO POLISH

> **STATUS: DELIVERED in v4.0.4.**

## Objective

A measured polish/integrity pass on v4.0.3: restore the missing visible
hero animation treatment on About and Contact, remove the retired
WhatsApp contact channel completely, fix footer alignment on one grid
contract, add a unified loading experience for real route navigation,
and extend the SEO verification with site-wide quality checks —
without changing the static-first architecture, the RED MAGIC, the
global Music Player, or the v4.0.3 loading discipline.

## Root cause found (verified against the v4.0.3 export)

The entire footer was **invisible on every ContentShell route**
(/about/, /contact/, /work/, /research/, the six topic hubs): the
shared `SiteFooter` carried `data-reveal="instant"`, but the reveal
controller (`MotionReveal`) only mounts on the world shell and the
blog layout. Under the `html.reveal-js` pre-paint gate the footer's
`opacity: 0` could never be lifted on those routes — reproduced in a
real browser against the v4.0.3 export (computed opacity "0",
`data-revealed` absent) before the fix.

## Delivered

- **Shared hero identity animation (v4.0.4)**: one hero signal
  (node + ring + transmission arc) rendered by `ContentShell` for
  every document tab — anchored above the title block on the shared
  alignment rail, absolutely positioned (zero layout impact), themed
  per tab through `--page-accent`, compositor-only, static under
  reduced motion. No page-specific animation components; About and
  Contact keep their unique hero motifs around the shared signal.
- **WhatsApp removed from the entire project**: registry entry, icon
  type, icon implementation, comments, and footer row rebalance
  (14 links, 7 + 7). Regression tests fail on any occurrence in the
  source tree, generated data, or the exported site
  (`verify-seo.mjs` scans all exported HTML/XML/JSON/TXT).
- **Footer grid contract**: the four document-nav rows share a fixed
  heading column and one link-start position (the variable-width
  heading hack is gone); the legal paragraph and LICENSE/TRADEMARKS
  links share one end-aligned grid on the footer rail; mobile
  collapses to stacked rows at ≤560px; the footer no longer opts into
  the route-scoped reveal system (the visibility fix above).
- **Unified route transition**: `GlobalRouteTransition` mounted once
  from the root layout — intent captured on click (passive capture),
  180 ms grace period, then the scene loader's signal language
  (`SceneLoadingScreen` variant `route`) until the destination route
  commits; double-rAF exit lets the destination settle in. Pure
  decision layer in `lib/routeIntent.ts`; timing constants in
  `lib/loadPhase.ts` (`ROUTE_OVERLAY_DELAY_MS`, safety cap
  `ROUTE_TRANSITION_CAP_MS`). Display-only (pointer-events: none in
  every state), race-safe under rapid clicks, excluded for external/
  mailto/tel/download/modifier/new-tab/same-route/hash-scene
  navigation, back/forward deliberately not intercepted, inert in
  the static export, star image mounted only at first engagement.
- **SEO quality group in verify-seo.mjs**: site-wide title and
  description uniqueness census with length sanity, twitter:card +
  twitter:image:alt coherence, og:image dimension declarations,
  canonical-identity uniqueness across indexable pages, per-page
  JSON-LD entity integrity (unique @ids, singular Person/WebSite),
  and the WhatsApp-remnant ban. Twitter card images now carry alt
  text site-wide (object form in the Metadata API).
- **Repository hygiene**: no legacy/duplicate source-name patterns
  (architecture test), `bench-results.json` gitignored, version 4.0.4.

## Verification (measured, not assumed)

- Full pipeline from a clean state: `npm ci`, `npm run blog`,
  `npm run typecheck`, `npm run typecheck:tests`, `npm test`
  (246 tests, 0 failures), `npm run build`, `npm run lint`
  (0 errors), `npm run verify` (SEO + brand + export + loading).
- Behavioral route-transition verification (headless Chromium,
  17/17 checks): fast/warmed navigation never flashes the loader; a
  navigation throttled past the grace period shows the overlay with
  the destination label and `pointer-events: none`; the overlay
  dismisses only when the route commits; same-route, external, and
  modifier clicks never trigger it; rapid BLOG→CONTACT clicks keep
  one continuous overlay under the latest intent; reduced motion
  keeps the surface functional with a static arc; navigation stays
  player-free without playback intent.
- `npm run bench:loading` re-run on the v4.0.4 export (same harness,
  same machine class): cold-load medians and navigation medians
  within run-to-run variance of the v4.0.3 baseline (the route
  transition adds display-only CSS, no critical-path work).

---

# PHASE 10 — DOCUMENT UNIFICATION, ROUTE PROGRESS, COMPACT FOOTER

> **STATUS: DELIVERED in v4.0.5.**

## Objective

Make About, Contact, Work, Research and the topic hubs visibly and
structurally ONE document system; replace the v4.0.4 full-screen
route overlay with a tiny non-blocking progress line; make the
footer materially more compact while preserving every link.

## Root causes found (measured, not assumed)

- The v4.0.4 route-transition host (`GlobalRouteTransition` +
  `lib/routeIntent.ts` + the `SceneLoadingScreen` route variant)
  shipped ~24.5 KB of initial JS on ALL 22 exported routes,
  including pure static documents, and presented normal tab
  navigation behind a full-screen dark wall — app-splash UX.
- The hero vertically CENTERED its content, so the title baseline
  moved with the amount of lead text (About carries three lead
  paragraphs, Contact two), and the hero signal hung absolutely
  positioned ABOVE the breadcrumb block — a floating element, not
  part of the title identity.
- Navigations FROM the home route measured ~180 ms slower than any
  other source (world-shell unmount cost — inherent to the preserved
  living-world architecture); destination payload size was NOT the
  bottleneck, and the 130 ms hover-dwell warm fetched up to 134 KB
  of payloads on a cursor sweep without genuine intent (browser
  automation's move-to-target gesture triggered it reliably).
- Footer styles lived in `LivingShell.module.css`, coupling every
  content route to world-shell CSS; `FooterLinks` hardcoded a 7 + 7
  row split; four stacked nav rows plus two link rows plus the legal
  block made the footer 355 px tall at desktop.

## Delivered

- **Document unification**: one hero composition contract in
  `ContentShell` — heroField → heroDoc → crumbs → heroIdentity
  (heroSignal BESIDE heroCopy: kicker, H1, lead). The signal is IN
  FLOW (no absolute positioning, no overlap, no clipping, no
  content-height dependence), and the hero is TOP-ANCHORED so the
  crumbs/kicker/H1 sit at identical positions on every route.
  Verified by measurement: crumbs y=144, kicker y=181, H1 y=206,
  signal 22×22 at identical coordinates on /about/, /contact/,
  /work/ and /research/ (1440×900). Route-specific CSS is decorative
  only (field motifs); no page-specific hero/shell components exist.
- **Route progress**: `components/RouteProgress.tsx` — a 2 px
  indeterminate red line at the top of the viewport, mounted once
  from the root layout. The navigation island fires a
  `web:route-progress` DOM event on genuine internal clicks
  (modifier/new-tab/external/same-route excluded); a 150 ms grace
  period (`ROUTE_PROGRESS_GRACE_MS`) keeps fast navigations
  invisible; the destination pathname commit plus double-rAF fades
  the line; a safety cap clears a silently-died navigation. Never
  blocks, never delays, aria-hidden, reduced-motion static, never
  visible in the static export. The v4.0.4 route-overlay
  architecture was REMOVED (files deleted, scene loader back to
  boot/scene variants only) — exactly ONE mechanism for document
  navigation.
- **Prefetching reassessed**: hover warming REMOVED (visual
  animation only); pointer-down and keyboard focus keep warming
  (unambiguous intent); save-data/2G still skip; the current route
  is still never warmed; viewport prefetch still off.
- **Compact footer**: `SiteFooter.module.css` (dedicated
  stylesheet — footer styles moved out of `LivingShell.module.css`);
  the four logical groups (SITE, COLLECTIONS, WORLD, TOPICS) render
  as a responsive column grid (4 → 2 → 1) with the six-entry TOPICS
  group flowing through two sub-columns; the public network presents
  the 14 verified links of `lib/links.ts` as its own region —
  PUBLIC NETWORK heading + two explicit rows of seven on desktop
  (final v4.0.5 contract; see PHASE 12); the legal row top-aligns
  without baseline hacks; the copyright/trademark identity row is
  the bottom-most footer row. Measured: no horizontal overflow at
  1440/1000/900/390, all 14 links crawlable and visible at every
  width.
- **Benchmark expansion**: `bench-loading.mjs` now covers all twelve
  canonical routes, reports click→URL-commit AND settled times with
  medians + P95, CSS/image/RSC-payload metrics per route, and a
  summary (slowest route, largest client route, largest initial JS
  asset, slowest navigation).
- **Tests rewritten as behavior contracts**: `v404-polish.test.ts`
  (implementation trivia: exact CSS values, slice counts, selector
  spelling) replaced by `document-shell.test.ts`,
  `route-progress.test.ts`, `footer.test.ts` and
  `repository-hygiene.test.ts` (durable structure, exclusion
  matrices, ownership, crawlability — not pixel values).

## Verification (measured, not assumed)

- `npm run typecheck`, `npm run typecheck:tests`, `npm test`
  (264 tests, 0 failures), `npm run build` (23 routes),
  `npm run verify` (SEO + brand + export + loading) — all green.
- Hero geometry parity measured in a real browser (identical
  landmark coordinates across the four documents).
- Footer heights measured at 1440/768/390 against the v4.0.4 export
  (same machine, same method) — more compact at every width.
- Route progress behavior probed in a real browser: a fast
  navigation (97 ms commit) never shows the line; modifier clicks
  never fire it; the host ships inactive on all 22 exported routes.
- `npm run bench:loading` re-run on the v4.0.5 export: see
  bench-results.json for the full twelve-route table.

---

# PHASE 11 — ABOUT/CONTACT IDENTITY ARTIFACTS + GLOBAL RED CURSOR

> **STATUS: DELIVERED in v4.0.5 (rebuild of the v4.0.5 state).**

## Objective

Give About and Contact the same kind of strong, page-specific visual
artifact that Work (project cards) and Research (module chains) use
immediately after the shared hero — without leaving the shared
ContentShell — and make the red cursor a TRUE global site system so it
works on every document route.

## Root causes found (verified against the source)

- `RedCursor` mounted only inside `LivingShell.tsx` (world shell,
  renders on "/" only) and, separately, in `app/blog/layout.tsx`.
  ContentShell document routes (`/about/`, `/contact/`, `/work/`,
  `/research/`, the six hubs) mount neither shell, so the cursor's
  activation class never reached them — a mount-placement error, not
  a cursor CSS error.
- About and Contact documents opened with plain prose sections; their
  first document block carried no page-specific visual identity.

## Delivered

- **Global red cursor**: mounted exactly ONCE from `app/layout.tsx`
  (the same root-layout law as the Music player and RouteProgress);
  the LivingShell and blog-layout mounts removed. The implementation
  is unchanged: native CSS cursor, zero pointer listeners, zero rAF,
  zero React state, coarse/touch + reduced-motion fallbacks, the
  `pdf-reader-active` escape hatch. Pinned by the new
  `tests/global-cursor.test.ts` (one mount, one implementation,
  preserved fallback contract).
- **One generic shell slot**: `ContentShell` gained a single optional
  `docFeature` prop — the page's first document block, rendered
  inside the shared document measure above the page content. No
  shell fork, no client code, no layout-contract change.
- **About identity/practice artifact**: RESEARCH · ENGINEERING ·
  PRODUCT as three connected track cards on one signal rail (scope
  vocabulary, one honest note, one real link per track — /research/,
  /work/, /contact/), leading directly into "What I do" and "How I
  work". Themed by the About accent (`--page-accent`), rendered by
  `app/about/page.tsx` through the slot.
- **Contact transmission artifact**: the four collaboration intents
  (the page's own model) as packet-dotted channels wired over one
  line to the ONE primary action (the verified mailto from
  `lib/links.ts`), GitHub / LinkedIn as secondary paths. Visual
  language extends the unified nav's contact identity
  (navContactRipple / navContactPacket) at document scale. The page
  restructured to artifact → Collaboration types → Before writing →
  Where the work lives; the honest no-form/no-backend model is
  unchanged.
- **CSS architecture**: artifact styling lives in
  `content.module.css` (PAGE ARTIFACT HEADER + ABOUT IDENTITY
  ARTIFACT + CONTACT TRANSMISSION ARTIFACT blocks) — page-specific
  artifact styling only; shared geometry untouched. Motion is
  compositor-only (opacity pulse on the rail nodes, scale/opacity
  ripple on the wire node), gated behind
  `prefers-reduced-motion: no-preference`; the static state is the
  complete, usable artifact. No absolute positioning anywhere in
  either artifact — nothing can overlap text or clip.

## Verification (measured, not assumed)

- `npm run typecheck`, `npm run typecheck:tests`, `npm test`
  (280 tests, 0 failures), `npm run build` (23 routes), `npm run
  lint` (0 errors), `npm run verify` (SEO + brand + export +
  loading) — all green. `verify:loading` now additionally asserts
  both artifacts ship server-rendered in the exported HTML (check 6b).
- `node scripts/verify-interactive.mjs` in headless Chromium:
  22/22 behavioral checks pass (keyboard disclosure, reduced-motion,
  throttled route progress, no-JS content on /about/, /contact/,
  /work/, /research/, /local-ai/, deep links, player absence before
  intent).
- Rendered artifact verification (headless Chromium, 36/36 checks):
  cursor class active on /about/ and /contact/ at 1440/820/390;
  zero horizontal overflow at every width; artifact present, visible,
  and positioned after the hero; reduced-motion contexts show no
  artifact animation with the artifact fully rendered; artifact links
  keyboard-focusable with visible outlines.
- Initial client graph measured before/after (decoded, on-disk bytes
  of the initial script set, identical method on both builds):
  document routes +3555 bytes each (the cursor module joining the
  shared root chunk — home and blog are byte-identical or smaller),
  same file count everywhere, zero new JS files, zero dynamic JS on
  document routes. Artifact markup costs only server-rendered HTML
  (About +12.2 KB, Contact +10.2 KB uncompressed).
- `npm run bench:loading` re-run on the final export: all twelve
  routes load cold within the established envelope, document routes
  carry dynJS=0, and navigation medians are unchanged within
  run-to-run variance. No performance claims beyond these
  measurements.

---

# PHASE 12 — HEADER + FOOTER UNIFICATION

> **STATUS: DELIVERED in v4.0.5.**

## Objective

Make the header identity and the footer site chrome consistent on
every major surface: one shared header status component rendering
`★ Parsa Tak  ● CURRENT SURFACE` on the world HUD, the blog and every
ContentShell document; one deliberate footer stack — document nav →
PUBLIC NETWORK (14 verified links, 7 + 7 on desktop) → legal →
bottom identity row (star + © + ™).

## Root causes found (verified against the source)

- The header identity existed as THREE implementations: the world
  HUD's pulsing `livingShellStatus/StatusDot` (+ `shellStatusPulse`
  keyframes), the blog's local unpulsed `status/statusDot` chip that
  stood down at ≤1100px and ≤760px, and NOTHING on ContentShell —
  so /about/, /contact/, /work/, /research/ and the six topic hubs
  carried no status identity at all.
- The footer placed the copyright/trademark identity BESIDE the
  public network (one meta row) instead of at the bottom; the public
  network was one naturally wrapping group (no explicit 7 + 7
  desktop rows); footer icons rendered at 13px (12px ≤760px); the
  registry's per-link `accent` was unused by the footer.
- `tests/footer.test.ts` asserted the obsolete "no fixed row
  slicing" implementation detail.

## Implementation

- **`components/SiteHeaderStatus.tsx` + `.module.css`** — the ONE
  shared status implementation: markup, 6px red dot, 2.4s
  transform/opacity pulse, 9px mono uppercase label, reduced-motion
  static state, `aria-hidden` dot, optional polite live region.
  Server-safe presentational component (no client code).
- **World HUD**: renders the shared status with the live scene
  definition's label (`live` keeps scene-change announcements); the
  duplicate status markup, CSS and keyframes are removed; the HUD
  keeps its four-column grid at every width (brand → status →
  navigation → actions; compact: brand → status → menu trigger).
- **Blog**: renders `<SiteHeaderStatus label="BLOG" />`; the local
  chip, its CSS and BOTH breakpoint-hiding rules are removed — the
  identity is visible at every width; the header rhythm tightens
  instead (14px/12px gaps).
- **ContentShell**: renders the shared status with
  `headerStatusForRoutePath(activeHref)` — one derivation for every
  document route; `HubPageView` passes its registry slug as
  `activeHref` (route identity plumbing only; the hub page-id and
  nav-active behavior are unchanged). Labels resolve from
  `data/routes.json` via `lib/routes.ts` (registry path → uppercase;
  unregistered → no status); no route-specific header code exists.
- **Footer**: `SiteFooter` renders the region stack
  (footerNavRegion → footerNetwork with a PUBLIC NETWORK heading →
  footerLegal → footerBottom identity row). `FooterLinks` slices the
  registry with `FOOTER_LINK_ROW_SIZE = 7` into two rows rendered by
  the ONE shared FooterLink renderer (list semantics, registry order
  preserved); icons render through the shared `LinkIcon` at a
  19–18px box; hover/focus activate the registry's own accent via
  `--link-accent` (CSS-only transform/opacity/color; scale + ring +
  arrow nudge; strong `:focus-visible` boundary; reduced motion
  keeps icons, color and focus, drops movement). The copyright/
  trademark identity row is the LAST footer row in normal flow.
- **Tests**: `tests/footer.test.ts` rewritten to the durable
  contracts (registry = exactly 14 unique links in canonical order,
  no WhatsApp; two row containers × seven links covering the full
  registry with no omission/duplication; shared renderer; LinkIcon;
  icon box 18–20px; transform/opacity-only animation; reduced-motion;
  legal wording; bottom identity row after the legal region; style
  ownership). New `tests/header-status.test.ts` (17 contracts: one
  implementation, all three hosts, no duplicates, label resolution,
  world scene labels, server-safety, accessibility, reduced motion).
  `tests/ts-loader.mjs` injects the JSON import attribute so tests
  can import the app's data authorities through the app code path.
- **Docs**: README, AGENTS and this roadmap updated to the final
  architecture (no "naturally wrapping" claims remain).

## Verification (measured, not assumed)

- `npm run typecheck`, `npm run typecheck:tests`, `npm test`
  (310 tests, 0 failures), `npm run lint` (0 errors; the pre-existing
  `<img>` warning profile unchanged), `npm run build` (23 routes),
  `npm run verify` (SEO + brand + export + loading) — all green.
- `node scripts/verify-interactive.mjs` in headless Chromium:
  22/22 behavioral checks pass (keyboard disclosure, reduced-motion,
  throttled route progress, no-JS content, deep links, player
  absence before intent).
- Rendered-export QA (12 routes × 14 checks, all green): brand +
  correct server-rendered status label per route; footer groups;
  PUBLIC NETWORK heading; exactly two row containers; all 14 links
  in canonical order; 14 inline SVG icons; legal + LICENSE +
  TRADEMARKS; identity row AFTER the legal region; no WhatsApp
  remnant.
- Browser measurement (1440/1000/900/390): zero horizontal overflow
  on /, /about/, /blog/, /contact/, /local-ai/; desktop rows render
  7 + 7 as two single visual lines (rows wrap order-stably below
  desktop); status visible at every width on every tested surface
  (the blog status no longer hides); status not focusable; footer
  link keyboard focus applies the red outline, the registry accent
  (LinkedIn → #0A66C2 measured) and scale(1.08) via transform;
  world scene clicks update the status (Home → Systems → RED Magic,
  uppercase by CSS); compact HUD at 390 renders brand → status →
  menu trigger with GitHub inside the disclosure menu.
- `npm run bench:loading` re-run: all twelve routes load within the
  established envelope; no new client bundle for the status or the
  footer animation (CSS-only, server-rendered markup).
