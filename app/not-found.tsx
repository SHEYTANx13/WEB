import type { Metadata } from "next";

import {
  REGISTRY_ROUTES
} from "@/lib/routes";

import styles from "./not-found.module.css";

/*
 * THE STATIC 404 (v4.0.1) — a real document, not a redirect.
 *
 * GitHub Pages serves this document (out/404.html) for every unknown
 * path, so it must carry its own useful content in the static HTML:
 * a proper title and heading, an honest explanation, the three main
 * destinations (Home / Blog / Work) as plain anchors, and one link
 * for every known area of the site — DERIVED from the canonical
 * route registry (data/routes.json), never a stale hardcoded list.
 *
 * Laws:
 * - Pure server component with zero client hooks and zero redirect
 *   calls: the page is fully rendered into the export. There is
 *   nothing to redirect to — the visitor's intended URL is unknown
 *   to a static file, so the page offers every real destination
 *   instead.
 * - Plain anchors with the deployment basePath applied through the
 *   build-time NEXT_PUBLIC_BASE_PATH inline (same discipline as the
 *   world shell and the blog pipeline).
 */

const BASE_PATH =
  process.env.NEXT_PUBLIC_BASE_PATH ??
  "";

function routeHref(
  path: string
): string {
  return `${BASE_PATH}${path}`;
}

/*
 * Known areas, derived from the canonical route registry: every real
 * public route except the home document (already the primary action)
 * and the blog index (already a primary action). Topic hubs keep
 * their registry topicName; identity/collection routes show their
 * kind. A route added to the registry appears here automatically; a
 * removed route disappears — no maintenance, no drift.
 */
const KNOWN_AREAS = REGISTRY_ROUTES.filter(
  (route) =>
    route.path !== "" &&
    route.path !== "blog"
).map((route) => ({
  href: routeHref(
    `/${route.path}/`
  ),
  kind:
    route.kind === "topic-hub"
      ? (route.topicName ?? "Topic hub")
      : route.kind === "collection"
        ? "Collection"
        : route.kind === "identity"
          ? "Document"
          : "Topic hub",
  name: route.title.replace(
    /\s+—\s+Parsa\s+Tak$/,
    ""
  )
}));

/*
 * The 404's own document metadata: a proper title (the root layout
 * carries no title template, so the suffix is stated explicitly) and
 * an explicit noindex — Next also marks the not-found route
 * noindex, but stating it keeps the intent verifiable.
 */
export const metadata: Metadata = {
  title: "Page not found — Parsa Tak",
  robots: {
    index: false,
    follow: false
  }
};

export default function NotFound() {
  return (
    <main className={styles.root}>
      <div className={styles.inner}>
        <p className={styles.signal}>
          <span
            className={styles.signalDot}
            aria-hidden="true"
          />

          <span>
            Signal lost
          </span>
        </p>

        <h1 className={styles.code}>
          404
        </h1>

        <p className={styles.title}>
          This page does not exist.
        </p>

        <p className={styles.explanation}>
          The address you followed has no document behind it — the
          static site was built without it, or it was removed. Nothing
          redirected you here and nothing is watching this page: this
          is the honest static answer. Every real destination of the
          laboratory is below —{" "}
          <code>Home</code>, <code>Blog</code> and{" "}
          <code>Work</code> first, then every known area of the site.
        </p>

        <nav
          className={styles.actions}
          aria-label="Primary destinations"
        >
          <a
            className={`${styles.action} ${styles.actionPrimary}`}
            href={routeHref("/")}
          >
            Home
          </a>

          <a
            className={styles.action}
            href={routeHref("/blog/")}
          >
            Blog
          </a>

          <a
            className={styles.action}
            href={routeHref("/work/")}
          >
            Work
          </a>
        </nav>

        <p className={styles.areasLabel}>
          Known areas of the site
        </p>

        <ul className={styles.areas}>
          {KNOWN_AREAS.map((area) => (
            <li key={area.href}>
              <a
                className={styles.area}
                href={area.href}
              >
                <span className={styles.areaKind}>
                  {area.kind}
                </span>

                <span className={styles.areaName}>
                  {area.name}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>

    </main>
  );
}
