/*
 * Shared clipboard helper (v2.5.3) — extracted from the CodeCopy
 * island so both copy instruments (code blocks, article link) use
 * one implementation with identical fallback semantics.
 *
 * The modern path is the async Clipboard API; when it is missing or
 * rejects (permission denial, non-secure context), the legacy
 * textarea + execCommand path runs before giving up. Both callers
 * treat the boolean result as the whole contract: label swap only,
 * no error UI, nothing load-bearing.
 */

export function copyText(
  text: string
): Promise<boolean> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => legacyCopy(text));
  }

  return Promise.resolve(legacyCopy(text));
}

/*
 * Legacy fallback for non-secure contexts: a temporary textarea,
 * select, and the deprecated-but-universal execCommand path.
 */
function legacyCopy(
  text: string
): boolean {
  try {
    const area =
      document.createElement(
        "textarea"
      );

    area.value = text;

    area.setAttribute(
      "readonly",
      ""
    );

    area.style.position = "fixed";

    area.style.opacity = "0";

    area.style.pointerEvents = "none";

    document.body.appendChild(area);

    area.select();

    const ok =
      document.execCommand("copy");

    document.body.removeChild(area);

    return ok;
  } catch {
    return false;
  }
}
