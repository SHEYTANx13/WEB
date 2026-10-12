"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

import {
  isModalDialogOpen,
  isTypingTarget
} from "@/lib/keyboard";

/*
 * ARTICLE KEYS (v2.5.3) — J/K keyboard navigation between articles.
 *
 * A silent island: renders nothing, teaches the article route two
 * keys after hydration.
 *
 * - J follows the NEXT link, K follows PREVIOUS (the vim reader's
 *   convention; the visible affordance is the aria-hidden <kbd> hint
 *   rendered build-time inside the adjacent-nav labels, so no-JS
 *   visitors simply see hints that do nothing — navigation itself
 *   stays the links' job).
 * - The hrefs arrive as props from the server page (same
 *   getAdjacentPosts data the adjacent nav renders), so the island
 *   owns zero content logic and cannot drift from the visible links.
 * - Navigation goes through the App Router, preserving the
 *   client-side transition other in-site links already get.
 * - T (v2.5.6) scrolls back to the top of the article — the
 *   keyboard twin of the visible BACK-TO-TOP control the
 *   ReadingProgress island renders after the first screens. No new
 *   listener: T rides this island's existing keydown budget. The
 *   smooth scroll collapses to an instant jump under
 *   prefers-reduced-motion, matching every other scroll motion on
 *   the site.
 * - Typing safety: keys are ignored while focus sits in an input,
 *   textarea, select, or contentEditable element (lib/keyboard);
 *   modified keys (Cmd/Ctrl/Alt/Shift) pass through to browser
 *   behavior untouched. Keys also stand down while a modal dialog
 *   (the shortcuts reference) is open — its keydown events bubble
 *   to document even though the page behind is inert, and acting
 *   on that page from inside the modal would be a silent trap.
 * - With only one neighbor (oldest/newest article) the other key
 *   simply does nothing.
 */

type ArticleKeysProps = {
  prevHref: string | null;
  nextHref: string | null;
};

export default function ArticleKeys({
  prevHref,
  nextHref
}: ArticleKeysProps) {
  const router = useRouter();

  useEffect(() => {
    /*
     * No early return on missing neighbors: J/K each no-op safely
     * below when their href is null, and T must keep working even
     * on the newest/oldest article where a neighbor doesn't exist.
     */
    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.defaultPrevented) {
        return;
      }

      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      if (isModalDialogOpen()) {
        return;
      }

      let href: string | null = null;

      if (event.key === "t") {
        /*
         * T (v2.5.6): keyboard twin of the visible back-to-top
         * control. Works regardless of neighbors; reduced motion
         * collapses the scroll to an instant jump.
         */
        event.preventDefault();

        window.scrollTo({
          top: 0,
          behavior: window.matchMedia(
            "(prefers-reduced-motion: reduce)"
          ).matches
            ? "auto"
            : "smooth"
        });

        return;
      }

      if (event.key === "j") {
        href = nextHref;
      } else if (event.key === "k") {
        href = prevHref;
      } else {
        return;
      }

      if (!href) {
        return;
      }

      event.preventDefault();

      router.push(href);
    };

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [router, prevHref, nextHref]);

  /*
   * No markup: the hints live in the adjacent nav (server markup),
   * the behavior lives here.
   */
  return null;
}
