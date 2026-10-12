import type { ReactNode } from "react";

import Link from "next/link";

import { type HubProject } from "@/lib/hubs";

import styles from "@/components/content/content.module.css";

/*
 * CONTENT BUILDING BLOCKS (v3.1, soft internal navigation in v4.0.3)
 * — small server components shared by the content routes so every
 * document renders the same section, project, article-card and
 * link-row vocabulary.
 *
 * INTERNAL links render through next/link with viewport prefetch
 * disabled: the exported HTML carries the same crawlable, basePath-
 * aware anchor as before, and a hydrated browser upgrades the click
 * to a CLIENT-SIDE navigation — the root layout and the ONE global
 * Music player never unmount, so playback survives every in-document
 * jump (v4.0.2 gave the footer the same upgrade; v4.0.3 extends it to
 * the document body). External targets stay plain anchors with
 * rel="noreferrer".
 */

export function Section({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>

      <hr className={styles.sectionRule} />

      {children}
    </section>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return <div className={styles.body}>{children}</div>;
}

export function FocusList({
  items
}: {
  items: readonly { title: string; body: string }[];
}) {
  return (
    <div className={styles.focusList}>
      {items.map((item) => (
        <div key={item.title} className={styles.focusItem}>
          <h3 className={styles.focusItemTitle}>{item.title}</h3>

          <p className={styles.focusItemBody}>{item.body}</p>
        </div>
      ))}
    </div>
  );
}

/*
 * Internal hrefs stay RAW root-relative paths: next/link applies the
 * deployment basePath itself (routeHref would double-prefix it).
 */
export function DocLink({
  href,
  className,
  children
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={className} prefetch={false}>
      {children}
    </Link>
  );
}

export function ProjectCardList({
  projects
}: {
  projects: readonly HubProject[];
}) {
  return (
    <div className={styles.projectList}>
      {projects.map((project) => (
        <article key={project.name} className={styles.projectCard}>
          <div className={styles.projectHead}>
            <h3 className={styles.projectName}>{project.name}</h3>

            <span className={styles.projectMeta}>{project.meta}</span>
          </div>

          <p className={styles.projectWhat}>{project.what}</p>

          <p className={styles.projectWhy}>
            <strong>Why it matters.</strong> {project.why}
          </p>

          <div className={styles.projectLinks}>
            {project.links.map((link) =>
              link.external ? (
                <a
                  key={link.href}
                  className={styles.projectLink}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {link.label}
                  {" ↗"}
                </a>
              ) : (
                <DocLink
                  key={link.href}
                  href={link.href}
                  className={styles.projectLink}
                >
                  {link.label}
                </DocLink>
              )
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

export type ArticleCardEntry = {
  slug: string;
  title: string;
  subtitle: string | null;
  date: string;
  readingTime: string;
  category: string;
};

/**
 * Descriptive card for a related article. The whole card is one
 * anchor whose accessible name is the article title — the anchor
 * text is the article's own name, never "read more".
 */
export function ArticleCard({
  article,
  note
}: {
  article: ArticleCardEntry;
  note?: string;
}) {
  return (
    <DocLink
      className={styles.articleCard}
      href={`/blog/${article.slug}/`}
    >
      <h3 className={styles.articleCardTitle}>{article.title}</h3>

      {note && <p className={styles.articleCardNote}>{note}</p>}

      <p className={styles.articleCardMeta}>
        {article.category} · {article.date} · {article.readingTime}
      </p>
    </DocLink>
  );
}

export type ContentLink = {
  label: string;
  href: string;
  note: string;
  external: boolean;
};

export function LinkCardRow({ links }: { links: readonly ContentLink[] }) {
  return (
    <div className={styles.linkRow}>
      {links.map((link) =>
        link.external ? (
          <a
            key={link.href}
            className={styles.linkCard}
            href={link.href}
            target="_blank"
            rel="noreferrer"
          >
            <p className={styles.linkLabel}>
              {link.label}
              {" ↗"}
            </p>

            <p className={styles.linkNote}>{link.note}</p>
          </a>
        ) : (
          <DocLink
            key={link.href}
            href={link.href}
            className={styles.linkCard}
          >
            <p className={styles.linkLabel}>{link.label}</p>

            <p className={styles.linkNote}>{link.note}</p>
          </DocLink>
        )
      )}
    </div>
  );
}

export function NextStep({
  text,
  links
}: {
  text: string;
  links: readonly ContentLink[];
}) {
  return (
    <div className={styles.nextStep}>
      <p className={styles.nextStepText}>{text}</p>

      <div className={styles.nextStepLinks}>
        {links.map((link) =>
          link.external ? (
            <a
              key={link.href}
              className={styles.nextStepLink}
              href={link.href}
              target="_blank"
              rel="noreferrer"
            >
              {link.label}
              {" ↗"}

              <span className={styles.nextStepNote}> — {link.note}</span>
            </a>
          ) : (
            <DocLink
              key={link.href}
              href={link.href}
              className={styles.nextStepLink}
            >
              {link.label}

              <span className={styles.nextStepNote}> — {link.note}</span>
            </DocLink>
          )
        )}
      </div>
    </div>
  );
}
