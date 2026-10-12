import type {
  CSSProperties,
  ReactNode,
  SVGProps
} from "react";

import styles from "@/components/PublicLinks.module.css";

import {
  PUBLIC_LINKS,
  type PublicLink,
  type PublicLinkIcon
} from "@/lib/links";

type PublicLinksProps = {
  compact?: boolean;
  title?: string;
};

type LinkGroup = {
  label: string;
  links: readonly PublicLink[];
};

const LINK_GROUPS: readonly LinkGroup[] = [
  {
    label: "SOCIAL",
    links: PUBLIC_LINKS.social
  },
  {
    label: "RESOURCES",
    links: PUBLIC_LINKS.resources
  },
  {
    label: "REFERENCE",
    links: PUBLIC_LINKS.meta
  }
];

const COMPACT_LINK_IDS = [
  "x",
  "telegram-channel",
  "instagram",
  "linkedin",
  "youtube",
  "support"
] as const;

type IconProps =
  SVGProps<SVGSVGElement>;

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true
} satisfies IconProps;

const LINK_ICONS: Record<
  PublicLinkIcon,
  (
    props: IconProps
  ) => ReactNode
> = {
  x: (props) => (
    <svg
      {...ICON_PROPS}
      {...props}
    >
      <path d="M5 4.5 19 19.5" />
      <path d="M19 4.5 5 19.5" />
    </svg>
  ),

  instagram: (props) => (
    <svg
      {...ICON_PROPS}
      {...props}
    >
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="5"
      />
      <circle
        cx="12"
        cy="12"
        r="4"
      />
      <circle
        cx="17.5"
        cy="6.5"
        r="0.8"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  ),

  email: (props) => (
    <svg
      {...ICON_PROPS}
      {...props}
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
      />
      <path d="m4 7 8 6 8-6" />
    </svg>
  ),

  linkedin: (props) => (
    <svg
      {...ICON_PROPS}
      {...props}
    >
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="2"
      />
      <path d="M8 10v6" />
      <path d="M8 8h.01" />
      <path d="M12 16v-3.2a2.2 2.2 0 0 1 4.4 0V16" />
      <path d="M12 10v6" />
    </svg>
  ),

  github: (props) => (
    <svg
      {...ICON_PROPS}
      {...props}
    >
      <path d="M8.2 20c-4-.8-5.5-3.2-5.5-5.7 0-1.9.7-3.2 1.8-4.4-.2-.5-.8-2.5.2-4.3 0 0 1.5-.5 4.3 1.7a14.5 14.5 0 0 1 6 0c2.8-2.2 4.3-1.7 4.3-1.7 1 1.8.4 3.8.2 4.3 1.1 1.2 1.8 2.5 1.8 4.4 0 2.5-1.5 4.9-5.5 5.7" />
      <path d="M8.2 20v-3c0-1-.4-1.7-1.2-2.1" />
      <path d="M15.8 20v-3c0-1 .4-1.7 1.2-2.1" />
      <path d="M8 16.5c.8.3 1.7.5 4 .5s3.2-.2 4-.5" />
    </svg>
  ),

  discord: (props) => (
    <svg
      {...ICON_PROPS}
      {...props}
    >
      <path d="M7 7.5a16 16 0 0 1 10 0l2 8.5c-1.5 1.1-3 1.8-4.5 2.2l-1-1.4a9.4 9.4 0 0 1-3 0l-1 1.4A12.5 12.5 0 0 1 5 16l2-8.5Z" />
      <path d="M9.2 11.5h.01" />
      <path d="M14.8 11.5h.01" />
    </svg>
  ),

  tiktok: (props) => (
    <svg
      {...ICON_PROPS}
      {...props}
    >
      <path d="M14 4v9.2a3.8 3.8 0 1 1-3.8-3.8" />
      <path d="M14 4c.5 2 1.8 3.4 4 3.8" />
    </svg>
  ),

  youtube: (props) => (
    <svg
      {...ICON_PROPS}
      {...props}
    >
      <path d="M21 8.2a2.8 2.8 0 0 0-2-2C17.2 5.7 12 5.7 12 5.7s-5.2 0-7 .5a2.8 2.8 0 0 0-2 2A29 29 0 0 0 2.5 12 29 29 0 0 0 3 15.8a2.8 2.8 0 0 0 2 2c1.8.5 7 .5 7 .5s5.2 0 7-.5a2.8 2.8 0 0 0 2-2 29 29 0 0 0 .5-3.8A29 29 0 0 0 21 8.2Z" />
      <path d="m10 9 5 3-5 3V9Z" />
    </svg>
  ),

  patreon: (props) => (
    <svg
      {...ICON_PROPS}
      {...props}
    >
      <path d="M5 4v16" />
      <path d="M5 5h7a4 4 0 0 1 0 8H5" />
    </svg>
  ),

  pinterest: (props) => (
    <svg
      {...ICON_PROPS}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="8.5"
      />
      <path d="M10.5 18.8c.7-2.1 1.1-3.4 1.4-4.6" />
      <path d="M10.8 13.2c-.6-.6-.9-1.4-.9-2.4 0-1.9 1.4-3.3 3.3-3.3 1.7 0 3 1.1 3 2.8 0 2.2-1 4.2-2.7 4.2-.8 0-1.4-.7-1.2-1.5l.4-1.6" />
    </svg>
  ),

  telegram: (props) => (
    <svg
      {...ICON_PROPS}
      {...props}
    >
      <path d="m21 4-3 16-5.1-4.2-3.1 2.9.4-4.4L18 8l-9.3 5.1L4 11.8 21 4Z" />
    </svg>
  ),

  paypal: (props) => (
    <svg
      {...ICON_PROPS}
      {...props}
    >
      <path d="M7.4 20 10 6.2c.2-.9.9-1.5 1.8-1.5h3.4c2.9 0 4.7 1.6 4.3 4.2-.4 2.5-2.3 3.8-5.2 3.8h-2.2" />
      <path d="M6 17.4h2.5c3.4 0 5.5-1.7 6-4.6" />
    </svg>
  ),

  linktree: (props) => (
    <svg
      {...ICON_PROPS}
      {...props}
    >
      <circle
        cx="12"
        cy="5"
        r="1.7"
      />
      <circle
        cx="6"
        cy="17"
        r="1.7"
      />
      <circle
        cx="18"
        cy="17"
        r="1.7"
      />
      <path d="M12 6.8v4.5" />
      <path d="m11 10.2-5 5" />
      <path d="m13 10.2 5 5" />
    </svg>
  )
};

export function LinkIcon({
  icon
}: {
  icon: PublicLinkIcon;
}) {
  const Icon =
    LINK_ICONS[icon];

  return <Icon />;
}

function getHost(
  href: string
) {
  if (
    href.startsWith(
      "mailto:"
    )
  ) {
    return "DIRECT CONTACT";
  }

  try {
    return new URL(
      href
    ).hostname.replace(
      /^www\./,
      ""
    );
  } catch {
    return "EXTERNAL";
  }
}

function LinkCard({
  link,
  index
}: {
  link: PublicLink;
  index: number;
}) {
  const isMail =
    link.href.startsWith(
      "mailto:"
    );

  return (
    <a
      className={
        styles.linkCard
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
      data-theme={
        link.theme
      }
      style={{
        "--public-link-accent":
          link.accent
      } as CSSProperties}
    >
      <div
        className={
          styles.linkCardGlow
        }
      />

      <div
        className={
          styles.linkCardTop
        }
      >
        <div
          className={
            styles.linkCardIdentity
          }
        >
          <span
            className={
              styles.linkCardIcon
            }
          >
            <LinkIcon
              icon={
                link.icon
              }
            />
          </span>

          <span
            className={
              styles.linkCardCategory
            }
          >
            {link.category ===
            "social"
              ? "SOCIAL"
              : link.category ===
                "resources"
              ? "RESOURCE"
              : "REFERENCE"}
          </span>
        </div>

        <span
          className={
            styles.linkCardIndex
          }
        >
          {String(
            index + 1
          ).padStart(
            2,
            "0"
          )}
        </span>
      </div>

      <div
        className={
          styles.linkCardMain
        }
      >
        <h3
          className={
            styles.linkCardTitle
          }
        >
          {link.label}
        </h3>

        <p
          className={
            styles.linkCardDescription
          }
        >
          {link.description}
        </p>
      </div>

      <div
        className={
          styles.linkCardBottom
        }
      >
        <span
          className={
            styles.linkCardHost
          }
        >
          {getHost(
            link.href
          )}
        </span>

        <span
          className={
            styles.linkCardAction
          }
        >
          OPEN

          <span
            aria-hidden="true"
          >
            ↗
          </span>
        </span>
      </div>

      <div
        className={
          styles.linkCardStatus
        }
        aria-hidden="true"
      >
        <span />
        <span />
        <span />
      </div>
    </a>
  );
}

export default function PublicLinks({
  compact = false,
  title = "PUBLIC NETWORK"
}: PublicLinksProps) {
  const compactLinks =
    compact
      ? [
          ...PUBLIC_LINKS.social,
          ...PUBLIC_LINKS.resources
        ]
      : [];

  return (
    <section
      className={`section-tight ${styles.publicLinks}`}
      aria-label={
        title
      }
      data-compact={
        compact
          ? "true"
          : "false"
      }
    >
      <div className="page-container">
        <div className="section-heading">
          <div className="section-heading-line">
            <span
              className="section-signal"
              aria-hidden="true"
            />

            <p className="kicker">
              {title}
            </p>
          </div>
        </div>

        {compact ? (
          <div
            className={`${styles.linkGroup} ${styles.linkGroupCompact}`}
          >
            <div
              className={
                styles.linkGrid
              }
            >
              {COMPACT_LINK_IDS.map(
                (
                  id,
                  index
                ) => {
                  const link =
                    compactLinks.find(
                      (
                        item
                      ) =>
                        item.id ===
                        id
                    );

                  if (
                    !link
                  ) {
                    return null;
                  }

                  return (
                    <LinkCard
                      key={
                        link.id
                      }
                      link={
                        link
                      }
                      index={
                        index
                      }
                    />
                  );
                }
              )}
            </div>
          </div>
        ) : (
          LINK_GROUPS.map(
            (
              group
            ) => (
              <div
                className={
                  styles.linkGroup
                }
                key={
                  group.label
                }
              >
                <div
                  className={
                    styles.linkGroupHeading
                  }
                >
                  <p className="kicker">
                    {
                      group.label
                    }
                  </p>

                  <span
                    aria-hidden="true"
                    className={
                      styles.linkGroupLine
                    }
                  />
                </div>

                <div
                  className={
                    styles.linkGrid
                  }
                >
                  {group.links.map(
                    (
                      link,
                      index
                    ) => (
                      <LinkCard
                        key={
                          link.id
                        }
                        link={
                          link
                        }
                        index={
                          index
                        }
                      />
                    )
                  )}
                </div>
              </div>
            )
          )
        )}
      </div>
    </section>
  );
}
