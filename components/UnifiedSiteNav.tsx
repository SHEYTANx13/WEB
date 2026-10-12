"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import Link from "next/link";

import { usePathname, useRouter } from "next/navigation";

import styles from "@/components/UnifiedSiteNav.module.css";

import { allowsSpeculativeNetwork } from "@/lib/connection";

/*
 * ROUTE PROGRESS INTENT EVENT — the SAME contract literal
 * components/RouteProgress.tsx listens for (tests/route-progress.test.ts
 * asserts both sides carry the identical string, so they can never
 * drift). Deliberately a local constant, not an import: importing the
 * progress host into the navigation island would couple the two
 * client chunk graphs — the island and the host stay independently
 * chunkable, and no route loads code it does not render.
 */
const ROUTE_PROGRESS_EVENT = "web:route-progress";

/*
 * INTENT WARMING DISCIPLINE (v4.0.5) — the mechanism that makes
 * clicking a tab feel immediate, bounded so it can never compete with
 * critical loading:
 *
 * - pointer-down   → warm NOW (a pressing finger is unambiguous
 *                    intent; the fetch overlaps the ~100ms before the
 *                    click event commits)
 * - keyboard focus → warm NOW (explicit navigation intent)
 * - hover          → VISUAL ANIMATION ONLY. Measured in v4.0.5: even
 *                    the 130ms dwell warm of v4.0.3 fetched
 *                    destination payloads when a cursor merely
 *                    crossed the track (browser automation's own
 *                    move-to-target gesture triggered 134KB of
 *                    payload fetches before any click), and the
 *                    warmed fetches did not measurably reduce
 *                    click-to-commit time — the dominant cost of
 *                    leaving the home route is the world shell
 *                    unmount, not the payload fetch. A cursor sweep
 *                    across the navigation generates ZERO requests.
 * - save-data / 2g connections skip route warming entirely (the same
 *   lib/connection.ts probe the background scheduler applies to
 *   speculative work)
 * - the CURRENT ROUTE is never warmed (usePathname comparison)
 * - every warm is deduplicated per href; a failed warm evicts the
 *   entry so a later intent can retry; a click always navigates
 *   normally, warmed or not
 *
 * Scene actions warm their modules through onActionWarm
 * (preloadScene — deduplicated by the scene preloader). Internal
 * route links warm through router.prefetch(), which in this static
 * export fetches the destination's RSC payload exactly once — one
 * small text file per intended destination. Viewport prefetch stays
 * off (prefetch={false}) — nothing is fetched continuously.
 *
 * ROUTE PROGRESS (v4.0.5): a normal click on an internal link also
 * fires ROUTE_PROGRESS_EVENT so the root-mounted top progress line
 * (components/RouteProgress.tsx) can show activity for slow
 * navigations. Excluded: modifier clicks, new-tab clicks, external
 * links, and same-route clicks — the same exclusion matrix the
 * warming discipline applies. The navigation itself is ALWAYS
 * native next/link behavior — never prevented, never delayed.
 */

/*
 * UNIFIED SITE NAVIGATION (v3.4) — THE one navigation system.
 *
 * Every surface of the website renders its primary navigation through
 * this component: the living world HUD, the blog header, the static
 * content documents (/about/, /work/, /research/, /contact/) and the
 * six topic hubs. One renderer, one data source (lib/navigation.ts),
 * one visual identity, one interaction contract.
 *
 * The component renders BOTH responsive modes of the same system from
 * the same entries:
 *
 * - TRACK (desktop): the horizontal primary/world track, identical on
 *   every surface. Primary tabs (HOME, ABOUT, WORK, RESEARCH, BLOG,
 *   CONTACT) each carry their own ~1s hover identity animation; the
 *   world scenes (SYSTEMS, RED MAGIC, MEDIA) follow a quiet divider.
 * - MENU (≤860px): a disclosure-panel mode of the same navigation —
 *   same labels, same ordering, same accents, same animation language.
 *   The trigger expands a panel with roving focus, Escape-to-close,
 *   focus restoration and outside-pointer dismissal.
 *
 * Entry kinds:
 * - "link":   a real destination. Internal routes render as
 *             next/link with viewport prefetch disabled (no page is
 *             fetched continuously in the background, per site law);
 *             instead v3.5 warms the route ON INTENT — focus or
 *             pointer-down fetches the destination's RSC payload
 *             through router.prefetch() once, deduplicated, so the
 *             click itself is a cache hit. Static-export payloads
 *             are tiny text files; no heavy page assets are pulled
 *             by warming. Hover is VISUAL ONLY (v4.0.5). External
 *             links render as plain anchors.
 * - "action": an in-shell interaction state (the world scenes),
 *             switched through onSelect with the same preloading
 *             contract as before (onActionWarm — immediate, bypasses
 *             the background scheduler, deduplicated by the scene
 *             preloader cache).
 *
 * Accessibility contract (every surface):
 * - semantic <nav> with accessible names
 * - aria-current="page" on the active entry, data-active for styling
 * - aria-expanded / aria-controls / aria-haspopup on the menu trigger
 * - roving ArrowUp/ArrowDown/Home/End focus inside the open panel
 * - Escape closes the panel and restores focus to the trigger
 * - pointer-down outside closes without stealing focus
 * - focus leaving the root closes the panel
 * - no scroll locking anywhere; native scrolling is preserved
 * - motion is compositor-only (transform/opacity/clip-path) and
 *   collapses under prefers-reduced-motion
 * - decorative hover identities only run on hover-capable pointers;
 *   touch devices never depend on hover
 */

export type UnifiedNavEntry =
  | {
      kind: "link";
      id: string;
      group: "primary" | "world" | "utility";
      label: string;
      shortLabel: string;
      href: string;
      external?: boolean;
      active?: boolean;
    }
  | {
      kind: "action";
      id: string;
      group: "primary" | "world" | "utility";
      label: string;
      shortLabel: string;
      active?: boolean;
      onSelect: () => void;
    };

type UnifiedSiteNavProps = {
  /** Unique panel id, referenced by the trigger's aria-controls. */
  menuId: string;
  /** Accessible name of the disclosure panel's navigation. */
  menuLabel?: string;
  entries: readonly UnifiedNavEntry[];
  /**
   * Scene-warming hook fired on pointer enter / focus of action
   * entries (the world shell passes its scene preloader here).
   */
  onActionWarm?: (id: string) => void;
  /** Extra class for surface-specific placement of the nav root. */
  className?: string;
};

export default function UnifiedSiteNav({
  menuId,
  menuLabel = "Site navigation",
  entries,
  onActionWarm,
  className
}: UnifiedSiteNavProps) {
  const router = useRouter();

  const pathname = usePathname();

  const warmedRoutes =
    useRef<Set<string>>(new Set());

  useEffect(() => {
    /*
     * Nothing to clean up per se — the warmed set is deduplicated
     * state, not timers. Hover carries no network side effects
     * anymore (v4.0.5), so no dwell timers exist to cancel.
     */
    return () => {};
  }, []);

  /*
   * Current-route comparison: hrefs are root-relative with a trailing
   * slash ("/about/"), usePathname() is basePath-free without one
   * ("/about"). Normalizing both makes the comparison stable across
   * surfaces and deployment base paths.
   */
  const isCurrentRoute = useCallback(
    (href: string) => {
      const normalize = (value: string) =>
        value.length > 1 ? value.replace(/\/+$/, "") : value;

      return normalize(href) === normalize(pathname ?? "");
    },
    [pathname]
  );

  const warmRoute = useCallback(
    (href: string) => {
      /*
       * Constrained connections never speculate: save-data and 2g
       * visitors navigate without a pre-fetched payload — the click
       * itself performs the full navigation (lib/connection.ts).
       */
      if (!allowsSpeculativeNetwork()) {
        return;
      }

      /* The destination the visitor is already reading is never warmed. */
      if (isCurrentRoute(href)) {
        return;
      }

      if (
        warmedRoutes.current.has(
          href
        )
      ) {
        return;
      }

      warmedRoutes.current.add(
        href
      );

      /*
       * router.prefetch is typed as void in the current Next types,
       * but failures surface as promise rejections internally — wrap
       * defensively so a failed warm evicts the entry and a later
       * intent can retry. The click itself always navigates normally.
       */
      void Promise.resolve(
        router.prefetch(href)
      ).catch(() => {
        warmedRoutes.current.delete(
          href
        );
      });
    },
    [isCurrentRoute, router]
  );

  const warmEntry = useCallback(
    (entry: UnifiedNavEntry) => {
      if (
        entry.kind === "action"
      ) {
        if (!entry.active) {
          onActionWarm?.(
            entry.id
          );
        }

        return;
      }

      if (
        entry.kind === "link" &&
        !entry.external &&
        !entry.active
      ) {
        warmRoute(entry.href);
      }
    },
    [onActionWarm, warmRoute]
  );

  /*
   * Pointer-down and keyboard focus are unambiguous intent: warm
   * immediately. Hover animates only — no network work.
   */
  const warmEntryNow = useCallback(
    (entry: UnifiedNavEntry) => {
      warmEntry(entry);
    },
    [warmEntry]
  );

  /*
   * ROUTE PROGRESS INTENT (v4.0.5) — fired on a NORMAL click on an
   * internal link. Excluded, exactly like warming: modifier clicks
   * (new-tab behavior belongs to the visitor), non-primary buttons,
   * already-prevented clicks, and the current route (a same-route
   * click navigates nowhere). The click is NEVER prevented — the
   * router proceeds natively; the root-mounted progress line only
   * observes.
   */
  const fireRouteProgress = useCallback(
    (event: React.MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      window.dispatchEvent(
        new CustomEvent(ROUTE_PROGRESS_EVENT)
      );
    },
    []
  );

  const primary = entries.filter(
    (entry) => entry.group === "primary"
  );

  const world = entries.filter(
    (entry) => entry.group === "world"
  );

  return (
    <div
      className={
        className
          ? `${styles.root} ${className}`
          : styles.root
      }
    >
      <nav
        className={
          styles.trackNav
        }
        aria-label="Site"
      >
        <div
          className={
            styles.track
          }
        >
          {primary.map(
            (entry) => (
              <NavEntry
                key={
                  entry.id
                }
                entry={
                  entry
                }
                onWarmNow={
                  warmEntryNow
                }
                onRouteProgress={
                  fireRouteProgress
                }
              />
            )
          )}

          {world.length >
            0 && (
            <span
              className={
                styles.divider
              }
              aria-hidden="true"
            />
          )}

          {world.map(
            (entry) => (
              <NavEntry
                key={
                  entry.id
                }
                entry={
                  entry
                }
                onWarmNow={
                  warmEntryNow
                }
                onRouteProgress={
                  fireRouteProgress
                }
              />
            )
          )}
        </div>
      </nav>

      <NavMenu
        menuId={menuId}
        label={
          menuLabel
        }
        entries={
          entries
        }
        onWarmNow={
          warmEntryNow
        }
        onRouteProgress={
          fireRouteProgress
        }
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared entry renderer (desktop track)                                       */
/* -------------------------------------------------------------------------- */

function NavEntry({
  entry,
  onWarmNow,
  onRouteProgress
}: {
  entry: UnifiedNavEntry;
  onWarmNow?: (entry: UnifiedNavEntry) => void;
  onRouteProgress?: (event: React.MouseEvent) => void;
}) {
  /*
   * WARM ON INTENT (v3.5, hover-visual-only in v4.0.5): pointerdown
   * and focus warm immediately (a pressing finger or a focused tab
   * is intent); hover animates only — a cursor sweep never reaches
   * the network. All paths share one deduplicated entry point.
   */
  const warm = () => {
    onWarmNow?.(entry);
  };

  const body = (
    <>
      <span
        className={
          styles.copy
        }
      >
        <span
          className={
            styles.label
          }
        >
          {
            entry.shortLabel
          }
        </span>
      </span>

      {/*
       * Hover-identity layers (v3.4). Two dedicated spans plus the
       * item's ::after pseudo-element give every primary tab three
       * animatable compositor-only layers. Decorative: hidden from
       * assistive technology, idle-invisible, animated only under
       * hover-capable pointers with motion allowed.
       */}
      <span
        className={
          styles.fx
        }
        aria-hidden="true"
      />

      <span
        className={
          styles.fx2
        }
        aria-hidden="true"
      />

      <span
        className={
          styles.indicator
        }
        aria-hidden="true"
      />
    </>
  );

  const shared = {
    className: `${styles.item} ${
      entry.group === "world"
        ? styles.worldItem
        : ""
    }`.trim(),
    "data-id":
      entry.id,
    "data-active":
      entry.active
        ? "true"
        : "false",
    "aria-current":
      entry.active
        ? ("page" as const)
        : undefined,
    "aria-label": `Open ${entry.label}`,
    onPointerDown:
      warm,
    onFocus: warm
  };

  if (
    entry.kind ===
    "action"
  ) {
    return (
      <button
        {...shared}
        type="button"
        onClick={
          entry.onSelect
        }
      >
        {
          body
        }
      </button>
    );
  }

  if (
    entry.external
  ) {
    return (
      <a
        {...shared}
        href={
          entry.href
        }
        target="_blank"
        rel="noreferrer"
      >
        {
          body
        }
      </a>
    );
  }

  return (
    <Link
      {...shared}
      href={
        entry.href
      }
      prefetch={
        false
      }
      onClick={
        entry.active
          ? undefined
          : onRouteProgress
      }
    >
      {
        body
      }
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Disclosure menu (mobile / narrow viewport mode of the same system)          */
/* -------------------------------------------------------------------------- */

const EXTERNAL_ARROW = "↗";

function NavMenu({
  menuId,
  label,
  entries,
  onWarmNow,
  onRouteProgress
}: {
  menuId: string;
  label: string;
  entries: readonly UnifiedNavEntry[];
  onWarmNow?: (entry: UnifiedNavEntry) => void;
  onRouteProgress?: (event: React.MouseEvent) => void;
}) {
  const [open, setOpen] =
    useState(false);

  const rootRef =
    useRef<HTMLDivElement>(null);

  const triggerRef =
    useRef<HTMLButtonElement>(null);

  const panelRef =
    useRef<HTMLDivElement>(null);

  const close =
    useCallback(() => {
      setOpen(false);
    }, []);

  const closeAndRestoreFocus =
    useCallback(() => {
      setOpen(false);

      triggerRef.current?.focus();
    }, []);

  /*
   * Open: focus lands on the active entry, or the first focusable
   * entry. One effect per open — no timers, no rAF.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    const panel =
      panelRef.current;

    if (!panel) {
      return;
    }

    const focusables =
      panel.querySelectorAll<HTMLElement>(
        "button, a[href]"
      );

    const target =
      Array.from(
        focusables
      ).find(
        (element) =>
          element.getAttribute(
            "data-active"
          ) === "true"
      ) ?? focusables[0];

    target?.focus();
  }, [open]);

  /*
   * Outside interaction: a pointer-down that starts outside the root
   * closes the menu. The listener exists only while open and is
   * passive — scroll behavior is never touched.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown =
      (
        event: PointerEvent
      ) => {
        if (
          rootRef.current &&
          event.target instanceof
            Node &&
          !rootRef.current.contains(
            event.target
          )
        ) {
          setOpen(false);
        }
      };

    document.addEventListener(
      "pointerdown",
      handlePointerDown,
      true
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown,
        true
      );
    };
  }, [open]);

  /*
   * Keyboard: roving focus inside the panel, Escape to close and
   * restore the trigger. Tab is left to the browser; if focus
   * leaves the root entirely the focusout handler closes.
   */
  const handleRootKeyDown =
    useCallback(
      (
        event: React.KeyboardEvent
      ) => {
        if (
          event.key ===
          "Escape"
        ) {
          if (open) {
            event.stopPropagation();

            closeAndRestoreFocus();
          }

          return;
        }

        if (!open) {
          return;
        }

        if (
          event.key !==
            "ArrowDown" &&
          event.key !==
            "ArrowUp" &&
          event.key !==
            "Home" &&
          event.key !==
            "End"
        ) {
          return;
        }

        const panel =
          panelRef.current;

        if (!panel) {
          return;
        }

        const focusables =
          Array.from(
            panel.querySelectorAll<HTMLElement>(
              "button, a[href]"
            )
          );

        if (
          focusables.length ===
          0
        ) {
          return;
        }

        const currentIndex =
          focusables.findIndex(
            (element) =>
              element ===
              document.activeElement
          );

        let nextIndex =
          currentIndex;

        if (
          event.key ===
          "ArrowDown"
        ) {
          nextIndex =
            currentIndex < 0
              ? 0
              : (currentIndex +
                  1) %
                focusables.length;
        } else if (
          event.key ===
          "ArrowUp"
        ) {
          nextIndex =
            currentIndex < 0
              ? focusables.length -
                1
              : (currentIndex -
                  1 +
                  focusables.length) %
                focusables.length;
        } else if (
          event.key ===
          "Home"
        ) {
          nextIndex = 0;
        } else {
          nextIndex =
            focusables.length -
            1;
        }

        event.preventDefault();

        focusables[nextIndex]?.focus();
      },
      [
        open,
        closeAndRestoreFocus
      ]
    );

  /*
   * Focus leaving the root (Tab past the last entry, or a
   * programmatic jump) closes the panel without moving focus.
   * React's onBlur maps to the DOM focusout event, so
   * relatedTarget is available.
   */
  const handleFocusOut =
    useCallback(
      (
        event: React.FocusEvent
      ) => {
        if (!open) {
          return;
        }

        if (
          rootRef.current &&
          event.relatedTarget instanceof
            Node &&
          !rootRef.current.contains(
            event.relatedTarget
          )
        ) {
          setOpen(false);
        }
      },
      [open]
    );

  return (
    <div
      ref={rootRef}
      className={
        styles.menuRoot
      }
      data-open={
        open
          ? "true"
          : "false"
      }
      onKeyDown={
        handleRootKeyDown
      }
      onBlur={
        handleFocusOut
      }
    >
      <button
        ref={triggerRef}
        type="button"
        className={
          styles.menuTrigger
        }
        data-open={
          open
            ? "true"
            : "false"
        }
        aria-expanded={
          open
        }
        aria-controls={
          open
            ? menuId
            : undefined
        }
        aria-haspopup="true"
        onClick={() =>
          setOpen(
            (value) =>
              !value
          )
        }
      >
        <span
          className={
            styles.menuGlyph
          }
          aria-hidden="true"
        >
          <span />

          <span />
        </span>

        <span
          className={
            styles.menuTriggerLabel
          }
        >
          Menu
        </span>
      </button>

      {/*
       * Focus scrim (v3.6 mobile): the open panel is a surface, not
       * a stencil — the page behind dims instead of competing with
       * the entries. Purely decorative + click-through is already
       * handled by the outside-pointerdown dismissal, so the scrim
       * itself stays aria-hidden and pointer-transparent.
       */}
      {open && (
        <div
          className={
            styles.menuScrim
          }
          aria-hidden="true"
        />
      )}

      {open && (
        <div
          ref={panelRef}
          id={menuId}
          className={
            styles.menuPanel
          }
        >
          <nav
            className={
              styles.menuPanelNav
            }
            aria-label={
              label
            }
          >
            <ul
              className={
                styles.menuList
              }
            >
              {entries.map(
                (
                  entry,
                  index
                ) => {
                  /*
                   * One quiet divider per group boundary: primary →
                   * world → utility. The primary block always leads.
                   */
                  const previousGroup =
                    index > 0
                      ? entries[
                          index -
                            1
                        ]
                          .group
                      : null;

                  const divider =
                    previousGroup !==
                      null &&
                    previousGroup !==
                      entry.group;

                  const entryBody =
                    (
                      <>
                        <span
                          className={
                            styles.menuEntryLabel
                          }
                        >
                          {
                            entry.shortLabel
                          }
                        </span>

                        <span
                          className={
                            styles.menuEntryDot
                          }
                          aria-hidden="true"
                        />
                      </>
                    );

                  /*
                   * WARM ON INTENT (v3.5, hover-visual-only in
                   * v4.0.5) — the disclosure panel warms exactly
                   * like the desktop track: pointerdown/focus warm
                   * immediately; hover never reaches the network.
                   * Scene actions preload their module; internal
                   * links prefetch their route. One deduplicated
                   * contract, no hover requirement.
                   */
                  const warm = () => {
                    onWarmNow?.(entry);
                  };

                  return (
                    <Fragment
                      key={
                        entry.id
                      }
                    >
                      {divider && (
                        <li
                          className={
                            styles.menuDivider
                          }
                          role="presentation"
                        />
                      )}

                      <li
                        className={
                          styles.menuItem
                        }
                      >
                        {entry.kind ===
                        "action" ? (
                          <button
                            type="button"
                            className={
                              styles.menuEntry
                            }
                            data-id={
                              entry.id
                            }
                            data-group={
                              entry.group
                            }
                            data-active={
                              entry.active
                                ? "true"
                                : "false"
                            }
                            aria-current={
                              entry.active
                                ? "page"
                                : undefined
                            }
                            onPointerDown={
                              warm
                            }
                            onFocus={
                              warm
                            }
                            onClick={() => {
                              entry.onSelect();

                              close();
                            }}
                          >
                            {
                              entryBody
                            }
                          </button>
                        ) : entry.external ? (
                          <a
                            className={
                              styles.menuEntry
                            }
                            data-id={
                              entry.id
                            }
                            data-group={
                              entry.group
                            }
                            data-active={
                              entry.active
                                ? "true"
                                : "false"
                            }
                            href={
                              entry.href
                            }
                            target="_blank"
                            rel="noreferrer"
                            onClick={
                              close
                            }
                          >
                            {
                              entryBody
                            }

                            <span
                              className={
                                styles.menuEntryArrow
                              }
                              aria-hidden="true"
                            >
                              {
                                EXTERNAL_ARROW
                              }
                            </span>
                          </a>
                        ) : (
                          <Link
                            className={
                              styles.menuEntry
                            }
                            data-id={
                              entry.id
                            }
                            data-group={
                              entry.group
                            }
                            data-active={
                              entry.active
                                ? "true"
                                : "false"
                            }
                            aria-current={
                              entry.active
                                ? "page"
                                : undefined
                            }
                            href={
                              entry.href
                            }
                            prefetch={
                              false
                            }
                            onPointerDown={
                              warm
                            }
                            onFocus={
                              warm
                            }
                            onClick={
                              entry.active
                                ? close
                                : (event) => {
                                    onRouteProgress?.(event);

                                    close();
                                  }
                            }
                          >
                            {
                              entryBody
                            }
                          </Link>
                        )}
                      </li>
                    </Fragment>
                  );
                }
              )}
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
