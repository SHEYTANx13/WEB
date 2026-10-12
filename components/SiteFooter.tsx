import styles from "@/components/SiteFooter.module.css";

import { BRAND_STAR } from "@/lib/brand";

import FooterLinks from "@/components/FooterLinks";

import SiteDocNav from "@/components/SiteDocNav";

/*
 * SITE FOOTER (v4.0.5) — the compact, professional footer shared by
 * every surface: the home world shell, the blog routes, the static
 * content documents (/about/, /work/, /research/, /contact/) and the
 * topic hubs. Rendered from a client parent it joins the client
 * tree; rendered from the blog layout it stays server-rendered with
 * zero client JavaScript.
 *
 * COMPOSITION (v4.0.5) — the deliberate site-chrome stack, top to
 * bottom, one region per rail:
 *
 *   1. footerNavRegion   SITE / COLLECTIONS / WORLD / TOPICS
 *                        (SiteDocNav, four crawlable groups)
 *   2. footerNetwork     the PUBLIC NETWORK heading + the 14
 *                        verified links as two rows of seven
 *                        (desktop) via FooterLinks
 *   3. footerLegal       the legal notice + LICENSE / TRADEMARKS,
 *                        visually secondary
 *   4. footerBottom      the BOTTOM-MOST identity row: the 13-point
 *                        star, © 2026 Parsa Tak. All rights
 *                        reserved., Parsa Tak™
 *
 * The copyright/trademark identity row moved OUT of the public-
 * network meta row to the bottom of the stack (v4.0.5) — the exact
 * wording, the star identity and normal document flow are preserved
 * (no negative margins, no absolute positioning, no baseline
 * compensation).
 *
 * The footer never opts into a route-scoped reveal system: reveal
 * controllers mount only on the world shell and the blog layout, and
 * a data-reveal element without a controller stays invisible under
 * html.reveal-js (the v4.0.3 bug — the footer must stay permanently
 * visible on every route).
 */

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        {/*
          * SITE DOCUMENT NAV (v3.1, columns in v4.0.5): crawlable
          * links to the real indexable documents — identity routes,
          * collections, world scenes and topic hubs — carried by every
          * page that renders this footer. The hash scenes remain
          * interaction states; these anchors make the content graph
          * reachable without JavaScript.
          */}
        <div className={styles.footerNavRegion}>
          <SiteDocNav />
        </div>

        {/*
          * THE PUBLIC NETWORK (v4.0.5) — its own region under the
          * document nav: a quiet mono heading (the same heading
          * rhythm as SiteDocNav's groups) above the two seven-link
          * rows. FooterLinks owns the rows, the icons and the
          * interaction; this region owns only the heading and the
          * rail.
          */}
        <div className={styles.footerNetwork}>
          <div className={styles.footerNetworkHeading}>
            <span>Public Network</span>

            <span
              className={
                styles.footerNetworkLine
              }
              aria-hidden="true"
            />
          </div>

          <FooterLinks />
        </div>

        {/*
          * LEGAL REGION — the notice keeps its exact meaning and
          * stays visible and crawlable (never an inaccessible
          * disclosure), with LICENSE / TRADEMARKS end-aligned on
          * the same rail. Visually secondary by design.
          */}
        <div className={styles.footerLegal}>
          <p>
            Original website design, visual identity,
            writing, artwork, and other original creative
            materials presented on this website are the
            work of Parsa Tak and may not be reproduced,
            redistributed, modified, or commercially
            exploited without prior written permission,
            except where a specific material states otherwise.
          </p>

          <div className={styles.footerLegalLinks}>
            <a
              href="https://github.com/Parsaetak/WEB/blob/main/LICENSE.md"
              target="_blank"
              rel="noreferrer"
            >
              LICENSE
            </a>

            <a
              href="https://github.com/Parsaetak/WEB/blob/main/TRADEMARKS.md"
              target="_blank"
              rel="noreferrer"
            >
              TRADEMARKS
            </a>
          </div>
        </div>

        {/*
          * BOTTOM IDENTITY ROW (v4.0.5) — the final footer row, and
          * the LAST thing in the region stack: star + copyright +
          * trademark, one compact line in normal flow. The wording
          * is exact and the star is the same 13-point site identity.
          */}
        <div className={styles.footerBottom}>
          <span
            className={styles.footerMark}
            aria-hidden="true"
          >
            {/*
              * The 13-point star anchors the identity row to the
              * site identity. Decorative: the adjacent text is the
              * accessible content.
              */}
            <img
              src={BRAND_STAR.red}
              alt=""
              width={18}
              height={18}
              loading="lazy"
              decoding="async"
            />
          </span>

          <strong className={styles.footerCopyright}>
            © 2026 Parsa Tak. All rights reserved.
          </strong>

          <span className={styles.footerTrademark}>
            Parsa Tak™
          </span>
        </div>
      </div>
    </footer>
  );
}
