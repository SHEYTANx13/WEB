---
title: "The Anatomy of a Fast Static Site"
subtitle: "How this static Next.js site is engineered: what loads, when it loads, how it moves — and why nothing on it ever lies to you."
excerpt: "A tour of the time architecture behind this website: loading priorities, frame budgets, refresh-rate-aware quality, and the rule that banned fake progress bars before it banned fake frame-rate claims."
description: "How this static site orders its work in 2026: a five-phase loading vocabulary, a P0–P4 priority ladder, an 8.33 ms frame budget for high-refresh displays, and honest telemetry for both."
date: "2026-09-10"
updated: "2026-09-10"
author: "Parsa Tak"
category: "engineering"
type: "work"
tags: ["performance", "architecture", "loading", "120Hz", "frame budget", "static export"]
featured: false
project: "web-platform"
topics: ["performance", "loading", "frame budget", "static export"]
related: ["building-under-constraints", "why-the-website-is-a-living-system"]
cover:
  src: "/blog/images/loading-architecture.svg"
  alt: "A dark technical diagram with a red priority ladder from P0 to P4 and a pulsing core"
  width: 1200
  height: 630
---

Every performance problem on the web is, at some level, a scheduling problem. Code, styles, images, and data all want the same scarce resources: the network, the main thread, and the user's attention. A fast site is not one with nothing to load — it is one where the *order* of loading is designed. This year that definition expanded for me: a fast site is also one where the *time between frames* is designed. This article documents both halves — the loading architecture, and the new high-refresh strategy that rides on top of it.

One fact frames everything below: [MDN states it plainly](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) — `requestAnimationFrame` synchronises with the display's refresh cycle, and the common rate is 60 Hz, but displays at 90, 120, and 144 Hz are now ordinary. **(Fact.)** The browser will happily drive your animation at the panel's native rate — if your code lets it. That single sentence reorganises how animation code has to be written.

## Five honest phases

Loading UIs lie constantly. They display 73%, then 92%, then 99% — numbers connected to nothing measurable. This site forbids that. Every loading surface exposes one of five phases: `INITIALIZING`, `LOADING`, `PREPARING`, `READY`, `ERROR`. For measurable work, the UI may show deterministic progress; for indeterminate work it shows an indeterminate treatment. The rule is simple: the interface never claims a resource is loaded when it is not.

## The priority ladder

All loading work is classified on one ladder:

- **P0 — critical.** The app shell, the current scene's code, essential CSS.
- **P1 — near-critical.** The most probable next scene, predicted deterministically. Loaded when the main thread goes idle.
- **P2 — predictive.** The adjacent previous scene, after a second idle gap.
- **P3 — background.** Secondary metadata. Nothing currently schedules P3 work.
- **P4 — user-triggered.** PDFs, audio, video. *Never* loaded automatically.

Heavy media being P4 is a hard law. The [Media](/#media) collection contains books, music, and media measured in megabytes; none of it moves until you press READ, LISTEN, or WATCH. A link existing is not consent to download.

## The frame budget nobody told you about

At 60 Hz a frame interval is 16.6 milliseconds. At 120 Hz it is 8.33. That number is a budget, not a boast — and it changes what counts as an optimisation. Work that was invisible at 60 Hz becomes the difference between 120 and 90 at high refresh. The rules this site's animation code follows fall straight out of the budget:

- **Delta-time, never per-frame constants.** Simulation advances by `velocity × deltaTime` with extreme deltas capped after tab switches, so motion is the same on 60, 90, 120, and 144 Hz — just smoother where more frames exist.
- **One scheduler per subsystem.** The interactive engine owns one RAF loop; the ambient organism owns one self-suspending controller; a settled organism costs zero JavaScript per frame. No nested loops, no loops created per render, no loops left running after unmount.
- **Zero steady-state allocation.** Gradients, sprites, and typed arrays are created once and reused; since this upgrade, even the per-particle colour strings are resolved through a bounded quantised cache instead of being built per frame.
- **CSS does what CSS can do.** Fades, reveals, staggers, and the entire ambient organism are compositor-friendly CSS — JS animation loops are reserved for actual simulation.

## Quality that measures the display, not the myth

The subtlest change this year: adaptive quality used to judge itself against *absolute* numbers — drop below 105 fps and lose a tier. On a 60 Hz display doing everything right, that was a false conviction: the panel cannot render 120, and the algorithm punished it for physics. The 2026 version derives the display's refresh rate from its own sustained frame intervals — the fastest inter-frame interval *is* the native interval — and applies relative thresholds with hysteresis: demotion requires two consecutive degraded windows, promotion requires three clean ones, so quality responds to sustained conditions instead of oscillating every few frames. A 60 Hz panel holding 60 keeps full quality. A 120 Hz panel losing a third of its frames is demoted — correctly.

And the console reports what was measured: sustained frame rate, against the refresh rate it was measured on, plus the active quality tier. What it never says is "120 FPS achieved". That claim would be a load-time progress bar wearing a nicer coat. **(Position — and the reason the vitality label reads like an instrument panel rather than a trophy shelf.)**

## Idle is a resource

The background preloader treats idle time as a budget, not an invitation. It loads at most two scene chunks without user intent. It declines to work when the tab is hidden, when `save-data` is on, or when the connection reports 2G. One background queue owns all non-urgent work — speculation never competes with the user's actual request, and scene chunks are downloaded exactly once through a single import site.

## The result

The outcome is a site with three navigation speeds and one motion language:

1. **Preloaded scene** — the chunk is resident; the transition is a coordinated fade, the organism pulses once, and the incoming content settles into place within a few hundred milliseconds. No loader ever appears.
2. **Cold scene** — the chunk fetches; the overlay appears after its delay, states `LOADING`, and disappears when the scene mounts.
3. **Return visits** — everything is content-hashed and immutable, so the browser cache does the work and the network stays quiet.

None of it required a new framework, a state manager, or an animation library. It required deciding what should load, in what order, how motion earns its place on the frame budget, and being honest about what has not loaded yet — and about what the hardware can sustain. That is most of performance engineering in 2026. The constraint that keeps it all static is covered in [Building Under Constraints](/blog/building-under-constraints/), and the organism those budgets protect is described in [Why This Website Is a Living System](/blog/why-the-website-is-a-living-system/).
