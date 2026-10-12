import type { CSSProperties } from "react";

import styles from "@/components/FooterLinks.module.css";

import {
  LinkIcon
} from "@/components/PublicLinks";

import {
  ALL_PUBLIC_LINKS,
  type PublicLink
} from "@/lib/links";

/*
 * THE PUBLIC NETWORK (v4.0.5) — the 14 verified public links of
 * lib/links.ts (the ONLY data authority; no link record is
 * duplicated here) presented under the explicit desktop contract:
 *
 *   ROW 1 — links 1–7
 *   ROW 2 — links 8–14
 *
 * FOOTER_LINK_ROW_SIZE is PRESENTATION LOGIC ONLY: it slices the
 * registry into the two desktop row containers, it never defines
 * or edits the link set. Both rows render through the ONE shared
 * FooterLink renderer, so the two rows can never drift visually.
 * Below desktop the rows themselves wrap (order-stable, no overflow)
 * — the 7 + 7 requirement is a desktop presentation contract, not a
 * mobile one.
 */

const FOOTER_LINK_ROW_SIZE = 7;

function FooterLink({
  link
}: {
  link: PublicLink;
}) {
  const isMail =
    link.href.startsWith(
      "mailto:"
    );

  return (
    <a
      className={
        styles.link
      }
      href={
        link.href
      }
      target={
        isMail
          ? undefined
          : "_blank"
      }
      rel={
        isMail
          ? undefined
          : "noreferrer"
      }
      aria-label={
        link.label
      }
      style={
        {
          /*
           * Per-link accent (v4.0.5): the registry's own accent
           * value exposed as a custom property — the CSS never
           * hardcodes social-network colors, and the hover
           * language (icon color + ring) is owned by the
           * stylesheet through var(--link-accent).
           */
          "--link-accent":
            link.accent
        } as CSSProperties
      }
    >
      <span
        className={
          styles.linkIcon
        }
        aria-hidden="true"
      >
        <LinkIcon
          icon={
            link.icon
          }
        />
      </span>

      <span
        className={
          styles.linkLabel
        }
      >
        {
          link.label
        }
      </span>

      {!isMail && (
        <span
          className={
            styles.linkArrow
          }
          aria-hidden="true"
        >
          ↗
        </span>
      )}
    </a>
  );
}

/*
 * One presentation row — the shared FooterLink renderer, list
 * semantics (crawlable anchors), registry order preserved inside
 * the row.
 */
function FooterLinkRow({
  links
}: {
  links: readonly PublicLink[];
}) {
  return (
    <ul
      className={
        styles.linkRow
      }
    >
      {links.map(
        (link) => (
          <li
            key={
              link.id
            }
            className={
              styles.linkItem
            }
          >
            <FooterLink
              link={
                link
              }
            />
          </li>
        )
      )}
    </ul>
  );
}

export default function FooterLinks() {
  const firstRow = ALL_PUBLIC_LINKS.slice(
    0,
    FOOTER_LINK_ROW_SIZE
  );

  const secondRow = ALL_PUBLIC_LINKS.slice(
    FOOTER_LINK_ROW_SIZE,
    FOOTER_LINK_ROW_SIZE * 2
  );

  return (
    <nav
      className={
        styles.footerLinks
      }
      aria-label="Public network"
    >
      <FooterLinkRow
        links={
          firstRow
        }
      />

      <FooterLinkRow
        links={
          secondRow
        }
      />
    </nav>
  );
}
