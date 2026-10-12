import type { Metadata } from "next";

import {
  SITE_NAME,
  SITE_OG_IMAGE_HEIGHT,
  SITE_OG_IMAGE_PATH,
  SITE_OG_IMAGE_WIDTH
} from "@/lib/seo";

import {
  requireRouteMeta,
  requireHubMeta
} from "@/lib/routes";

/*
 * CONTENT ROUTE DATA — TOPIC HUBS + IDENTITY ROUTES (v3.1).
 *
 * Single source of truth for the static content documents:
 * /about/, /work/, and the six topic hubs. Every route here is a
 * real, independently useful page rendered from existing verified
 * site material — projects, articles, frameworks. Nothing is
 * fabricated: each article reference, project link and claim below
 * maps to content that already exists on the site or in the public
 * repositories.
 *
 * Laws:
 * - No thin pages: every hub defines the topic, states what I
 *   actually build in that area, lists real projects, links
 *   genuinely related articles, and offers a next exploration path.
 * - Article relationships must be real. An article appears on a hub
 *   only when its subject matter genuinely belongs there.
 * - Anchor text is descriptive, never "read more".
 *
 * This module is server-side data: it imports no generated content
 * and is consumed by app/ pages and article-page helpers only.
 */

export type HubProjectLink = {
  /** Descriptive anchor text — the visible link label. */
  label: string;
  href: string;
  external: boolean;
};

export type HubProject = {
  name: string;
  /** What the system is, in one factual sentence. */
  what: string;
  /** Why it matters, in one sentence. */
  why: string;
  /** Where it lives: repository, specification, scene or route. */
  links: readonly HubProjectLink[];
  /** Short mono tag line (technology or status). */
  meta: string;
};

export type HubArticleRef = {
  slug: string;
  /** The relationship, stated plainly — used as the card note. */
  relationship: string;
};

export type HubCrossLink = {
  label: string;
  href: string;
  /** Why this destination is the natural next step. */
  note: string;
  external: boolean;
};

export type HubDefinition = {
  /** Route path segment, e.g. "local-ai" → /local-ai/. */
  slug: string;
  /** The topic as a plain concept name (schema.org `about` value). */
  topicName: string;
  kicker: string;
  /** Full <title> — unique per route, ends with the site name. */
  metaTitle: string;
  /** Unique meta description / WebPage.description. */
  metaDescription: string;
  h1: string;
  /** Lead paragraphs directly under the H1. */
  lead: readonly string[];
  /** "What I work on here" — titled focus areas. */
  focus: readonly { title: string; body: string }[];
  projects: readonly HubProject[];
  articles: readonly HubArticleRef[];
  crossLinks: readonly HubCrossLink[];
  /** Next exploration path — closing guidance, never a dead end. */
  nextStep: {
    text: string;
    links: readonly HubCrossLink[];
  };
};

/* -------------------------------------------------------------------------- */
/* Identity + portfolio route definitions (metadata from the route registry)   */
/* -------------------------------------------------------------------------- */

/*
 * SEO v2: titles and descriptions live ONCE in data/routes.json (the
 * canonical route registry) — these definitions reference them instead
 * of maintaining a second copy. lib/routes.requireRouteMeta throws at
 * module init if a route is unregistered, so registry drift fails the
 * build instead of shipping thin metadata.
 */

export const ABOUT_ROUTE = {
  slug: "about",
  metaTitle: requireRouteMeta("about").title,
  metaDescription: requireRouteMeta("about").description
} as const;

export const WORK_ROUTE = {
  slug: "work",
  metaTitle: requireRouteMeta("work").title,
  metaDescription: requireRouteMeta("work").description
} as const;

export const RESEARCH_ROUTE = {
  slug: "research",
  metaTitle: requireRouteMeta("research").title,
  metaDescription: requireRouteMeta("research").description
} as const;

export const CONTACT_ROUTE = {
  slug: "contact",
  metaTitle: requireRouteMeta("contact").title,
  metaDescription: requireRouteMeta("contact").description
} as const;

/* -------------------------------------------------------------------------- */
/* Topic hubs                                                                  */
/* -------------------------------------------------------------------------- */

export const HUB_ROUTES: readonly HubDefinition[] = [
  {
    slug: "local-ai",
    topicName: requireHubMeta("local-ai").topicName,
    kicker: "TOPIC HUB / LOCAL AI",
    metaTitle: requireHubMeta("local-ai").title,
    metaDescription:
      requireHubMeta("local-ai").description,
    h1: "Local AI systems that run entirely on your machine",
    lead: [
      "Local AI is the practice of running the whole intelligence stack — model inference, agent logic, tools, memory, evaluation — on hardware you control, with no account, no cloud backend, and no telemetry leaving the machine. It is the founding discipline of this laboratory, not a deployment afterthought.",
      "The work is shaped by one conviction: an AI system you cannot run, inspect, and verify locally is a system you can never fully trust. Everything below is built and documented under that rule."
    ],
    focus: [
      {
        title: "Local agent architecture",
        body: "SHEYTAN Local Agent runs a supervised agent loop on your desktop: the model proposes, governed tools execute, and objective verification gates decide whether the work actually succeeded — the model is never the authority on its own success."
      },
      {
        title: "Managed local inference",
        body: "SHEYTAN manages a llama.cpp server end to end — download, launch, health check, bounded auto-restart, and version updates when a model needs them — so local inference is an engineered lifecycle, not a script."
      },
      {
        title: "Context and memory discipline",
        body: "Long-context memory and recall with measured context budgets: what enters the prompt is a deliberate engineering decision, not whatever happens to fit."
      },
      {
        title: "Local-first beyond AI",
        body: "The same local-first constitution governs the laboratory's non-AI software: FreeIran runs with no account and no remote telemetry, storing its state in checksummed local files."
      }
    ],
    projects: [
      {
        name: "SHEYTAN Local Agent",
        what: "A local-first desktop AI engineering laboratory: managed llama.cpp inference, a supervised agent loop, isolated coding workspaces, long-context memory, and objective verification gates.",
        why: "It proves that a serious agent workflow — proposal, execution, verification — can run entirely on your own hardware.",
        meta: "GO · WAILS V3 · LLAMA.CPP · REACT",
        links: [
          {
            label: "SHEYTAN repository on GitHub",
            href: "https://github.com/Parsaetak/SHEYTAN-local-agent",
            external: true
          },
          {
            label: "Inside SHEYTAN's local-first laboratory — field notes",
            href: "/blog/sheytan-the-local-first-laboratory/",
            external: false
          }
        ]
      },
      {
        name: "FreeIran",
        what: "A free, open-source VPN configuration manager for Windows with a Go multi-core runtime, chunked local storage, and no telemetry of any kind.",
        why: "The strict local-first contract — local state, local control, nothing phoning home — applied to everyday software under hostile network conditions.",
        meta: "GO · XRAY · V2RAY · SING-BOX",
        links: [
          {
            label: "FreeIran repository on GitHub",
            href: "https://github.com/Parsaetak/FreeIran",
            external: true
          },
          {
            label: "FreeIran engineering notes",
            href: "/blog/freeiran-engineering-notes/",
            external: false
          }
        ]
      }
    ],
    articles: [
      {
        slug: "sheytan-the-local-first-laboratory",
        relationship: "The complete architecture of the local-first agent laboratory"
      },
      {
        slug: "freeiran-engineering-notes",
        relationship: "Local-first engineering under unreliable networks, without telemetry"
      },
      {
        slug: "building-under-constraints",
        relationship: "What a no-server, static-only deployment teaches about building with AI"
      }
    ],
    crossLinks: [
      {
        label: "AI systems engineering",
        href: "/ai-systems/",
        note: "The framework layer that governs local agents",
        external: false
      },
      {
        label: "AI reasoning architectures",
        href: "/ai-reasoning/",
        note: "How reasoning is structured as a system property",
        external: false
      },
      {
        label: "Selected Work",
        href: "/work/",
        note: "Every system in one indexable document",
        external: false
      }
    ],
    nextStep: {
      text: "Next exploration path:",
      links: [
        {
          label: "SHEYTAN's local-first AI architecture",
          href: "/blog/sheytan-the-local-first-laboratory/",
          note: "Start with the flagship local system",
          external: false
        },
        {
          label: "How AI systems are governed",
          href: "/ai-systems/",
          note: "Then climb one layer to the framework level",
          external: false
        }
      ]
    }
  },

  {
    slug: "ai-systems",
    topicName: requireHubMeta("ai-systems").topicName,
    kicker: "TOPIC HUB / AI SYSTEMS",
    metaTitle: requireHubMeta("ai-systems").title,
    metaDescription:
      requireHubMeta("ai-systems").description,
    h1: "AI systems: governance, tools, and verification as one architecture",
    lead: [
      "An AI system is not a model — it is the model plus its instructions, tools, memory, evaluation, and failure handling, arranged so the whole thing can be audited and improved. This hub collects the frameworks and systems built under that definition.",
      "The unifying rule across all of them: capability without direction is not yet a system. Governance, reasoning, and measurement are load-bearing components, not documentation."
    ],
    focus: [
      {
        title: "Constitutional operating frameworks",
        body: "AI Instructions defines a five-tier operating constitution for AI systems: instruction hierarchy, evidence handling, tools, context, security, memory, and self-governance — one governing layer above the reasoning and the runtime."
      },
      {
        title: "System enhancement discipline",
        body: "USEF — the Unified System Enhancement Framework — is the repeatable loop used to find weaknesses, redesign components, test consequences, measure results, and iterate systems over time."
      },
      {
        title: "Agents with governed tools",
        body: "SHEYTAN puts the frameworks to work: seventeen governed tools, isolated coding workspaces, and verification gates so the agent's autonomy is always bounded by objective checks."
      },
      {
        title: "Engineering under constraints",
        body: "Building systems with AI is itself a systems problem: the building-under-constraints notes document how a static-only, no-server deployment disciplines AI-assisted engineering."
      }
    ],
    projects: [
      {
        name: "AI Instructions",
        what: "A constitutional operating framework for AI systems, published and versioned as a public document.",
        why: "It gives every other system in the laboratory the same enforceable operating law.",
        meta: "FRAMEWORK · GOVERNANCE",
        links: [
          {
            label: "AI Instructions: the constitutional operating framework — article",
            href: "/blog/ai-instructions/",
            external: false
          }
        ]
      },
      {
        name: "REP — Reasoning Enhancement Protocol",
        what: "Structures reasoning through decomposition, verification, critique, adversarial checking, uncertainty handling, and iterative refinement.",
        why: "Reasoning becomes a property the system enforces, not a talent the model happens to have.",
        meta: "FRAMEWORK · REASONING",
        links: [
          {
            label: "Reasoning as a system property — article",
            href: "/blog/reasoning-is-a-system-property/",
            external: false
          },
          {
            label: "The Systems scene for the full framework presentation",
            href: "/#systems",
            external: false
          }
        ]
      },
      {
        name: "SHEYTAN Local Agent",
        what: "The desktop agent laboratory where the frameworks run against real engineering tasks.",
        why: "A framework that has never run a real task is a draft; SHEYTAN is where drafts become systems.",
        meta: "GO · WAILS V3 · LLAMA.CPP",
        links: [
          {
            label: "SHEYTAN repository on GitHub",
            href: "https://github.com/Parsaetak/SHEYTAN-local-agent",
            external: true
          }
        ]
      }
    ],
    articles: [
      {
        slug: "ai-instructions",
        relationship: "The constitutional layer that governs every AI system here"
      },
      {
        slug: "building-under-constraints",
        relationship: "AI-assisted engineering as a discipline, under real deployment constraints"
      },
      {
        slug: "sheytan-the-local-first-laboratory",
        relationship: "The frameworks executing inside a real agent system"
      },
      {
        slug: "reasoning-is-a-system-property",
        relationship: "Why reasoning belongs to the system, not the model"
      }
    ],
    crossLinks: [
      {
        label: "AI reasoning architectures",
        href: "/ai-reasoning/",
        note: "The reasoning layer of the same architecture",
        external: false
      },
      {
        label: "AI evaluation and benchmarks",
        href: "/ai-evaluation/",
        note: "How system capability is measured honestly",
        external: false
      },
      {
        label: "Local AI systems & agents",
        href: "/local-ai/",
        note: "Where these systems physically run",
        external: false
      }
    ],
    nextStep: {
      text: "Next exploration path:",
      links: [
        {
          label: "AI Instructions — the constitutional operating framework",
          href: "/blog/ai-instructions/",
          note: "Read the governing document first",
          external: false
        },
        {
          label: "AI reasoning architectures",
          href: "/ai-reasoning/",
          note: "Then see how reasoning itself is structured",
          external: false
        }
      ]
    }
  },

  {
    slug: "ai-reasoning",
    topicName: requireHubMeta("ai-reasoning").topicName,
    kicker: "TOPIC HUB / AI REASONING",
    metaTitle: requireHubMeta("ai-reasoning").title,
    metaDescription:
      requireHubMeta("ai-reasoning").description,
    h1: "Reasoning is a system property, not a model feature",
    lead: [
      "A model proposes; a system decides. Reasoning that lives only inside the model's next token cannot be inspected, corrected, or trusted — so the laboratory treats reasoning as something you architect: decomposed into steps, checked against evidence, adversarially reviewed, and refined under explicit uncertainty handling.",
      "That position has a practical form: the Reasoning Enhancement Protocol (REP), and a design rule that shows up in every system here — verification is load-bearing."
    ],
    focus: [
      {
        title: "The Reasoning Enhancement Protocol",
        body: "REP structures thinking through decomposition, verification, critique, adversarial checking, uncertainty handling, and iterative refinement — a protocol the system enforces, independent of which model is attached."
      },
      {
        title: "Verification-first agent design",
        body: "In SHEYTAN, the reasoning loop ends at an objective gate: work is judged by checks, not by the model's confidence. The plan-verify loop is REP made executable."
      },
      {
        title: "Reasoning you can measure",
        body: "Reasoning claims feed the UHIT measurement programme: if a system says it reasons better, a benchmark has to be able to test that — which is where evaluation takes over."
      }
    ],
    projects: [
      {
        name: "REP — Reasoning Enhancement Protocol",
        what: "A protocol that turns reasoning into an enforced system behaviour: decomposition, verification, critique, adversarial checking, uncertainty handling, refinement.",
        why: "It is the difference between a model that sounds rigorous and a system that is.",
        meta: "FRAMEWORK · REASONING",
        links: [
          {
            label: "Reasoning Is a System Property — the REP article",
            href: "/blog/reasoning-is-a-system-property/",
            external: false
          },
          {
            label: "The Systems scene presentation",
            href: "/#systems",
            external: false
          }
        ]
      },
      {
        name: "SHEYTAN Local Agent",
        what: "The agent laboratory whose loop is plan → execute → verify, with objective gates.",
        why: "The executable proof that protocol-driven reasoning survives contact with real tasks.",
        meta: "GO · WAILS V3 · LLAMA.CPP",
        links: [
          {
            label: "SHEYTAN repository on GitHub",
            href: "https://github.com/Parsaetak/SHEYTAN-local-agent",
            external: true
          }
        ]
      }
    ],
    articles: [
      {
        slug: "reasoning-is-a-system-property",
        relationship: "The core argument and the REP protocol itself"
      },
      {
        slug: "ai-instructions",
        relationship: "The constitutional layer operating above the reasoning protocol"
      },
      {
        slug: "measuring-machine-intelligence",
        relationship: "How reasoning claims are tested instead of trusted"
      }
    ],
    crossLinks: [
      {
        label: "AI evaluation and benchmarks",
        href: "/ai-evaluation/",
        note: "Where reasoning claims meet measurement",
        external: false
      },
      {
        label: "AI systems engineering",
        href: "/ai-systems/",
        note: "The governance layer around the reasoning layer",
        external: false
      }
    ],
    nextStep: {
      text: "Next exploration path:",
      links: [
        {
          label: "Reasoning Is a System Property",
          href: "/blog/reasoning-is-a-system-property/",
          note: "The full argument, with REP",
          external: false
        },
        {
          label: "How machine intelligence is measured",
          href: "/ai-evaluation/",
          note: "Then see how the claims are tested",
          external: false
        }
      ]
    }
  },

  {
    slug: "ai-evaluation",
    topicName: requireHubMeta("ai-evaluation").topicName,
    kicker: "TOPIC HUB / AI EVALUATION",
    metaTitle: requireHubMeta("ai-evaluation").title,
    metaDescription:
      requireHubMeta("ai-evaluation").description,
    h1: "Evaluation: measurement before claims",
    lead: [
      "Evaluation is where AI work earns its vocabulary. Before a system is called intelligent, capable, or improved, something has to measure it — and the measurement itself has to be immune to gaming. This hub collects the laboratory's measurement work and its doctrine.",
      "The public form today is the UHIT measurement programme: the AIST-2026.09 standard and the ASI-100-Elite-2026.09 benchmark, built on one rule — an ungameable benchmark is the only benchmark worth scoring."
    ],
    focus: [
      {
        title: "The UHIT measurement programme",
        body: "Universal Human Intelligence Test is the laboratory's measurement arm: adaptive frameworks for measuring intelligence, reasoning, transfer, and human-AI performance, published as open specifications."
      },
      {
        title: "Multiplicative, verification-first scoring",
        body: "AIST-2026.09 treats capability as multiplicative and verification as a load-bearing factor: an unverified ability does not count as an ability, and zero-collapse defense factors keep inflated scores from surviving."
      },
      {
        title: "Verification inside systems, not only benchmarks",
        body: "The same doctrine runs inside the systems: SHEYTAN's agent loop ends at objective verification gates, and FreeIran's test suite separates deterministic fakes from real-core verification."
      }
    ],
    projects: [
      {
        name: "UHIT",
        what: "The measurement arm of the laboratory — the umbrella programme for intelligence measurement.",
        why: "It gives every framework and system here an honest scoreboard.",
        meta: "MEASUREMENT PROGRAMME",
        links: [
          {
            label: "Measuring Machine Intelligence — the UHIT article",
            href: "/blog/measuring-machine-intelligence/",
            external: false
          },
          {
            label: "UHIT specifications on GitHub (AI-Tests branch)",
            href: "https://github.com/Parsaetak/Contents/tree/AI-Tests",
            external: true
          }
        ]
      },
      {
        name: "AIST-2026.09",
        what: "The AI Smartness Test: a psychometric measurement framework and self-evolution engine for frontier AI systems.",
        why: "It defines operational intelligence precisely enough to be tested — and failed.",
        meta: "STANDARD · 2026.09",
        links: [
          {
            label: "Read the AIST-2026.09 specification on GitHub",
            href: "https://github.com/Parsaetak/Contents/blob/AI-Tests/AIST-2026.09.md",
            external: true
          }
        ]
      },
      {
        name: "ASI-100-Elite-2026.09",
        what: "A frontier benchmark: ten batteries, one hundred engineered items, multiplicative scoring, and a twelve-class failure taxonomy.",
        why: "It is the concrete instrument — engineered items, not vibes — behind the measurement doctrine.",
        meta: "BENCHMARK · 2026.09",
        links: [
          {
            label: "Read the ASI-100-Elite-2026.09 benchmark on GitHub",
            href: "https://github.com/Parsaetak/Contents/blob/AI-Tests/ASI-100-Elite-2026.09.md",
            external: true
          }
        ]
      }
    ],
    articles: [
      {
        slug: "measuring-machine-intelligence",
        relationship: "The UHIT doctrine and both public specifications, explained"
      },
      {
        slug: "reasoning-is-a-system-property",
        relationship: "Why verification — the core of evaluation — is a system property"
      },
      {
        slug: "sheytan-the-local-first-laboratory",
        relationship: "Objective verification gates inside a working agent system"
      }
    ],
    crossLinks: [
      {
        label: "AI reasoning architectures",
        href: "/ai-reasoning/",
        note: "The claims that evaluation tests",
        external: false
      },
      {
        label: "AI systems engineering",
        href: "/ai-systems/",
        note: "The systems being measured",
        external: false
      }
    ],
    nextStep: {
      text: "Next exploration path:",
      links: [
        {
          label: "How the machine-intelligence measurement system works",
          href: "/blog/measuring-machine-intelligence/",
          note: "Start with the measurement article",
          external: false
        },
        {
          label: "The AIST and ASI-100 specifications",
          href: "https://github.com/Parsaetak/Contents/tree/AI-Tests",
          note: "Then read the primary documents",
          external: true
        }
      ]
    }
  },

  {
    slug: "software-engineering",
    topicName: requireHubMeta("software-engineering").topicName,
    kicker: "TOPIC HUB / SOFTWARE ENGINEERING",
    metaTitle: requireHubMeta("software-engineering").title,
    metaDescription:
      requireHubMeta("software-engineering").description,
    h1: "Software engineering: bounded systems, honest tests, fast static architecture",
    lead: [
      "The software line of this laboratory is about discipline more than scale: bounded resources, explicit state machines, deterministic selection, storage that survives crashes, and tests that do not lie. The systems are public; the engineering notes document why they are built the way they are.",
      "A second thread runs through everything: building with AI as a real engineering practice — under constraints, with verification, never on vibes."
    ],
    focus: [
      {
        title: "Deterministic pipelines and honest testing",
        body: "FreeIran's Go engine runs a bounded FETCH → PARSE → NORMALIZE → VALIDATE → DEDUP → PERSIST pipeline with a deterministic fake-core test harness — unit behaviour stays hermetic while real-core claims are verified separately."
      },
      {
        title: "Storage and state that survive reality",
        body: "Checksummed immutable chunk files, write-ahead journals, atomic commits, and crash recovery — the unglamorous layer where most desktop software quietly rots."
      },
      {
        title: "Static-site architecture",
        body: "This website is itself an engineering artifact: a statically exported Next.js application with a build-time content pipeline, a generated SEO graph, and a verified link graph — documented in the anatomy notes."
      },
      {
        title: "Building with AI under constraints",
        body: "The building-under-constraints notes turn a no-server deployment into a general discipline for AI-assisted engineering: make expensive operations happen at the right time, in the right size, and fail loudly."
      }
    ],
    projects: [
      {
        name: "FreeIran",
        what: "A free, open-source VPN configuration manager for Windows: Go multi-core runtime, chunked local storage, C++ acceleration behind pure-Go fallbacks.",
        why: "Production software for hostile network conditions, engineered so correctness never depends on the fast path.",
        meta: "GO · XRAY · V2RAY · SING-BOX",
        links: [
          {
            label: "FreeIran repository on GitHub",
            href: "https://github.com/Parsaetak/FreeIran",
            external: true
          },
          {
            label: "FreeIran engineering notes — determinism and honest testing",
            href: "/blog/freeiran-engineering-notes/",
            external: false
          }
        ]
      },
      {
        name: "WEB — this website",
        what: "A statically exported Next.js 16 application: living-world homepage, markdown-driven blog, generated sitemap, and a static SEO verifier that runs on every build.",
        why: "It demonstrates that a personal site can be both an expressive artifact and a disciplined engineering system.",
        meta: "NEXT.JS 16 · REACT 19 · STATIC EXPORT",
        links: [
          {
            label: "How this static Next.js site is engineered — the anatomy article",
            href: "/blog/the-anatomy-of-a-fast-static-site/",
            external: false
          },
          {
            label: "WEB repository on GitHub",
            href: "https://github.com/Parsaetak/WEB",
            external: true
          }
        ]
      },
      {
        name: "Contents",
        what: "The multi-branch content infrastructure repository that publishes specifications, frameworks, and books, and feeds this site's media collection through a validated manifest.",
        why: "Content is infrastructure: versioned, validated, and pipeline-fed like everything else.",
        meta: "SPECS · BOOKS · MANIFEST",
        links: [
          {
            label: "Contents repository on GitHub",
            href: "https://github.com/Parsaetak/Contents",
            external: true
          }
        ]
      }
    ],
    articles: [
      {
        slug: "freeiran-engineering-notes",
        relationship: "Determinism, chunked storage, and honest testing in a Go system"
      },
      {
        slug: "the-anatomy-of-a-fast-static-site",
        relationship: "The full engineering story of this static site"
      },
      {
        slug: "building-under-constraints",
        relationship: "The no-server discipline behind AI-assisted engineering here"
      },
      {
        slug: "why-the-website-is-a-living-system",
        relationship: "How the living-system architecture is actually built"
      }
    ],
    crossLinks: [
      {
        label: "Local AI systems & agents",
        href: "/local-ai/",
        note: "Where the same discipline meets AI",
        external: false
      },
      {
        label: "Creative technology",
        href: "/creative-technology/",
        note: "The expressive side of the same engineering",
        external: false
      },
      {
        label: "Selected Work",
        href: "/work/",
        note: "All systems in one document",
        external: false
      }
    ],
    nextStep: {
      text: "Next exploration path:",
      links: [
        {
          label: "How this static Next.js site is engineered",
          href: "/blog/the-anatomy-of-a-fast-static-site/",
          note: "Start with the site you are reading",
          external: false
        },
        {
          label: "FreeIran engineering notes",
          href: "/blog/freeiran-engineering-notes/",
          note: "Then the hardest production constraints",
          external: false
        }
      ]
    }
  },

  {
    slug: "creative-technology",
    topicName: requireHubMeta("creative-technology").topicName,
    kicker: "TOPIC HUB / CREATIVE TECHNOLOGY",
    metaTitle: requireHubMeta("creative-technology").title,
    metaDescription:
      requireHubMeta("creative-technology").description,
    h1: "Creative technology: the living web",
    lead: [
      "Creative technology is the laboratory's expressive line: interfaces that perceive, adapt, and show their state; simulations that treat a website as an ecosystem; and a visual identity — the 13-point star, the red/black world — that is generated and verified like code.",
      "RED THEORY is the model behind it: emergence, adaptation, competition, dissolution, replacement — five dynamics explored on the web itself. RED MAGIC is the instrument: a responsive canvas organism wired into this site."
    ],
    focus: [
      {
        title: "The RED MAGIC organism",
        body: "A responsive canvas organism that turns the website itself into a computational experiment — perception, adaptation, and visible state, with reduced-motion and performance treated as first-class constraints."
      },
      {
        title: "Living-system modelling",
        body: "RED THEORY formalizes the dynamics: emergence, adaptation, competition, dissolution, replacement — applied to the web as a living environment rather than a page stack."
      },
      {
        title: "Computational identity",
        body: "The 13-point star brand system is generated by script, rasterized deterministically, and verified in the build — identity as a computational artifact, not a static logo."
      },
      {
        title: "Expressive, yet engineered",
        body: "The living web shares infrastructure with the engineering line: the same static export, the same verification culture — the organism is heavy only where it is safe to be."
      }
    ],
    projects: [
      {
        name: "RED MAGIC",
        what: "The computational-organism experiment living in this website's Magic scene.",
        why: "It is the demonstration that a personal site can behave like an organism instead of a brochure.",
        meta: "CANVAS · ADAPTATION · EXPERIMENT",
        links: [
          {
            label: "Red Theory and the Living Web — the theory article",
            href: "/blog/red-theory-and-the-living-web/",
            external: false
          },
          {
            label: "The Magic scene — experience the organism",
            href: "/#magic",
            external: false
          }
        ]
      },
      {
        name: "RED MAGIC books",
        what: "RED MAGIC, MAGIC FOR KIDS, and THE BOOK OF THE DEMIURGE — the written form of the ideas, readable in the Media collection.",
        why: "The ideas survive outside the canvas, in long-form writing.",
        meta: "BOOKS · MEDIA",
        links: [
          {
            label: "The Media scene — the books",
            href: "/#media",
            external: false
          }
        ]
      },
      {
        name: "WEB — the living system itself",
        what: "The statically engineered website that hosts the organism.",
        why: "The medium is the artifact: the living web is built, not painted.",
        meta: "NEXT.JS 16 · STATIC EXPORT",
        links: [
          {
            label: "Why this website is a living system",
            href: "/blog/why-the-website-is-a-living-system/",
            external: false
          }
        ]
      }
    ],
    articles: [
      {
        slug: "red-theory-and-the-living-web",
        relationship: "The five dynamics behind the living web"
      },
      {
        slug: "why-the-website-is-a-living-system",
        relationship: "Why the site behaves like an organism, and what that costs"
      },
      {
        slug: "the-anatomy-of-a-fast-static-site",
        relationship: "The engineering that keeps the organism fast"
      }
    ],
    crossLinks: [
      {
        label: "Software engineering",
        href: "/software-engineering/",
        note: "The discipline underneath the art",
        external: false
      },
      {
        label: "Selected Work",
        href: "/work/",
        note: "The creative line in professional context",
        external: false
      }
    ],
    nextStep: {
      text: "Next exploration path:",
      links: [
        {
          label: "Red Theory and the Living Web",
          href: "/blog/red-theory-and-the-living-web/",
          note: "Start with the theory",
          external: false
        },
        {
          label: "Why this website is a living system",
          href: "/blog/why-the-website-is-a-living-system/",
          note: "Then see it applied to this very site",
          external: false
        }
      ]
    }
  }
];

/* -------------------------------------------------------------------------- */
/* Article ↔ hub graph                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Primary topic hub for each article. Used by article pages to emit
 * one crawlable "TOPIC HUB" chip, giving every article a real edge
 * into the hub graph. One hub per article — the honest primary
 * home; secondary relationships live inside the hub pages.
 */
export const ARTICLE_PRIMARY_HUB: Readonly<Record<string, string>> = {
  "sheytan-the-local-first-laboratory": "local-ai",
  "freeiran-engineering-notes": "software-engineering",
  "building-under-constraints": "software-engineering",
  "the-anatomy-of-a-fast-static-site": "software-engineering",
  "ai-instructions": "ai-systems",
  "reasoning-is-a-system-property": "ai-reasoning",
  "measuring-machine-intelligence": "ai-evaluation",
  "red-theory-and-the-living-web": "creative-technology",
  "why-the-website-is-a-living-system": "creative-technology"
};

export function getHubBySlug(slug: string): HubDefinition | null {
  return HUB_ROUTES.find((hub) => hub.slug === slug) ?? null;
}

/**
 * Typed lookup for route files: returns the hub definition or throws
 * at build time. A missing definition must fail the build, never
 * produce a silently thin page.
 */
export function requireHub(slug: string): HubDefinition {
  const hub = HUB_ROUTES.find((candidate) => candidate.slug === slug);

  if (!hub) {
    throw new Error(`${slug} hub definition missing from lib/hubs.ts`);
  }

  return hub;
}

export function getHubForArticle(slug: string): HubDefinition | null {
  const hubSlug = ARTICLE_PRIMARY_HUB[slug];
  return hubSlug ? getHubBySlug(hubSlug) : null;
}

/* -------------------------------------------------------------------------- */
/* Base-path-aware href helper (server-side, build-time inlined)               */
/* -------------------------------------------------------------------------- */

/**
 * Prefix a root-relative href with the deployment basePath. The env
 * value is inlined at build time by Next (mirrors next.config.ts /
 * app/layout.tsx), so plain anchors render /WEB-aware URLs on GitHub
 * Pages and clean URLs locally — the same discipline as
 * app/not-found.tsx. Content routes use plain <a> elements instead
 * of next/link so the documents ship with zero client JavaScript.
 */
export function routeHref(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${base}${path}`;
}

/* -------------------------------------------------------------------------- */
/* Shared metadata builder for every content route                             */
/* -------------------------------------------------------------------------- */

export type ContentMetadataInput = {
  route: string;
  title: string;
  description: string;
  ogAlt: string;
};

/**
 * Route metadata for the static content documents: unique title and
 * description, canonical /OG/Twitter URLs resolved against the
 * production metadataBase (which already carries /WEB), and the
 * site-level OG image. The root layout contributes the Search
 * Console verification token, favicon family, and robots default.
 *
 * v4.0.4: the Twitter image carries its alt text through the object
 * form (the bare-string form cannot express twitter:image:alt), so
 * the card metadata stays coherent with the og:image declaration.
 */
export function contentRouteMetadata({
  route,
  title,
  description,
  ogAlt
}: ContentMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: `/${route}/`
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: `/${route}/`,
      siteName: SITE_NAME,
      images: [
        {
          url: SITE_OG_IMAGE_PATH,
          width: SITE_OG_IMAGE_WIDTH,
          height: SITE_OG_IMAGE_HEIGHT,
          alt: ogAlt
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        {
          url: SITE_OG_IMAGE_PATH,
          alt: ogAlt
        }
      ]
    },
    robots: {
      index: true,
      follow: true
    }
  };
}
