---
title: "FreeIran Engineering Notes"
subtitle: "Determinism, chunked storage, and honest testing in a Go system built for unreliable networks."
excerpt: "FreeIran is a local-first configuration manager built around a shared Go engine: three protocol cores behind one abstraction, checksummed chunked storage with crash recovery, a deterministic fake-core test harness, and no telemetry at all. These are the engineering notes."
description: "Inside FreeIran's architecture: a Go orchestration engine with Xray, V2Ray and sing-box behind one Core abstraction, immutable chunked local storage, deterministic backend selection, a fake-core test harness, and a C++ acceleration layer that correctness never depends on."
date: "2026-09-12"
author: "Parsa Tak"
category: "engineering"
type: "work"
tags: ["FreeIran", "Go", "systems", "storage", "testing", "2026"]
featured: false
project: "freeiran"
topics: ["Go", "deterministic testing", "storage", "systems"]
related: ["building-under-constraints", "sheytan-the-local-first-laboratory"]
cover:
  src: "/blog/images/freeiran-cores.svg"
  alt: "Three protocol cores converging into one abstraction above a checksummed chunk grid"
  width: 1200
  height: 630
---

FreeIran is the most quietly engineered project in [the public archive](https://github.com/Parsaetak/FreeIran): a free, open-source VPN configuration manager for Windows, built around a shared Go engine for discovering, testing, maintaining, and running publicly available proxy configurations. It exists for environments where ordinary connectivity is heavily restricted — including Iran — and it is local-first in the strict sense: no account, no central backend, no cloud service, no remote telemetry. **(Fact — the repository's own description.)**

This article documents the engineering decisions that make it trustworthy, because the interesting story is not what it does but *how little it allows itself to lie*.

## The pipeline: one direction, bounded at every stage

Configurations flow through a single streaming pipeline: FETCH → PARSE → NORMALIZE → VALIDATE → DEDUP → PERSIST. Each stage runs in a bounded worker pool with backpressure and cancellation, so a slow or failed source never blocks the other sources, and unchanged sources are skipped entirely through content-hash change detection. **(Fact — the repository's feature documentation.)**

That design echoes a rule documented in [Building Under Constraints](/blog/building-under-constraints/): make every expensive operation happen at the right time, in the right size, and fail loudly when it cannot. Nothing in the pipeline is unbounded, and nothing is silent.

## Three cores, one abstraction, zero folklore

The runtime manages three real protocol backends — Xray, V2Ray (V2Fly), and sing-box — behind one Core abstraction. What makes this more than a wrapper is the capability model: configurations map to backends through a registry that knows, for example, that REALITY lives in Xray and sing-box while classic QUIC/HTTP-2 transports live in V2Ray. Backend selection is deterministic (preference → priority → name ordering), produces explainable selection reasons, and falls back in a bounded, ordered way. **(Fact.)** V2Ray is a first-class backend, never a synonym for Xray. **(Fact — and stated explicitly in the repository because the distinction is usually lost.)**

The connection lifecycle is an explicit state machine — disconnected → selecting → preparing → starting_core → waiting_for_ready → connected → disconnecting — with process health separated from network health, one active session, and core crash detection through a background monitor. **(Fact.)**

## Storage that survives crashes and Windows

Local state lives in checksummed immutable chunk files with a binary fingerprint index, a segmented write-ahead journal, incremental writes, atomic commits, compaction, and crash recovery — no full-dataset JSON dumps. **(Fact.)**

Two details deserve the spotlight because they are where most desktop software quietly rots:

- **The Windows file guarantee.** A bounded chunk-handle cache is the sole owner of open descriptors; eviction closes files, pins protect in-flight reads, and `Close()` releases everything before returning — so the store directory is deletable immediately, on every platform, enforced by tests. **(Fact.)**
- **The v0.5.0 lifecycle repair.** The two classic Windows "file in use" failure classes — a legacy store migrated before its file was closed, and a journal upgraded before its removal — were fixed *at the root* and guarded by ordering regression tests that run on every platform. **(Fact — the release notes name both fixes.)**

Runtime security follows the same discipline: generated core configurations are written as 0600 files inside 0700 temporary directories, removed on shutdown and after failed startups, and credentials are redacted from logs, errors, selection reasons, and every UI surface. **(Fact.)**

## Testing against fakes, verifying against reality

The test strategy is the part most worth stealing. All lifecycle tests run against *deterministic fake cores* — controlled executables built from the repository's own fixtures and exposed through an environment switch — with platform-correct executable names. Real-core verification remains a separate CI job. **(Fact.)** The split is honest in both directions: unit-level behaviour is reproducible and hermetic, and the integration claim ("it actually runs real cores") is verified too, just not conflated with the hermetic suite.

**(Analysis)** this is the same verification doctrine that governs [SHEYTAN's Coding Lab](/blog/sheytan-the-local-first-laboratory/) and [REP's reasoning protocol](/blog/reasoning-is-a-system-property/#rep-strengthen-the-thinking), applied to a different domain: separate what must be deterministic from what must be real, and never let one impersonate the other.

## The acceleration layer that correctness never depends on

A small C++ layer (batch hashing, CRC-32, URL scanning) sits behind a stable C ABI for measurable speedups — with bit-exact pure-Go fallbacks, built-in or at runtime, so correctness never depends on the native path being present. **(Fact.)** It is the same boundary philosophy as SHEYTAN's native engine, at smaller scale: acceleration is an optimisation, never a dependency of truth.

## Why it is on this site

FreeIran shares the laboratory's constitution with the rest of the [Work](/work/) line: bounded resources, explicit state machines, deterministic selection, honest tests, and a hard refusal to ship telemetry. The repository is public and the current version is 0.5.0: [github.com/Parsaetak/FreeIran](https://github.com/Parsaetak/FreeIran).

Access to information is a precondition for everything else this laboratory builds. The engineering has to deserve the name.
