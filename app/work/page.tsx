import type { Metadata } from "next";

import {
  JsonLd,
  SITE_URL,
  contentBreadcrumbEntity,
  contentWebPageEntity
} from "@/lib/seo";

import { WORK_ROUTE, contentRouteMetadata, routeHref } from "@/lib/hubs";

import ContentShell from "@/components/content/ContentShell";

import {
  LinkCardRow,
  Prose,
  Section
} from "@/components/content/ContentBlocks";

import { getBlogMetaList } from "@/lib/blog";

import { WORK_ENTRIES } from "@/lib/workRegistry";

import { BRAND_STAR } from "@/lib/brand";

import styles from "@/components/content/content.module.css";

/*
 * /work/ — the canonical professional portfolio document (v3.7).
 *
 * ROLE (v3.7): Work is no longer a primary-navigation tab — it is
 * the CANONICAL DEEP LANDING PAGE of the Blog content ecosystem: a
 * search-engine landing document and detailed reference, while
 * discovery increasingly happens through the Blog's content modes
 * (see /blog/?type=work). This route stays indexable, crawlable,
 * and cross-linked in both directions.
 *
 * DATA (v3.9): the selected-systems entries live in
 * lib/workRegistry.ts — the same registry the article lateral
 * graph resolves project→Work edges against. One table, two
 * consumers; the Work document and the article related strips can
 * never disagree about what /work/ documents.
 *
 * PRESENTATION (v3.7): visual-first project cards. Every card leads
 * with a real visual — the project's committed article cover, or a
 * truthful geometric identity card built from its own technology
 * labels (never a fake screenshot) — then the scannable summary:
 * name, type, tech stack, one-sentence purpose, key signal, links.
 * The longer what/problem/why prose follows BELOW the visual
 * summary, inside the same card. Covers come from the generated
 * content index (the same assets the Blog cards use).
 *
 * Structured data: one WebPage plus an ItemList of the selected
 * systems (truthful — the page is genuinely an ordered list of
 * projects) referencing the same entity graph.
 */

export const metadata: Metadata = contentRouteMetadata({
  route: WORK_ROUTE.slug,
  title: WORK_ROUTE.metaTitle,
  description: WORK_ROUTE.metaDescription,
  ogAlt: "Selected work by Parsa Tak — AI systems, evaluation, software, and creative technology"
});

export default function WorkPage() {
  const metaList = getBlogMetaList();

  const bySlug = new Map(metaList.map((post) => [post.slug, post]));

  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Work", href: null }
  ];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            contentWebPageEntity({
              route: `${WORK_ROUTE.slug}/`,
              name: WORK_ROUTE.metaTitle,
              description: WORK_ROUTE.metaDescription,
              about: {
                "@type": "Thing",
                name: "Selected systems and projects by Parsa Tak"
              }
            }),
            {
              "@type": "ItemList",
              "@id": `${SITE_URL}/work/#projects`,
              name: "Selected systems and projects",
              itemListElement: WORK_ENTRIES.map((entry, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: entry.name,
                description: entry.purpose
              }))
            },
            contentBreadcrumbEntity(`${WORK_ROUTE.slug}/`, crumbs)
          ]
        }}
      />

      <ContentShell
        kicker="SELECTED WORK"
        title="Selected Work"
        crumbs={crumbs}
        activeHref="/work/"
        lead={[
          "The significant public systems of the laboratory: local AI agents, machine-intelligence measurement, production software under hostile constraints, static-site engineering, and the creative line. Each card leads with the system's real visual identity, its stack, and its purpose — the deep documentation follows inside the card.",
          "This document is the canonical, indexable counterpart of the living Work scene; ongoing discovery of the writing behind these systems happens in the Blog — browse the work documentation stream there."
        ]}
      >
        <Section title="The systems">
          <div className={styles.projectVisualList}>
            {WORK_ENTRIES.map((entry, index) => {
              const article = entry.articleSlug
                ? bySlug.get(entry.articleSlug) ?? null
                : null;

              const coverPost = entry.coverSlug
                ? bySlug.get(entry.coverSlug) ?? null
                : null;

              return (
                <article
                  key={entry.name}
                  className={styles.projectVisualCard}
                  aria-label={`${entry.name} — ${entry.type.toLowerCase()}`}
                >
                  {/*
                   * THE VISUAL — the system's real identity: the
                   * committed article cover when one exists, or a
                   * truthful geometric card built from the 13-point
                   * star identity and the system's own technology
                   * labels. Never a fabricated screenshot.
                   */}
                  {coverPost?.cover ? (
                    <a
                      className={styles.projectVisualMedia}
                      href={routeHref(
                        `/blog/${article?.slug ?? coverPost.slug}/`
                      )}
                      tabIndex={-1}
                      aria-hidden="true"
                    >
                      <img
                        src={coverPost.cover.src}
                        alt=""
                        width={coverPost.cover.width}
                        height={coverPost.cover.height}
                        loading={index < 2 ? "eager" : "lazy"}
                        decoding="async"
                      />
                    </a>
                  ) : (
                    <div
                      className={`${styles.projectVisualMedia} ${styles.projectVisualIdentity}`}
                      aria-hidden="true"
                    >
                      <img
                        src={BRAND_STAR.red}
                        alt=""
                        width={54}
                        height={54}
                        loading="lazy"
                        decoding="async"
                      />

                      <span className={styles.projectVisualIdentityLabel}>
                        CONTENT
                        <br />
                        INFRASTRUCTURE
                      </span>
                    </div>
                  )}

                  <div className={styles.projectVisualContent}>
                    <div className={styles.projectVisualHead}>
                      {/*
                       * NAME → ARTICLE (v3.9): the card's first
                       * interaction routes to its proof — the field
                       * notes documenting the system. A plain anchor
                       * through routeHref (zero client JS), with the
                       * project name as the descriptive anchor text.
                       * Cards without an article keep the plain name.
                       */}
                      <h3 className={styles.projectVisualName}>
                        <span
                          aria-hidden="true"
                          className={styles.projectNumber}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>{" "}
                        {article ? (
                          <a
                            className={styles.projectLink}
                            href={routeHref(`/blog/${article.slug}/`)}
                          >
                            {entry.name}
                          </a>
                        ) : (
                          entry.name
                        )}
                      </h3>

                      <span className={styles.projectMeta}>{entry.type}</span>
                    </div>

                    {/*
                     * SCANNABLE SUMMARY — purpose, signal, stack. The
                     * card is understood in seconds; depth follows.
                     */}
                    <p className={styles.projectPurpose}>{entry.purpose}</p>

                    <p className={styles.projectSignal}>{entry.signal}</p>

                    <p className={styles.projectMeta}>{entry.tech}</p>

                    <div className={styles.projectLinks}>
                      {entry.links.map((link) => (
                        <a
                          key={link.href}
                          className={styles.projectLink}
                          href={link.external ? link.href : routeHref(link.href)}
                          target={link.external ? "_blank" : undefined}
                          rel={link.external ? "noreferrer" : undefined}
                        >
                          {link.label}
                          {link.external ? " ↗" : ""}
                        </a>
                      ))}

                      {article && (
                        <a
                          className={styles.projectLink}
                          href={routeHref(`/blog/${article.slug}/`)}
                        >
                          {article.title}
                        </a>
                      )}

                      {entry.blogProject && (
                        <a
                          className={styles.projectLink}
                          href={routeHref(
                            `/blog/?project=${encodeURIComponent(
                              entry.blogProject
                            )}`
                          )}
                        >
                          All {entry.name.split(" — ")[0].split(" · ")[0]}{" "}
                          writing in the Blog
                        </a>
                      )}
                    </div>
                  </div>

                  {/*
                   * THE DEEP DOCUMENTATION — what/problem/why, below
                   * the visual summary, inside the same card.
                   */}
                  <div className={styles.projectVisualDetail}>
                    <p className={styles.projectWhat}>{entry.what}</p>

                    <p className={styles.projectWhy}>
                      <strong>The problem.</strong> {entry.problem}
                    </p>

                    <p className={styles.projectWhy}>
                      <strong>Why it matters.</strong> {entry.why}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </Section>

        <Section title="Where to go deeper">
          <Prose>
            <p>
              Each domain of this portfolio has a topic hub — a real
              document that defines the area and connects its systems,
              frameworks, and articles. The Blog carries the ongoing
              writing behind every system, and the research programme
              document maps the questions the systems exist to answer.
            </p>
          </Prose>

          <LinkCardRow
            links={[
              {
                label: "Work documentation in the Blog",
                href: "/blog/?type=work",
                note: "Every system's engineering notes, one stream",
                external: false
              },
              {
                label: "Research — the programme behind the systems",
                href: "/research/",
                note: "Questions, frameworks, measurement",
                external: false
              },
              {
                label: "Local AI systems & agents",
                href: "/local-ai/",
                note: "SHEYTAN, managed inference, verification gates",
                external: false
              },
              {
                label: "AI systems engineering",
                href: "/ai-systems/",
                note: "AI Instructions, REP, USEF, governed agents",
                external: false
              },
              {
                label: "AI evaluation & benchmarks",
                href: "/ai-evaluation/",
                note: "UHIT, AIST-2026.09, ASI-100-Elite",
                external: false
              },
              {
                label: "Software engineering",
                href: "/software-engineering/",
                note: "FreeIran, WEB, static architecture, honest tests",
                external: false
              },
              {
                label: "Creative technology",
                href: "/creative-technology/",
                note: "RED MAGIC, the living web, computational identity",
                external: false
              },
              {
                label: "About Parsa Tak",
                href: "/about/",
                note: "Who I am, how I work, and what I build",
                external: false
              }
            ]}
          />
        </Section>
      </ContentShell>
    </>
  );
}
