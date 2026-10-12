/*
 * WORK REGISTRY (v3.9 / v4.0.1) — the canonical data behind the
 * ENTIRE work catalogue: the /work/ document, the article lateral
 * graph, the experiential Work scene (#work) and the homepage's
 * featured subset all render from WORK_ENTRIES.
 *
 * WHY A SHARED MODULE: one catalogue, many surfaces. When an
 * article's `project` matches a registry entry's `blogProject`, the
 * article page can link the canonical Work document with the
 * entry's real name; the Work scene derives its featured and
 * grouped cards from the same entries and their facets. One
 * relationship model, zero duplicated project tables.
 *
 * Field roles:
 * - Document fields (name, type, purpose, what, problem, why, tech,
 *   signal, links, blogProject, coverSlug, articleSlug) feed the
 *   /work/ document and the lateral graph.
 * - Dense-surface fields (code, status, notesLabel, link.short,
 *   facets) exist so compact presentations — the Work scene and the
 *   homepage featured strip — render from the SAME catalogue instead
 *   of maintaining parallel project tables. The /work/ document
 *   ignores them.
 * - `facets` are the sub-systems of an entry that the Work scene
 *   presents as their own cards (REP and USEF inside the framework
 *   family, AIST and ASI-100 inside UHIT, the book line inside RED
 *   MAGIC). They are catalogue facts, not presentation-only data.
 *
 * CONSUMERS: app/work/page.tsx (server), the article lateral graph
 * (server), components/scenes/WorkScene.tsx and its scene model
 * (client chunk — the registry is static data, safe to bundle), and
 * components/scenes/HomeScene.tsx's featured strip (home scene
 * chunk).
 *
 * Laws carried over from the inline table (v3.7):
 * - Every entry condenses verified copy from the repositories and
 *   the field-note articles. Nothing is fabricated.
 * - Covers reuse the Blog's committed article artwork (resolved by
 *   the Work page from the content index), never new fabrications.
 * - `signal` states a measured or structural fact, never a claim.
 */

export type WorkLink = {
  label: string;
  href: string;
  external: boolean;
  /**
   * Dense-surface mono label (Work scene / homepage cards). A link
   * WITHOUT a short label is document-only and is not surfaced on
   * compact presentations.
   */
  short?: string;
};

export type WorkEntry = {
  name: string;
  /** Short mono designation for dense surfaces (scene card chip). */
  code: string;
  type: string;
  /** Lifecycle state shown on dense surfaces; factual. */
  status: string;
  /** One-sentence purpose — the scannable summary above the fold. */
  purpose: string;
  what: string;
  problem: string;
  why: string;
  tech: string;
  /** Key mono signal — measured or structural fact, never a claim. */
  signal: string;
  /**
   * Dense-surface label for the field-notes article link derived
   * from articleSlug (e.g. "FIELD NOTES", "HOW IT WORKS").
   */
  notesLabel?: string;
  /**
   * Blog project filter value — links the card into the Blog's
   * project-filtered content (/blog/?project=…) and the article
   * lateral graph into this registry. Null when the system has no
   * project-tagged writing yet.
   */
  blogProject: string | null;
  /**
   * Additional Blog project values (v3.9) that document this same
   * system under a distinct filter stream. Used only by the lateral
   * graph lookup — the Blog's project filters keep the author's own
   * vocabulary, and the Work document keeps one entry per system.
   * Example: the RED MAGIC line is written about both as the
   * organism (project "red-magic") and as the RED THEORY model
   * (project "red-theory"); both streams belong to the same
   * Selected Work entry.
   */
  blogProjectAliases?: readonly string[];
  /**
   * Article slug whose committed cover becomes the card visual.
   * Null renders the truthful geometric identity card instead.
   */
  coverSlug: string | null;
  links: readonly WorkLink[];
  articleSlug: string | null;
  /**
   * Sub-system facets the Work scene renders as their own grouped
   * cards (see the field-roles note above).
   */
  facets?: readonly WorkFacet[];
};

export type WorkFacet = {
  /** Short mono designation (dense-surface chip). */
  code: string;
  title: string;
  type: string;
  status: string;
  copy: string;
  tags: readonly string[];
  /** Destination: root-relative route, scene hash, or absolute https URL. */
  href: string;
  external: boolean;
  /** Accessible name for the full-card link. */
  ariaLabel: string;
  /** Optional visible mono line naming the destination of a linked card. */
  notes?: string;
};

/*
 * Selected systems, ordered by centrality to the laboratory's
 * mission (unchanged from v3.7 — the order the Work document and
 * its ItemList structured data present).
 */
export const WORK_ENTRIES: readonly WorkEntry[] = [
  {
    name: "SHEYTAN Local Agent",
    code: "SHEYTAN",
    type: "LOCAL-FIRST AI LABORATORY",
    status: "ACTIVE",
    purpose: "A desktop AI engineering environment where the model proposes, governed tools execute, and objective verification decides success.",
    what: "A desktop AI engineering environment: managed llama.cpp inference, a supervised agent loop with seventeen governed tools, isolated coding workspaces, long-context memory and recall, and objective verification gates.",
    problem: "Agent demos end where engineering begins — after the model speaks. Real work needs execution, memory, and a judge that is not the model itself.",
    why: "It proves a serious agent workflow can run entirely locally, with verification — not confidence — deciding whether work succeeded.",
    tech: "GO · WAILS V3 · LLAMA.CPP · REACT",
    signal: "17 GOVERNED TOOLS · PLAN → EXECUTE → VERIFY",
    notesLabel: "FIELD NOTES",
    blogProject: "sheytan-local-agent",
    coverSlug: "sheytan-the-local-first-laboratory",
    links: [
      {
        label: "SHEYTAN repository on GitHub",
        href: "https://github.com/Parsaetak/SHEYTAN-local-agent",
        external: true,
        short: "REPOSITORY ↗"
      },
      {
        label: "The local AI topic hub",
        href: "/local-ai/",
        external: false
      }
    ],
    articleSlug: "sheytan-the-local-first-laboratory"
  },
  {
    name: "UHIT — Universal Human Intelligence Test",
    code: "UHIT",
    type: "INTELLIGENCE MEASUREMENT",
    status: "EVOLVING",
    purpose: "The laboratory's measurement arm: an adaptive framework measuring intelligence, reasoning, transfer, and human-AI performance.",
    what: "The laboratory's measurement arm: an adaptive framework for measuring intelligence, reasoning, transfer, and human-AI performance, public today as the AIST-2026.09 standard and the ASI-100-Elite-2026.09 benchmark.",
    problem: "AI capability claims outrun their evidence; most benchmarks can be gamed, so scores stop meaning anything.",
    why: "It makes measurement honest by design — multiplicative scoring, verification as a load-bearing factor, and engineered items instead of vibes.",
    tech: "AIST · ASI-100 · PSYCHOMETRICS",
    signal: "MULTIPLICATIVE SCORING · VERIFICATION IS LOAD-BEARING",
    notesLabel: "FIELD NOTES",
    blogProject: "uhit",
    coverSlug: "measuring-machine-intelligence",
    links: [
      {
        label: "UHIT specifications on GitHub (AI-Tests branch)",
        href: "https://github.com/Parsaetak/Contents/tree/AI-Tests",
        external: true,
        short: "SPECIFICATIONS ↗"
      },
      {
        label: "AIST-2026.09 specification",
        href: "https://github.com/Parsaetak/Contents/blob/AI-Tests/AIST-2026.09.md",
        external: true
      },
      {
        label: "ASI-100-Elite-2026.09 benchmark",
        href: "https://github.com/Parsaetak/Contents/blob/AI-Tests/ASI-100-Elite-2026.09.md",
        external: true
      },
      {
        label: "The AI evaluation topic hub",
        href: "/ai-evaluation/",
        external: false
      }
    ],
    articleSlug: "measuring-machine-intelligence",
    facets: [
      {
        code: "AIST",
        title: "AIST-2026.09 — AI Smartness Test",
        type: "SPECIFICATION",
        status: "2026.09",
        copy: "The Universal Operational Intelligence Standard: a psychometric measurement framework and self-evolution engine for frontier AI systems.",
        tags: ["MEASUREMENT", "STANDARD"],
        href: "https://github.com/Parsaetak/Contents/blob/AI-Tests/AIST-2026.09.md",
        external: true,
        ariaLabel: "Read the AIST-2026.09 specification on GitHub"
      },
      {
        code: "ASI-100",
        title: "ASI-100-Elite-2026.09 — AI Smartness Index",
        type: "BENCHMARK",
        status: "2026.09",
        copy: "A frontier benchmark of ten batteries and one hundred engineered items, with multiplicative scoring and a twelve-class failure taxonomy.",
        tags: ["BENCHMARK", "EVALUATION"],
        href: "https://github.com/Parsaetak/Contents/blob/AI-Tests/ASI-100-Elite-2026.09.md",
        external: true,
        ariaLabel: "Read the ASI-100-Elite-2026.09 benchmark on GitHub"
      }
    ]
  },
  {
    name: "FreeIran",
    code: "FREEIRAN",
    type: "OPEN-SOURCE VPN MANAGER",
    status: "PRODUCTION",
    purpose: "A free, open-source VPN configuration manager for Windows built around a Go multi-core runtime and local-first storage.",
    what: "A lightweight, free, open-source VPN configuration manager for Windows: a Go multi-core runtime that discovers, tests, maintains, and runs publicly available proxy configurations, with checksummed chunked local storage.",
    problem: "Connectivity tools for heavily restricted environments are usually closed, heavy, or careless with local state and telemetry.",
    why: "It is local-first software under the hardest conditions: no account, no cloud, no telemetry, deterministic behaviour, and tests that separate fakes from reality.",
    tech: "GO · XRAY · V2RAY · SING-BOX · C++ ABI",
    signal: "NO ACCOUNT · NO CLOUD · NO TELEMETRY",
    notesLabel: "ENGINEERING NOTES",
    blogProject: "freeiran",
    coverSlug: "freeiran-engineering-notes",
    links: [
      {
        label: "FreeIran repository on GitHub",
        href: "https://github.com/Parsaetak/FreeIran",
        external: true,
        short: "REPOSITORY ↗"
      },
      {
        label: "The software engineering topic hub",
        href: "/software-engineering/",
        external: false
      }
    ],
    articleSlug: "freeiran-engineering-notes"
  },
  {
    name: "WEB — this website",
    code: "WEB",
    type: "STATIC LIVING SYSTEM",
    status: "LIVE",
    purpose: "The site you are reading: a statically exported Next.js application that behaves like an organism and verifies its own SEO every build.",
    what: "The site you are reading: a statically exported Next.js application — six hash scenes, a markdown-driven blog, a generated SEO graph, a build-time link verifier, and a canvas organism.",
    problem: "A personal site is usually either expressive or engineered; it is rarely both with the discipline made public.",
    why: "It demonstrates the whole practice in one artifact: living-world UX, static-export performance, and a verified internal graph — every build checks its own SEO.",
    tech: "NEXT.JS 16 · REACT 19 · STATIC EXPORT",
    signal: "STATIC EXPORT · BUILD-TIME SEO VERIFICATION",
    notesLabel: "HOW IT WORKS",
    blogProject: "web-platform",
    coverSlug: "the-anatomy-of-a-fast-static-site",
    links: [
      {
        label: "WEB repository on GitHub",
        href: "https://github.com/Parsaetak/WEB",
        external: true,
        short: "REPOSITORY ↗"
      },
      {
        label: "The live site",
        href: "https://parsaetak.github.io/WEB/",
        external: true,
        short: "LIVE ↗"
      }
    ],
    articleSlug: "the-anatomy-of-a-fast-static-site"
  },
  {
    name: "AI Instructions · REP · USEF",
    code: "AI INSTRUCTIONS · REP · USEF",
    type: "FRAMEWORK FAMILY",
    status: "PUBLIC",
    purpose: "The published framework family governing how AI systems reason, verify, use tools, and improve — one constitution above the runtime.",
    what: "The published framework family: AI Instructions (a five-tier constitutional operating framework for AI systems), REP (the Reasoning Enhancement Protocol), and USEF (the Unified System Enhancement Framework).",
    problem: "AI systems fail without direction: capability needs governance, reasoning needs structure, and improvement needs a repeatable discipline.",
    why: "They are the operating law every other system here runs under — published and versioned as public documents.",
    tech: "GOVERNANCE · REASONING · SYSTEMS",
    signal: "5-TIER CONSTITUTION · PROTOCOL-ENFORCED REASONING",
    blogProject: "ai-frameworks",
    coverSlug: "ai-instructions",
    links: [
      {
        label: "The AI systems topic hub",
        href: "/ai-systems/",
        external: false
      },
      {
        label: "The AI reasoning topic hub",
        href: "/ai-reasoning/",
        external: false
      },
      {
        label: "The Systems scene",
        href: "/#systems",
        external: false
      }
    ],
    articleSlug: "ai-instructions",
    facets: [
      {
        code: "AI INSTRUCTIONS",
        title: "Constitutional Operating Framework",
        type: "FRAMEWORK",
        status: "PUBLIC",
        copy: "A five-tier operating constitution for AI systems: instruction hierarchy, evidence handling, tools, context, security, memory, and self-governance.",
        tags: ["GOVERNANCE", "AI"],
        href: "/blog/ai-instructions/",
        external: false,
        ariaLabel: "Read the AI INSTRUCTIONS article: a constitutional operating framework for AI",
        notes: "NOTES — AI INSTRUCTIONS: A CONSTITUTIONAL OPERATING FRAMEWORK"
      },
      {
        code: "REP",
        title: "Reasoning Enhancement Protocol",
        type: "FRAMEWORK",
        status: "PUBLIC",
        copy: "Structures reasoning through decomposition, verification, critique, adversarial checking, uncertainty handling, and iterative refinement.",
        tags: ["REASONING", "VERIFICATION"],
        href: "#systems",
        external: false,
        ariaLabel: "Open the Systems scene for the REP presentation"
      },
      {
        code: "USEF",
        title: "Unified System Enhancement Framework",
        type: "FRAMEWORK",
        status: "PUBLIC",
        copy: "A discipline for finding weaknesses, redesigning components, testing consequences, measuring results, and iterating systems over time.",
        tags: ["IMPROVEMENT", "SYSTEMS"],
        href: "#systems",
        external: false,
        ariaLabel: "Open the Systems scene for the USEF presentation"
      }
    ]
  },
  {
    name: "Contents",
    code: "CONTENTS",
    type: "CONTENT INFRASTRUCTURE",
    status: "PUBLIC",
    purpose: "The multi-branch repository that publishes the specifications, frameworks, and books — and feeds this site's media collection.",
    what: "The multi-branch repository that publishes the specifications, frameworks, and books — and feeds this site's media collection through a validated manifest.",
    problem: "Specifications and long-form writing drift when they live as loose files.",
    why: "Content is treated as infrastructure: versioned, validated, and pipeline-fed like code.",
    tech: "SPECS · BOOKS · MANIFEST",
    signal: "VERSIONED · VALIDATED · PIPELINE-FED",
    blogProject: null,
    coverSlug: null,
    links: [
      {
        label: "Contents repository on GitHub",
        href: "https://github.com/Parsaetak/Contents",
        external: true
      }
    ],
    articleSlug: null,
    facets: [
      {
        code: "CONTENTS",
        title: "Content Infrastructure",
        type: "REPOSITORY",
        status: "PUBLIC",
        copy: "The multi-branch repository that publishes the specifications, frameworks, and books — and feeds this site's media collection through a validated manifest.",
        tags: ["SPECS", "BOOKS", "MANIFEST"],
        href: "https://github.com/Parsaetak/Contents",
        external: true,
        ariaLabel: "Open the Parsaetak/Contents repository on GitHub"
      }
    ]
  },
  {
    name: "RED MAGIC",
    code: "RED MAGIC",
    type: "COMPUTATIONAL ORGANISM",
    status: "ACTIVE",
    purpose: "A responsive canvas organism that turns the website itself into a computational experiment — perception, adaptation, visible state.",
    what: "A responsive canvas organism that turns the website itself into a computational experiment — perception, adaptation, and visible state — plus the RED MAGIC book line.",
    problem: "The web is mostly brochures; interfaces rarely behave as if they were alive.",
    why: "It is the laboratory's expressive thesis made executable, and it is deliberately kept lazy and reduced-motion-safe so expression never defeats performance.",
    tech: "CANVAS · ADAPTATION · EXPERIMENT",
    signal: "5 COMPUTED LAYERS · REDUCED-MOTION-SAFE",
    blogProject: "red-magic",
    blogProjectAliases: ["red-theory"],
    coverSlug: "why-the-website-is-a-living-system",
    links: [
      {
        label: "The Magic scene — experience the organism",
        href: "/#magic",
        external: false
      },
      {
        label: "The creative technology topic hub",
        href: "/creative-technology/",
        external: false
      }
    ],
    articleSlug: "red-theory-and-the-living-web",
    facets: [
      {
        code: "RED MAGIC",
        title: "Computational Organism",
        type: "EXPERIMENT",
        status: "ACTIVE",
        copy: "A responsive canvas organism that turns the website itself into a computational experiment — perception, adaptation, and visible state.",
        tags: ["CANVAS", "ADAPTATION"],
        href: "#magic",
        external: false,
        ariaLabel: "Open the RED MAGIC experiment in the Magic scene"
      },
      {
        code: "RED THEORY",
        title: "Living-System Model",
        type: "SIMULATION",
        status: "ACTIVE",
        copy: "An experimental model for emergence, adaptation, competition, dissolution, and replacement — explored through the living web.",
        tags: ["SIMULATION", "EVOLUTION"],
        href: "/blog/red-theory-and-the-living-web/",
        external: false,
        ariaLabel: "Read the RED THEORY article: Red Theory and the Living Web",
        notes: "NOTES — RED THEORY AND THE LIVING WEB"
      },
      {
        code: "RED MAGIC BOOKS",
        title: "The Book Series",
        type: "PUBLICATION",
        status: "PUBLISHED",
        copy: "RED MAGIC, MAGIC FOR KIDS, and THE BOOK OF THE DEMIURGE — the written form of the RED MAGIC ideas, readable in the Media scene.",
        tags: ["BOOKS", "IDEAS"],
        href: "#media",
        external: false,
        ariaLabel: "Open the RED MAGIC books in the Media scene"
      }
    ]
  }
];

/*
 * LATERAL GRAPH LOOKUP (v3.9): the Work entry documenting a given
 * Blog project value, or null. Deterministic — a plain registry
 * scan in fixed order, first match wins; the match tests the
 * entry's primary blogProject value first, then its explicit
 * aliases. Alias membership means the project's writing documents
 * this system (declared here, never inferred from keywords).
 */
export function getWorkEntryForProject(
  project: string | null | undefined
): WorkEntry | null {
  if (!project) {
    return null;
  }

  return (
    WORK_ENTRIES.find(
      (entry) =>
        entry.blogProject === project ||
        entry.blogProjectAliases?.includes(project) === true
    ) ?? null
  );
}
