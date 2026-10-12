"use client";

import { useEffect, useRef } from "react";

import styles from "./ReadingProgress.module.css";

/*
 * READING PROGRESS (v2.5) — a minimal instrument, not a decoration.
 *
 * A 2px bar pinned to the top of the viewport that reflects how far
 * through the article the reader actually is. Design laws:
 *
 * - Compositor-only: progress is applied as `transform: scaleX()` on
 *   one fixed element. Width/height/left/top are never animated.
 * - No layout reads per frame: the article's document-space geometry
 *   is measured ONCE per layout-changing event (mount, resize, load,
 *   motion change) and cached; the scroll handler only reads
 *   `window.scrollY` and writes two style values inside a single
 *   rAF-coalesced tick. No React state, no re-render, no scroll
 *   thrash — the reader can never outpace the bar's frame budget.
 * - The same controller publishes the shared `--reading-progress`
 *   custom property and the `data-reading` attribute on <html>, which
 *   is how the WorldBackground organism quiets itself into its
 *   focused reading mood (see WorldBackground.module.css). One
 *   writer, CSS-side consumers, zero per-frame JavaScript beyond the
 *   two writes.
 * - Honest range: progress starts when the article's top edge reaches
 *   the top of the viewport and completes when its bottom edge
 *   reaches the bottom — the actual reading span, not page padding.
 * - The bar is informational, not autonomous motion: it stays
 *   functional under prefers-reduced-motion and reflects only where
 *   the READER scrolled.
 * - The BACK-TO-TOP control (v2.5.2) shares this component's rAF
 *   tick instead of running its own scroll listener: visibility is
 *   one data-attribute write on the button in the SAME tick that
 *   scales the bar (no React state, no second loop, no extra frame
 *   budget). Its scroll-to-top honors prefers-reduced-motion.
 */

const PROGRESS_START_OFFSET = 0;

/*
 * The control appears once the reader is genuinely into the article
 * and stays until they return to the top.
 */
const TO_TOP_THRESHOLD = 0.12;

export default function ReadingProgress() {
  const barRef = useRef<HTMLSpanElement | null>(null);

  const toTopRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const bar = barRef.current;

    if (!bar) {
      return;
    }

    const root = document.documentElement;

    const article = document.querySelector("article");

    root.dataset.reading = "true";

    let start = 0;
    let end = 1;
    let frame = 0;

    const measure = () => {
      if (!article) {
        return;
      }

      const rect = article.getBoundingClientRect();
      const articleTop = rect.top + window.scrollY;
      const viewportHeight =
        window.innerHeight || document.documentElement.clientHeight;

      start = articleTop + PROGRESS_START_OFFSET;
      end = articleTop + rect.height - viewportHeight;

      if (end <= start) {
        end = start + 1;
      }
    };

    const applyProgress = () => {
      frame = 0;

      const scrollY = window.scrollY;
      const progress = Math.min(
        1,
        Math.max(0, (scrollY - start) / (end - start))
      );

      bar.style.transform = `scaleX(${progress})`;
      root.style.setProperty(
        "--reading-progress",
        progress.toFixed(4)
      );

      const toTop = toTopRef.current;

      if (toTop) {
        const visible = progress > TO_TOP_THRESHOLD;

        if (toTop.dataset.visible !== (visible ? "true" : "false")) {
          toTop.dataset.visible = visible ? "true" : "false";
        }
      }
    };

    const scheduleProgress = () => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(applyProgress);
      }
    };

    const handleResize = () => {
      measure();
      scheduleProgress();
    };

    measure();
    applyProgress();

    window.addEventListener("scroll", scheduleProgress, {
      passive: true
    });
    window.addEventListener("resize", handleResize, {
      passive: true
    });

    /*
     * Late layout changes: the cover image and web fonts can shift
     * the article's height after first paint. One re-measure per
     * event, never per frame. The promise is guarded by `disposed`
     * so a navigation away before fonts settle cannot re-measure or
     * re-write the shared CSS variable after cleanup removed it.
     */
    window.addEventListener("load", handleResize, {
      passive: true
    });

    let disposed = false;

    if (typeof document.fonts !== "undefined" && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (disposed) {
          return;
        }

        measure();
        scheduleProgress();
      });
    }

    return () => {
      disposed = true;

      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }

      window.removeEventListener("scroll", scheduleProgress);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("load", handleResize);

      delete root.dataset.reading;
      root.style.removeProperty("--reading-progress");
    };
  }, []);

  const scrollToTop = () => {
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    window.scrollTo({
      top: 0,
      behavior: reduced ? "auto" : "smooth"
    });
  };

  return (
    <>
      <span
        ref={barRef}
        className={styles.readingProgress}
        aria-hidden="true"
      />

      <button
        ref={toTopRef}
        type="button"
        className={styles.toTop}
        data-visible="false"
        aria-label="Back to top"
        onClick={scrollToTop}
      >
        <span aria-hidden="true">↑</span>
      </button>
    </>
  );
}
