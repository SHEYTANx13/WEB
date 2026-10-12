import type {
  Metadata
} from "next";

import Link from "next/link";

import { notFound } from "next/navigation";

import {
  formatBlogDate,
  formatBlogDateShort,
  getAdjacentPosts,
  getBlogMetaList,
  getLinksHere,
  getPost,
  getRelatedDestinations,
  getRelatedPosts,
  type RelatedPost
} from "@/lib/blog";

import { getHubForArticle, routeHref } from "@/lib/hubs";

import { CONTENT_TYPE_LABELS } from "@/lib/blogFormat";

import {
  AUTHOR_RESEARCH_LINE,
  AUTHOR_TAGLINE,
  JsonLd,
  PERSON_ID,
  PERSON_NAME,
  SITE_IN_LANGUAGE,
  SITE_OG_IMAGE_HEIGHT,
  SITE_OG_IMAGE_PATH,
  SITE_OG_IMAGE_WIDTH,
  SITE_URL
} from "@/lib/seo";

import ReadingProgress from "@/components/ReadingProgress";

import ArticleToc from "@/components/blog/ArticleToc";

import ArticleKeys from "@/components/blog/ArticleKeys";

import CodeCopy from "@/components/blog/CodeCopy";

import ShareLink from "@/components/blog/ShareLink";

import TextSize from "@/components/blog/TextSize";

import styles from "./article.module.css";

/*
 * Blog article — fully static.
 *
 * Every page below is prerendered at build time from the generated
 * content index. The article body is build-time HTML from the
 * validated markdown source; no markdown is parsed in the browser
 * and no client component hydrates on this route beyond the cursor.
 *
 * SEO: one JSON-LD graph per article — BreadcrumbList + BlogPosting —
 * describing exactly what the page shows (real headline, real dates,
 * real cover, real navigation hierarchy Home → Blog → article).
 * Author/publisher reference the site-wide Person @id so the
 * article plugs into the same entity graph as every other route.
 */

type ArticlePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return getBlogMetaList().map(
    (post) => ({
      slug: post.slug
    })
  );
}

function resolvePost(
  slug: string
) {
  const post = getPost(slug);

  if (!post) {
    notFound();
  }

  return post;
}

/*
 * Social image for an article: the cover's PNG twin when the
 * article has one, otherwise the site-level default. Root-relative
 * paths — Next resolves og/twitter image URLs against the
 * production metadataBase.
 */
function socialImage(post: NonNullable<ReturnType<typeof getPost>>) {
  const cover = post.cover;

  if (cover && cover.ogSrc) {
    return {
      url: cover.ogSrc,
      alt: cover.alt,
      width: cover.width,
      height: cover.height
    };
  }

  return {
    url: SITE_OG_IMAGE_PATH,
    alt: `${post.title} — Parsa Tak`,
    width: SITE_OG_IMAGE_WIDTH,
    height: SITE_OG_IMAGE_HEIGHT
  };
}

export async function generateMetadata({
  params
}: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;

  const post = getPost(slug);

  if (!post) {
    return {
      title: "Article not found"
    };
  }

  const image = socialImage(post);

  return {
    title: post.title,
    description: post.description,

    alternates: {
      canonical: `/blog/${post.slug}/`
    },

    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}/`,
      publishedTime: post.date,
      modifiedTime:
        post.updated ?? post.date,
      authors: [post.author],
      tags: post.tags,
      images: [
        {
          url: image.url,
          width: image.width,
          height: image.height,
          alt: image.alt
        }
      ]
    },

    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [
        {
          url: image.url,
          alt: image.alt
        }
      ]
    },

    robots: {
      index: true,
      follow: true
    }
  };
}

/*
 * RELATED CONTENT hierarchy (v2.5).
 *
 * The build-time index already orders related articles by relevance.
 * The page splits them into two readable tiers instead of one wall:
 * primary = author-explicit relationships and scored matches at or
 * above PRIMARY_SCORE_THRESHOLD (rich cards with excerpt); everything
 * else becomes a compact secondary row. Deterministic, no runtime
 * scoring, no recommendation engine — just the precomputed graph.
 */
const RELATED_PRIMARY_COUNT = 3;

const RELATED_PRIMARY_SCORE = 8;

function splitRelated(related: readonly RelatedPost[]): {
  primary: RelatedPost[];
  secondary: RelatedPost[];
} {
  const primary: RelatedPost[] = [];
  const secondary: RelatedPost[] = [];

  for (const entry of related) {
    const isPrimary =
      entry.explicit ||
      (entry.score !== null && entry.score >= RELATED_PRIMARY_SCORE);

    if (isPrimary && primary.length < RELATED_PRIMARY_COUNT) {
      primary.push(entry);
    } else {
      secondary.push(entry);
    }
  }

  return { primary, secondary };
}

export default async function ArticlePage({
  params
}: ArticlePageProps) {
  const { slug } = await params;

  const post = resolvePost(
    slug
  );

  const adjacent =
    getAdjacentPosts(
      post.slug
    );

  const related =
    getRelatedPosts(
      post.slug
    );

  const { primary: relatedPrimary, secondary: relatedSecondary } =
    splitRelated(related);

  /*
   * LATERAL CONTENT DESTINATIONS (v3.9) — the deterministic
   * article→collection edges (Selected Work via the article's
   * project registry entry; Research via the content type). Rendered
   * as crawlable rows in the related section, they make the four
   * content types — topic, article, work, research — one connected
   * graph instead of three parallel catalogs.
   */
  const relatedDestinations =
    getRelatedDestinations(
      post.slug
    );

  /*
   * REVERSE LINK GRAPH (v2.5.4) — the "Referenced by" section.
   * Articles whose prose links into this one; the same link graph
   * the build validates, walked backwards. Empty when nothing links
   * here (the section simply doesn't render).
   */
  const linksHere =
    getLinksHere(
      post.slug
    );

  /*
   * TOPIC HUB EDGE (v3.1): the article's honest primary hub. When it
   * exists, the page renders one crawlable "TOPIC HUB" chip and the
   * author box sits next to the article's home in the knowledge
   * graph — a real semantic edge, never a keyword link.
   */
  const hub = getHubForArticle(post.slug);

  const publishedDate =
    formatBlogDate(
      post.date
    );

  const updatedDate =
    post.updated
      ? formatBlogDate(
          post.updated
        )
      : null;

  /*
   * Article structured data. The image field is absolute (JSON-LD
   * is not resolved against metadataBase the way Next metadata is)
   * and present exactly when a cover actually exists.
   */
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",

    "@graph": [
      {
        "@type": "BreadcrumbList",

        "@id": `${SITE_URL}/blog/${post.slug}/#breadcrumb`,

        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: `${SITE_URL}/`
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Blog",
            item: `${SITE_URL}/blog/`
          },
          {
            "@type": "ListItem",
            position: 3,
            name: post.title
          }
        ]
      },

      {
        "@type": "BlogPosting",

        "@id": `${SITE_URL}/blog/${post.slug}/#article`,

        headline:
          post.title,

        description:
          post.description,

        url:
          `${SITE_URL}/blog/${post.slug}/`,

        datePublished:
          post.date,

        dateModified:
          post.updated ??
          post.date,

        author: {
          "@type": "Person",
          "@id": PERSON_ID,
          name: post.author
        },

        publisher: {
          "@type": "Person",
          "@id": PERSON_ID,
          name: PERSON_NAME
        },

        isPartOf: {
          "@id": `${SITE_URL}/blog/#blog`
        },

        breadcrumb: {
          "@id": `${SITE_URL}/blog/${post.slug}/#breadcrumb`
        },

        mainEntityOfPage: {
          "@type": "WebPage",
          "@id":
            `${SITE_URL}/blog/${post.slug}/`
        },

        image: [
          `${SITE_URL}${
            post.cover?.ogSrc ??
            SITE_OG_IMAGE_PATH
          }`
        ],

        keywords:
          post.tags.join(", "),

        wordCount:
          post.wordCount,

        articleSection:
          post.category,

        inLanguage: SITE_IN_LANGUAGE
      }
    ]
  };

  return (
    <article
      className={styles.article}
    >
      <ReadingProgress />

      <ArticleKeys
        prevHref={
          adjacent.prev
            ? `/blog/${adjacent.prev.slug}/`
            : null
        }
        nextHref={
          adjacent.next
            ? `/blog/${adjacent.next.slug}/`
            : null
        }
      />

      <JsonLd data={jsonLd} />

      <div className="page-container">
        <header
          className={styles.header}
          data-category={
            post.category
          }
          data-reveal="instant"
        >
          <p
            className={
              styles.headerKicker
            }
          >
            <Link
              href="/blog/"
              className={
                styles.backLink
              }
            prefetch={false}
            >
              ← BLOG
            </Link>

            <span
              className={
                styles.headerCategory
              }
            >
              {post.category}
            </span>

            <span>
              {
                post.readingTime
              }
            </span>

            {/*
             * INBOUND AUTHORITY BADGE (v2.5.5): how many other
             * articles link into this one, from the same validated
             * build-time graph the REFERENCED BY section renders.
             * An in-page fragment link — the verifier proves the
             * target id exists on every page that renders it.
             */}
            {linksHere.length > 0 && (
              <a
                href="#referenced-by"
                className={
                  styles.headerRefs
                }
                title={`${linksHere.length} article${linksHere.length === 1 ? "" : "s"} reference this article`}
              >
                <span aria-hidden="true">
                  ↩
                </span>{" "}
                {
                  linksHere.length
                }
                <span className="sr-only">
                  {" "}
                  articles reference this — jump to the list
                </span>
              </a>
            )}
          </p>

          <h1
            className={
              styles.title
            }
          >
            {post.title}
          </h1>

          {post.subtitle && (
            <p
              className={
                styles.subtitle
              }
            >
              {post.subtitle}
            </p>
          )}

          <div
            className={
              styles.meta
            }
          >
            <span>
              {
                post.author
              }
            </span>

            <time
              dateTime={
                post.date
              }
            >
              {
                publishedDate
              }
            </time>

            {updatedDate && (
              <span>
                UPDATED{" "}
                {
                  updatedDate
                }
              </span>
            )}

            <span>
              {
                post.wordCount
              }
              {" "}
              WORDS
            </span>
          </div>

          {/*
           * AT A GLANCE (v3.7): the type chip always renders — every
           * article has a classified content type. Project, hub, and
           * topic chips follow when their metadata exists.
           */}
          <div
            className={
              styles.contextChips
            }
            data-reveal="instant"
          >
              {/**
                * TYPE CHIP (v3.7) — the at-a-glance strip leads with
                * the content type: what the reader is about to enter
                * (ARTICLE / WORK / RESEARCH documentation), linking
                * into the Blog's matching content mode.
                */}
              <Link
                className={`${styles.contextChip} ${styles.contextChipType}`}
                href={`/blog/?type=${post.type}`}
                data-type={post.type}
                title={`More ${CONTENT_TYPE_LABELS[post.type].toLowerCase()} content in the Blog`}
              prefetch={false}
              >
                <span
                  className={
                    styles.contextChipLabel
                  }
                >
                  TYPE
                </span>

                {CONTENT_TYPE_LABELS[post.type]}
              </Link>

              {post.project && (
                <Link
                  className={`${styles.contextChip} ${styles.contextChipProject}`}
                  href={`/blog/?project=${encodeURIComponent(
                    post.project
                  )}`}
                  title={`More from the ${post.project} project`}
                prefetch={false}
                >
                  <span
                    className={
                      styles.contextChipLabel
                    }
                  >
                    PROJECT
                  </span>

                  {
                    post.project
                  }
                </Link>
              )}

              {/*
                * WRITING → WORK (v3.0): every project-tagged article
                * also links to the Work scene, where that project's
                * section lives. A crawlable normal anchor — the hash
                * scene target is part of the same canonical document,
                * so this adds a real internal edge without creating a
                * duplicate URL.
                */}
              {post.project && (
                <Link
                  className={
                    styles.contextChip
                  }
                  href="/#work"
                  title="Open the Work scene"
                prefetch={false}
                >
                  <span
                    className={
                      styles.contextChipLabel
                    }
                  >
                    SCENE
                  </span>

                  Work ↗
                </Link>
              )}

              {/*
                * TOPIC HUB EDGE (v3.1): one crawlable chip to the
                * article's primary topic hub — the document that
                * owns this subject in the site's content graph.
                * Rendered before the free-form topic chips so the
                * structured relationship reads first.
                */}
              {hub && (
                <Link
                  className={styles.contextChip}
                  href={`/${hub.slug}/`}
                  title={`${hub.topicName} — topic hub`}
                prefetch={false}
                >
                  <span
                    className={
                      styles.contextChipLabel
                    }
                  >
                    TOPIC HUB
                  </span>

                  {hub.topicName}
                </Link>
              )}

              {post.topics.map(
                (topic) => (
                  <Link
                    key={
                      topic
                    }
                    className={
                      styles.contextChip
                    }
                    href={`/blog/?topic=${encodeURIComponent(
                      topic
                    )}`}
                    title={`More articles on ${topic}`}
                  prefetch={false}
                  >
                    <span
                      className={
                        styles.contextChipLabel
                      }
                    >
                      TOPIC
                    </span>

                    {
                      topic
                    }
                  </Link>
                )
              )}
          </div>
        </header>

        {/*
          * COVER MOTION (v2.7): the reversible flow reveal — the
          * image enters with a restrained settle (opacity + slight
          * rise + scale) and eases back toward its quiet state as
          * it leaves the viewport, sharing the single
          * IntersectionObserver behind MotionReveal with the rest
          * of the site. Transform/opacity only: the box never
          * changes size, so no layout shift in either direction.
          */}
        {post.cover && (
          <figure
            className={
              styles.cover
            }
            data-reveal="flow"
          >
            <img
              src={
                post.cover.src
              }
              alt={
                post.cover.alt
              }
              width={
                post.cover.width
              }
              height={
                post.cover.height
              }
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </figure>
        )}

        {/*
         * ARTICLE TOC (v2.5.1) — inline disclosure (narrow viewports)
         * + fixed right-rail instrument (≥1280px), sharing the
         * build-time headings data. Scroll-spy is one
         * IntersectionObserver; without JS the links still navigate.
         */}
        <ArticleToc
          headings={
            post.headings
          }
        />

        <div
          className={
            styles.body
          }
          dangerouslySetInnerHTML={{
            __html: post.html
          }}
        />

        {/*
         * CODE COPY (v2.5.2) — a silent enhancement island: renders
         * nothing, gives every code block one COPY affordance after
         * hydration. Without JS the code stays fully readable.
         */}
        <CodeCopy />

        {/*
         * FOOTER ROW (v2.8) — rendered unconditionally. Previously
         * the whole row (including the reserved actions slot) was
         * gated on tags.length, so a tagless article silently lost
         * COPY LINK and the reader text-size control. Tags render
         * only when present; the actions slot is always reserved.
         */}
        <div
          className={
            styles.tags
          }
          data-reveal="instant"
        >
          {post.tags.length > 0 && (
            <div
              className={
                styles.tagList
              }
            >
              {post.tags.map(
                (tag) => (
                  <span
                    key={tag}
                  >
                    {tag}
                  </span>
                )
              )}
            </div>
          )}

            {/*
              * Actions slot (v2.5.3) — reserved right edge of the
              * row; the ShareLink island docks a COPY LINK button
              * here after hydration, and since v2.5.7 the TextSize
              * island docks a three-step reader text-size control
              * beside it. Empty without JS.
              */}
            <span
              className={
                styles.tagsActions
              }
              data-article-actions
            >
              <ShareLink />

              <TextSize />
            </span>
        </div>

        {/*
          * AUTHOR AUTHORITY BLOCK (v3.1) — visible, factual authorship
          * on every article. One wording, shared with /about/ and the
          * Person entity via lib/seo constants; the name links to the
          * /about/ entity page. No credentials beyond what the site
          * actually presents.
          */}
        <section
          className={styles.authorBox}
          data-reveal="instant"
          aria-label="About the author"
        >
          <p className={styles.authorKicker}>AUTHOR</p>

          <p className={styles.authorName}>
            By{" "}
            <Link href="/about/" prefetch={false}>
              {post.author}
            </Link>
          </p>

          <p className={styles.authorTagline}>
            {AUTHOR_TAGLINE}
          </p>

          <p className={styles.authorResearch}>
            {AUTHOR_RESEARCH_LINE}
          </p>
        </section>

        <nav
          className={
            styles.adjacentNav
          }
          data-count={
            (adjacent.prev ? 1 : 0) +
            (adjacent.next ? 1 : 0)
          }
          aria-label="Article navigation"
          data-reveal=""
        >
          {adjacent.prev ? (
            <Link
              className={
                styles.adjacentLink
              }
              href={`/blog/${adjacent.prev.slug}/`}
            prefetch={false}
            >
              <span
                className={
                  styles.adjacentLabel
                }
              >
                ← PREVIOUS

                <kbd
                  className={
                    styles.adjacentKey
                  }
                  aria-hidden="true"
                >
                  K
                </kbd>
              </span>

              <span
                className={
                  styles.adjacentTitle
                }
              >
                {
                  adjacent.prev.title
                }
              </span>
            </Link>
          ) : (
            <span />
          )}

          {adjacent.next && (
            <Link
              className={`${styles.adjacentLink} ${styles.adjacentLinkNext}`}
              href={`/blog/${adjacent.next.slug}/`}
            prefetch={false}
            >
              <span
                className={
                  styles.adjacentLabel
                }
              >
                NEXT →

                <kbd
                  className={
                    styles.adjacentKey
                  }
                  aria-hidden="true"
                >
                  J
                </kbd>
              </span>

              <span
                className={
                  styles.adjacentTitle
                }
              >
                {
                  adjacent.next.title
                }
              </span>
            </Link>
          )}
        </nav>

        {(related.length > 0 || relatedDestinations.length > 0) && (
          <section
            className={
              styles.related
            }
            aria-label="Related articles, systems, and research"
            data-reveal=""
          >
            <p
              className={
                styles.relatedKicker
              }
            >
              RELATED TRANSMISSIONS
            </p>

            {relatedPrimary.length > 0 && (
              <div
                className={
                  styles.relatedPrimaryGrid
                }
              >
                {relatedPrimary.map(
                  (
                    relatedEntry,
                    index
                  ) => (
                    <Link
                      key={
                        relatedEntry.post.slug
                      }
                      className={
                        styles.relatedCard
                      }
                      href={`/blog/${relatedEntry.post.slug}/`}
                      prefetch={
                        false
                      }
                      data-category={
                        relatedEntry.post.category
                      }
                      data-reveal=""
                      data-reveal-order={
                        index
                      }
                    >
                      <span
                        className={
                          styles.relatedCardCategory
                        }
                      >
                        {
                          relatedEntry.post.category
                        }
                      </span>

                      <strong
                        className={
                          styles.relatedCardTitle
                        }
                      >
                        {
                          relatedEntry.post.title
                        }
                      </strong>

                      <span
                        className={
                          styles.relatedCardExcerpt
                        }
                      >
                        {
                          relatedEntry.post.excerpt
                        }
                      </span>

                      <span
                        className={
                          styles.relatedCardMeta
                        }
                      >
                        {
                          relatedEntry.post.readingTime
                        }
                        {" · "}
                        {formatBlogDateShort(
                          relatedEntry.post.date
                        )}
                      </span>

                      {/*
                       * WHY-RELATED HINT (v2.5.5): the strongest
                       * concrete overlaps the build model found —
                       * or the author-curated mark for explicit
                       * frontmatter relationships. Plain text, one
                       * quiet mono line, never a link.
                       */}
                      {(relatedEntry.explicit ||
                        relatedEntry.shared.length > 0) && (
                        <span
                          className={
                            styles.relatedShared
                          }
                        >
                          {relatedEntry.explicit
                            ? "★ author-curated"
                            : relatedEntry.shared.join(
                                " · "
                              )}
                        </span>
                      )}
                    </Link>
                  )
                )}
              </div>
            )}

            {relatedSecondary.length > 0 && (
              <ul
                className={
                  styles.relatedSecondaryList
                }
              >
                {relatedSecondary.map(
                  (
                    relatedEntry,
                    index
                  ) => (
                    <li
                      key={
                        relatedEntry.post.slug
                      }
                      data-category={
                        relatedEntry.post.category
                      }
                      data-reveal="instant"
                      data-reveal-order={
                        index
                      }
                    >
                      <Link
                        className={
                          styles.relatedRow
                        }
                        href={`/blog/${relatedEntry.post.slug}/`}
                        prefetch={
                          false
                        }
                      >
                        <span
                          className={
                            styles.relatedRowCategory
                          }
                        >
                          {
                            relatedEntry.post.category
                          }
                        </span>

                        <span
                          className={
                            styles.relatedRowTitle
                          }
                        >
                          {
                            relatedEntry.post.title
                          }
                        </span>

                        <span
                          className={
                            styles.relatedRowMeta
                          }
                        >
                          {
                            relatedEntry.post.readingTime
                          }
                          {" · "}
                          {formatBlogDateShort(
                            relatedEntry.post.date
                          )}
                        </span>

                        {/*
                         * WHY-RELATED HINT on the compact rows
                         * (v2.5.5): same data as the cards, own
                         * full-width flex line so the row grid
                         * (category · title · meta) stays intact.
                         */}
                        {(relatedEntry.explicit ||
                          relatedEntry.shared.length > 0) && (
                          <span
                            className={
                              styles.relatedRowShared
                            }
                          >
                            {relatedEntry.explicit
                              ? "★ author-curated"
                              : relatedEntry.shared.join(
                                  " · "
                                )}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            )}
            {/*
             * LATERAL DESTINATIONS (v3.9) — the crawlable
             * article→collection edges. Same row language as the
             * secondary related list; the kind label names the
             * relationship (SYSTEMS / RESEARCH), the anchor names the
             * real destination, and the note states the provenance.
             * Plain anchors through routeHref: exported HTML, zero
             * client JavaScript, descriptive anchor text.
             */}
            {relatedDestinations.length > 0 && (
              <div
                className={
                  styles.relatedLateral
                }
              >
                <p className={styles.relatedLateralKicker}>
                  IN THE LABORATORY
                </p>

                <ul className={styles.relatedSecondaryList}>
                  {relatedDestinations.map(
                    (
                      destination,
                      index
                    ) => (
                      <li
                        key={
                          destination.href
                        }
                        data-destination={
                          destination.kind
                        }
                        data-reveal="instant"
                        data-reveal-order={
                          index
                        }
                      >
                        <a
                          className={
                            styles.relatedRow
                          }
                          href={routeHref(
                            destination.href
                          )}
                        >
                          <span
                            className={
                              styles.relatedRowCategory
                            }
                          >
                            {destination.kind === "work"
                              ? "SYSTEMS"
                              : "RESEARCH"}
                          </span>

                          <span
                            className={
                              styles.relatedRowTitle
                            }
                          >
                            {
                              destination.label
                            }
                          </span>

                          <span
                            className={
                              styles.relatedLateralNote
                            }
                          >
                            {
                              destination.note
                            }
                          </span>

                          <span
                            className={
                              styles.relatedRowMeta
                            }
                            aria-hidden="true"
                          >
                            →
                          </span>
                        </a>
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}
          </section>
        )}

        {linksHere.length > 0 && (
          <section
            id="referenced-by"
            className={
              styles.linksHere
            }
            aria-label="Articles that link here"
            data-reveal=""
          >
            <p
              className={
                styles.relatedKicker
              }
            >
              REFERENCED BY
            </p>

            <ul
              className={
                styles.linksHereList
              }
            >
              {linksHere.map(
                (
                  referencingPost
                ) => (
                  <li
                    key={
                      referencingPost.slug
                    }
                    data-category={
                      referencingPost.category
                    }
                    data-reveal="instant"
                  >
                    <Link
                      className={
                        styles.linksHereRow
                      }
                      href={`/blog/${referencingPost.slug}/`}
                      prefetch={
                        false
                      }
                    >
                      <span
                        className={
                          styles.linksHereGlyph
                        }
                        aria-hidden="true"
                      >
                        ↩
                      </span>

                      <span
                        className={
                          styles.relatedRowCategory
                        }
                      >
                        {
                          referencingPost.category
                        }
                      </span>

                      <span
                        className={
                          styles.linksHereTitle
                        }
                      >
                        {
                          referencingPost.title
                        }
                      </span>

                      <span
                        className={
                          styles.relatedRowMeta
                        }
                      >
                        {
                          referencingPost.readingTime
                        }
                        {" · "}
                        {formatBlogDateShort(
                          referencingPost.date
                        )}
                      </span>
                    </Link>
                  </li>
                )
              )}
            </ul>
          </section>
        )}

        <div
          className={
            styles.footerNav
          }
        >
          <Link
            className={`button button-secondary ${styles.backToIndex}`}
            href="/blog/"
          prefetch={false}
          >
            ← All articles
          </Link>

          <Link
            className={`button button-secondary ${styles.backToWorld}`}
            href="/"
          prefetch={false}
          >
            Back to the world
          </Link>
        </div>
      </div>
    </article>
  );
}
