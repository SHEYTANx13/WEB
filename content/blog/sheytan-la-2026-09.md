---
title: "SHEYTAN-LA 2026-09: The Runtime Governor Research Notes"
subtitle: "A policy authority that measures the machine, admits against resident budgets, and refuses to guess — the laboratory's September research release, documented."
excerpt: "The September 2026 research release of SHEYTAN-LA adds a Runtime Governor: one resource-state model over measurable facts, admission against resident memory budgets, honest adjustment classes, a self-model with provenance — and two P0 repairs that make pause/resume and abort semantics honest at the root."
description: "Inside SHEYTAN-LA v1.8.0: a Runtime Governor that admits workloads against resident memory budgets, explains every verdict, and keeps the host responsive."
date: "2026-09-29"
author: "Parsa Tak"
category: "research"
type: "research"
tags: ["SHEYTAN", "SHEYTAN-LA", "local-first", "Runtime Governor", "resource management", "verification", "Go", "2026"]
featured: false
project: "sheytan-local-agent"
topics: ["local-first AI", "agent architecture", "verification", "resource management"]
related: ["sheytan-the-local-first-laboratory", "reasoning-is-a-system-property", "ai-instructions"]
cover:
  src: "/blog/images/sheytan-la-governor.svg"
  alt: "A red policy-loop diagram: telemetry flowing into a governor core, an execution-envelope band beside it, and subsystem boxes below carrying the actions"
  width: 1200
  height: 630
---

Every agent system eventually collides with the same wall: the machine it runs on. The [SHEYTAN laboratory](/blog/sheytan-the-local-first-laboratory/) has spent its releases building verification gates for the model's work; the September research release (v1.8.0, current) turns the same discipline on the host itself. The headline is a **Runtime Governor** — a policy authority that continuously understands the machine and governs runtime policy while keeping the host responsive. **(Fact — the repository's v1.8.0 documentation.)**

A register note, in the house style: everything below about the system's behaviour is **fact**, checkable in the [public repository](https://github.com/Parsaetak/SHEYTAN-Local-Agent); interpretation is marked as analysis.

## One process, one runtime stack

SHEYTAN-LA is a single Go process that owns its runtime exactly once: one engine lifecycle over managed llama.cpp — with the native C++ engine as a validated alternative path — one run registry where fresh and resumed runs share one identity, one session store, one tool registry, one scheduler, one downloader, one memory authority. **(Fact — the architecture truth table.)** I keep the architecture accumulative by rule: v1.8 added the Governor without moving a single authority, because a laboratory that rearranges its constitution every release is not a laboratory.

## The Runtime Governor: policy, never force

The Governor (`internal/governor`) is fed by the live-pressure monitor that already existed — one sampler, one cadence, one protection path; no second telemetry database. It computes a resource state of measured facts with an explicit unknowns list, then a pressure model that reuses the shipped four-level vocabulary (ok / warning / high_pressure / critical_pressure) and adds the time dimension: sustained-duration tracking per level and bounded rolling signals, so one noisy sample never flips policy. **(Fact.)**

The output is an execution envelope — what may be admitted, what should be reduced (background work, context work, tool concurrency) — and, the part I consider the honest core, an adjustment class on every recommendation: `live` (a real control point exists now), `next-run`, or `reload` (the engine must reload; the llama.cpp contract is not pretended away). **(Fact.)**

Admission is arithmetic, not vibes. Model loads are admitted against a resident budget — available RAM minus host headroom minus measured process RSS — where mapped file size is never accepted as resident size, plans without an estimate are refused, and every verdict carries its own arithmetic in the reason. Unknown evidence refuses conservatively. **(Fact.)** **(Analysis)** this is the laboratory's [verification doctrine](/blog/reasoning-is-a-system-property/#rep-strengthen-the-thinking) applied to resources: a decision is only as good as the evidence it names, and a policy that cannot explain itself has no business governing a machine.

The Governor executes nothing. Enforcement stays with the subsystems that already own engines, runs, and memory. `GET /api/governor` composes one read model — governor state, hardware facts with GPU/NPU honestly labelled detection-level, engine health, actual capabilities — and the System Centre renders it with real values and named unknowns, no decorative graphs. **(Fact.)**

## Two P0 repairs, told honestly

The release also closed two defects at the root, and both stories read as research.

The pause→resume→pause synchronization defect: a failing integration test reused a wait helper whose condition was satisfied by the *stale, pre-resume* cumulative snapshot — the second pause was issued without proof the resumed generation was live. The repair is an authoritative-evidence contract (`resumedGenerationEvidence`): after a resume, proof requires a strictly newer run sequence AND a changed cumulative response/reasoning snapshot; stale cumulative state is never evidence. **(Fact.)**

The abort honesty race: on a canceled run context the orchestrator published `done` with an abort caption while the outcome registry recorded `aborted` — a divergence the one-settlement rule could never repair, and the source of a ~17% flake in the abort-after-resume integration test on Linux. The orchestrator now publishes the typed `aborted` activity, live state and registry agree on it forever, and the flake is gone across 15/15 stressed runs. **(Fact — the v1.8.0 release notes.)**

## The honest boundary

The laboratory's evidence model names its classes — deterministic unit, race gate, integration, E2E, CI, real-engine probe, real-host runtime, known limitation — and v1.8.0 keeps every boundary truthful: CPU load is measured on Linux while the Windows seam reports unknown rather than a fabricated utilisation number; the Governor is a policy authority, not yet a full closed-loop actuator; CI is build/test evidence, never physical-host evidence. **(Fact.)**

**(Analysis)** that refusal to flatter itself is the actual research result. A local-first system that admits workloads it cannot measure is a demo; one that refuses until the evidence exists is an instrument. This is why the system anchors the laboratory's [Local AI line](/local-ai/) in [Selected Work](/work/), and why these notes sit inside the [research programme](/research/): the same rule runs through everything I build — the model proposes, the tools execute, the laboratory verifies, and now the runtime governs. The repository is public: [github.com/Parsaetak/SHEYTAN-Local-Agent](https://github.com/Parsaetak/SHEYTAN-Local-Agent).
