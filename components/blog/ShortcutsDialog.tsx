"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { usePathname } from "next/navigation";

import {
  isModalDialogOpen,
  isTypingTarget
} from "@/lib/keyboard";

import styles from "./ShortcutsDialog.module.css";

/*
 * SHORTCUTS DIALOG (v2.5.4) — the keyboard's help affordance.
 *
 * One island per blog page (mounted once in the blog layout, so it
 * serves the index AND every article). Pressing "?" opens a native
 * <dialog> listing the shortcuts that actually work on the current
 * route: J/K article navigation exists only on article pages, "/"
 * search focus exists only on the index — the list is filtered by
 * usePathname so it never advertises a key that would do nothing.
 *
 * Progressive enhancement law (same as CodeCopy/ShareLink): the
 * island renders NOTHING on the server and mounts only after
 * hydration. The keys don't work without JS, so a statically
 * rendered "?" button would be a dead control — a lie in the
 * interface. With JS, the button and dialog appear; without JS,
 * nothing is promised.
 *
 * Accessibility: a native modal <dialog> (focus trapping, Escape,
 * and focus restoration are the platform's job, not ours), labelled
 * by its heading, rows are a definition list with visually hidden
 * key names for screen readers. Backdrop clicks close. Reduced
 * motion: the entrance transition is gated behind
 * (prefers-reduced-motion: no-preference) in the module CSS.
 */

type ShortcutRow = {
  keys: string[];
  action: string;
};

/*
 * Hydration gate via useSyncExternalStore: false on the server and
 * during the hydration render, true afterwards. This is the
 * lint-clean equivalent of the setMounted-in-effect gate — no
 * cascading render warning, and server HTML and first client render
 * still agree on null.
 */
const emptySubscribe = () => () => {};

export default function ShortcutsDialog() {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [isOpen, setOpen] = useState(false);

  const isIndex = /^\/blog\/?$/.test(pathname ?? "");

  const rows: ShortcutRow[] = isIndex
    ? [
        { keys: ["/"], action: "Focus the search field" },
        { keys: ["↵"], action: "Open the top result (from search)" },
        { keys: ["?"], action: "Open this reference" },
        { keys: ["Esc"], action: "Close or clear" }
      ]
    : [
        { keys: ["J"], action: "Next article" },
        { keys: ["K"], action: "Previous article" },
        { keys: ["T"], action: "Back to top" },
        { keys: ["?"], action: "Open this reference" },
        { keys: ["Esc"], action: "Close" }
      ];

  const openDialog = useCallback(() => {
    const dialog = dialogRef.current;

    if (dialog && !dialog.open) {
      dialog.showModal();
      setOpen(true);
    }
  }, []);

  const closeDialog = useCallback(() => {
    const dialog = dialogRef.current;

    if (dialog?.open) {
      dialog.close();
    }

    setOpen(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      /*
       * Never re-open (or fight Escape) while any modal dialog is
       * already showing — "?" pressed inside the dialog is inert
       * text, not another trigger.
       */
      if (isModalDialogOpen()) {
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        openDialog();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openDialog]);

  /*
   * The native "cancel" (Escape) closes the dialog; React state only
   * mirrors visibility for the backdrop-click check.
   */
  const handleCancel = (event: React.SyntheticEvent) => {
    event.preventDefault();
    closeDialog();
  };

  const handleClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) {
      closeDialog();
    }
  };

  /*
   * Scroll lock: showModal makes the page inert, but wheel/touch
   * input still scrolls the document behind the modal, silently
   * moving the reader's place. Lock body overflow for exactly the
   * open window (and only this island's lock) so closing always
   * restores the previous state, even across unmount.
   */
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const body = document.body;

    const previousOverflow = body.style.overflow;

    body.style.overflow = "hidden";

    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!mounted) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={openDialog}
        aria-haspopup="dialog"
        aria-label="Keyboard shortcuts"
        aria-keyshortcuts="?"
      >
        <kbd aria-hidden="true">?</kbd>
      </button>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby="shortcuts-title"
        onCancel={handleCancel}
        onClick={handleClick}
        data-open={isOpen ? "true" : undefined}
      >
        <div className={styles.panel}>
          <p className={styles.kicker} aria-hidden="true">
            READER CONSOLE
          </p>

          <h2 className={styles.title} id="shortcuts-title">
            Keyboard shortcuts
          </h2>

          <dl className={styles.list}>
            {rows.map((row) => (
              <div className={styles.row} key={row.keys.join("+")}>
                <dt className={styles.keys}>
                  {row.keys.map((key) => (
                    <kbd key={key} aria-hidden="true">
                      {key}
                    </kbd>
                  ))}
                </dt>

                <dd className={styles.action}>
                  <span className="sr-only">{row.keys.join(" or ")}: </span>
                  {row.action}
                </dd>
              </div>
            ))}
          </dl>

          <button
            type="button"
            className={styles.close}
            onClick={closeDialog}
          >
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}
