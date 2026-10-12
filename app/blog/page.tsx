import type {
  Metadata
} from "next";

import Link from "next/link";

import { DocLink } from "@/components/content/ContentBlocks";

import BlogIndex from "@/components/blog/BlogIndex";

import {
  formatBlogDate,
  formatBlogDateShort,
  getBlogInfo,
  getBlogMetaList,
  getFeaturedPost,
  getAllTags,
  getInboundCounts,
  getTypeCounts
} from "@/lib/blog";

import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_ORDER
} from "@/lib/blogFormat";

import {
  JsonLd,
  PERSON_ID,
  SITE_IN_LANGUAGE,
  SITE_OG_IMAGE_HEIGHT,
  SITE_OG_IMAGE_PATH,
  SITE_OG_IMAGE_WIDTH,
  SITE_URL,
  WEBSITE_ID
} from "@/lib/seo";


import styles from "./page.module.css";

/*
 * Blog index — fully static (v3.7: the laboratory's content
 * discovery surface).
 *
 * The Blog is the site's single content ecosystem: articles, work
 * documentation, and research writing are all discovered here — as
 * content modes over one catalogue (ALL · ARTICLES · WORK ·
 * RESEARCH), not as separate navigation destinations. The canonical
 * /work/ and /research/ documents remain the deep landing pages and
 * are linked prominently from the Lab Map below.
 *
 * The first screen is a VISUAL INSTRUMENT, not a text document: the
 * hero pairs the positioning copy with a live instrument panel
 * (featured cover, real type counts, latest signal), the featured
 * article renders as a large visual card, the Lab Map orients the
 * whole territory, and only then does the discovery grid begin.
 *
 * The interactive island below receives article METADATA ONLY (no
 * HTML bodies) so filtering is an in-memory scan of a tiny array.
 *
 * SEO: this page emits the Blog entity — one object describing the
 * /blog/ collection, with BlogPosting stubs whose @id values match
 * the full article graphs emitted on /blog/<slug>/ routes — plus an
 * ItemList of the canonical content collections the ecosystem is
 * built on. The collection object and the article objects interlock
 * instead of duplicating each other.
 */

const BLOG_DESCRIPTION =
  "The laboratory's publication and discovery surface: field notes, engineering documentation of the built systems, and the research programme — SHEYTAN, UHIT, FreeIran, RED MAGIC, and the frameworks behind them — browsable as one connected content ecosystem.";

export function generateMetadata(): Metadata {
  const info = getBlogInfo();

  return {
    /*
     * absolute: the layout's "%s — Parsa Tak" template only applies
     * to DEEPER segments (article pages), not to this same-segment
     * index page — so the full title is spelled out exactly once
     * here, matching the site's title convention.
     */
    title: {
      absolute: "Blog — Parsa Tak"
    },
    description: BLOG_DESCRIPTION,

    alternates: {
      canonical: "/blog/"
    },

    openGraph: {
      type: "website",
      title: "Blog — Parsa Tak",
      description: BLOG_DESCRIPTION,
      url: "/blog/",
      images: [
        {
          url: SITE_OG_IMAGE_PATH,
          width: SITE_OG_IMAGE_WIDTH,
          height: SITE_OG_IMAGE_HEIGHT,
          alt: "Parsa Tak — the laboratory's publication and discovery surface"
        }
      ]
    },

    twitter: {
      card: "summary_large_image",
      title: "Blog — Parsa Tak",
      description: BLOG_DESCRIPTION,
      images: [
        {
          url: SITE_OG_IMAGE_PATH,
          alt: "Parsa Tak — the laboratory's publication and discovery surface"
        }
      ]
    }
  };
}

function blogEntity(info: {
  siteName: string;
  siteDescription: string;
}, posts: readonly { slug: string; title: string }[]) {
  return {
    "@type": "Blog",
    "@id": `${SITE_URL}/blog/#blog`,
    url: `${SITE_URL}/blog/`,
    name: `Blog — ${info.siteName}`,
    description: BLOG_DESCRIPTION,
    inLanguage: SITE_IN_LANGUAGE,
    isPartOf: { "@id": WEBSITE_ID },
    author: { "@id": PERSON_ID },
    publisher: { "@id": PERSON_ID },
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      "@id": `${SITE_URL}/blog/${post.slug}/#article`,
      url: `${SITE_URL}/blog/${post.slug}/`,
      headline: post.title
    }))
  };
}

/*
 * CONTENT COLLECTIONS (v3.7) — the canonical deep documents the
 * Blog content ecosystem is built on. Truthful ItemList entries:
 * /work/ (the systems in depth), /research/ (the programme in
 * depth), and /blog/ itself (the full stream). No query URLs —
 * filter states stay out of structured data exactly as they stay
 * out of the sitemap.
 */
function contentCollectionsEntity() {
  return {
    "@type": "ItemList",
    "@id": `${SITE_URL}/blog/#collections`,
    name: "Content collections",
    description:
      "The canonical collections of the laboratory's content ecosystem",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Selected Work — the systems in depth",
        url: `${SITE_URL}/work/`
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Research — the programme in depth",
        url: `${SITE_URL}/research/`
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Blog — all published notes",
        url: `${SITE_URL}/blog/`
      }
    ]
  };
}

/*
 * THE LAB MAP (v3.7) — the six research territories and their most
 * important systems, from the same verified hub data the topic-hub
 * routes render. Every node links to a real destination. This is a
 * navigation surface, not decoration: it orients the whole site
 * without reading a single paragraph.
 *
 * v3.9: each territory also carries its lateral collection edge —
 * the canonical document (Selected Work or Research) where the
 * territory's systems and programme are documented in depth. The
 * links are the same truthful project/type relationships the
 * article pages resolve; no territory gained or lost a topic.
 */
const LAB_TERRITORIES: readonly {
  name: string;
  href: string;
  code: string;
  signal: string;
  links: readonly {
    label: string;
    href: string;
  }[];
}[] = [
  {
    name: "Local AI",
    href: "/local-ai/",
    code: "L-01",
    signal: "SHEYTAN · MANAGED INFERENCE · VERIFICATION GATES",
    links: [
      {
        label: "Inside SHEYTAN's local-first laboratory",
        href: "/blog/sheytan-the-local-first-laboratory/"
      },
      {
        label: "SHEYTAN in Selected Work",
        href: "/work/"
      }
    ]
  },
  {
    name: "AI Systems",
    href: "/ai-systems/",
    code: "S-02",
    signal: "AI INSTRUCTIONS · REP · USEF · GOVERNED AGENTS",
    links: [
      {
        label: "AI Instructions: the constitutional framework",
        href: "/blog/ai-instructions/"
      },
      {
        label: "The framework family in Selected Work",
        href: "/work/"
      }
    ]
  },
  {
    name: "Reasoning",
    href: "/ai-reasoning/",
    code: "R-03",
    signal: "REP · DECOMPOSITION · ADVERSARIAL CHECKING",
    links: [
      {
        label: "Reasoning is a system property",
        href: "/blog/reasoning-is-a-system-property/"
      },
      {
        label: "The research programme",
        href: "/research/"
      }
    ]
  },
  {
    name: "Evaluation",
    href: "/ai-evaluation/",
    code: "E-04",
    signal: "UHIT · AIST-2026.09 · ASI-100-ELITE",
    links: [
      {
        label: "Measuring machine intelligence",
        href: "/blog/measuring-machine-intelligence/"
      },
      {
        label: "UHIT in Selected Work",
        href: "/work/"
      }
    ]
  },
  {
    name: "Software Engineering",
    href: "/software-engineering/",
    code: "SE-05",
    signal: "FREEIRAN · STATIC ARCHITECTURE · HONEST TESTS",
    links: [
      {
        label: "FreeIran engineering notes",
        href: "/blog/freeiran-engineering-notes/"
      },
      {
        label: "FreeIran & WEB in Selected Work",
        href: "/work/"
      }
    ]
  },
  {
    name: "Creative Technology",
    href: "/creative-technology/",
    code: "C-06",
    signal: "RED MAGIC · LIVING WEB · RED THEORY",
    links: [
      {
        label: "Red Theory and the living web",
        href: "/blog/red-theory-and-the-living-web/"
      },
      {
        label: "RED MAGIC in Selected Work",
        href: "/work/"
      }
    ]
  }
];

export default function BlogPage() {
  const posts = getBlogMetaList();
  const tags = getAllTags();
  const featured = getFeaturedPost();
  const info = getBlogInfo();
  const typeCounts = getTypeCounts();

  const latest = posts[0] ?? null;

  /*
   * Inbound reference counts (v2.5.5) for the quiet "↩ N" card
   * badges — straight from the validated build-time link graph.
   */
  const inboundRefs = getInboundCounts();

  return (
    <div className={styles.blogPage}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            blogEntity(info, posts),
            contentCollectionsEntity()
          ]
        }}
      />

      {/*
       * VISUAL HERO (v3.7) — TEXT EXPLAINS (left), VISUALS ORIENT
       * (right), INTERACTION EXPLORES (the whole page below). The
       * instrument panel is a DOM/CSS composition of REAL data: the
       * featured cover, the true content-type counts, and the latest
       * signal — no decorative gradients standing in for information.
       */}
      <section
        className={`section ${styles.blogHero}`}
      >
        <div className="page-container">
          <header className={styles.blogHeroHeader} data-reveal="instant">
            <div className={styles.blogHeroCopy}>
              <p className={styles.blogHeroKicker}>
                07 / BLOG — THE LABORATORY INDEX
              </p>

              <h1
                className={styles.blogHeroTitle}
              >
                Every note,
                <br />
                system, and
                <br />
                experiment
              </h1>

              <p
                className={`body-large ${styles.blogHeroLead}`}
              >
                One connected content ecosystem: field notes,
                engineering documentation of the built systems,
                and the research programme — SHEYTAN, UHIT,
                FreeIran, RED MAGIC, and the frameworks behind
                them.
              </p>

              <div
                className={styles.blogHeroActions}
              >
                <a
                  className="button button-primary"
                  href="#browse"
                >
                  Browse the index
                  <span aria-hidden="true"> →</span>
                </a>

                <Link
                  className="button button-secondary"
                  href={"/work/"}
                 prefetch={false}>
                  Work — the systems
                </Link>
              </div>
            </div>

            {/*
             * THE INSTRUMENT — right-hand visual field. The featured
             * cover rides in a framed panel with signal rings; the
             * type readouts are the REAL counts (links into the
             * content modes below); the latest signal names the
             * newest transmission. All CSS/SVG/DOM — no canvas, no
             * client JS.
             */}
            <aside
              className={styles.blogHeroInstrument}
              aria-label="Laboratory status"
            >
              <div
                className={styles.instrumentPanel}
                aria-hidden={featured ? undefined : "true"}
              >
                <div
                  className={styles.instrumentField}
                >
                  <span className={styles.instrumentRingOne} />
                  <span className={styles.instrumentRingTwo} />
                  <span className={styles.instrumentNode} />
                </div>

                {featured?.cover && (
                  <Link
                    className={styles.instrumentCover}
                    href={`/blog/${featured.slug}/`}
                    aria-label={`Featured: ${featured.title}`}
                    tabIndex={-1}
                    prefetch={false}
                  >
                    <img
                      src={featured.cover.src}
                      alt={featured.cover.alt}
                      width={featured.cover.width}
                      height={featured.cover.height}
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                    />
                  </Link>
                )}

                <p className={styles.instrumentLabel}>
                  FEATURED SIGNAL
                </p>
              </div>

              <div className={styles.instrumentReadouts}>
                {CONTENT_TYPE_ORDER.map((type) => (
                  <a
                    key={type}
                    className={styles.readout}
                    href="#browse"
                    data-type={type}
                  >
                    <span className={styles.readoutCount}>
                      {String(typeCounts[type]).padStart(2, "0")}
                    </span>

                    <span className={styles.readoutLabel}>
                      {CONTENT_TYPE_LABELS[type]}
                      {type === "article" && typeCounts[type] !== 1
                        ? "S"
                        : ""}
                    </span>
                  </a>
                ))}
              </div>

              {latest && (
                <p className={styles.instrumentLatest}>
                  <span className={styles.instrumentLatestLabel}>
                    LATEST
                  </span>

                  <Link
                    href={`/blog/${latest.slug}/`}
                    className={styles.instrumentLatestLink}
                    prefetch={false}
                  >
                    {latest.title}
                  </Link>

                  <span className={styles.instrumentLatestDate}>
                    {formatBlogDateShort(latest.date)}
                  </span>
                </p>
              )}
            </aside>
          </header>
        </div>
      </section>

      {featured && (
        <section
          className={`section-tight ${styles.blogFeaturedSection}`}
          aria-label="Featured article"
        >
          <div className="page-container">
            <div
              className={styles.blogFeaturedCard}
              data-reveal="scale"
              data-type={featured.type}
            >
              {featured.cover && (
                <Link
                  className={
                    styles.blogFeaturedVisual
                  }
                  href={`/blog/${featured.slug}/`}
                  aria-label={featured.title}
                  tabIndex={-1}
                  prefetch={false}
                >
                  <img
                    src={featured.cover.src}
                    alt={featured.cover.alt}
                    width={featured.cover.width}
                    height={featured.cover.height}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                  />
                </Link>
              )}

              <div
                className={styles.blogFeaturedContent}
              >
                <p
                  className={styles.blogFeaturedKicker}
                >
                  FEATURED ·{" "}
                  <span data-type={featured.type}>
                    {CONTENT_TYPE_LABELS[featured.type]}
                  </span>
                </p>

                <h2
                  className={styles.blogFeaturedTitle}
                >
                  <Link
                    href={`/blog/${featured.slug}/`}
                    prefetch={false}
                  >
                    {featured.title}
                  </Link>
                </h2>

                {featured.subtitle && (
                  <p
                    className={
                      styles.blogFeaturedSubtitle
                    }
                  >
                    {featured.subtitle}
                  </p>
                )}

                <p
                  className={styles.blogFeaturedExcerpt}
                >
                  {featured.excerpt}
                </p>

                <p
                  className={styles.blogFeaturedMeta}
                >
                  {formatBlogDate(
                    featured.date
                  )}
                  {" · "}
                  {featured.readingTime}
                  {" · "}
                  {featured.author}
                </p>

                <Link
                  className={`button button-primary ${styles.blogFeaturedAction}`}
                  href={`/blog/${featured.slug}/`}
                  prefetch={false}
                >
                  Read article
                  <span aria-hidden="true">
                    →
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/*
       * THE DISCOVERY GRID — the BlogIndex island: content modes
       * (ALL · ARTICLES · WORK · RESEARCH), search, tag/project/topic
       * filters, and the visual card grid. One catalogue, one URL
       * state (?type=… shareable and history-safe).
       */}
      <section
        className={`section ${styles.blogListSection}`}
        aria-label="Browse all content"
        id="browse"
      >
        <div className="page-container">
          <BlogIndex
            posts={posts}
            tags={tags}
            inboundRefs={inboundRefs}
          />
        </div>
      </section>

      {/*
       * THE LAB MAP (v3.7) — the whole territory in one visual
       * surface: the six research territories (each a real topic-hub
       * document with its key system) and the two canonical
       * collections the ecosystem is built on. A navigation surface:
       * every node is a link. Desktop composes a spatial map; mobile
       * stacks the same cards vertically — one system, two layouts.
       */}
      <section
        className={`section ${styles.labMapSection}`}
        aria-label="Explore the lab"
      >
        <div className="page-container">
          <header className={styles.labMapHeader} data-reveal="instant">
            <p className={styles.labMapKicker}>
              EXPLORE THE LAB
            </p>

            <h2 className={styles.labMapTitle}>
              The map of the territory
            </h2>

            <p className={styles.labMapLead}>
              Six research territories, the systems that live in
              them, and the collections that document everything in
              depth.
            </p>
          </header>

          <div
            className={styles.labMapGrid}
          >
            {LAB_TERRITORIES.map((territory, index) => (
              <article
                key={territory.href}
                className={styles.labCard}
                data-reveal=""
                data-reveal-order={index % 4}
              >
                <div className={styles.labCardHead}>
                  <span className={styles.labCardCode}>
                    {territory.code}
                  </span>

                  <h3 className={styles.labCardName}>
                    <DocLink href={territory.href}>
                      {territory.name}
                    </DocLink>
                  </h3>
                </div>

                <p className={styles.labCardSignal}>
                  {territory.signal}
                </p>

                <div className={styles.labCardLinks}>
                  {territory.links.map((link) => (
                    <DocLink
                      key={link.href}
                      className={styles.labCardLink}
                      href={link.href}
                    >
                      {link.label}
                      <span aria-hidden="true"> →</span>
                    </DocLink>
                  ))}
                </div>
              </article>
            ))}
          </div>

          {/*
           * THE COLLECTIONS — the canonical deep documents. Work and
           * Research are no longer primary tabs: they are the deep
           * landing pages of this ecosystem, linked here (and from
           * the footer) with descriptive anchors.
           */}
          <div className={styles.labCollections} data-reveal="instant">
            <Link
              className={styles.labCollection}
              href={"/work/"}
             prefetch={false}>
              <span className={styles.labCollectionLabel}>
                COLLECTION / WORK
              </span>

              <strong className={styles.labCollectionTitle}>
                The systems in depth
              </strong>

              <span className={styles.labCollectionNote}>
                SHEYTAN, UHIT, FreeIran, WEB, the framework family,
                Contents, RED MAGIC — every entry with its
                architecture, stack, and repository.
              </span>

              <span className={styles.labCollectionAction}>
                Open Selected Work
                <span aria-hidden="true"> →</span>
              </span>
            </Link>

            <Link
              className={styles.labCollection}
              href={"/research/"}
             prefetch={false}>
              <span className={styles.labCollectionLabel}>
                COLLECTION / RESEARCH
              </span>

              <strong className={styles.labCollectionTitle}>
                The programme in depth
              </strong>

              <span className={styles.labCollectionNote}>
                The research questions, the REP/USEF frameworks, the
                UHIT measurement programme, and the six-hub research
                map.
              </span>

              <span className={styles.labCollectionAction}>
                Open Research
                <span aria-hidden="true"> →</span>
              </span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
