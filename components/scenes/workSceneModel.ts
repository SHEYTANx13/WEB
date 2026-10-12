/*
 * workSceneModel.ts — the experiential Work scene's presentation
 * model, DERIVED from the canonical work catalogue (v4.0.1).
 *
 * Every card fact — code, title, type, status, copy, tags and
 * destination — comes from lib/workRegistry.ts (WORK_ENTRIES and
 * their facets). This module contributes ONLY presentation:
 *
 *   - which entries are FEATURED (the first four, registry order);
 *   - how the grouped coverage is composed (which entry facets form
 *     which group, and the groups' editorial framing);
 *   - how registry hrefs resolve for the scene (basePath for
 *     internal routes, verbatim for scene hashes and externals).
 *
 * There is no second project table here: remove or rename an entry
 * or facet in the registry and the scene follows — or fails loudly
 * when a referenced facet no longer exists.
 */

import {
  WORK_ENTRIES,
  type WorkEntry,
  type WorkFacet
} from "@/lib/workRegistry";

/*
 * Internal routes carry the deployment basePath explicitly via
 * routeHref() — plain anchors, the same convention the scene always
 * used. Scene hashes (#magic, #systems, #media) are same-document
 * and must never be prefixed; externals are absolute. The registry
 * stores root-relative routes, so resolution happens here.
 * NEXT_PUBLIC_BASE_PATH is inlined at build time ("" locally,
 * "/WEB" on GitHub Pages).
 */
const BASE_PATH =
  process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function routeHref(
  path: string
): string {
  return `${BASE_PATH}${path}`;
}

function resolveSceneHref(
  href: string,
  external: boolean
): string {
  if (external || href.startsWith("#")) {
    return href;
  }

  return routeHref(href);
}

/* -------------------------------------------------------------------------- */
/* Card model types                                                           */
/* -------------------------------------------------------------------------- */

type SceneLink = {
  label: string;
  href: string;
  external: boolean;
};

export type FeaturedProject = {
  number: string;
  code: string;
  title: string;
  type: string;
  status: string;
  copy: string;
  tags: readonly string[];
  links: readonly SceneLink[];
};

export type GroupProject = {
  number: string;
  code: string;
  title: string;
  type: string;
  status: string;
  copy: string;
  tags: readonly string[];
  /**
   * Primary destination — full-card link when present; null keeps
   * the informational (unlinked) card variant.
   */
  href: string | null;
  /** External destination flag of the facet backing the card. */
  hrefExternal: boolean;
  ariaLabel?: string;
  /** Visible mono line naming the destination of a linked card. */
  notes?: string;
};

export type ProjectGroup = {
  id: string;
  kicker: string;
  title: string;
  description: string;
  projects: readonly GroupProject[];
};

/* -------------------------------------------------------------------------- */
/* Featured systems — the first four registry entries                         */
/* -------------------------------------------------------------------------- */

/*
 * FEATURED SELECTION: registry order IS centrality order (the same
 * order the /work/ document and its ItemList present), so the four
 * highest-signal systems are simply the first four entries.
 */
const FEATURED_ENTRY_COUNT = 4;

function featuredLinks(
  entry: WorkEntry
): readonly SceneLink[] {
  /*
   * Dense-surface links: the registry links that carry a `short`
   * mono label, plus the field-notes article link derived from
   * articleSlug (labelled by the entry's notesLabel).
   */
  const links: SceneLink[] = entry.links
    .filter(
      (link) => link.short !== undefined
    )
    .map((link) => ({
      label: link.short as string,
      href: resolveSceneHref(
        link.href,
        link.external
      ),
      external: link.external
    }));

  if (entry.articleSlug) {
    links.push({
      label:
        entry.notesLabel ??
        "FIELD NOTES",
      href: routeHref(
        `/blog/${entry.articleSlug}/`
      ),
      external: false
    });
  }

  return links;
}

export const featuredProjects: readonly FeaturedProject[] =
  WORK_ENTRIES.slice(
    0,
    FEATURED_ENTRY_COUNT
  ).map(
    (entry, index): FeaturedProject => ({
      number: String(
        index + 1
      ).padStart(2, "0"),
      code: entry.code,
      title: entry.name,
      type: entry.type,
      status: entry.status,
      copy: entry.what,
      tags: entry.tech.split(" · "),
      links: featuredLinks(entry)
    })
  );

/* -------------------------------------------------------------------------- */
/* Grouped coverage — entry facets composed into editorial groups             */
/* -------------------------------------------------------------------------- */

/*
 * The registry entries the grouped coverage renders from, referenced
 * directly so a catalogue change propagates (or fails) at type-check
 * time. blogProject values are the stable entry ids used below only
 * for documentation.
 */
const [
  ,
  uhitEntry,
  ,
  ,
  frameworksEntry,
  contentsEntry,
  redMagicEntry
] = WORK_ENTRIES;

function facetCard(
  facet: WorkFacet,
  number: string
): GroupProject {
  return {
    number,
    code: facet.code,
    title: facet.title,
    type: facet.type,
    status: facet.status,
    copy: facet.copy,
    tags: facet.tags,
    href: resolveSceneHref(
      facet.href,
      facet.external
    ),
    hrefExternal: facet.external,
    ariaLabel: facet.ariaLabel,
    notes: facet.notes
  };
}

function facetByCode(
  entry: WorkEntry,
  code: string
): WorkFacet {
  const facet =
    entry.facets?.find(
      (candidate) =>
        candidate.code === code
    ) ?? null;

  if (!facet) {
    throw new Error(
      `Work scene model: entry "${entry.name}" has no facet "${code}" — the scene model and lib/workRegistry.ts have drifted apart.`
    );
  }

  return facet;
}

/*
 * GROUP COMPOSITION. Each group lists the entry facets it presents,
 * in display order; numbering continues sequentially after the
 * featured systems (05…), exactly as the grouped coverage always
 * numbered its cards.
 */
type GroupSpec = {
  id: string;
  kicker: string;
  title: string;
  description: string;
  sources: readonly {
    entry: WorkEntry;
    /** Facet codes to render, in order; omit to render all facets. */
    facets?: readonly string[];
  }[];
};

const GROUP_SPECS: readonly GroupSpec[] = [
  {
    id: "ai-reasoning",
    kicker: "AI + REASONING",
    title: "Frameworks for thinking systems",
    description:
      "The framework family that governs, strengthens, and improves intelligent systems — published and versioned as public documents.",
    sources: [
      {
        entry: frameworksEntry
        /* all facets: AI INSTRUCTIONS, REP, USEF */
      }
    ]
  },
  {
    id: "research-experiments",
    kicker: "RESEARCH + EXPERIMENTS",
    title: "Measurement and simulation",
    description:
      "The UHIT measurement programme's public specifications and the RED THEORY living-system experiments.",
    sources: [
      {
        entry: uhitEntry,
        facets: ["AIST", "ASI-100"]
      },
      {
        entry: redMagicEntry,
        facets: ["RED THEORY"]
      }
    ]
  },
  {
    id: "software-engineering",
    kicker: "SOFTWARE + ENGINEERING",
    title: "Infrastructure that carries the work",
    description:
      "The repositories and systems that publish, feed, and run everything else.",
    sources: [
      {
        entry: contentsEntry,
        facets: ["CONTENTS"]
      }
    ]
  },
  {
    id: "creative-technology",
    kicker: "CREATIVE TECHNOLOGY",
    title: "The RED MAGIC line",
    description:
      "Computational organisms, living interfaces, and the book series — technology as an expressive medium.",
    sources: [
      {
        entry: redMagicEntry,
        facets: ["RED MAGIC", "RED MAGIC BOOKS"]
      }
    ]
  }
];

function buildGroups(): readonly ProjectGroup[] {
  let nextNumber =
    FEATURED_ENTRY_COUNT + 1;

  const numberedCard = (
    facet: WorkFacet
  ): GroupProject =>
    facetCard(
      facet,
      String(
        nextNumber++
      ).padStart(2, "0")
    );

  return GROUP_SPECS.map(
    (spec): ProjectGroup => ({
      id: spec.id,
      kicker: spec.kicker,
      title: spec.title,
      description: spec.description,
      projects: spec.sources.flatMap(
        (source) => {
          const facets =
            source.facets
              ? source.facets.map(
                  (code) =>
                    facetByCode(
                      source.entry,
                      code
                    )
                )
              : (source.entry.facets ??
                []);

          return facets.map(
            numberedCard
          );
        }
      )
    })
  );
}

export const projectGroups: readonly ProjectGroup[] =
  buildGroups();

export const TOTAL_PROJECTS =
  featuredProjects.length +
  projectGroups.reduce(
    (sum, group) =>
      sum + group.projects.length,
    0
  );
