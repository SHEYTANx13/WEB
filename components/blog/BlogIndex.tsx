"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from "react";

import Link from "next/link";

import { useRouter } from "next/navigation";

import type {
  BlogPostMeta,
  ContentType
} from "@/lib/blogFormat";

import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_ORDER,
  contentTypePlural,
  formatBlogDate,
  formatBlogDateShort
} from "@/lib/blogFormat";

import {
  isModalDialogOpen,
  isTypingTarget
} from "@/lib/keyboard";

import styles from "./BlogIndex.module.css";

/*
 * Blog index island — the only client component on the blog index.
 *
 * IMPORTANT BOUNDARY: this component imports from lib/blogFormat.ts
 * ONLY. lib/blog.ts imports the full generated content file, so a
 * single value import from it would pull every article body into this
 * page's client bundle. Metadata arrives as serialized props from the
 * server-rendered index instead.
 *
 * Search is a scan over the precomputed `search` haystack emitted at
 * build time — typing re-filters without joining strings per post.
 * The runtime fallback covers data generated before v2.1.
 */

function matchesQuery(
  post: BlogPostMeta,
  query: string
): boolean {
  if (query === "") {
    return true;
  }

  const haystack =
    post.search ??
    [
      post.title,
      post.subtitle ?? "",
      post.excerpt,
      post.category,
      post.author,
      ...post.tags
    ]
      .join(" ")
      .toLowerCase();

  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) =>
      haystack.includes(term)
    );
}

type BlogIndexProps = {
  posts: readonly BlogPostMeta[];
  tags: readonly string[];
  /*
   * slug → inbound article count (v2.5.5), from the validated
   * build-time link graph. Optional so the island degrades to
   * badge-less cards with older generated data. Plain data — the
   * island itself never imports lib/blog.ts (boundary above).
   */
  inboundRefs?: Readonly<Record<string, number>>;
};

/*
 * CONTENT MODES (v3.7): the Blog is the site's content discovery
 * surface. WORK and RESEARCH stopped being primary-navigation
 * destinations — inside the Blog they are content modes over the
 * same catalogue, selected here and mirrored in the URL (?type=)
 * so a filtered view is shareable and browser-history safe.
 */
const TYPE_MODES: readonly {
  value: ContentType | null;
  label: string;
}[] = [
  { value: null, label: "ALL" },
  { value: "article", label: "ARTICLES" },
  { value: "work", label: "WORK" },
  { value: "research", label: "RESEARCH" }
];

/*
 * DEEP-LINK FILTERS (v2.5.2 + v3.7): article context chips link here
 * as /blog/?project=<name> and /blog/?topic=<name>; the content
 * modes link as /blog/?type=work and /blog/?type=research. The URL
 * is the single source of truth for every dimension — read through
 * useSyncExternalStore (no effect-time setState, no hydration
 * mismatch: the server snapshot is ""), so a chip clear rewrites
 * the address and the store notifies in one motion. An unknown
 * value is ignored — the index never renders a broken-looking
 * state from a stale or hand-edited URL.
 */
const URL_FILTER_EVENT = "blogindex:filters";

function readDeepLinkFilters(
  search: string,
  posts: readonly BlogPostMeta[]
): {
  project: string | null;
  topic: string | null;
  type: ContentType | null;
} {
  if (search === "") {
    return {
      project: null,
      topic: null,
      type: null
    };
  }

  const params =
    new URLSearchParams(search);

  const project =
    params.get("project");

  const topic = params.get("topic");

  const type = params.get("type");

  const validProject =
    project &&
    posts.some(
      (post) =>
        post.project === project
    )
      ? project
      : null;

  const validTopic =
    topic &&
    posts.some((post) =>
      post.topics.includes(topic)
    )
      ? topic
      : null;

  /*
   * The type mode qualifies only when the catalogue actually
   * contains the content type — an empty mode would render an
   * empty-looking state from a hand-edited URL.
   */
  const validType =
    type &&
    (CONTENT_TYPE_ORDER as readonly string[]).includes(type) &&
    posts.some((post) => post.type === type)
      ? (type as ContentType)
      : null;

  return {
    project: validProject,
    topic: validTopic,
    type: validType
  };
}

/*
 * The store: location.search, re-read on popstate AND after the
 * island's own replaceState writes (history.replaceState fires no
 * event, so the writer announces itself).
 */
function subscribeToUrlFilters(
  onStoreChange: () => void
): () => void {
  window.addEventListener(
    "popstate",
    onStoreChange
  );

  window.addEventListener(
    URL_FILTER_EVENT,
    onStoreChange
  );

  return () => {
    window.removeEventListener(
      "popstate",
      onStoreChange
    );

    window.removeEventListener(
      URL_FILTER_EVENT,
      onStoreChange
    );
  };
}

function getUrlSearchSnapshot(): string {
  return window.location.search;
}

function getServerUrlSearchSnapshot(): string {
  return "";
}

/*
 * URL sync for the deep-link dimensions: clearing a filter chip
 * rewrites the address with replaceState so a shareable URL never
 * advertises a filter that is no longer active. History is left
 * alone — filter state is view state, not navigation, and the
 * popstate listener keeps the Back button coherent with what is
 * rendered.
 */
function writeDeepLinkFilters(
  project: string | null,
  topic: string | null,
  type: ContentType | null = null
) {
  if (
    typeof window === "undefined" ||
    typeof window.history === "undefined"
  ) {
    return;
  }

  const params =
    new URLSearchParams(
      window.location.search
    );

  if (project) {
    params.set(
      "project",
      project
    );
  } else {
    params.delete(
      "project"
    );
  }

  if (topic) {
    params.set("topic", topic);
  } else {
    params.delete("topic");
  }

  if (type) {
    params.set("type", type);
  } else {
    params.delete("type");
  }

  const query =
    params.toString();

  /*
   * The current path is preserved verbatim (window.location.pathname),
   * NOT hardcoded to "/blog/": the production deployment serves the
   * site under the /WEB basePath, and a hardcoded path would rewrite
   * the address bar to /blog/?… (outside the deployment), corrupting
   * the shareable URL and making the next full page load a 404.
   */
  window.history.replaceState(
    null,
    "",
    query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname
  );

  window.dispatchEvent(
    new Event(URL_FILTER_EVENT)
  );
}

export default function BlogIndex({
  posts,
  tags,
  inboundRefs
}: BlogIndexProps) {
  const [query, setQuery] =
    useState("");

  const [activeTag, setActiveTag] =
    useState<string | null>(
      null
    );

  const [showAllTags, setShowAllTags] =
    useState(false);

  /*
   * Deep-link dimensions live in the URL (single source of truth).
   * The store snapshot is "" during SSR and re-read on popstate and
   * after the island's own replaceState writes — no effect-time
   * setState anywhere.
   */
  const urlSearch =
    useSyncExternalStore(
      subscribeToUrlFilters,
      getUrlSearchSnapshot,
      getServerUrlSearchSnapshot
    );

  const { project: activeProject, topic: activeTopic, type: activeType } =
    useMemo(
      () =>
        readDeepLinkFilters(
          urlSearch,
          posts
        ),
      [urlSearch, posts]
    );

  /*
   * CONTENT-MODE SWITCH (v3.7): one URL write per selection — the
   * same replaceState channel the project/topic chips use, so the
   * mode is shareable, Back-safe, and survives a page reload. The
   * ALL mode clears the parameter instead of writing ?type=all,
   * keeping the canonical URL clean.
   */
  const setTypeMode = (
    type: ContentType | null
  ) => {
    writeDeepLinkFilters(
      activeProject,
      activeTopic,
      type
    );
  };

  const clearProject = () => {
    writeDeepLinkFilters(
      null,
      activeTopic,
      activeType
    );
  };

  /*
   * PROJECT LABEL FILTER (v2.7): the visible PROJECT chip on each
   * project-connected card joins the deep-link filter system — one
   * click narrows the index to that project, one more click (or
   * the chip bar's ×) restores the full list. Same state, same URL
   * source of truth, no parallel relationship system.
   */
  const toggleProject = (
    project: string
  ) => {
    writeDeepLinkFilters(
      activeProject ===
        project
        ? null
        : project,
      activeTopic,
      activeType
    );
  };

  const clearTopic = () => {
    writeDeepLinkFilters(
      activeProject,
      null,
      activeType
    );
  };

  /*
   * TYPE COUNTS (v3.7) — real counts derived from the generated
   * catalogue (never hardcoded), recomputed only when the posts
   * prop changes. Drives both the selector's per-mode counts and
   * the compact result summary line.
   */
  const typeCounts = useMemo(() => {
    const counts = new Map<
      ContentType,
      number
    >();

    for (const post of posts) {
      counts.set(
        post.type,
        (counts.get(post.type) ?? 0) + 1
      );
    }

    return counts;
  }, [posts]);

  const visibleTags =
    useMemo(
      () =>
        showAllTags
          ? tags
          : tags.slice(0, 8),
      [tags, showAllTags]
    );

  const filteredPosts =
    useMemo(
      () =>
        posts.filter(
          (post) =>
            matchesQuery(
              post,
              query
            ) &&
            (activeType === null ||
              post.type === activeType) &&
            (activeTag === null ||
              post.tags.includes(
                activeTag
              )) &&
            (activeProject ===
              null ||
              post.project ===
                activeProject) &&
            (activeTopic === null ||
              post.topics.includes(
                activeTopic
              ))
        ),
      [
        posts,
        query,
        activeType,
        activeTag,
        activeProject,
        activeTopic
      ]
    );

  const hasFilters =
    query !== "" ||
    activeType !== null ||
    activeTag !== null ||
    activeProject !== null ||
    activeTopic !== null;

  /*
   * ENTER-TO-OPEN (v2.5.7): the keydown handler below is registered
   * once (empty deps) for the "/" hotkey budget, so it cannot close
   * over fresh filter state. This ref mirrors the currently visible
   * list — Enter in the search field opens its first card, exactly
   * what the visible list shows as the top result.
   */
  const visibleRef =
    useRef<BlogPostMeta[]>([]);

  useEffect(() => {
    visibleRef.current = [
      ...filteredPosts
    ];
  }, [filteredPosts]);

  const router = useRouter();

  const clearFilters = () => {
    setQuery("");

    setActiveTag(
      null
    );

    writeDeepLinkFilters(
      null,
      null,
      null
    );
  };

  const toggleTag = (
    tag: string
  ) => {
    setActiveTag(
      (current) =>
        current === tag
          ? null
          : tag
    );
  };

  /*
   * Search hotkey (v2.5.3): "/" anywhere on the index jumps focus
   * into the search field; Escape inside it clears and blurs; Enter
   * inside it (v2.5.7) opens the top result — the keyboard twin of
   * clicking the first visible card, and the natural end of a
   * type-and-go search. All three ride this ONE handler (no new
   * listener budget). All keys are ignored while the reader is
   * already typing in a different field (lib/keyboard — and
   * modified keystrokes always pass through untouched; Enter also
   * stands down during IME composition so a confirm keystroke
   * never navigates mid-word). The visible affordances are the
   * aria-hidden <kbd> hints inside the search wrap — without JS
   * they are inert chrome, with JS they teach the shortcuts.
   * Reduced motion is honored for the scroll-into-view.
   */
  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      /*
       * A modal dialog (the shortcuts reference) eats the page's
       * single keys: its keydowns still reach document, but the
       * search field behind the modal is inert — focusing or
       * scrolling to it from inside the modal would silently do
       * nothing visible.
       */
      if (isModalDialogOpen()) {
        return;
      }

      const searchInput =
        document.getElementById(
          "blog-search"
        );

      if (!searchInput) {
        return;
      }

      if (
        event.key === "/" &&
        !event.shiftKey &&
        !isTypingTarget(
          event.target
        ) &&
        !event.defaultPrevented
      ) {
        event.preventDefault();

        searchInput.scrollIntoView(
          {
            block: "nearest",

            behavior:
              window.matchMedia(
                "(prefers-reduced-motion: reduce)"
              ).matches
                ? "auto"
                : "smooth"
          }
        );

        searchInput.focus();

        return;
      }

      if (
        event.key === "Enter" &&
        event.target ===
          searchInput &&
        !event.isComposing &&
        !event.defaultPrevented
      ) {
        const first =
          visibleRef.current[0];

        if (first) {
          event.preventDefault();

          router.push(
            `/blog/${first.slug}/`
          );
        }

        return;
      }

      if (
        event.key === "Escape" &&
        event.target ===
          searchInput
      ) {
        setQuery("");

        searchInput.blur();
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [router]);

  return (
    <div className={styles.blogIndex}>
      {/**
        * CONTENT-MODE SELECTOR (v3.7) — the Blog's primary
        * discovery control. Four modes over one catalogue; the
        * active mode is mirrored in the URL (?type=…), announced
        * with aria-pressed, and visually unmistakable. Counts are
        * the real per-type catalogue counts (never hardcoded). A
        * mode whose type is absent from the catalogue is disabled —
        * it can never strand the reader in an empty view.
        */}
      <div
        className={styles.typeSelector}
        role="group"
        aria-label="Browse by content type"
      >
        {TYPE_MODES.map((mode) => {
          const active = activeType === mode.value;

          const count =
            mode.value === null
              ? posts.length
              : typeCounts.get(mode.value) ?? 0;

          return (
            <button
              key={mode.label}
              type="button"
              className={styles.typeMode}
              data-active={active ? "true" : "false"}
              data-type={mode.value ?? "all"}
              aria-pressed={active}
              disabled={count === 0}
              onClick={() => setTypeMode(mode.value)}
            >
              <span className={styles.typeModeLabel}>
                {mode.label}
              </span>

              <span className={styles.typeModeCount}>
                {String(count).padStart(2, "0")}
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.controls}>
        <div
          className={styles.searchWrap}
          role="search"
          aria-label="Search articles"
        >
          <label
            className={styles.searchLabel}
            htmlFor="blog-search"
          >
            SEARCH
          </label>

          <input
            id="blog-search"
            className={styles.searchInput}
            type="search"
            value={query}
            onChange={(
              event
            ) => {
              setQuery(
                event
                  .target
                  .value
              );
            }}
            placeholder="Title, tag, or topic…"
            autoComplete="off"
            spellCheck={false}
            aria-keyshortcuts="/"
          />

          {/**
            * Hotkey hints (v2.5.3 + v2.5.7) — decorative; the input
            * carries aria-keyshortcuts for assistive tech. The
            * second hint teaches Enter-to-open, the natural end of
            * a type-and-go search.
            */}
          <kbd
            className={
              styles.searchKey
            }
            aria-hidden="true"
          >
            /
          </kbd>

          <kbd
            className={
              styles.searchKey
            }
            aria-hidden="true"
          >
            ↵
          </kbd>
        </div>

        {tags.length > 0 && (
          <div
            className={styles.tagFilter}
            role="group"
            aria-label="Filter by tag"
            id="blog-tag-filter-full"
          >
            {visibleTags.map(
              (tag) => {
                const active =
                  activeTag ===
                  tag;

                return (
                  <button
                    key={tag}
                    type="button"
                    className={
                      styles.tagChip
                    }
                    data-active={
                      active
                        ? "true"
                        : "false"
                    }
                    aria-pressed={
                      active
                    }
                    onClick={() =>
                      toggleTag(
                        tag
                      )
                    }
                  >
                    {tag}
                  </button>
                );
              }
            )}

            {tags.length > 8 && (
              <button
                type="button"
                className={
                  styles.tagMore
                }
                aria-expanded={
                  showAllTags
                }
                aria-controls="blog-tag-filter-full"
                onClick={() =>
                  setShowAllTags(
                    (
                      current
                    ) =>
                      !current
                  )
                }
              >
                {showAllTags
                  ? "LESS −"
                  : `+${tags.length - 8}`}
              </button>
            )}
          </div>
        )}

        {hasFilters && (
          <button
            type="button"
            className={
              styles.clearButton
            }
            onClick={
              clearFilters
            }
          >
            CLEAR FILTERS
          </button>
        )}
      </div>

      <div
        className={
          styles.resultMeta
        }
        aria-live="polite"
      >
        <span>
          {filteredPosts.length}
          {" "}
          VISIBLE
        </span>

        {/**
          * COMPACT RESULT SUMMARY (v3.7) — the catalogue's real
          * per-type composition, one quiet mono line. Counts come
          * from the generated posts (typeCounts memo above), never
          * from a hardcoded string.
          */}
        <span className={styles.typeSummary}>
          {CONTENT_TYPE_ORDER.map((type, index) => (
            <span key={type}>
              {index > 0 && (
                <span aria-hidden="true"> · </span>
              )}

              {String(typeCounts.get(type) ?? 0).padStart(2, "0")}{" "}
              {contentTypePlural(
                type,
                typeCounts.get(type) ?? 0
              )}
            </span>
          ))}
        </span>

        {activeType && (
          <span className={styles.typeSummaryActive}>
            MODE · {CONTENT_TYPE_LABELS[activeType]}
          </span>
        )}

        {activeTag && (
          <span>
            TAGGED · {activeTag}
          </span>
        )}

        {/*
         * Active deep-link dimensions (v2.5.2): shown as removable
         * chips so a reader arriving from an article context chip
         * always sees WHY the list is narrowed — and can undo it.
         */}
        {activeProject && (
          <button
            type="button"
            className={
              styles.deepLinkChip
            }
            onClick={
              clearProject
            }
            aria-label={`Remove project filter: ${activeProject}`}
          >
            PROJECT ·{" "}
            {activeProject}
            <span
              aria-hidden="true"
              className={
                styles.deepLinkChipX
              }
            >
              ×
            </span>
          </button>
        )}

        {activeTopic && (
          <button
            type="button"
            className={
              styles.deepLinkChip
            }
            onClick={clearTopic}
            aria-label={`Remove topic filter: ${activeTopic}`}
          >
            TOPIC ·{" "}
            {activeTopic}
            <span
              aria-hidden="true"
              className={
                styles.deepLinkChipX
              }
            >
              ×
            </span>
          </button>
        )}
      </div>

      {filteredPosts.length >
        0 && (
        <ul className={styles.grid}>
          {filteredPosts.map(
            (
              post,
              index
            ) => (
              <li
                key={
                  post.slug
                }
                className={
                  styles.card
                }
                data-featured={
                  post.featured
                    ? "true"
                    : "false"
                }
                /*
                 * CARD VARIANT (v3.7): the content type drives the
                 * card's accent variant — one shared card
                 * architecture, four controlled looks (FEATURED
                 * rides on top of the type variant via the
                 * data-featured attribute above).
                 */
                data-type={
                  post.type
                }
                data-category={
                  post.category
                }
                /*
                 * REVEAL STAGGER (v2.2): cards enter with a
                 * deterministic stagger. Grid position drives the
                 * delay (capped by the controller); cards that
                 * survive a filter change keep their revealed state,
                 * newly matching cards fade in, removed cards leave
                 * the set without a heavy exit system.
                 */
                data-reveal=""
                data-reveal-order={
                  index % 6
                }
              >
                {post.cover && (
                  <Link
                    className={
                      styles.cardVisual
                    }
                    href={`/blog/${post.slug}/`}
                    tabIndex={-1}
                    aria-hidden="true"
                  prefetch={false}
                  >
                    <img
                      src={
                        post.cover.src
                      }
                      alt=""
                      width={
                        post.cover.width
                      }
                      height={
                        post.cover.height
                      }
                      loading="lazy"
                      decoding="async"
                    />
                  </Link>
                )}

                <div
                  className={
                    styles.cardContent
                  }
                >
                  <p
                    className={
                      styles.cardKicker
                    }
                  >
                    <span
                      className={
                        styles.cardKickerLeft
                      }
                    >
                      {/**
                        * TYPE BADGE (v3.7) — primary hierarchy slot:
                        * TYPE before category/project, the quiet
                        * mono vocabulary of the content modes. Plain
                        * text: readable by assistive tech, styled by
                        * the data-type variant below.
                        */}
                      <span
                        className={styles.cardType}
                        data-type={post.type}
                      >
                        {
                          CONTENT_TYPE_LABELS[
                            post.type
                          ]
                        }
                      </span>

                      <span
                        className={
                          styles.cardCategory
                        }
                      >
                        {
                          post.category
                        }
                      </span>

                      {/*
                       * PROJECT CONNECTION LABEL (v2.7): cards whose
                       * article belongs to a project carry a visible,
                       * clickable PROJECT chip — the index now shows
                       * which writing is project-connected at a
                       * glance, and the click rides the existing
                       * deep-link project filter (no new machinery).
                       */}
                      {post.project && (
                        <button
                          type="button"
                          className={
                            styles.cardProject
                          }
                          data-active={
                            activeProject ===
                            post.project
                              ? "true"
                              : "false"
                          }
                          aria-pressed={
                            activeProject ===
                            post.project
                          }
                          onClick={() =>
                            toggleProject(
                              post.project ?? ""
                            )
                          }
                          title={`Show articles from the ${post.project} project`}
                        >
                          PROJECT ·{" "}
                          {post.project}
                        </button>
                      )}
                    </span>

                    {/*
                     * Right-hand group (v2.5.5): the inbound
                     * reference badge (when the graph knows at
                     * least one article linking here) beside the
                     * reading time. Server-rendered data riding
                     * the island's props — filtering never
                     * recomputes it.
                     */}
                    <span className={styles.cardKickerRight}>
                      {inboundRefs &&
                        inboundRefs[post.slug] > 0 && (
                          <span
                            className={styles.cardRefs}
                            title={`${inboundRefs[post.slug]} article${inboundRefs[post.slug] === 1 ? "" : "s"} reference this article`}
                          >
                            <span aria-hidden="true">↩ </span>
                            {inboundRefs[post.slug]}
                            <span className="sr-only">
                              {" "}
                              inbound references
                            </span>
                          </span>
                        )}

                      <span>
                        {
                          post.readingTime
                        }
                      </span>
                    </span>
                  </p>

                  <h2
                    className={
                      styles.cardTitle
                    }
                  >
                    <Link
                      href={`/blog/${post.slug}/`}
                    prefetch={false}
                    >
                      {
                        post.title
                      }
                    </Link>
                  </h2>

                  <p
                    className={
                      styles.cardExcerpt
                    }
                  >
                    {
                      post.excerpt
                    }
                  </p>

                  <p
                    className={
                      styles.cardMeta
                    }
                  >
                    <time
                      dateTime={
                        post.date
                      }
                    >
                      {formatBlogDateShort(
                        post.date
                      )}
                    </time>

                    {/*
                     * UPDATED CHIP (v2.5.6): articles whose
                     * frontmatter carries an `updated` date past
                     * their original publication show a quiet
                     * revision marker right beside the date — the
                     * card tells the truth about recency without
                     * re-sorting the list. ISO strings compare
                     * lexically, so "later" is a plain `>`.
                     */}
                    {post.updated &&
                      post.updated >
                        post.date && (
                        <span
                          className={
                            styles.cardUpdated
                          }
                          title={`Updated ${formatBlogDate(post.updated)}`}
                        >
                          <span
                            aria-hidden="true"
                          >
                            ↻{" "}
                          </span>
                          {formatBlogDateShort(
                            post.updated
                          )}
                        </span>
                      )}

                    <span>
                      {
                        post.author
                      }
                    </span>
                  </p>

                  {post.tags.length >
                    0 && (
                    <div
                      className={
                        styles.cardTags
                      }
                    >
                      {/*
                       * CLICK-TO-FILTER TAGS (v2.5.6): card
                       * tags stop being dead text and join the
                       * chip bar's toggle system — one click on
                       * "seo" on a card filters the index to
                       * that tag, exactly as if the chip had
                       * been pressed. Same state, same CLEAR
                       * FILTERS escape hatch, aria-pressed for
                       * assistive tech. The first three tags
                       * per card stay the visible cap.
                       */}
                      {post.tags
                        .slice(
                          0,
                          3
                        )
                        .map(
                          (
                            tag
                          ) => (
                            <button
                              key={
                                tag
                              }
                              type="button"
                              className={
                                styles.cardTag
                              }
                              data-active={
                                activeTag ===
                                tag
                                  ? "true"
                                  : "false"
                              }
                              aria-pressed={
                                activeTag ===
                                tag
                              }
                              onClick={() =>
                                toggleTag(
                                  tag
                                )
                              }
                            >
                              {tag}
                            </button>
                          )
                        )}
                    </div>
                  )}
                </div>
              </li>
            )
          )}
        </ul>
      )}

      {posts.length > 0 &&
        filteredPosts.length ===
          0 && (
        <div
          className={
            styles.empty
          }
          role="status"
          data-reveal="instant"
        >
          <span
            className={
              styles.emptyGlyph
            }
          >
            NO SIGNAL
          </span>

          <strong>
            No articles match
            this filter.
          </strong>

          <p>
            Adjust the search
            terms or clear the
            active tag to see
            the full index.
          </p>

          <button
            type="button"
            className={
              styles.emptyAction
            }
            onClick={
              clearFilters
            }
          >
            CLEAR FILTERS
          </button>
        </div>
      )}

      {posts.length === 0 && (
        <div
          className={
            styles.empty
          }
          role="status"
        >
          <span
            className={
              styles.emptyGlyph
            }
          >
            STANDBY
          </span>

          <strong>
            No articles published
            yet.
          </strong>

          <p>
            The index is live and
            waiting for the first
            transmission.
          </p>
        </div>
      )}
    </div>
  );
}
