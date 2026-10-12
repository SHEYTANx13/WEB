"use client";

import { useEffect } from "react";

/*
 * RED CURSOR — PERFORMANCE EDITION
 *
 * The visual design remains a custom red pointer with:
 * - red dimensional pointer body
 * - bright contour
 * - inner highlight
 * - eye/core detail
 * - subtle cursor ring
 *
 * Performance architecture:
 * - zero pointer event listeners
 * - zero requestAnimationFrame loops
 * - zero React state
 * - zero moving DOM nodes
 * - zero per-frame style writes
 * - zero SVG filters
 * - zero animated shadows
 *
 * The browser/OS owns cursor movement directly.
 *
 * This is deliberately implemented as a native CSS cursor so pointer
 * movement is completely independent from the page's React/Canvas
 * rendering workload.
 */

const RED_CURSOR_DATA_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='40' viewBox='0 0 48 58'%3E%3Cdefs%3E%3ClinearGradient id='f' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23ff5848'/%3E%3Cstop offset='42%25' stop-color='%23d20f0f'/%3E%3Cstop offset='100%25' stop-color='%23460000'/%3E%3C/linearGradient%3E%3ClinearGradient id='s' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23ff3028'/%3E%3Cstop offset='100%25' stop-color='%23680000'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='17' cy='22' r='13' fill='none' stroke='%23ff2020' stroke-width='1' stroke-opacity='.20'/%3E%3Ccircle cx='17' cy='22' r='9' fill='none' stroke='%23ff2020' stroke-width='.7' stroke-opacity='.10'/%3E%3Cpath d='M1.5 1.5L1.5 49L14.5 36.5L26.5 53.5L34 48.5L22.5 32.5L41.5 32.5Z' fill='url(%23f)'/%3E%3Cpath d='M1.5 1.5L22.5 32.5L41.5 32.5Z' fill='url(%23s)'/%3E%3Cpath d='M1.5 1.5L1.5 49L14.5 36.5L26.5 53.5L34 48.5L22.5 32.5L41.5 32.5Z' fill='none' stroke='%23ff7065' stroke-width='.9' stroke-linejoin='round' stroke-opacity='.88'/%3E%3Cpath d='M3.5 5L3.5 43L13.5 33.5' fill='none' stroke='%23ff9a91' stroke-width='1' stroke-linecap='round' stroke-linejoin='round' stroke-opacity='.78'/%3E%3Ccircle cx='14.5' cy='23' r='4' fill='%23ff2d20' fill-opacity='.92'/%3E%3Ccircle cx='14.5' cy='23' r='1.5' fill='%23ffffff' fill-opacity='.96'/%3E%3C/svg%3E";

const RED_CURSOR_CSS = `
  html.red-cursor-enabled,
  html.red-cursor-enabled body,
  html.red-cursor-enabled a,
  html.red-cursor-enabled button,
  html.red-cursor-enabled [role="button"],
  html.red-cursor-enabled input,
  html.red-cursor-enabled textarea,
  html.red-cursor-enabled select,
  html.red-cursor-enabled summary,
  html.red-cursor-enabled [tabindex] {
    cursor: url("${RED_CURSOR_DATA_URL}") 2 2, auto;
  }

  @media (hover: hover) and (pointer: fine) {
    html.red-cursor-enabled,
    html.red-cursor-enabled body,
    html.red-cursor-enabled a,
    html.red-cursor-enabled button,
    html.red-cursor-enabled [role="button"],
    html.red-cursor-enabled input,
    html.red-cursor-enabled textarea,
    html.red-cursor-enabled select,
    html.red-cursor-enabled summary,
    html.red-cursor-enabled [tabindex] {
      cursor: url("${RED_CURSOR_DATA_URL}") 2 2, auto;
    }
  }

  /*
   * Native PDF viewers and other embedded document surfaces should
   * keep their own cursor behavior. MediaPdfReader toggles this
   * class while a PDF is active.
   */
  html.pdf-reader-active,
  html.pdf-reader-active body,
  html.pdf-reader-active a,
  html.pdf-reader-active button,
  html.pdf-reader-active [role="button"],
  html.pdf-reader-active input,
  html.pdf-reader-active textarea,
  html.pdf-reader-active select,
  html.pdf-reader-active summary,
  html.pdf-reader-active [tabindex] {
    cursor: auto;
  }

  @media (hover: none), (pointer: coarse), (prefers-reduced-motion: reduce) {
    html.red-cursor-enabled,
    html.red-cursor-enabled body,
    html.red-cursor-enabled a,
    html.red-cursor-enabled button,
    html.red-cursor-enabled [role="button"],
    html.red-cursor-enabled input,
    html.red-cursor-enabled textarea,
    html.red-cursor-enabled select,
    html.red-cursor-enabled summary,
    html.red-cursor-enabled [tabindex] {
      cursor: auto;
    }
  }
`;

export default function RedCursor() {
  useEffect(() => {
    const root =
      document.documentElement;

    root.classList.add(
      "red-cursor-enabled"
    );

    return () => {
      root.classList.remove(
        "red-cursor-enabled"
      );
    };
  }, []);

  return (
    <style
      id="red-cursor-native"
      dangerouslySetInnerHTML={{
        __html: RED_CURSOR_CSS,
      }}
    />
  );
}
