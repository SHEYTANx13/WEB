import { Fragment, type ReactNode } from "react";

import Link from "next/link";

import { BRAND_STAR } from "@/lib/brand";

import { PRIMARY_NAV, WORLD_NAV } from "@/lib/navigation";

import { GITHUB_LINK } from "@/lib/links";

import UnifiedSiteNav, {
  type UnifiedNavEntry
} from "@/components/UnifiedSiteNav";

import SiteHeaderStatus from "@/components/SiteHeaderStatus";

import FullScreenPageShell from "@/components/FullScreenPageShell";

import {
  headerStatusForRoutePath,
  pageIdForRoutePath
} from "@/lib/routes";

import SiteFooter from "@/components/SiteFooter";

import styles from "@/components/content/content.module.css";

/*
 * CONTENT SHELL (v4.0.5) — the shared frame for ALL document
 * routes: /about/, /work/, /research/, /contact/, and the topic
 * hubs.
 *
 * ONE document composition system: route identity changes accent
 * and decorative geometry only; it never changes the layout
 * contract. Every route renders the same header rail, the same
 * navigation island, the same hero composition (field → rail →
 * crumbs → identity → kicker → H1 → lead), the same document
 * rhythm, and the same footer. Pages supply title, kicker, lead
 * and content — nothing else.
 *
 * Full-screen is composition, not confinement: the first screen
 * never collapses below one viewport (with a content floor so
 * short screens scroll instead of cramping) and the document below
 * scrolls naturally for as long as it needs. The hero's vertical
 * composition is TOP-ANCHORED: the title system starts at the same
 * offset from the header on every route, so the amount of lead
 * text can never move the title baseline between pages.
 *
 * v3.4 navigation: the header renders the UNIFIED navigation system
 * (UnifiedSiteNav) — the same renderer, data source, geometry,
 * accents, active states and hover identities as the world HUD and
 * the blog header. The nav is the page's one small client island;
 * the document body below it remains static semantic HTML, and the
 * nav itself still ships as complete server-rendered markup for
 * crawlers and no-JS readers.
 *
 * v4.0.5 header identity: the header also renders the shared
 * SiteHeaderStatus — brand → status → navigation, the same visual
 * grammar as the world HUD and the blog. The label is derived from
 * the route registry (lib/routes.ts → headerStatusForRoutePath) via
 * this shell's existing activeHref, so EVERY ContentShell route
 * (About, Contact, Work, Research, the six topic hubs, and any
 * future registered route) inherits its identity automatically.
 * Pages never render status markup; there are no route-specific
 * header implementations.
 *
 * The 13-point star, mono kickers, and red accents are reused so
 * every content document reads as the same website, not a template.
 */

export type Crumb = {
  name: string;
  /** Root-relative href (basePath applied automatically) or null for the current page. */
  href: string | null;
};

type ContentShellProps = {
  kicker: string;
  title: string;
  /** Breadcrumb trail from Home to this page (last entry = current). */
  crumbs: readonly Crumb[];
  /** Lead paragraphs rendered directly under the H1. */
  lead: readonly string[];
  /** Root-relative href of the current route, marks the active header link. */
  activeHref?: string;
  /*
   * DOC FEATURE SLOT (v4.0.5) — the ONE generic optional slot of the
   * shared shell: the page's first document block, rendered inside
   * the shared document measure, directly above the page's content
   * children. Work and Research lead their documents with strong
   * visual artifacts through ordinary children; this slot exists for
   * pages whose first document block needs the same first-impression
   * treatment (the About identity/practice matrix, the Contact
   * transmission console). It is NOT a shell fork: a server-rendered
   * node in normal document flow, themed by the same --page-accent,
   * with no client code, no route-specific layout contract, and no
   * effect on the hero, header, rail, or footer geometry.
   */
  docFeature?: ReactNode;
  children: ReactNode;
};

/*
 * TAB IDENTITY (v4.0.3): resolved from the canonical route registry
 * (data/routes.json) through lib/routes.ts — the same registry that
 * derives SEO metadata and the sitemap. Before v4.0.3 this was a
 * hardcoded switch that could forget a route; now every registered
 * primary document route automatically receives its shell identity,
 * and topic hubs keep the neutral "hub" identity of the shared
 * shell. About and Contact therefore ride the EXACT same registry
 * path as Work, Research and the hubs — no special cases.
 */

export default function ContentShell({
  kicker,
  title,
  crumbs,
  lead,
  activeHref,
  docFeature,
  children
}: ContentShellProps) {
  /*
   * UNIFIED NAVIGATION (v3.4): same entries on every content route —
   * the primary destinations (active state resolved per route), the
   * world scenes as plain hash links into the living shell, and
   * GitHub as a utility entry in the disclosure menu. Serializable
   * data only: the server renders the full nav markup and the client
   * island hydrates the interaction on top.
   */
  const navEntries: readonly UnifiedNavEntry[] = [
    ...PRIMARY_NAV.map(
      (entry): UnifiedNavEntry => ({
        kind: "link",
        group: "primary",
        id: entry.id,
        label: entry.label,
        shortLabel: entry.shortLabel,
        href: entry.href,
        active: activeHref === entry.href
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

  /*
   * HEADER STATUS (v4.0.5) — the visible surface identity, resolved
   * from the canonical route registry through this route's own
   * activeHref. One derivation for every ContentShell route; pages
   * provide content only, never status markup.
   */
  const headerStatus =
    headerStatusForRoutePath(activeHref);

  return (
    <FullScreenPageShell
      page={pageIdForRoutePath(activeHref)}
      className={styles.shell}
    >
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} href="/" prefetch={false}>
            {/*
             * The 13-point star — the site identity — anchors the
             * content shell to the same brand as the world shell
             * and the blog. Decorative: the adjacent text is the
             * accessible content.
             *
             * Soft navigation (v4.0.2): the brand links home through
             * next/link — a crawlable anchor in the export, a
             * client-side navigation when hydrated, so the root
             * layout and the global Music player never unmount.
             */}
            <img
              src={BRAND_STAR.red}
              alt=""
              width={30}
              height={30}
              loading="eager"
              decoding="async"
            />

            <span className={styles.brandName}>Parsa Tak</span>
          </Link>

          {/*
            * HEADER STATUS (v4.0.5) — placement only. The label is
            * resolved from the canonical route registry through the
            * activeHref the route already provides; unregistered
            * paths resolve to null and render no status.
            */}
          {headerStatus !== null && (
            <SiteHeaderStatus label={headerStatus} />
          )}

          <UnifiedSiteNav
            className={styles.contentNav}
            menuId="content-unified-nav"
            entries={navEntries}
          />
        </div>
      </header>

      <main className={styles.main} id="content">
        {/*
         * FULL-SCREEN HERO (v4.0.5) — the first screen of every
         * document route, ONE composition contract:
         *
         *   hero
         *   ├── heroField        decorative per-route motif (aria-hidden)
         *   ├── heroDoc          the shared alignment rail
         *   │   ├── crumbs
         *   │   └── heroIdentity
         *   │       ├── heroSignal   the shared identity mark
         *   │       └── heroCopy     kicker → H1 → lead
         *   └── heroCue          the honest "document continues" cue
         *
         * The signal belongs to the title identity — it sits BESIDE
         * the copy block, in normal document flow (no absolute
         * positioning, no overlap, no content-height dependence).
         * The route's accent themes it; the route's decorative
         * field motif surrounds it. Nothing in this structure
         * varies per route.
         */}
        <section
          className={styles.hero}
          aria-label={title}
        >
          <div
            className={styles.heroField}
            aria-hidden="true"
          >
            <span
              className={`${styles.heroRing} ${styles.heroRingOne}`}
            />
            <span
              className={`${styles.heroRing} ${styles.heroRingTwo}`}
            />
            <span
              className={`${styles.heroRing} ${styles.heroRingThree}`}
            />
            <span className={styles.heroAxis} />
            <span
              className={`${styles.heroNode} ${styles.heroNodeOne}`}
            />
            <span
              className={`${styles.heroNode} ${styles.heroNodeTwo}`}
            />
          </div>

          {/*
           * HERO RAIL (v3.6.1) — the hero text block sits on the same
           * shared alignment rail as the header brand, the home hero,
           * the blog hero and the footer (styles.heroDoc). The
           * document body below the fold keeps the narrower readable
           * measure (styles.doc).
           */}
          <div className={styles.heroDoc}>
            <nav
              className={styles.crumbs}
              aria-label="Breadcrumb"
            >
              {crumbs.map((crumb, index) => {
                const isLast =
                  index === crumbs.length - 1;

                return (
                  <Fragment key={crumb.name}>
                    {index > 0 && (
                      <span
                        className={styles.crumbSeparator}
                        aria-hidden="true"
                      >
                        /
                      </span>
                    )}

                    {crumb.href && !isLast ? (
                      <Link
                        className={styles.crumbLink}
                        href={crumb.href}
                        prefetch={false}
                      >
                        {crumb.name}
                      </Link>
                    ) : (
                      <span
                        className={styles.crumbCurrent}
                        aria-current={
                          isLast
                            ? "page"
                            : undefined
                        }
                      >
                        {crumb.name}
                      </span>
                    )}
                  </Fragment>
                );
              })}
            </nav>

            {/*
             * HERO IDENTITY (v4.0.5) — the stable title system: the
             * shared signal mark BESIDE the title copy. One
             * structure on every document route; the signal's
             * position can never depend on the amount of lead text,
             * never overlaps the crumbs or the H1, and never clips
             * on narrow screens — it is in normal document flow, so
             * the layout itself guarantees all three.
             */}
            <div className={styles.heroIdentity}>
              <span
                className={styles.heroSignal}
                aria-hidden="true"
              >
                <span
                  className={styles.heroSignalRing}
                />

                <span
                  className={styles.heroSignalCore}
                />
              </span>

              <div className={styles.heroCopy}>
                <p className={styles.docKicker}>
                  {kicker}
                </p>

                <h1 className={styles.title}>
                  {title}
                </h1>

                <div className={styles.lead}>
                  {lead.map((paragraph, index) => (
                    <p
                      key={index}
                      className={styles.leadParagraph}
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div
            className={styles.heroCue}
            aria-hidden="true"
          >
            <span>SCROLL</span>

            <i className={styles.heroCueLine} />
          </div>
        </section>

        <div className={styles.doc}>
          {docFeature}

          {children}
        </div>
      </main>

      <SiteFooter />
    </FullScreenPageShell>
  );
}
