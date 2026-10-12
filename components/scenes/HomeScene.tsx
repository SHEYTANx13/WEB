import Link from "next/link";

import PublicLinks from "@/components/PublicLinks";
import HomeOriginOrganism from "@/components/HomeOriginOrganism";
import { GITHUB_LINK } from "@/lib/links";
import { routeHref } from "@/lib/hubs";

import {
  WORK_ENTRIES,
  type WorkEntry
} from "@/lib/workRegistry";

import { formatBlogDate } from "@/lib/blogFormat";

import type { ReactNode } from "react";

import type { HomeWritingPost } from "@/lib/homeWriting";

import styles from "./HomeScene.module.css";

/*
 * HOME SCENE — the statically rendered home page.
 *
 * The file reads as the page narrative, top to bottom:
 *   Hero → Featured Work → Capabilities → Method → Systems →
 *   Writing → Direction → Connect
 *
 * v3.9 first-action model: the hero carries a START HERE strip of
 * real document destinations (Selected Work / Research / Blog /
 * Contact) beneath the primary actions, and the featured systems
 * (the proof) now directly follow the identity layer — capabilities
 * come after the evidence, each capability routing to its own
 * public proof.
 *
 * Static-render law: this component renders synchronously into the
 * exported HTML (see SceneRegistry), so everything below is what
 * crawlers and no-JS visitors receive. Two boundaries keep it that
 * way:
 * - the organism is a CSS seed here; the canvas system loads at
 *   idle time through HomeOriginOrganism, never on the critical
 *   path;
 * - writing metadata arrives as serializable props from the server
 *   (app/page.tsx → lib/homeWriting). This module must never import
 *   lib/blog directly — posts.json contains article HTML and must
 *   never enter the client bundle.
 */

/*
 * Verified capability set: each line names work that actually
 * exists in the public repository ecosystem (SHEYTAN, UHIT/AIST,
 * FreeIran, the framework family, this website, RED MAGIC).
 * v3.2: product building sits alongside engineering and research —
 * evidenced by the shipped products themselves.
 * v3.5: the grid is exactly eight capabilities (4 + 4 on desktop).
 * "Creative technology" left the home grid by consolidation, not
 * deletion — the discipline already owns a dedicated presentation
 * surface: the /creative-technology/ topic hub and the RED MAGIC
 * scene/article, so the home page repeated it without adding
 * signal. The capability vocabulary remains fully represented
 * across the site.
 * v3.9: each capability carries a `proof` — a real crawlable
 * destination that demonstrates it (topic hub, Selected Work
 * document, or the field notes). The grid behaves as an
 * information-routing layer: "what is this?" → "where is the
 * proof?". Every label is descriptive; nothing points at "read
 * more".
 */
type Capability = {
  number: string;
  title: string;
  copy: string;
  proof: { label: string; href: string };
};

const capabilities: readonly Capability[] = [
  {
    number: "01",
    title: "AI systems",
    copy:
      "Designing and building AI systems end to end: agent loops, controlled tools, context engineering, and verification gates.",
    proof: {
      label: "The AI systems engineering hub",
      href: "/ai-systems/"
    }
  },
  {
    number: "02",
    title: "Reasoning & evaluation",
    copy:
      "Structuring how systems think: decomposition, critique, adversarial checking, and measurable benchmarks like AIST and ASI-100.",
    proof: {
      label: "Measuring machine intelligence — the evaluation hub",
      href: "/ai-evaluation/"
    }
  },
  {
    number: "03",
    title: "Software engineering",
    copy:
      "Shipping real software in Go, TypeScript, and React — architecture, tests, regression suites, and maintainable runtimes.",
    proof: {
      label: "The software engineering hub",
      href: "/software-engineering/"
    }
  },
  {
    number: "04",
    title: "Product building",
    copy:
      "Taking products from direction to delivery: scoping the problem, shaping the interface, deciding what not to build, and shipping.",
    proof: {
      label: "Shipped products in Selected Work",
      href: "/work/"
    }
  },
  {
    number: "05",
    title: "Local AI & agents",
    copy:
      "Running intelligence locally: managed llama.cpp inference, supervised agent loops, memory, and isolated workspaces.",
    proof: {
      label: "SHEYTAN — the local AI hub",
      href: "/local-ai/"
    }
  },
  {
    number: "06",
    title: "System architecture",
    copy:
      "Designing systems that hold: process supervision, state, bounded restarts, and deliberate evolution paths.",
    proof: {
      label: "SHEYTAN's architecture — field notes",
      href: "/blog/sheytan-the-local-first-laboratory/"
    }
  },
  {
    number: "07",
    title: "Research frameworks",
    copy:
      "Turning research into frameworks: AI Instructions, REP, and USEF — governance, reasoning, and system improvement.",
    proof: {
      label: "AI Instructions — the constitution",
      href: "/blog/ai-instructions/"
    }
  },
  {
    number: "08",
    title: "Web engineering",
    copy:
      "Engineering the web: static-first Next.js, performance budgets, accessibility, and honest, crawlable SEO.",
    proof: {
      label: "How this site is engineered",
      href: "/blog/the-anatomy-of-a-fast-static-site/"
    }
  }
] as const;

/*
 * START HERE (v3.9) — the hero's first-action entry points.
 *
 * A first-time visitor should never have to infer the site's
 * architecture: under the identity + primary actions, one compact
 * labeled strip exposes the four real discovery paths of the
 * document layer — the canonical collections (Selected Work,
 * Research), the content ecosystem (Blog), and the direct line
 * (Contact). All four are plain crawlable anchors through
 * routeHref (exported HTML, no JS); the experiential "Explore the
 * work ↓" scene action stays in the hero actions row above, so the
 * world layer keeps its entry too. Deliberately NOT a dashboard:
 * four quiet entries, one line of provenance each.
 */
const heroEntryPoints: readonly {
  label: string;
  href: string;
  note: string;
}[] = [
  {
    label: "Selected Work",
    href: "/work/",
    note: "SHEYTAN, UHIT, FreeIran, RED MAGIC — the systems"
  },
  {
    label: "Research",
    href: "/research/",
    note: "The questions, frameworks, and measurement"
  },
  {
    label: "Blog",
    href: "/blog/",
    note: "Field notes, connected — the full index"
  },
  {
    label: "Contact",
    href: "/contact/",
    note: "Research collaboration & engineering"
  }
];

/*
 * FEATURED WORK (v4.0.1) — the homepage subset of the canonical work
 * catalogue. Every card fact (name, type, description, stack,
 * repository, field-notes article) comes from lib/workRegistry.ts;
 * this module contributes ONLY presentation: the display order, the
 * committed artwork, and the compact link labels. There is no second
 * project table on the homepage — the /work/ document, the Work
 * scene and this strip render the same registry.
 */

type FeaturedProject = {
  number: string;
  title: string;
  category: string;
  copy: string;
  tags: readonly string[];
  repository?: string;
  repositoryLabel?: string;
  liveHref?: string;
  liveLabel?: string;
  notesHref: string;
  notesLabel: string;
  image: {
    src: string;
    alt: string;
    width: 1200;
    height: 630;
  };
};

/* Generated artwork is served from the static export. */
const PROJECT_IMAGE_BASE = `${
  process.env.NEXT_PUBLIC_BASE_PATH ?? ""
}/images/projects`;

/*
 * Presentation layer: which catalogue entries the homepage features,
 * in which order, with which committed artwork and compact labels.
 * Entries are referenced by their stable blogProject id; a typo (or
 * a removed entry) fails loudly below instead of silently rendering
 * an empty card.
 */
type FeaturedSpec = {
  project: string;
  image: {
    file: string;
    alt: string;
  };
  repositoryLabel?: string;
  live?: {
    label: string;
    href: string;
  };
  notesLabel: string;
};

const FEATURED_SPECS: readonly FeaturedSpec[] = [
  {
    project: "sheytan-local-agent",
    image: {
      file: "sheytan-agent-lab.svg",
      alt: "Abstract diagram of the SHEYTAN local agent laboratory: a framed local workspace containing a four-stage agent loop — plan, act, verify, remember — orbiting a red 13-point core"
    },
    repositoryLabel: "GitHub ↗",
    notesLabel: "Field notes"
  },
  {
    project: "uhit",
    image: {
      file: "uhit-intelligence-scale.svg",
      alt: "Abstract measurement artwork for UHIT: a rising scale of evaluation bars under a dashed elite threshold, one result ringed and marked in red"
    },
    repositoryLabel: "Specifications ↗",
    notesLabel: "Field notes"
  },
  {
    project: "freeiran",
    image: {
      file: "freeiran-vpn-mesh.svg",
      alt: "Abstract mesh artwork for FreeIran: a field of proxy network nodes with two bright routing tunnels crossing it toward a highlighted client node"
    },
    repositoryLabel: "GitHub ↗",
    notesLabel: "Engineering notes"
  },
  {
    project: "red-magic",
    image: {
      file: "red-magic-organism.svg",
      alt: "Abstract artwork of the RED MAGIC computational organism: a red nucleus inside three breathing membranes with flow currents and orbiting signal particles"
    },
    live: {
      label: "Live experiment",
      href: "#magic"
    },
    notesLabel: "Article"
  },
  {
    project: "web-platform",
    image: {
      file: "web-static-living-system.svg",
      alt: "Abstract diagram of this website as a static living system: a red 13-point identity core linking six world scenes and a chained blog route tree"
    },
    repositoryLabel: "GitHub ↗",
    notesLabel: "How it works"
  }
];

function entryByProject(
  project: string
): WorkEntry {
  const entry =
    WORK_ENTRIES.find(
      (candidate) =>
        candidate.blogProject === project
    ) ?? null;

  if (!entry) {
    throw new Error(
      `Home scene featured work: no work registry entry for project "${project}" — the homepage presentation and lib/workRegistry.ts have drifted apart.`
    );
  }

  return entry;
}

/*
 * Card derivation: facts from the registry, presentation from the
 * spec. The repository link is the entry's first external link; the
 * notes link is the entry's field-notes article (articleSlug).
 */
const featuredProjects: readonly FeaturedProject[] =
  FEATURED_SPECS.map((spec, index): FeaturedProject => {
    const entry = entryByProject(spec.project);

    const repository =
      entry.links.find(
        (link) => link.external
      ) ?? null;

    return {
      number: String(index + 1).padStart(2, "0"),
      title: entry.name,
      category: entry.type,
      copy: entry.what,
      tags: entry.tech.split(" · "),
      repository: repository?.href,
      repositoryLabel: spec.repositoryLabel,
      liveHref: spec.live?.href,
      liveLabel: spec.live?.label,
      notesHref: `/blog/${entry.articleSlug}/`,
      notesLabel: spec.notesLabel,
      image: {
        src: `${PROJECT_IMAGE_BASE}/${spec.image.file}`,
        alt: spec.image.alt,
        width: 1200,
        height: 630
      }
    };
  });

/*
 * The working pipeline, stated in human language (v3.2). One
 * continuous chain from research to delivery — the same discipline
 * the repository's own history demonstrates: research before
 * direction, verification before shipping, evaluation after
 * delivery.
 */
const workflowStages = [
  {
    label: "RESEARCH",
    copy:
      "Explore the problem space: prior work, evidence, and the real question underneath."
  },
  {
    label: "PRODUCT DIRECTION",
    copy:
      "Decide what to build and for whom — scope, constraints, and the smallest useful outcome."
  },
  {
    label: "ARCHITECTURE",
    copy:
      "Design the system: components, state, boundaries, and failure handling before code."
  },
  {
    label: "IMPLEMENTATION",
    copy:
      "Build it as coherent, reviewable steps in Go, TypeScript, and React."
  },
  {
    label: "TESTING",
    copy:
      "Break it before anyone else can: automated tests, honest fixtures, regression suites."
  },
  {
    label: "VERIFICATION",
    copy:
      "Prove the result against objective checks — build, run, inspect, measure — not confidence."
  },
  {
    label: "DELIVERY",
    copy:
      "Ship it clean: static build, verified export, documented state, and a measured outcome."
  }
] as const;

/*
 * Each framework row links somewhere real: AI INSTRUCTIONS has a
 * dedicated deep-dive article (a real /blog route); REP and USEF
 * point to the Systems scene, which is where their full
 * presentation lives today. `scene` marks which kind of link it is —
 * scene hashes are plain anchors handled by the world shell, routes
 * are next/link clients.
 */
type HomeSystem = {
  number: string;
  title: string;
  copy: string;
  href: string;
  scene: boolean;
};

const systems: readonly HomeSystem[] = [
  {
    number: "01",
    title: "AI INSTRUCTIONS",
    copy: "A framework for governing intelligent systems.",
    href: "/blog/ai-instructions/",
    scene: false
  },
  {
    number: "02",
    title: "REP",
    copy: "A framework for stronger reasoning and verification.",
    href: "#systems",
    scene: true
  },
  {
    number: "03",
    title: "USEF",
    copy: "A framework for improving systems over time.",
    href: "#systems",
    scene: true
  }
];

const directionStages = [
  {
    label: "RESEARCH",
    copy: "Explore intelligence, reasoning, and systems."
  },
  {
    label: "EXPERIMENT",
    copy:
      "Turn research into software, frameworks, simulations, and art."
  },
  {
    label: "BETTER INTELLIGENCE",
    copy:
      "Build systems that are measurable, testable, and improvable."
  }
] as const;

/*
 * Shared section intro: kicker + section title on the left, section
 * lead on the right. The Systems section uses a tighter variant,
 * selected through the optional class overrides.
 */
function HomeSectionIntro({
  kicker,
  title,
  lead,
  className = styles.homeSectionIntro,
  leadClassName = `body-large ${styles.homeSectionLead}`
}: {
  kicker: string;
  title: ReactNode;
  lead: ReactNode;
  className?: string;
  leadClassName?: string;
}) {
  return (
    <div className={className}>
      <div>
        <p className="kicker">{kicker}</p>

        <h2 className="section-title">{title}</h2>
      </div>

      <p className={leadClassName}>{lead}</p>
    </div>
  );
}

/*
 * One featured-project card. Kept as a unit because the meta row,
 * the body, the link set, and the artwork describe one coherent
 * thing: a project. The artwork carries intrinsic 1200×630
 * dimensions (no layout shift), lazy-loads because the section is
 * below the hero, and its alt text describes exactly what is drawn —
 * the images are generated diagrams, never fake screenshots.
 */
function HomeProjectCard({ project }: { project: FeaturedProject }) {
  return (
    <article className={styles.homeProject} key={project.number}>
      <div className={styles.homeProjectMeta}>
        <span className={styles.homeProjectNumber}>{project.number}</span>

        <span className={styles.homeProjectCategory}>{project.category}</span>
      </div>

      <div className={styles.homeProjectMain}>
        <h3 className={styles.homeProjectTitle}>{project.title}</h3>

        <p className={styles.homeProjectCopy}>{project.copy}</p>

        <div className={styles.homeProjectTags}>
          {project.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>

        <div className={styles.homeProjectLinks}>
          {project.repository && (
            <a
              className={styles.homeProjectLink}
              href={project.repository}
              target="_blank"
              rel="noreferrer"
            >
              {project.repositoryLabel}
            </a>
          )}

          {project.liveHref && (
            <a className={styles.homeProjectLink} href={project.liveHref}>
              {project.liveLabel}
              <span aria-hidden="true"> →</span>
            </a>
          )}

          <Link
            className={styles.homeProjectLink}
            href={project.notesHref}
            prefetch={false}
          >
            {project.notesLabel}
            <span aria-hidden="true"> →</span>
          </Link>
        </div>
      </div>

      <div className={styles.homeProjectVisual}>
        <img
          src={project.image.src}
          alt={project.image.alt}
          width={project.image.width}
          height={project.image.height}
          loading="lazy"
          decoding="async"
        />
      </div>
    </article>
  );
}

/*
 * One framework row. Scene hashes render as plain anchors — the
 * world shell owns hash navigation; real routes render as
 * next/link with prefetch disabled (blog payloads load on intent,
 * not on hover past).
 */
function HomeSystemItem({ system }: { system: HomeSystem }) {
  const body = (
    <>
      <span className={styles.homeSystemItemNumber}>{system.number}</span>

      <div>
        <h3>{system.title}</h3>

        <p>{system.copy}</p>
      </div>

      <span className={styles.homeSystemItemArrow} aria-hidden="true">
        →
      </span>
    </>
  );

  if (system.scene) {
    return (
      <a className={styles.homeSystemItem} href={system.href}>
        {body}
      </a>
    );
  }

  return (
    <Link className={styles.homeSystemItem} href={system.href} prefetch={false}>
      {body}
    </Link>
  );
}

/*
 * One writing entry — the server-selected article metadata rendered
 * as a single link to its real /blog route.
 */
function HomeWritingItem({
  post,
  index
}: {
  post: HomeWritingPost;
  index: number;
}) {
  return (
    <Link
      className={styles.homeWritingItem}
      href={`/blog/${post.slug}/`}
      prefetch={false}
    >
      <span className={styles.homeWritingMeta}>
        <span className={styles.homeWritingNumber}>
          {String(index + 1).padStart(2, "0")}
        </span>

        {/*
         * TYPE BADGE (v3.7) — the home writing list speaks the same
         * content-type vocabulary as the Blog: field note, system
         * documentation, or research writing, one glance before the
         * title.
         */}
        <span
          className={styles.homeWritingType}
          data-type={post.type}
        >
          {post.type === "article"
            ? "NOTE"
            : post.type === "work"
              ? "WORK"
              : "RESEARCH"}
        </span>

        <span className={styles.homeWritingCategory}>{post.category}</span>

        <span className={styles.homeWritingDate}>
          {formatBlogDate(post.date)}
        </span>
      </span>

      <span className={styles.homeWritingMain}>
        <strong className={styles.homeWritingTitle}>{post.title}</strong>

        <span className={styles.homeWritingExcerpt}>{post.excerpt}</span>

        <span className={styles.homeWritingFoot}>
          <span>{post.readingTime}</span>

          {post.inbound > 0 && (
            <span>
              ↩ {post.inbound}{" "}
              {post.inbound === 1 ? "reference" : "references"}
            </span>
          )}
        </span>
      </span>

      <span className={styles.homeWritingArrow} aria-hidden="true">
        →
      </span>
    </Link>
  );
}

export default function HomeScene({
  writingPosts = []
}: {
  /*
   * SERVER-SIDE WRITING SELECTION: serializable article metadata
   * computed in app/page.tsx. See the module comment for the import
   * boundary this props bridge exists to protect.
   */
  writingPosts?: readonly HomeWritingPost[];
}) {
  const github = GITHUB_LINK;

  return (
    <div className={styles.homeScene}>
      {/* ---------------------------------------------------- HERO */}
      <section className={`hero ${styles.homeOrigin}`}>
        <div
          className={styles.homeOriginGrid}
          aria-hidden="true"
        >
          <span
            className={`${styles.homeOriginRing} ${styles.homeOriginRingOne}`}
          />

          <span
            className={`${styles.homeOriginRing} ${styles.homeOriginRingTwo}`}
          />

          <span
            className={`${styles.homeOriginRing} ${styles.homeOriginRingThree}`}
          />

          <span
            className={`${styles.homeOriginAxis} ${styles.homeOriginAxisX}`}
          />

          <span
            className={`${styles.homeOriginAxis} ${styles.homeOriginAxisY}`}
          />

          <span
            className={`${styles.homeOriginCross} ${styles.homeOriginCrossOne}`}
          />

          <span
            className={`${styles.homeOriginCross} ${styles.homeOriginCrossTwo}`}
          />

          <span
            className={`${styles.homeOriginCross} ${styles.homeOriginCrossThree}`}
          />
        </div>

        <div
          className={styles.homeOriginMagicBackground}
          aria-hidden="true"
        >
          <div className={styles.homeOriginMagicVignette} />

          <div className={styles.homeOriginMagicOrganism}>
            {/*
              * The organism loads lazily at idle time through
              * HomeOriginOrganism; the exported HTML carries the
              * CSS-only seed instead of a canvas dependency.
              */}
            <HomeOriginOrganism />
          </div>
        </div>

        <div
          className={`page-container hero-grid ${styles.homeOriginContent}`}
        >
          <div className={`hero-copy ${styles.homeOriginCopy}`}>
            <div className="hero-status">
              <span className="status-dot" aria-hidden="true" />

              <span>ACTIVE</span>
            </div>

            <p className="kicker">
              PARSA TAK — SOFTWARE ENGINEER · PRODUCT BUILDER · AI SYSTEMS RESEARCHER
            </p>

            <h1 className={`hero-title ${styles.homeIdentityTitle}`}>
              AI systems
              <br />
              Reasoning
              <br />
              Software
              <br />
              Art
            </h1>

            <p
              className={`body-large hero-description ${styles.homeIdentityLead}`}
            >
              I research intelligence and build AI systems — taking products
              from research and product direction through architecture,
              implementation, testing, verification, and delivery. Local AI
              agents, reasoning frameworks, and the writing and art around
              them.
            </p>

            <div className={`hero-actions ${styles.homeOriginActions}`}>
              <a className="button button-primary" href="#work">
                Explore the work ↓
              </a>

              {github && (
                <a
                  className="button button-secondary"
                  href={github.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub ↗
                </a>
              )}
            </div>

            {/*
              * START HERE (v3.9) — the first-action strip. A labeled
              * <nav> so assistive technology can name it; four real
              * destinations, each anchor carrying its own descriptive
              * label (the note renders beneath as quiet provenance).
              * Nothing here is decorative: every entry is a canonical
              * document of the content graph. Contact lives HERE, not
              * as a second hero button — one instance, no duplication.
              */}
            <nav
              className={styles.homeHeroEntries}
              aria-label="Start here — main paths through the site"
            >
              <span className={styles.homeHeroEntriesLabel} aria-hidden="true">
                START HERE
              </span>

              {heroEntryPoints.map((entry) => (
                <a
                  key={entry.href}
                  className={styles.homeHeroEntry}
                  href={routeHref(entry.href)}
                >
                  <strong>{entry.label}</strong>

                  <span>{entry.note}</span>
                </a>
              ))}
            </nav>
          </div>
        </div>

        <div className={styles.homeOriginFoot}>
          <span>SCROLL TO EXPLORE</span>

          <span
            className={styles.homeOriginFootLine}
            aria-hidden="true"
          />
        </div>
      </section>

      {/* ------------------------------------------- FEATURED WORK */}
      {/*
        * PROOF-FIRST ORDER (v3.9): featured work immediately follows
        * the hero. Measured against the v3.8 baseline, the capability
        * explainer (~2.8KB of DOM, a full grid) previously sat
        * between the identity layer and the first concrete project —
        * pushing "what I have actually built" past the first scroll
        * on every common laptop viewport (hero is 100svh). The page
        * now moves from identity to proof in one step:
        * Hero → Featured Work → Capabilities → Method → …
      */}
      <section className={`section ${styles.homeProjects}`}>
        <div className="page-container">
          <HomeSectionIntro
            kicker="FEATURED WORK"
            title={
              <>
                What I have
                <br />
                actually built
              </>
            }
            lead="Real projects with real destinations — every repository, article, and experiment below exists and is publicly reachable."
          />

          <div
            className={styles.homeProjectList}
            aria-label="Featured projects"
          >
            {featuredProjects.map((project) => (
              <HomeProjectCard
                key={project.number}
                project={project}
              />
            ))}
          </div>

          {/*
            * PORTFOLIO ROUTING (v3.9): the archive link now targets
            * the canonical Selected Work document — the crawlable,
            * indexable deep page — instead of the world scene. The
            * experiential #work scene remains one hop away in the
            * world navigation and the footer.
            */}
          <a className={styles.homeProjectArchive} href={routeHref("/work/")}>
            <span>FULL PORTFOLIO</span>

            <strong>
              Open Selected Work
              <span aria-hidden="true"> →</span>
            </strong>
          </a>
        </div>
      </section>

      {/* -------------------------------------------- CAPABILITIES */}
      <section className={`section ${styles.homeCapabilities}`}>
        <div className="page-container">
          <HomeSectionIntro
            kicker="CAPABILITIES"
            title="What I can do"
            lead="The practice behind the proof above — and every capability here routes to the public work that demonstrates it."
          />

          <div
            className={styles.homeCapabilityGrid}
            aria-label="Core capabilities"
          >
            {capabilities.map((capability) => (
              <div
                className={styles.homeCapability}
                key={capability.number}
              >
                <span className={styles.homeCapabilityNumber}>
                  {capability.number}
                </span>

                <h3>{capability.title}</h3>

                <p>{capability.copy}</p>

                {/*
                  * PROOF LINK (v3.9): the evidence edge. Descriptive
                  * anchor text names the real destination — a topic
                  * hub, the Selected Work document, or the field
                  * notes — so the card answers both halves of the
                  * routing question: what is this? where is the
                  * proof?
                  */}
                <Link
                  className={styles.homeCapabilityProof}
                  href={capability.proof.href}
                  prefetch={false}
                >
                  {capability.proof.label}
                  <span aria-hidden="true"> →</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- METHOD */}
      <section className={`section ${styles.homeWorkflow}`}>
        <div className="page-container">
          <HomeSectionIntro
            kicker="METHOD"
            title="How I work"
            lead="One pipeline from research to delivery — direction before architecture, testing before verification, verification before shipping."
          />

          <div
            className={styles.homeWorkflowGrid}
            aria-label="Working method"
          >
            {workflowStages.map((stage, index) => (
              <div
                className={styles.homeWorkflowStage}
                key={stage.label}
              >
                <div className={styles.homeWorkflowStageHead}>
                  <span className={styles.homeWorkflowStageIndex}>
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <strong>{stage.label}</strong>

                  {index < workflowStages.length - 1 && (
                    <span
                      className={styles.homeWorkflowStageArrow}
                      aria-hidden="true"
                    >
                      →
                    </span>
                  )}
                </div>

                <p className={styles.homeWorkflowStageCopy}>{stage.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ SYSTEMS */}
      <section className={`section ${styles.homeSystems}`}>
        <div className="page-container">
          <HomeSectionIntro
            kicker="WHAT I BUILD"
            title={
              <>
                Ideas
                <br />
                made concrete
              </>
            }
            lead="I turn research into frameworks, software, experiments, simulations, and other working systems."
            className={styles.homeSystemsIntro}
            leadClassName={`body ${styles.homeSystemsCopy}`}
          />

          <div className={styles.homeSystemsOverview}>
            <a
              className={styles.homeSystemsOverviewLink}
              href="#systems"
              aria-label="Open the Systems scene"
            >
              <div className={styles.homeSystemsOverviewLabel}>
                <span>SYSTEMS</span>
              </div>

              <strong>
                <span>AI</span>

                <i>·</i>

                <span>REASONING</span>

                <i>·</i>

                <span>SYSTEMS</span>
              </strong>

              <span
                className={styles.homeSystemsOverviewArrow}
                aria-hidden="true"
              >
                →
              </span>
            </a>
          </div>

          <div className={styles.homeSystemList}>
            {systems.map((system) => (
              <HomeSystemItem key={system.number} system={system} />
            ))}
          </div>
        </div>
      </section>

      {/*
        * BLOG — the home scene's bridge into the knowledge graph.
        * The entries are selected on the server from the real content
        * index: the featured article first, then the most internally
        * referenced. Everything links to a real route.
        */}
      {writingPosts.length > 0 && (
        <section className={`section ${styles.homeWriting}`}>
          <div className="page-container">
            <HomeSectionIntro
              kicker="BLOG"
              title={
                <>
                  Field notes
                  <br />
                  from the laboratory
                </>
              }
              lead="Research, engineering, and the reasoning behind the systems — written down and connected, not left in commit logs."
            />

            <div
              className={styles.homeWritingList}
              aria-label="Selected articles"
            >
              {writingPosts.map((post, index) => (
                <HomeWritingItem key={post.slug} post={post} index={index} />
              ))}
            </div>

            <Link
              className={styles.homeWritingArchive}
              href="/blog/"
              prefetch={false}
            >
              <span>ALL ARTICLES</span>

              <strong>
                Open the Blog
                <span aria-hidden="true"> →</span>
              </strong>
            </Link>
          </div>
        </section>
      )}

      {/* ---------------------------------------------- DIRECTION */}
      <section className={`section ${styles.homeDirection}`}>
        <div className="page-container">
          <div className={styles.homeDirectionGrid}>
            <div className={styles.homeDirectionHeading}>
              <p className="kicker">DIRECTION</p>

              <h2 className="section-title">
                Understand
                <br />
                intelligence
                <br />
                Build better systems
              </h2>
            </div>

            <div className={styles.homeDirectionCopy}>
              <p className="body-large">
                The work is an ongoing attempt to understand intelligence,
                strengthen reasoning, and turn ideas into systems that can
                be tested and improved.
              </p>

              <div className={styles.homeDirectionStages}>
                {directionStages.map((stage, index) => (
                  <div
                    className={styles.homeDirectionStage}
                    key={stage.label}
                  >
                    <div className={styles.homeDirectionStageMain}>
                      <div className={styles.homeDirectionStageIndex}>
                        {String(index + 1).padStart(2, "0")}
                      </div>

                      <div>
                        <strong>{stage.label}</strong>

                        <p>{stage.copy}</p>
                      </div>
                    </div>

                    {index < directionStages.length - 1 && (
                      <span
                        className={styles.homeDirectionStageArrow}
                        aria-hidden="true"
                      >
                        →
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- CONNECT */}
      <section className={`section ${styles.homeFinal}`}>
        <div className="page-container">
          <div className={styles.homeFinalFrame}>
            <div>
              <p className="kicker">WORK WITH ME</p>

              <h2 className="section-title">
                Research
                <br />
                Build
                <br />
                Deliver
              </h2>
            </div>

            <div className={styles.homeFinalContact}>
              <p className="body-large">
                Research collaboration, product engineering, or a system to
                build — the fastest way in is a direct email. Research,
                writing, and the code behind the work are all open below.
              </p>

              <div className={styles.homeFinalActions}>
                <a
                  className="button button-primary"
                  href="mailto:Parsaetak@gmail.com"
                >
                  Email Parsa Tak
                </a>

                <a
                  className="button button-secondary"
                  href={routeHref("/contact/")}
                >
                  Contact page
                </a>

                {github && (
                  <a
                    className="button button-secondary"
                    href={github.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <PublicLinks compact title="CONNECT" />
    </div>
  );
}
