/*
 * KEYBOARD HELPERS — shared by the blog's keyboard islands.
 *
 * One definition of "the reader is typing": focus sits inside an
 * input, textarea, select, or contentEditable element. Single-key
 * shortcuts (J/K navigation, "/" search, "?" shortcuts) must never
 * fire while the reader is composing text.
 */
export function isTypingTarget(
  target: EventTarget | null
): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tag = target.tagName;

  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT"
  );
}

/*
 * "A modal dialog is open right now": true when any native <dialog>
 * is showing (showModal). While a modal is open, background content
 * is inert but keydown events from inside the dialog still bubble to
 * document — so global single-key shortcuts (J/K, T, "/") must stand
 * down instead of acting on the page behind the modal.
 */
export function isModalDialogOpen(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return document.querySelector("dialog[open]") !== null;
}
