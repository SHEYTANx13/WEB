import Link from "next/link";

import {
  CONTENT_NAV,
  PRIMARY_NAV,
  WORLD_NAV
} from "@/lib/navigation";

import styles from "@/components/SiteDocNav.module.css";

/*
 * SITE DOCUMENT NAV (v3.7, columns in v4.0.5; soft navigation since
 * v4.0.2) — crawlable links to the real, indexable documents,
 * carried by the shared SiteFooter on every page.
 *
 * Four logical groups, one compact COLUMN GRID:
 * - Site: the primary navigation (HOME, ABOUT, BLOG, CONTACT) — the
 *   Blog-centered information architecture;
 * - Collections: the canonical deep documents the Blog content
 *   ecosystem is built on (SELECTED WORK, RESEARCH) — kept crawlable
 *   site-wide so neither route can become orphaned;
 * - World: the experimental scenes (SYSTEMS, RED MAGIC, MEDIA) as
 *   contextual destinations;
 * - Topics: the six topic hubs — the research map, one hop from
 *   every document.
 *
 * The hash scenes remain interaction states; these anchors make the
 * whole content graph reachable without JavaScript. Since v4.0.2 the
 * groups render through next/link (the same component the unified
 * navigation uses): Link renders a plain crawlable anchor in the
 * exported HTML and applies the deployment basePath itself, while a
 * hydrated browser upgrades the click to a CLIENT-SIDE navigation —
 * the root layout (and with it the global Music player) never
 * unmounts, so playback continues across the whole site. The router
 * bundle already ships on every page (App Router hydration), so this
 * adds no new client JavaScript — it removes full page reloads.
 */

const DOCUMENT_LINKS: readonly { label: string; href: string }[] =
  PRIMARY_NAV.map((entry) => ({
    label: entry.label,
    href: entry.href
  }));

const COLLECTION_LINKS: readonly { label: string; href: string }[] =
  CONTENT_NAV.map((entry) => ({
    label: entry.label,
    href: entry.href
  }));

const WORLD_LINKS: readonly { label: string; href: string }[] =
  WORLD_NAV.map((entry) => ({
    label: entry.label,
    href: entry.href
  }));

const TOPIC_LINKS: readonly { label: string; href: string }[] = [
  { label: "Local AI", href: "/local-ai/" },
  { label: "AI Systems", href: "/ai-systems/" },
  { label: "AI Reasoning", href: "/ai-reasoning/" },
  { label: "AI Evaluation", href: "/ai-evaluation/" },
  { label: "Software Engineering", href: "/software-engineering/" },
  { label: "Creative Technology", href: "/creative-technology/" }
];

function NavColumn({
  heading,
  links,
  paired = false
}: {
  heading: string;
  links: readonly { label: string; href: string }[];
  /**
   * Paired groups flow their links through two sub-columns (the
   * six-entry TOPICS group) so the tallest footer group costs three
   * rows instead of six — the compact-footer contract (v4.0.5).
   */
  paired?: boolean;
}) {
  return (
    <div className={styles.group}>
      <span className={styles.heading}>{heading}</span>

      <ul
        className={styles.list}
        data-flow={paired ? "paired" : undefined}
      >
        {links.map((link) => (
          <li key={link.href}>
            {/*
              * Raw root-relative href: Link applies the deployment
              * basePath itself (routeHref would double-prefix it).
              */}
            <Link className={styles.link} href={link.href} prefetch={false}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SiteDocNav() {
  return (
    <nav className={styles.nav} aria-label="Site documents and topics">
      <NavColumn heading="Site" links={DOCUMENT_LINKS} />

      <NavColumn heading="Collections" links={COLLECTION_LINKS} />

      <NavColumn heading="World" links={WORLD_LINKS} />

      <NavColumn heading="Topics" links={TOPIC_LINKS} paired />
    </nav>
  );
}
