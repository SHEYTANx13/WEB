"use client";

import { useEffect, useState } from "react";

import styles from "./ArticleToc.module.css";

/*
 * ARTICLE TOC (v2.5.1) — navigation for long reads, in the site's
 * instrument-panel language.
 *
 * Two presentations from ONE heading list (the build-time `headings`
 * data every article already carries — no pipeline change):
 *
 * - RAIL (≥1280px): a fixed instrument rail in the right gutter,
 *   outside the content column (it starts at 50% + 446px — past the
 *   860px related/adjacent blocks). Sticky-by-nature: it stays with
 *   the reader for the whole article.
 * - INLINE (below 1280px): a native <details> disclosure above the
 *   article body — keyboard accessible, functional without JS.
 *
 * Scroll-spy law: ONE IntersectionObserver watches the heading
 * elements (observer-driven state, never a scroll listener) and
 * highlights the section currently being read. Clicks smooth-scroll
 * with scroll-margin respected and degrade to instant jumps under
 * reduced motion. Without JavaScript the links are ordinary anchors:
 * the TOC navigates, only the highlighting disappears.
 */

type TocHeading = {
  id: string;
  text: string;
  level: number;
};

export default function ArticleToc({
  headings
}: {
  headings: readonly TocHeading[];
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (headings.length === 0) {
      return;
    }

    const targets = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => element !== null);

    if (targets.length === 0) {
      return;
    }

    /*
     * Scroll-spy v2.8 — the previous implementation highlighted
     * whichever heading sat inside a thin 15%–25% band, which left
     * the highlight stuck on the last-crossed section while reading
     * long bodies between headings (and never cleared above the
     * first heading on scroll-up).
     *
     * The geometry is now the source of truth: heading offsets in
     * DOCUMENT space are cached once per layout event (mount, load,
     * resize, fonts settled — the same events ReadingProgress
     * re-measures on, zero layout reads during scroll), and the
     * active section is "the last heading above the activation line
     * (15% of viewport from the top)". The IntersectionObserver is
     * kept as the crossing detector — with a root that starts at the
     * activation line, it fires exactly when a heading crosses it in
     * either direction, so every crossing recomputes the state from
     * cached offsets without a scroll listener. Above the first
     * heading nothing is active; the highlight tracks both scroll
     * directions; long bodies between headings keep the enclosing
     * section highlighted.
     */
    const LINE_RATIO = 0.15;

    let offsets: number[] = [];
    let disposed = false;

    const measure = () => {
      const scrollY = window.scrollY;

      offsets = targets.map(
        (element) => element.getBoundingClientRect().top + scrollY
      );
    };

    const recompute = () => {
      const line =
        window.scrollY +
        (window.innerHeight || document.documentElement.clientHeight) *
          LINE_RATIO;

      let current: string | null = null;

      for (let index = 0; index < targets.length; index += 1) {
        if (offsets[index] <= line) {
          current = targets[index].id;
        } else {
          break;
        }
      }

      setActiveId(current);
    };

    const handleLayoutChange = () => {
      measure();
      recompute();
    };

    measure();
    recompute();

    window.addEventListener("resize", handleLayoutChange, {
      passive: true
    });
    window.addEventListener("load", handleLayoutChange, {
      passive: true
    });

    if (typeof document.fonts !== "undefined" && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (disposed) {
          return;
        }

        handleLayoutChange();
      });
    }

    const observer = new IntersectionObserver(
      () => {
        recompute();
      },
      {
        rootMargin: "-15% 0px 0px 0px",
        threshold: 0
      }
    );

    targets.forEach((element) => observer.observe(element));

    return () => {
      disposed = true;
      observer.disconnect();

      window.removeEventListener("resize", handleLayoutChange);
      window.removeEventListener("load", handleLayoutChange);
    };
  }, [headings]);

  if (headings.length === 0) {
    return null;
  }

  const scrollTo = (
    event: React.MouseEvent<HTMLAnchorElement>,
    id: string
  ) => {
    const element = document.getElementById(id);

    if (!element) {
      return;
    }

    event.preventDefault();

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    element.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start"
    });

    window.history.replaceState(null, "", `#${id}`);
    setActiveId(id);
  };

  const renderList = (variant: "rail" | "inline") => (
    <ol
      className={
        variant === "rail" ? styles.railList : styles.inlineList
      }
    >
      {headings.map((heading, index) => (
        <li key={heading.id}>
          <a
            className={
              variant === "rail" ? styles.railLink : styles.inlineLink
            }
            href={`#${heading.id}`}
            data-active={
              activeId === heading.id ? "true" : "false"
            }
            data-level={heading.level}
            onClick={(event) => scrollTo(event, heading.id)}
          >
            <span
              className={styles.index}
              aria-hidden="true"
            >
              {String(index + 1).padStart(2, "0")}
            </span>

            <span className={styles.label}>
              {heading.text}
            </span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      {/*
        * INLINE variant — below 1280px, above the article body.
        * Native details/summary: opens with Enter/Space, works
        * without JavaScript, never traps focus.
        */}
      <details
        className={styles.tocInline}
        data-reveal="instant"
      >
        <summary className={styles.tocInlineSummary}>
          <span>CONTENTS</span>

          <span className={styles.tocInlineCount}>
            {headings.length} SECTIONS
          </span>
        </summary>

        {renderList("inline")}
      </details>

      {/*
        * RAIL variant — ≥1280px only (CSS-hidden elsewhere). Fixed in
        * the right gutter; no ancestor carries a transform, so
        * `position: fixed` behaves literally.
        */}
      <nav
        className={styles.tocRail}
        aria-label="Article contents"
        data-reveal="instant"
      >
        <p className={styles.railKicker}>CONTENTS</p>

        {renderList("rail")}
      </nav>
    </>
  );
}
