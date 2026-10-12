"use client";

import { useEffect } from "react";

import { copyText } from "@/lib/clipboard";

import styles from "./CodeCopy.module.css";

/*
 * CODE COPY (v2.5.2) — progressive enhancement, zero content coupling.
 *
 * The article body is build-time HTML; this island renders NOTHING
 * and adds one behavior after hydration: every `pre > code` block in
 * the article receives a small COPY button. Design laws:
 *
 * - Without JavaScript no button exists and the code is fully
 *   readable — the enhancement is additive, never load-bearing.
 * - The copy target is the code element's textContent, so the button
 *   itself (a sibling of <code>, not a child) can never leak into
 *   the clipboard.
 * - Feedback is a plain text swap ("COPY" → "COPIED") with a
 *   data-copied attribute for styling — no timers beyond the single
 *   reset timeout, no re-renders, no state.
 * - Clipboard failures fall back to the shared legacy path in
 *   lib/clipboard.ts (extracted v2.5.3) before giving up with an
 *   error label; the code text itself is selectable regardless.
 * - Buttons are screen-reader labeled and keyboard-operable: they
 *   are ordinary <button type="button"> elements.
 *
 * The controller runs once per mount. Article bodies are static per
 * route, so no MutationObserver is needed — the DOM is complete
 * before hydration.
 */

const RESET_DELAY_MS = 1600;

export default function CodeCopy() {
  useEffect(() => {
    const blocks = Array.from(
      document.querySelectorAll<HTMLPreElement>(
        "article pre"
      )
    ).filter((pre) =>
      pre.querySelector("code")
    );

    if (blocks.length === 0) {
      return;
    }

    const cleanups: ((
    ) => void)[] = [];

    for (const pre of blocks) {
      const code =
        pre.querySelector("code");

      if (!code) {
        continue;
      }

      /*
       * Anchor chrome to the .code-block WRAPPER when it exists
       * (v2.5.2 build output): the button then stays pinned to the
       * corner while wide code scrolls inside the <pre>. Older
       * data without wrappers falls back to the pre itself.
       */
      const host =
        pre.parentElement &&
        pre.parentElement.classList.contains(
          "code-block"
        )
          ? pre.parentElement
          : pre;

      const button =
        document.createElement(
          "button"
        );

      button.type = "button";

      button.className =
        styles.codeCopy;

      button.textContent = "COPY";

      button.setAttribute(
        "aria-label",
        "Copy code to clipboard"
      );

      let resetTimer = 0;

      const handleClick = () => {
        void copyText(
          code.textContent ?? ""
        ).then((ok) => {
          button.dataset.copied =
            ok ? "true" : "error";

          button.textContent = ok
            ? "COPIED"
            : "FAILED";

          window.clearTimeout(
            resetTimer
          );

          resetTimer =
            window.setTimeout(
              () => {
                button.dataset.copied =
                  "false";

                button.textContent =
                  "COPY";
              },
              RESET_DELAY_MS
            );
        });
      };

      button.addEventListener(
        "click",
        handleClick
      );

      host.appendChild(button);

      cleanups.push(() => {
        button.removeEventListener(
          "click",
          handleClick
        );

        window.clearTimeout(
          resetTimer
        );

        button.remove();
      });
    }

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, []);

  /*
   * No markup: everything this island does happens in the article
   * body that already exists. An empty (but present) host keeps the
   * hydration contract trivial.
   */
  return null;
}
