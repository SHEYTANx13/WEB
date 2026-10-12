"use client";

import { useEffect } from "react";

import { copyText } from "@/lib/clipboard";

import styles from "./ShareLink.module.css";

/*
 * SHARE LINK (v2.5.3) — a copy-link instrument for the article.
 *
 * The article server-renders an empty actions slot at the right end
 * of the tags row (<span data-article-actions> in page.tsx); after
 * hydration this island docks a quiet COPY LINK button into it.
 * Design laws, matching the CodeCopy island exactly (same imperative
 * pattern — no state, no hydration mismatch, no cascading renders):
 *
 * - Without JavaScript no button exists — the enhancement is
 *   additive, never a dead control. The reserved slot keeps the tag
 *   pills from moving when the button appears.
 * - The copy target is window.location.href at click time, so what
 *   lands in the clipboard is exactly where the reader is (including
 *   any heading hash they chose to share).
 * - Feedback is a plain text swap ("COPY LINK" → "COPIED" /
 *   "FAILED") with a data-copied attribute for styling — one reset
 *   timeout, no animation.
 * - An ordinary <button type="button">: keyboard-operable, labeled.
 * - Print hides the whole actions slot (article.module.css).
 */

const RESET_DELAY_MS = 1600;

export default function ShareLink() {
  useEffect(() => {
    const slot = document.querySelector(
      "[data-article-actions]"
    );

    if (!slot) {
      return;
    }

    const button =
      document.createElement("button");

    button.type = "button";

    button.className =
      styles.shareButton;

    button.dataset.copied = "idle";

    button.textContent = "COPY LINK";

    button.setAttribute(
      "aria-label",
      "Copy link to this article"
    );

    button.title =
      "Copy link to this article";

    let resetTimer = 0;

    const handleClick = () => {
      void copyText(
        window.location.href
      ).then((ok) => {
        button.dataset.copied = ok
          ? "copied"
          : "error";

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
                "idle";

              button.textContent =
                "COPY LINK";
            },
            RESET_DELAY_MS
          );
      });
    };

    button.addEventListener(
      "click",
      handleClick
    );

    slot.appendChild(button);

    return () => {
      button.removeEventListener(
        "click",
        handleClick
      );

      window.clearTimeout(
        resetTimer
      );

      button.remove();
    };
  }, []);

  /*
   * No markup: the slot exists in the server-rendered tags row;
   * this island only fills it.
   */
  return null;
}
