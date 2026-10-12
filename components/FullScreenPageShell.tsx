import type { ReactNode } from "react";

import styles from "@/components/FullScreenPageShell.module.css";

/*
 * FULL-SCREEN PAGE SHELL (v3.6) — the shared architecture that
 * makes every primary tab begin as a full-screen composition.
 *
 * One shell, one contract, six tabs:
 *
 *   HOME · ABOUT · WORK · RESEARCH · BLOG · CONTACT
 *
 * - the shell never collapses shorter than one viewport: a
 *   100vh → 100svh → 100dvh min-height stack (static vh fallback
 *   for older engines, small-viewport units for mobile browser
 *   chrome, dynamic units where they are supported)
 * - the shell is a flex column: header, growing main, footer —
 *   so short documents still end with the footer pinned to the
 *   bottom of the first screen, and long documents push it down
 *   naturally
 * - full-screen means COMPOSITION, not confinement: content
 *   longer than one viewport scrolls normally; nothing is
 *   clipped, squeezed, or given an artificial fixed height
 * - `data-page` carries the per-tab identity layer (accent
 *   tokens, hero field motifs) on top of the one shared design
 *   system — six accents, not six design systems
 *
 * The content documents (/about/, /work/, /research/, /contact/
 * and the topic hubs) integrate this shell through ContentShell;
 * the blog route wraps its own layout with the same contract.
 */

export type FullScreenPageId =
  | "home"
  | "about"
  | "work"
  | "research"
  | "blog"
  | "contact"
  | "hub";

type FullScreenPageShellProps = {
  /**
   * Tab identity — drives the per-page accent tokens. "hub" is the
   * neutral fallback for the topic hubs, which share the document
   * shell without claiming a primary tab's identity.
   */
  page: FullScreenPageId;
  children: ReactNode;
  /** Optional extra class merged onto the shell root. */
  className?: string;
};

export default function FullScreenPageShell({
  page,
  children,
  className
}: FullScreenPageShellProps) {
  return (
    <div
      className={
        className
          ? `${styles.shell} ${className}`
          : styles.shell
      }
      data-page={page}
    >
      {children}
    </div>
  );
}
