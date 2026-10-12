"use client";

import { useEffect } from "react";

import styles from "./TextSize.module.css";

/*
 * TEXT SIZE (v2.5.7) — a reader text-size instrument for the article.
 *
 * The article server-renders an empty actions slot at the right end
 * of the tags row (<span data-article-actions> in page.tsx); after
 * hydration this island docks a quiet three-step control into that
 * slot beside the COPY LINK button. Design laws, matching the
 * ShareLink and CodeCopy islands exactly (same imperative pattern —
 * no state, no hydration mismatch, no cascading renders):
 *
 * - Without JavaScript no control exists — the enhancement is
 *   additive, never a dead control. The slot keeps the tag pills
 *   from moving when the group appears.
 * - The control writes a single CSS custom property
 *   (--reader-scale) on the document root; article.module.css
 *   multiplies the article body and heading sizes by it with a
 *   fallback of 1. Nothing else on the site consumes the variable,
 *   so the preference cannot leak outside the article page.
 * - The preference persists in localStorage (guarded — restrictive
 *   browsers that throw on access simply get a session-only scale,
 *   the same contract as the audio settings). The stored value is
 *   re-validated: anything that is not an integer inside the step
 *   range is ignored and the default stands.
 * - Feedback for assistive tech is a visually hidden live region
 *   inside the group ("Text size 110%"), announced on every change.
 * - The range ends disable their buttons rather than looping — a
 *   control that silently wraps teaches the wrong range.
 * - Ordinary <button type="button"> elements: keyboard-operable,
 *   labeled, no keydown listeners of their own.
 * - Print hides the whole actions slot (article.module.css); this
 *   module carries no print rules of its own.
 */

/*
 * Reading scale steps around the 1.0 default. The article body
 * renders at clamp(16px … 18px); these multiply that base, so every
 * step stays inside the same measured line-length the layout was
 * designed for.
 */
const SCALES = [0.95, 1, 1.1, 1.2];

const DEFAULT_INDEX = 1;

const STORAGE_KEY = "web.reader-text-scale";

export default function TextSize() {
  useEffect(() => {
    const slot = document.querySelector(
      "[data-article-actions]"
    );

    if (!slot) {
      return;
    }

    const group =
      document.createElement("div");

    group.className = styles.group;

    group.dataset.textSize = "";

    group.setAttribute(
      "role",
      "group"
    );

    group.setAttribute(
      "aria-label",
      "Article text size"
    );

    const status =
      document.createElement("span");

    status.className = "sr-only";

    status.setAttribute(
      "aria-live",
      "polite"
    );

    const minus =
      document.createElement("button");

    minus.type = "button";

    minus.className = styles.btn;

    minus.textContent = "A\u2212";

    minus.setAttribute(
      "aria-label",
      "Smaller article text"
    );

    minus.title = "Smaller text";

    const reset =
      document.createElement("button");

    reset.type = "button";

    reset.className = styles.btn;

    reset.textContent = "A";

    reset.setAttribute(
      "aria-label",
      "Reset article text size"
    );

    reset.title = "Default text size";

    const plus =
      document.createElement("button");

    plus.type = "button";

    plus.className = styles.btn;

    plus.textContent = "A+";

    plus.setAttribute(
      "aria-label",
      "Larger article text"
    );

    plus.title = "Larger text";

    let index = DEFAULT_INDEX;

    /*
     * Restore a previous choice. Re-validated on read: a stale or
     * tampered value falls back to the default step.
     */
    try {
      const stored =
        window.localStorage.getItem(
          STORAGE_KEY
        );

      if (stored !== null) {
        const parsed = Number(stored);

        if (
          Number.isInteger(parsed) &&
          parsed >= 0 &&
          parsed < SCALES.length
        ) {
          index = parsed;
        }
      }
    } catch {
      /*
       * Storage unavailable (restrictive browser or privacy mode) —
       * the default stands and the control still works for the
       * session, exactly like the audio settings.
       */
    }

    const apply = (persist: boolean) => {
      const scale = SCALES[index];

      document.documentElement.style.setProperty(
        "--reader-scale",
        String(scale)
      );

      minus.disabled = index === 0;

      plus.disabled =
        index === SCALES.length - 1;

      reset.dataset.active =
        scale === 1 ? "true" : "false";

      status.textContent = `Text size ${Math.round(scale * 100)}%`;

      if (persist) {
        try {
          window.localStorage.setItem(
            STORAGE_KEY,
            String(index)
          );
        } catch {
          /*
           * Storage unavailable — the scale stays session-only.
           */
        }
      }
    };

    const handleMinus = () => {
      if (index > 0) {
        index -= 1;

        apply(true);
      }
    };

    const handlePlus = () => {
      if (index < SCALES.length - 1) {
        index += 1;

        apply(true);
      }
    };

    const handleReset = () => {
      if (index !== DEFAULT_INDEX) {
        index = DEFAULT_INDEX;

        apply(true);
      }
    };

    minus.addEventListener(
      "click",
      handleMinus
    );

    plus.addEventListener(
      "click",
      handlePlus
    );

    reset.addEventListener(
      "click",
      handleReset
    );

    group.append(minus, reset, plus, status);

    apply(false);

    slot.appendChild(group);

    return () => {
      minus.removeEventListener(
        "click",
        handleMinus
      );

      plus.removeEventListener(
        "click",
        handlePlus
      );

      reset.removeEventListener(
        "click",
        handleReset
      );

      /*
       * Leaving the article also leaves the scale: the variable is
       * removed, so any later article re-opens at the stored (or
       * default) step through a fresh island mount — the preference
       * is re-applied on mount, not leaked between pages.
       */
      document.documentElement.style.removeProperty(
        "--reader-scale"
      );

      group.remove();
    };
  }, []);

  /*
   * No markup: the slot exists in the server-rendered tags row;
   * this island only fills it.
   */
  return null;
}
