import { JsonLd, contentBreadcrumbEntity, contentWebPageEntity } from "@/lib/seo";

import { routeHref, type HubDefinition } from "@/lib/hubs";

import ContentShell from "@/components/content/ContentShell";

import {
  ArticleCard,
  DocLink,
  FocusList,
  LinkCardRow,
  NextStep,
  ProjectCardList,
  Prose,
  Section
} from "@/components/content/ContentBlocks";

import { getBlogMetaList } from "@/lib/blog";

import styles from "@/components/content/content.module.css";

/*
 * HUB PAGE VIEW (v3.1) — the shared renderer for the six topic hubs.
 *
 * Every hub renders the same honest structure: H1 + lead, what
 * I actually work on in the area, the systems built here,
 * genuinely related field notes, related destinations, and a next
 * exploration path. All content comes from the hub's definition in
 * lib/hubs.ts — real site material only, nothing fabricated.
 *
 * The route files stay thin (metadata + definition lookup); this
 * component owns the document structure once, so hubs can never
 * drift apart structurally.
 */

/*
 * Topic name in mid-sentence casing: lowercase every word except
 * acronyms (AI), so the focus section title reads naturally —
 * "What I work on in local AI", "What I work on in AI reasoning".
 */
function topicInSentence(topic: string): string {
  return topic
    .split(" ")
    .map((word) => (word === "AI" ? word : word.toLowerCase()))
    .join(" ");
}

export default function HubPageView({ hub }: { hub: HubDefinition }) {
  const metaList = getBlogMetaList();

  const articleEntries = hub.articles
    .map((ref) => {
      const post = metaList.find((candidate) => candidate.slug === ref.slug);

      return post ? { ref, post } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const crumbs = [
    { name: "Home", href: "/" },
    { name: hub.topicName, href: null }
  ];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            contentWebPageEntity({
              route: `${hub.slug}/`,
              name: hub.metaTitle,
              description: hub.metaDescription,
              about: {
                "@type": "Thing",
                name: hub.topicName
              }
            }),
            contentBreadcrumbEntity(`${hub.slug}/`, crumbs)
          ]
        }}
      />

      <ContentShell
        kicker={hub.kicker}
        title={hub.h1}
        crumbs={crumbs}
        lead={hub.lead}
        activeHref={`/${hub.slug}/`}
      >
        <Section title={`What I work on in ${topicInSentence(hub.topicName)}`}>
          <FocusList items={hub.focus} />
        </Section>

        <Section title="Systems in this area">
          <ProjectCardList projects={hub.projects} />

          <Prose>
            <p>
              The complete portfolio — including the systems from other
              domains — is collected on the{" "}
              <DocLink href="/work/">Selected Work page</DocLink>.
            </p>
          </Prose>
        </Section>

        <Section title="Field notes">
          <Prose>
            <p>
              Articles from the laboratory that genuinely belong to this
              topic — each one states its relationship to the area.
            </p>
          </Prose>

          <div className={styles.articleList}>
            {articleEntries.map(({ ref, post }) => (
              <ArticleCard
                key={post.slug}
                article={{
                  slug: post.slug,
                  title: post.title,
                  subtitle: post.subtitle,
                  date: post.date,
                  readingTime: post.readingTime,
                  category: post.category
                }}
                note={ref.relationship}
              />
            ))}
          </div>
        </Section>

        <Section title="Related destinations">
          <LinkCardRow links={hub.crossLinks} />
        </Section>

        <NextStep text={hub.nextStep.text} links={hub.nextStep.links} />
      </ContentShell>
    </>
  );
}
