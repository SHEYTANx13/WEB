import Link from "next/link";

import { BRAND_STAR } from "@/lib/brand";
import UnifiedSiteNav, {
  type UnifiedNavEntry
} from "@/components/UnifiedSiteNav";
import SiteHeaderStatus from "@/components/SiteHeaderStatus";
import { PRIMARY_NAV, WORLD_NAV } from "@/lib/navigation";

import { GITHUB_LINK } from "@/lib/links";

import styles from "./BlogHeader.module.css";

/*
 * Blog header — server-rendered shell with one small client island.
 *
 * v3.4 navigation: the header carries the UNIFIED navigation system
 * (UnifiedSiteNav) — the same renderer, data source, geometry,
 * accents, active states and animation language as the world HUD,
 * the content documents and the topic hubs. BLOG is the active
 * area; the experimental world scenes (SYSTEMS, RED MAGIC, MEDIA)
 * follow as the quieter secondary group; GitHub rides as a utility
 * entry inside the ≤860px disclosure menu. The disclosure trigger is
 * the unified navigation's own compact mode.
 */

const NAV_ENTRIES: readonly UnifiedNavEntry[] = [
  ...PRIMARY_NAV.map(
    (entry): UnifiedNavEntry => ({
      kind: "link",
      group: "primary",
      id: entry.id,
      label: entry.label,
      shortLabel: entry.shortLabel,
      href: entry.href,
      active: entry.id === "blog"
    })
  ),
  ...WORLD_NAV.map(
    (entry): UnifiedNavEntry => ({
      kind: "link",
      group: "world",
      id: entry.id,
      label: entry.label,
      shortLabel: entry.shortLabel,
      href: entry.href
    })
  ),
  ...(GITHUB_LINK
    ? [
        {
          kind: "link" as const,
          group: "utility" as const,
          id: "github",
          label: GITHUB_LINK.label,
          shortLabel: "GITHUB",
          href: GITHUB_LINK.href,
          external: true
        }
      ]
    : [])
];

export default function BlogHeader() {
  const github = GITHUB_LINK;

  return (
    <header className={styles.blogHeader}>
      <div className={styles.blogHeaderInner}>
        <Link
          className={styles.brand}
          href="/"
          aria-label="Parsa Tak — back to the world"
        prefetch={false}
        >
          <span className={styles.brandEye} aria-hidden="true">
            {/*
             * The 13-point star — the Parsa Tak site identity, as a
             * static asset (no hydration for a logo). The link's
             * aria-label carries the accessible name.
             */}
            <img
              src={BRAND_STAR.red}
              alt=""
              width={32}
              height={32}
              loading="eager"
              decoding="async"
            />
          </span>

          <span className={styles.brandName}>
            Parsa Tak
          </span>
        </Link>

        {/*
          * HEADER STATUS (v4.0.5) — the shared SiteHeaderStatus
          * identity with the same red pulsing light as the world
          * HUD and the content documents. The local (unpulsed,
          * breakpoint-hidden) chip this replaces is gone; the
          * identity remains visible at every width the header's
          * responsive structure permits.
          */}
        <SiteHeaderStatus label="BLOG" />

        {/*
         * The unified navigation (v3.4): desktop track + ≤860px
         * disclosure trigger from one component, one data source.
         */}
        <UnifiedSiteNav
          className={styles.blogNav}
          menuId="blog-unified-nav"
          entries={NAV_ENTRIES}
        />

        <div className={styles.headerActions}>
          {github && (
            <a
              className={styles.githubLink}
              href={github.href}
              target="_blank"
              rel="noreferrer"
            >
              GitHub ↗
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
