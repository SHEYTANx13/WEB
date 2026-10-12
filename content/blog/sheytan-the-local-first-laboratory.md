---
title: "SHEYTAN: A Local-First AI Agent Laboratory"
subtitle: "The model proposes. The tools execute. The laboratory verifies."
excerpt: "SHEYTAN Local Agent is a local-first desktop AI engineering environment: a managed llama.cpp engine, a real agent loop, seventeen governed tools, an isolated Coding Lab, and objective verification gates — because the model is never the authority on whether an engineering task succeeded."
description: "How SHEYTAN Local Agent is built: Go orchestration under a Wails v3 desktop shell, a managed llama.cpp lifecycle, the plan-verify agent loop, the isolated Coding Lab with objective verification gates, measured context budgets, and the honest status of its native C++ inference engine."
date: "2026-09-12"
author: "Parsa Tak"
category: "engineering"
type: "work"
tags: ["SHEYTAN", "local-first", "agents", "Go", "llama.cpp", "verification", "2026"]
featured: false
project: "sheytan-local-agent"
topics: ["local-first AI", "agent architecture", "verification", "Go"]
related: ["reasoning-is-a-system-property", "ai-instructions"]
cover:
  src: "/blog/images/sheytan-laboratory.svg"
  alt: "A red layered stack diagram: desktop shell on top, a Go laboratory core in the middle, and two inference engines at the base behind a verification gate"
  width: 1200
  height: 630
---

Most agent demos end at the impressive part: the model produces something plausible and the video cuts. SHEYTAN Local Agent — the flagship of the [AI systems line](/work/) on this site — is built for everything that happens *after* the model speaks. It is a local-first desktop AI engineering environment whose founding rule is the same one this laboratory's [reasoning frameworks](/blog/reasoning-is-a-system-property/) are built on: **the model is never the authority on whether an engineering task succeeded — objective verification is.**

A register note, in the house style: everything below about the system's behaviour is **fact**, checkable in the [public repository](https://github.com/Parsaetak/SHEYTAN-local-agent); interpretation is marked as analysis.

## What it is

SHEYTAN is a single desktop application — current release v1.1.5Z, Windows-first with a Linux build — that runs entirely on your machine: no account, no cloud backend, no remote telemetry. The architecture puts critical execution logic in Go and presentation in a React/TypeScript UI, embedded into the desktop shell via Wails v3. **(Fact — the repository's architecture documentation.)**

The engine is a managed llama.cpp server: SHEYTAN downloads it, launches it, health-checks it, supervises it with bounded auto-restart, and updates it when a model needs a newer version. The engine's state machine is backend-authoritative and fanned out over every activity channel — the UI never invents a state. **(Fact.)**

## The agent loop, with a spine

The agent loop is a real plan-act-verify cycle: plan → tool calls → observations → verification → final answer, with streaming, cancellation, retries, an iteration cap, per-run time budgets, and loop prevention. Timeout and abort are distinguished in the UI, and an abort preserves the partial result instead of discarding it. **(Fact.)**

Seventeen tools are registered — shell, files, code execution, web search, git, browser, data analysis, archive, diff, screenshot, research, memory, and more — each with argument validation and schemas measured exactly before they are windowed into the context plan. **(Fact.)**

## The Coding Lab: verification as a gate

The most distinctive component is the Coding Lab, where engineering work happens in isolation:

- **Isolated workspace copies** — the lab works on copies, symlinks skipped, `.git` excluded, before anything is promoted back.
- **Command policy** — a lexical policy denies dangerous, networked, interactive, and escape-pattern commands, with expansion-token hardening.
- **Objective verification gates** — every task must pass mechanical checks, and the verifier rejects trivially self-satisfying checks (an `echo`-style probe that cannot fail is rejected as evidence). **(Fact — the repository's own summary.)**
- **Bounded repair loops** — failed verification triggers a repair pass with repeat-command detection, and a snapshot is taken before any promotion.
- **Bounded output** — tool output is capped (2 MiB), environments are sanitised, and secrets are scrubbed.

**(Analysis)** this is [AI Instructions'](https://github.com/Parsaetak/Contents/tree/AI-frameworks) governance thesis compiled into process discipline: the environment an agent runs in decides its behaviour, so the environment — not the prompt — carries the guarantees. The application even ships its own `AI-CONTEXT.md` as the model's operating manual, sitting next to the executable.

## Context as an engineering problem

Long sessions are treated as a measurement problem, not a hope: context plans budget the window across system, tools, recall, attachments, and history with explicit priorities; chunking happens at paragraph boundaries; a content-keyed cache avoids reprocessing; and when a session outgrows its window, the *continuum* distils facts, decisions, and open threads into a fresh chapter session automatically. Memory is trust-classed (M1–M7, with external material quarantined), and recall is BM25 with a recency boost steered by persistent user feedback. **(Fact.)**

## The native engine: an honest boundary decision

Version 1.1.5Z introduced a native C++ inference engine behind a narrow C ABI, supervised by Go as a subprocess over a length-prefixed JSON IPC protocol — a deliberate Go↔C++ boundary decision documented in the repository rather than hidden in build flags. Phase 5 implements the real llama-architecture forward pass, real GGUF loading with a bounded memory plan, and measured generation metrics (TTFT, tokens per second, KV positions).

The honesty here matters enough to quote the status literally: the portable scalar C++ forward pass measures *slower* than llama.cpp on the test fixtures, no native-speed claim is made, numerical correctness is pinned against an independent reference, and llama.cpp remains the default engine — the native path is strictly opt-in. **(Fact — the repository's Phase 5 notes.)** A laboratory that measures everything has no room to flatter itself, and that refusal is the point.

## Why this belongs to the AI Systems line

SHEYTAN is where the site's frameworks stop being documents: [REP's](/blog/reasoning-is-a-system-property/#rep-strengthen-the-thinking) verification discipline becomes a gate the code must pass, the [constitutional layer](/blog/ai-instructions/) becomes the shipped operating manual, and the measurement culture of [the UHIT programme](/blog/measuring-machine-intelligence/) becomes per-run metrics that are reported, not advertised. The same Go-first discipline runs through the laboratory's software line — the [FreeIran engineering notes](/blog/freeiran-engineering-notes/) document the proxy-manager runtime built on the same bounded-resource, explicit-state-machine constitution. The repository is public: [github.com/Parsaetak/SHEYTAN-local-agent](https://github.com/Parsaetak/SHEYTAN-local-agent).

The model proposes. The tools execute. The laboratory verifies. Everything else is commentary.
