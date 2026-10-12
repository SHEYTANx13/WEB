---
title: "FreeIran 2026-09: TUN Mode and the Evidence Ladder"
subtitle: "System-wide tunneling through the managed sing-box core — and an evidence ladder that refuses to claim what was not run."
excerpt: "The September research line of FreeIran delivers functional Windows TUN through the managed sing-box core's native dataplane, hardens the activation gate until it fails closed, repairs the Windows GUI startup defect at the root, and proves the repair with a launch test that demands a visible window — not a live process."
description: "FreeIran September research: system-wide TUN through the managed sing-box core, a fail-closed activation gate, and the evidence ladder keeping claims honest."
date: "2026-09-29"
author: "Parsa Tak"
category: "research"
type: "research"
tags: ["FreeIran", "TUN", "sing-box", "networking", "Go", "verification", "Windows", "2026"]
featured: false
project: "freeiran"
topics: ["networking", "verification", "Go", "systems"]
related: ["freeiran-engineering-notes", "building-under-constraints", "sheytan-the-local-first-laboratory"]
cover:
  src: "/blog/images/freeiran-tun-evidence.svg"
  alt: "A red evidence-ladder diagram of five rungs from config check to physical host with the top rung left open, above a TUN adapter and its route table"
  width: 1200
  height: 630
---

[FreeIran](/blog/freeiran-engineering-notes/) is the laboratory's free, open-source VPN configuration manager for Windows — local-first in the strict sense: no account, no cloud, no telemetry. **(Fact — the repository's own description.)** The September research line (v0.11.3 through v0.11.5, current) attacked the hardest technical and epistemic problem the project had left: system-wide tunneling, and the question of what a project is allowed to claim about code it could not run.

## TUN: the managed core is the dataplane

Since v0.11.3, TUN is no longer an honest refusal. The managed, digest-verified sing-box core — the same binary the Cores page installs with pinned-digest verification — IS the TUN dataplane: a native sing-box tun inbound (Wintun-backed) runs the user's active configuration system-wide. There is no second packet engine and no second downloader: the official Wintun driver ships embedded inside the verified sing-box binary and loads from memory. **(Fact — docs/tun.md.)**

Activation is transactional and observed at every step: elevation check, verified managed core, sing-box compatibility validation refused before any mutation, collision-free TUN addressing derived from the live interface table, loop prevention through sing-box's `auto_detect_interface`, and a DNS hijack where plain DNS is answered by sing-box's resolver over the proxy while system adapter DNS is never mutated. And the definition of Active is the sentence I would frame: *"Active is never 'the process started': it is 'the exact session adapter was observed, the covering route state was observed, traffic provably flowed, and no upstream loop was observed'."* **(Fact — quoted from docs/tun.md.)**

## v0.11.4: the activation gate stops accepting weak evidence

The hardening release replaced the two weak observations the first gate accepted. Exact adapter identity: the observed interface must match the recorded FreeIran adapter name AND carry the session's expected address on that same interface — same-address-on-wrong-adapter is rejected. Native route-path observation: before traffic is trusted, the Windows IP Helper forwarding table must show the TUN owning the covering IPv4 routes (the 0.0.0.0/0 default, or the 0.0.0.0/1 + 128.0.0.0/1 pair), and after the tunneled request succeeds, the sing-box process must own NO TCP socket sourced from the TUN address — that sourcing IS the route-loop failure mode. UDP-family outbounds hold no TCP upstream socket, so the verdict honestly reports "not observable through the TCP owner table" instead of guessing. Address selection now fails closed when every IPv4 candidate collides. No netsh, no route.exe, no PowerShell anywhere — lazy syscalls, bounded, fail-closed. **(Fact.)**

## The evidence ladder

What makes TUN mode research rather than a feature announcement is [the evidence ladder](https://github.com/Parsaetak/FreeIran/blob/main/docs/tun.md) in docs/tun.md, where each class is stated at exactly the level actually proven and classes are not interchangeable. Generated-config verification: VERIFIED — the complete TUN document passes `sing-box check` of the real pinned 1.14.1 binary. Linux/unit verification: VERIFIED against deterministic seams. Windows compile verification: VERIFIED. Windows CI behavioural verification: EXECUTED BY CI, which runs no privileged TUN operation. Physical elevated Windows TUN runtime: **NOT VERIFIED** — and the repository deliberately does not claim it. **(Fact.)**

**(Analysis)** this ladder is the laboratory's [measurement discipline](/research/) applied to a network daemon: evidence classes are not interchangeable, and a claim that cannot name its class is not a claim — it is marketing. FreeIran would rather ship a smaller truth than a larger fiction.

## v0.11.5: a GUI defect with a forensic story

The current release root-caused a silent Windows startup failure. The pre-Run tray reconcile dispatched through `application.InvokeAsync`, whose first step dereferences Wails' platform-app handle — which does not exist until `Run()` — and the resulting panic killed the process on the main goroutine after the engine logs were written and before the window was created; a windowsgui binary has no console, so the crash left no visible trace. The repair creates and shows the ONE main window from the `ApplicationStarted` event, where the platform app and message loop exist, making visibility independent of the WebView2 outcome. **(Fact — verified against the pinned wails v3.0.0-beta.19 source.)**

The proof is the part worth stealing: a new Windows-only test launches the ACTUAL built executable — not a smoke flag — in an isolated workspace and fails unless a visible top-level window owned by the launched process is observed natively (user32 EnumWindows, IsWindowVisible, GetWindowThreadProcessId) within a bounded timeout. It distinguishes "process alive" from "GUI visible" and terminates the instance by exact PID. **(Fact.)** The runtime log also shed its metadata — no per-entry wall-clock timestamps, no commit field, no toolchain identifiers; `seq` and the measured `duration_ms`/`status` remain the only evidence. **(Fact.)**

## Why this belongs here

FreeIran carries the laboratory's constitution into the [hardest environment it builds for](/blog/building-under-constraints/): unreliable networks, restricted connectivity, and a Windows host it does not romanticise. The unified adaptive memory controller samples real measurements every two seconds and adapts within hard floors and ceilings with hysteresis; process supervision is kernel-level — job objects, so no orphan core survives; the [software engineering](/software-engineering/) through-line is the same as everywhere else in [Selected Work](/work/): bounded resources, explicit state machines, honest tests. **(Fact.)** The questions behind the engineering sit in the [research programme](/research/). The repository is public: [github.com/Parsaetak/FreeIran](https://github.com/Parsaetak/FreeIran).

Access to information is a precondition for everything else this laboratory builds — and now the tunnel, the memory controller, and the claims about them all obey one law: nothing is Active until it is observed.
