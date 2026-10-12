/*
 * SITE NAVIGATION (v3.7) — the single source of truth for the
 * site-wide navigation labels and destinations.
 *
 * v3.7 orders the primary navigation around the Blog-centered
 * content architecture:
 *
 *   HOME · ABOUT · BLOG · CONTACT
 *
 * identity → the laboratory's publication surface → contact.
 * BLOG is the main discovery surface for the whole content
 * ecosystem: writing, work documentation, and research writing all
 * live inside it as content modes (ALL · ARTICLES · WORK · RESEARCH).
 *
 * WORK and RESEARCH are no longer primary tabs. Their canonical
 * routes remain real, crawlable documents (CONTENT_NAV below) — deep
 * portfolio and research landing pages whose discovery increasingly
 * happens through the Blog, the footer, the topic hubs, and each
 * other. They are carried by every surface that renders
 * CONTENT_NAV (the footer's document nav) so they can never become
 * orphaned.
 *
 * The six-scene world stays intact: the scene ids
 * (home / about / systems / magic / work / media) are internal
 * interaction states and are NOT renamed. The experimental
 * destinations — Systems, RED MAGIC, Media — remain secondary
 * "world" navigation, carried by the same unified renderer
 * (UnifiedSiteNav) on every surface — world HUD, blog header,
 * content-shell header, footer — with quieter styling instead of
 * numbered labels. The internal living-world #work scene remains an
 * experiential portfolio scene, distinct from the /work/ canonical
 * document.
 *
 * Every surface renders from these lists, so the navigation can
 * never drift between the world shell, the blog, the content
 * documents, and the footer.
 */

export type NavigationEntry = {
  /** Stable internal id — scene ids stay unchanged (v3.2 law). */
  id: string;
  /** Accessible name (spoken form). */
  label: string;
  /** Visible uppercase form (typography handles the casing). */
  shortLabel: string;
  /** Root-relative destination (basePath applied by the renderer). */
  href: string;
};

/*
 * PRIMARY NAVIGATION (v3.7) — four destinations: who (ABOUT), what
 * is published and discovered (BLOG), and how to reach me (CONTACT).
 * HOME is special-cased inside the world shell as a scene action
 * (in-shell transition); from every other surface it is a plain
 * link to "/". All other primary entries are real, indexable routes.
 */
export const PRIMARY_NAV: readonly NavigationEntry[] = [
  {
    id: "home",
    label: "Home",
    shortLabel: "HOME",
    href: "/"
  },
  {
    id: "about",
    label: "About",
    shortLabel: "ABOUT",
    href: "/about/"
  },
  {
    id: "blog",
    label: "Blog",
    shortLabel: "BLOG",
    href: "/blog/"
  },
  {
    id: "contact",
    label: "Contact",
    shortLabel: "CONTACT",
    href: "/contact/"
  }
];

/*
 * CONTENT COLLECTIONS (v3.7) — the canonical deep documents that the
 * Blog content ecosystem is built on. /work/ is the deep portfolio
 * landing page; /research/ is the deep research landing page. Both
 * remain indexable, crawlable, and cross-linked from the Blog's
 * content modes — they are discovery destinations, not primary tabs.
 * Carried by the footer document nav (and the Blog's lab map) so
 * both routes keep their site-wide inbound edges.
 */
export const CONTENT_NAV: readonly NavigationEntry[] = [
  {
    id: "work",
    label: "Selected Work",
    shortLabel: "WORK",
    href: "/work/"
  },
  {
    id: "research",
    label: "Research",
    shortLabel: "RESEARCH",
    href: "/research/"
  }
];

/*
 * WORLD NAVIGATION (v3.2 / v4.0.0) — the experimental scenes, secondary
 * and contextual. These are interaction states of the world shell
 * ("#/systems", "#/magic", "#/media"), reachable from every
 * surface but visually quieter than the primary track. The v4.0.0
 * Media migration renamed the LIBRARY entry to MEDIA; "#library"
 * keeps working as a normalised backward-compatible alias.
 */
export const WORLD_NAV: readonly NavigationEntry[] = [
  {
    id: "systems",
    label: "Systems",
    shortLabel: "SYSTEMS",
    href: "/#systems"
  },
  {
    id: "magic",
    label: "RED Magic",
    shortLabel: "RED MAGIC",
    href: "/#magic"
  },
  {
    id: "media",
    label: "Media",
    shortLabel: "MEDIA",
    href: "/#media"
  }
];
