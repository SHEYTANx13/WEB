---
title: "Measuring Machine Intelligence"
subtitle: "The UHIT measurement programme: what a benchmark has to verify before the word intelligence is allowed anywhere near the score."
excerpt: "UHIT is the measurement arm of this laboratory, and its public form today is two canonical specifications — AIST-2026.09 and ASI-100-Elite-2026.09 — built on one doctrine: capability is multiplicative, verification is a load-bearing factor, and an ungameable benchmark is the only benchmark worth scoring."
description: "Inside the UHIT measurement programme: the AIST-2026.09 standard and the ASI-100-Elite benchmark — verified operational intelligence, multiplicative scoring, zero-collapse defense factors, and the honesty rules that keep a benchmark from lying."
date: "2026-09-12"
author: "Parsa Tak"
category: "research"
type: "research"
tags: ["UHIT", "AIST", "ASI-100", "measurement", "verification", "benchmarks", "2026"]
featured: false
project: "uhit"
topics: ["measurement", "verification", "benchmarks", "operational intelligence"]
related: ["reasoning-is-a-system-property", "ai-instructions"]
cover:
  src: "/blog/images/measuring-intelligence.svg"
  alt: "A red instrument dial with weighted battery bars beside it and one factor zeroed out"
  width: 1200
  height: 630
---

Every frontier lab now publishes capability numbers, and almost none of them publish the thing that actually fails in production: does the system verify its own work, refuse what it is not authorised to do, and stay correct over a long, adversarial session? The [Selected Work document](/work/) of this site calls the research line attacking that gap **UHIT — the Universal Human Intelligence Test**: an adaptive framework for measuring intelligence, reasoning, transfer, and human-AI performance. This article documents what UHIT publicly is today, what it measures, and — just as deliberately — what it does not claim.

A register note first, in the house style: what the two specification documents say is **fact** and checkable in their sources; what the design implies is **analysis**; where I commit to a position, it is marked as mine.

## The public artifacts

The measurement programme has two canonical, publicly readable specifications, maintained in the [`AI-Tests` branch of Parsaetak/Contents](https://github.com/Parsaetak/Contents/tree/AI-Tests):

- [**AIST-2026.09**](https://github.com/Parsaetak/Contents/blob/AI-Tests/AIST-2026.09.md) — the *AI Smartness Test*: a Universal Operational Intelligence Standard, psychometric measurement framework, and self-evolution engine for frontier AI systems. **(Fact — the document's own header.)**
- [**ASI-100-Elite-2026.09**](https://github.com/Parsaetak/Contents/blob/AI-Tests/ASI-100-Elite-2026.09.md) — the *AI Smartness Index*: a frontier benchmark of ten batteries and one hundred engineered items (Q001–Q100), whose weights sum to exactly 100%, with a twelve-class canonical failure taxonomy (F1–F12). **(Fact — the document's own structure table.)**

Both documents descend from the same lineage as the frameworks described in [Reasoning Is a System Property](/blog/reasoning-is-a-system-property/) and [AI Instructions](/blog/ai-instructions/) — the ASI-100 header names AI Instructions, USEF, and REP as its framework lineage explicitly. **(Fact.)** The measurement arm and the governance arm of this research are one programme, not two.

## Verified operational intelligence, not conversational fluency

The central measurement decision, stated in both documents, is a refusal: these benchmarks do not measure fluency, trivia recall, confidence, or style. They measure *verified operational intelligence* — the composite ability to reason correctly, know what is not known, distinguish evidence from assumption, refuse unauthorized or destructive actions, verify work mechanically, and maintain state over long horizons. **(Fact — the standards' stated scope.)**

The reasoning is the one this whole laboratory is built on. A system that fabricates citations, executes nothing while claiming execution, or obeys instructions embedded in retrieved documents can pass every static knowledge benchmark and still be unusable the moment it acts. So the benchmarks score the intersection conventional evaluation leaves unmeasured: capability under adversarial conditions, with verification, authorization, and state integrity enforced as first-class constraints.

## Multiplicative intelligence and the zero that collapses it

ASI-100 Elite operationalises one doctrine worth spelling out, because it is the sharpest single idea in the programme:

> Capability is a *multiplicative* system function. A single zero-valued defense factor — verification, security, authorization — collapses the whole product, regardless of how strong the raw reasoning factor is.

**(Fact — the document's "effective intelligence" model.**) Multiply a 0.95 reasoning score by a 0.0 verification score and the system's usable intelligence is zero: it produces confident, unverified output at scale, which is worse than producing nothing. The scoring architecture encodes that asymmetry structurally rather than penalising it softly. **(Analysis.)** This is the same position [REP takes one level down](/blog/reasoning-is-a-system-property/#rep-strengthen-the-thinking): verification is not a step after thinking, it is a property of the thinking — here promoted from a reasoning discipline to a scoring law.

AIST extends the same doctrine across a much larger surface: twenty public capability domains, sixteen internal engineering batteries with a 0.85/0.15 core/self weight split, a strict `RESULT = INVALID` contract that separates evaluator failures from agent failures, a mandatory fault-injection protocol with detection-rate reporting, and reproducibility tiers that make a scorecard without provenance non-conformant. **(Fact — the standard's structure.)**

## What is deliberately not claimed

The honesty rules are the part I consider most important, because benchmarks drift into fiction the moment measurement becomes marketing:

- AIST declares itself maturity **M0** — a published specification artifact — and states that no maturity level beyond M0 is claimed by specification alone. **(Fact.)**
- No results, no leaderboards, no calibrated baselines, and no psychometric statistics are claimed until empirically measured; placeholder values are labelled provisional, never calibrated. **(Fact — the standards' scientific-honesty sections.)**
- Weights are pre-registered and never adjusted after observing performance; post-hoc weight changes trip the benchmark's own failure gate. **(Fact.)**

**(Position)** this is what separates a measurement instrument from a marketing asset, and it is the rule UHIT will be held to as the programme advances: the framework is allowed to evolve, but it is never allowed to claim numbers it has not produced under its own verification rules.

## Where measurement meets this site

The culture that produced these documents is visible in this website's own engineering: the loading system [refuses fake progress and fake frame-rate claims](/blog/the-anatomy-of-a-fast-static-site/#quality-that-measures-the-display-not-the-myth), the [static pipeline fails loudly](/blog/building-under-constraints/) instead of shipping corrupted content, and the [Systems scene](/#systems) presents the governance frameworks the benchmarks descend from. An instrument that lies about the system it measures is worthless; the same rule applies to a website, a benchmark, and an agent.

The measurement programme is [open on GitHub](https://github.com/Parsaetak/Contents/tree/AI-Tests) alongside the [governance documents](https://github.com/Parsaetak/Contents/tree/AI-frameworks) and the [SHEYTAN laboratory](/blog/sheytan-the-local-first-laboratory/) that puts the verification discipline to work. Measure what fails. Verify what ships. Score nothing you cannot reproduce.
