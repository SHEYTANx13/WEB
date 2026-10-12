"use client";

import dynamic from "next/dynamic";

import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { createPortal } from "react-dom";

import {
  getActionLabel,
  getCatalogLabel,
  getDownloadLabel,
  getMediaFilterForItem,
  getPreviewGlyph,
  listMedia,
  MEDIA_FILTERS,
  type MediaFilter,
  type MediaItem,
  type MusicItem
} from "@/lib/mediaRepository";

import { getPlayerStore } from "@/lib/player/playerStore";

import { usePlayerState } from "@/lib/player/usePlayer";

import { formatPlayerTime } from "@/lib/player/format";

import styles from "./MediaScene.module.css";

const MediaPdfReader =
  dynamic(
    () =>
      import(
        "@/components/MediaPdfReader"
      ),
    {
      ssr: false
    }
  );

/*
 * The active Media collection drives the player's queue: the
 * deterministic collection id is the scene filter, and the queue
 * order is the filtered list order. Filtering Media re-registers the
 * collection — the player follows, never duplicates, that state.
 *
 * This scene is a CATALOG/INTENT surface only (v4.0.2): it renders
 * catalog metadata and issues playback intents (play / play next /
 * add to queue) against the ONE global store mounted by the root
 * layout — it owns no audio element and no player state of its own,
 * and it reads the store's current state purely to REFLECT it (the
 * now-playing highlight below).
 */
function getCollectionId(filter: MediaFilter) {
  return `media:${filter}`;
}

function isMusicItem(
  item: MediaItem
): item is MusicItem {
  return item.category === "music";
}

export default function MediaScene() {
  const [
    items,
    setItems
  ] = useState<
    MediaItem[]
  >([]);

  /*
   * READ-ONLY mirror of the global player state: the only player
   * data this catalog surface keeps is the reflection needed to mark
   * the current track. All playback state stays in the one store.
   */
  const playerState = usePlayerState();

  const [
    selected,
    setSelected
  ] = useState<
    MediaItem | null
  >(null);

  const [
    filter,
    setFilter
  ] = useState<MediaFilter>(
    "all"
  );

  const [
    opened,
    setOpened
  ] = useState(false);

  /*
   * Focus target for the portal modal (see the opened effect):
   * focused on open, participates in the Tab cycle, focus returns
   * to the opening trigger on close.
   */
  const modalShellRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    error,
    setError
  ] = useState<
    string | null
  >(null);

  useEffect(() => {
    let cancelled =
      false;

    void listMedia()
      .then(
        (
          content
        ) => {
          if (
            cancelled
          ) {
            return;
          }

          setItems(
            content
          );

          setSelected(
            null
          );

          setError(
            null
          );
        }
      )
      .catch(
        (
          reason
        ) => {
          if (
            cancelled
          ) {
            return;
          }

          setError(
            reason instanceof
              Error
              ? reason.message
              : "Unable to load the media collection."
          );
        }
      )
      .finally(() => {
        if (
          !cancelled
        ) {
          setLoading(
            false
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems =
    useMemo(
      () => {
        if (
          filter ===
          "all"
        ) {
          return items;
        }

        return items.filter(
          (
            item
          ) =>
            getMediaFilterForItem(
              item
            ) === filter
        );
      },
      [
        items,
        filter
      ]
    );

  const musicCollection =
    useMemo(
      () =>
        filteredItems.filter(
          isMusicItem
        ),
      [filteredItems]
    );

  const hasMusicSource =
    useMemo(
      () =>
        items.some(isMusicItem),
      [items]
    );

  /*
   * The player store owns the ONE queue. Whatever is visible in the
   * active filter IS the collection: play now builds the queue from
   * it, and the store keeps playback alive across filter/scene
   * changes. This effect only mirrors the collection into the store —
   * never the reverse (no player state duplication here).
   */
  useEffect(() => {
    const store =
      getPlayerStore();

    store.setCollection(
      musicCollection,
      getCollectionId(filter)
    );
  }, [
    musicCollection,
    filter
  ]);

  const playTrack = (
    trackId: string
  ) => {
    const store =
      getPlayerStore();

    store.playCollectionFrom(
      trackId,
      getCollectionId(filter)
    );
  };

  const featuredItems =
    useMemo(
      () =>
        filteredItems.filter(
          (
            item
          ) =>
            item.featured
        ),
      [
        filteredItems
      ]
    );

  const regularItems =
    useMemo(
      () =>
        filteredItems.filter(
          (
            item
          ) =>
            !item.featured
        ),
      [
        filteredItems
      ]
    );

  const filterCounts =
    useMemo(
      () => {
        const counts =
          new Map<
            MediaFilter,
            number
          >();

        for (
          const item of items
        ) {
          const mediaFilter =
            getMediaFilterForItem(
              item
            );

          counts.set(
            mediaFilter,
            (
              counts.get(
                mediaFilter
              ) ?? 0
            ) + 1
          );
        }

        return counts;
      },
      [items]
    );

  const selectItem = (
    item: MediaItem
  ) => {
    setSelected(
      item
    );

    setOpened(
      false
    );
  };

  const openItem = () => {
    if (
      !selected
    ) {
      return;
    }

    if (isMusicItem(selected)) {
      /*
       * Music plays through the global player — never a modal
       * audio element. The viewer stays for PDFs, video and art. When the
       * selected track IS the current one, the intent is a
       * pause/resume gesture, not a restart.
       */
      if (selected.id === playerState.currentTrackId) {
        getPlayerStore().togglePlay();
      } else {
        playTrack(selected.id);
      }

      return;
    }

    setOpened(
      true
    );
  };

  const closeViewer =
    () => {
      setOpened(
        false
      );
    };

  useEffect(() => {
    if (
      !opened
    ) {
      document.body.style.overflow =
        "";

      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    /*
     * Focus management (v2.8): the portal dialog is a plain div
     * (not a native <dialog>), so the platform provides no focus
     * trap or restoration. On open, remember the trigger, move
     * focus into the modal shell, and cycle Tab/Shift+Tab within
     * the modal's focusable elements; on close, hand focus back to
     * the trigger so keyboard and screen-reader readers never end
     * up stranded at the document start.
     */
    const previousFocus =
      document.activeElement instanceof
      HTMLElement
        ? document.activeElement
        : null;

    const shell =
      modalShellRef.current;

    if (shell) {
      shell.focus();
    }

    const handleKeyDown =
      (
        event: KeyboardEvent
      ) => {
        if (
          event.key ===
          "Escape"
        ) {
          setOpened(
            false
          );

          return;
        }

        if (
          event.key !==
            "Tab" ||
          !modalShellRef.current
        ) {
          return;
        }

        const focusable =
          modalShellRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'
          );

        if (
          focusable.length ===
          0
        ) {
          event.preventDefault();

          return;
        }

        const first =
          focusable[0];

        const last =
          focusable[focusable.length -
            1];

        const active =
          document.activeElement;

        if (
          event.shiftKey &&
          (active ===
            first ||
            active ===
            modalShellRef.current)
        ) {
          event.preventDefault();

          last.focus();
        } else if (
          !event.shiftKey &&
          active ===
          last
        ) {
          event.preventDefault();

          first.focus();
        } else if (
          active !==
            modalShellRef.current &&
          !modalShellRef.current.contains(
            active
          )
        ) {
          /* Focus escaped (e.g. clicked outside a control) — pull it back. */
          event.preventDefault();

          first.focus();
        }
      };

    document.body.style.overflow =
      "hidden";

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );

      previousFocus?.focus();
    };
  }, [opened]);

  const viewer =
    opened &&
    selected &&
    !isMusicItem(selected) &&
    typeof document !==
      "undefined"
      ? createPortal(
          <div
            className={
              styles.mediaModal
            }
            role="dialog"
            aria-modal="true"
            aria-label={
              selected.title
            }
            onMouseDown={(
              event
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeViewer();
              }
            }}
          >
            <div
              className={
                styles.mediaModalShell
              }
              ref={modalShellRef}
              tabIndex={-1}
            >
              <header
                className={
                  styles.mediaModalHeader
                }
              >
                <div
                  className={
                    styles.mediaModalHeading
                  }
                >
                  <span
                    className={
                      styles.mediaModalType
                    }
                  >
                    {
                      getCatalogLabel(
                        selected
                      )
                    }
                  </span>

                  <h2>
                    {
                      selected.title
                    }
                  </h2>
                </div>

                <button
                  type="button"
                  className={
                    styles.mediaModalClose
                  }
                  onClick={
                    closeViewer
                  }
                  aria-label="Close viewer"
                >
                  ×
                </button>
              </header>

              <div
                className={
                  styles.mediaModalContent
                }
              >
                {selected.category ===
                  "book" && (
                  <MediaPdfReader
                    src={
                      selected.rawUrl
                    }
                    title={
                      selected.title
                    }
                  />
                )}

                {selected.category ===
                  "video" && (
                  <video
                    controls
                    autoPlay
                    preload="metadata"
                    src={
                      selected.rawUrl
                    }
                    className={
                      styles.mediaVideoPlayer
                    }
                  />
                )}

                {selected.category ===
                  "art" && (
                  <div
                    className={
                      styles.mediaModalImageWrap
                    }
                  >
                    <img
                      src={
                        selected.rawUrl
                      }
                      alt={
                        selected.title
                      }
                      className={
                        styles.mediaImage
                      }
                    />
                  </div>
                )}

                <div
                  className={
                    styles.mediaModalDownload
                  }
                >
                  <a
                    className={
                      styles.mediaDownloadButton
                    }
                    href={
                      selected.rawUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>
                      {
                        getDownloadLabel(
                          selected
                        )
                      }
                    </span>

                    <span
                      aria-hidden="true"
                    >
                      ↓
                    </span>
                  </a>

                  {/*
                    * SOURCE — provenance. Contents items link their
                    * GitHub origin (the URL computed by
                    * lib/mediaRepository); direct items link the
                    * external publisher, labeled honestly — a direct
                    * source has no GitHub provenance and never a
                    * faked one.
                    */}
                  {selected.githubUrl ? (
                    <a
                      className={
                        styles.mediaSourceButton
                      }
                      href={
                        selected.githubUrl
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span>SOURCE</span>

                      <span
                        aria-hidden="true"
                      >
                        ↗
                      </span>
                    </a>
                  ) : selected.source.kind ===
                    "direct" ? (
                    <a
                      className={
                        styles.mediaSourceButton
                      }
                      href={
                        selected.rawUrl
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span>DIRECT SOURCE</span>

                      <span
                        aria-hidden="true"
                      >
                        ↗
                      </span>
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  const selectedIsMusic =
    selected !== null &&
    isMusicItem(selected);

  return (
    <>
      <div
        className={
          styles.mediaScene
        }
      >
        <section
          className={`section ${styles.mediaSection}`}
        >
          <div
            className={
              styles.mediaAtmosphere
            }
            aria-hidden="true"
          >
            <span
              className={`${styles.mediaAtmosphereOrbit} ${styles.mediaAtmosphereOrbitOne}`}
            />

            <span
              className={`${styles.mediaAtmosphereOrbit} ${styles.mediaAtmosphereOrbitTwo}`}
            />

            <span
              className={`${styles.mediaAtmosphereAxis} ${styles.mediaAtmosphereAxisX}`}
            />

            <span
              className={`${styles.mediaAtmosphereAxis} ${styles.mediaAtmosphereAxisY}`}
            />
          </div>

          <div className="page-container">
            <header
              className={
                styles.mediaHeader
              }
            >
              <div
                className={
                  styles.mediaHeaderCopy
                }
              >
                <p className="kicker">
                  MEDIA
                </p>

                <h1
                  className={`section-title ${styles.mediaTitle}`}
                >
                  The works
                  <br />
                  Read, watch,
                  <br />
                  listen
                </h1>

                <p
                  className={`body-large ${styles.mediaHeaderLead}`}
                >
                  A living archive of{" "}
                  books, music,
                  experiments, media,
                  and other{" "}
                  original work.
                </p>
              </div>
            </header>

            <div
              className={
                styles.mediaFilters
              }
              role="group"
              aria-label="Media filters"
            >
              {MEDIA_FILTERS.map(
                (
                  mediaFilter
                ) => {
                  const count =
                    mediaFilter.id ===
                    "all"
                      ? items.length
                      : filterCounts.get(
                            mediaFilter.id
                          ) ?? 0;

                  const active =
                    filter ===
                    mediaFilter.id;

                  return (
                    <button
                      type="button"
                      /*
                       * Toggle-style filter buttons (v2.8): the old
                       * role="tab"/aria-selected markup implied a
                       * tab pattern the component never implemented
                       * (no arrow-key handling, no tabpanels). A
                       * pressed/not-pressed button group describes
                       * exactly what these controls do.
                       */
                      aria-pressed={
                        active
                      }
                      className={
                        styles.mediaFilter
                      }
                      data-active={
                        active
                          ? "true"
                          : "false"
                      }
                      key={
                        mediaFilter.id
                      }
                      onClick={() =>
                        setFilter(
                          mediaFilter.id
                        )
                      }
                    >
                      <span>
                        {
                          mediaFilter.label
                        }
                      </span>

                      <strong>
                        {String(
                          count
                        ).padStart(
                          2,
                          "0"
                        )}
                      </strong>
                    </button>
                  );
                }
              )}
            </div>

            {loading && (
              <div
                className={
                  styles.mediaLoading
                }
              >
                <span className="status-dot" />

                <span>
                  LOADING
                </span>
              </div>
            )}

            {error && (
              <div
                className={
                  styles.mediaError
                }
                role="alert"
              >
                <strong>
                  Media unavailable
                </strong>

                <p>
                  {error}
                </p>
              </div>
            )}

            {!loading &&
              !error && (
                <div
                  className={
                    styles.mediaLayout
                  }
                >
                  <section
                    className={
                      styles.mediaGallery
                    }
                    aria-label="Media collection"
                  >
                    <div
                      className={
                        styles.mediaCatalogHeader
                      }
                    >
                      <div>
                        <p className="kicker">
                          COLLECTION
                        </p>

                        <h2>
                          {filter ===
                          "all"
                            ? "Gallery"
                            : MEDIA_FILTERS.find(
                                (
                                  mediaFilter
                                ) =>
                                  mediaFilter.id ===
                                  filter
                              )?.label ??
                              "Collection"}
                        </h2>
                      </div>

                      <span>
                        {String(
                          filteredItems.length
                        ).padStart(
                          2,
                          "0"
                        )}
                      </span>
                    </div>

                    {/*
                      * MUSIC EMPTY STATE — the honest state until a
                      * Music source publishes tracks. No fabricated
                      * content, ever: this panel exists precisely so
                      * the absence of music is a first-class state.
                      */}
                    {filter ===
                      "music" &&
                      musicCollection.length ===
                        0 && (
                        <div
                          className={
                            styles.mediaMusicEmpty
                          }
                          role="status"
                        >
                          <span
                            className={
                              styles.mediaMusicEmptyGlyph
                            }
                            aria-hidden="true"
                          >
                            MUSIC
                          </span>

                          <strong>
                            NO MUSIC SOURCE
                          </strong>

                          <p>
                            No Music
                            source has{" "}
                            published
                            tracks yet.{" "}
                            When a
                            Music
                            branch{" "}
                            ships in
                            the Contents{" "}
                            repository,
                            its tracks{" "}
                            appear
                            here with{" "}
                            embedded
                            metadata,{" "}
                            covers,
                            and the{" "}
                            built-in
                            player.
                          </p>
                        </div>
                      )}

                    {featuredItems.length >
                      0 && (
                      <div
                        className={
                          styles.mediaFeaturedStrip
                        }
                      >
                        {featuredItems.map(
                          (
                            item
                          ) => {
                            const active =
                              selected?.id ===
                              item.id;

                            return (
                              <button
                                type="button"
                                className={
                                  styles.mediaFeaturedCard
                                }
                                data-active={
                                  active
                                    ? "true"
                                    : "false"
                                }
                                key={
                                  item.id
                                }
                                onClick={() =>
                                  selectItem(
                                    item
                                  )
                                }
                              >
                                <div
                                  className={
                                    styles.mediaFeaturedCardVisual
                                  }
                                >
                                  {item.coverUrl ? (
                                    <img
                                      src={
                                        item.coverUrl
                                      }
                                      alt=""
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  ) : (
                                    <span>
                                      {
                                        getPreviewGlyph(
                                          item
                                        )
                                      }
                                    </span>
                                  )}
                                </div>

                                <div
                                  className={
                                    styles.mediaFeaturedCardContent
                                  }
                                >
                                  <span>
                                    FEATURED
                                  </span>

                                  <strong>
                                    {
                                      item.title
                                    }
                                  </strong>

                                  {item.year && (
                                    <small>
                                      {
                                        item.year
                                      }
                                    </small>
                                  )}
                                </div>
                              </button>
                            );
                          }
                        )}
                      </div>
                    )}

                    <div
                      className={
                        styles.mediaList
                      }
                    >
                      {regularItems.map(
                        (
                          item
                        ) => {
                          const active =
                            selected?.id ===
                            item.id;

                          const music =
                            isMusicItem(
                              item
                            );

                          return (
                            <div
                              className={
                                styles.mediaItemRow
                              }
                              key={
                                item.id
                              }
                            >
                              <button
                                type="button"
                                className={
                                  styles.mediaItem
                                }
                                data-active={
                                  active
                                    ? "true"
                                    : "false"
                                }
                                onClick={() =>
                                  selectItem(
                                    item
                                  )
                                }
                              >
                                <span
                                  className={
                                    styles.mediaItemType
                                  }
                                >
                                  {
                                    getCatalogLabel(
                                      item
                                    )
                                  }
                                </span>

                                <span
                                  className={
                                    styles.mediaItemMain
                                  }
                                >
                                  <strong>
                                    {item.title}
                                  </strong>

                                  <small>
                                    {music &&
                                    item.id ===
                                      playerState.currentTrackId
                                      ? `${playerState.status === "playing" ? "NOW PLAYING" : "PAUSED"} · ${
                                          item.track.artist ??
                                          "ORIGINAL WORK"
                                        }`
                                      : music
                                        ? item.track
                                            .artist ??
                                          item.year ??
                                          "ORIGINAL WORK"
                                        : item.year ??
                                          "ORIGINAL WORK"}
                                  </small>
                                </span>

                                <span
                                  className={
                                    styles.mediaItemArrow
                                  }
                                  aria-hidden="true"
                                >
                                  →
                                </span>
                              </button>

                              {music && (
                                <button
                                  type="button"
                                  className={
                                    styles.mediaItemPlay
                                  }
                                  data-playing={
                                    item.id ===
                                      playerState.currentTrackId &&
                                      playerState.status ===
                                        "playing"
                                      ? "true"
                                      : "false"
                                  }
                                  onClick={() =>
                                    item.id ===
                                      playerState.currentTrackId
                                      ? getPlayerStore().togglePlay()
                                      : playTrack(
                                          item.id
                                        )
                                  }
                                  aria-label={
                                    item.id ===
                                      playerState.currentTrackId
                                      ? `${playerState.status === "playing" ? "Pause" : "Resume"} ${item.title}${item.track.artist ? ` by ${item.track.artist}` : ""}`
                                      : `Play ${item.title}${item.track.artist ? ` by ${item.track.artist}` : ""}`
                                  }
                                >
                                  <span
                                    aria-hidden="true"
                                  >
                                    {item.id ===
                                      playerState.currentTrackId &&
                                      playerState.status ===
                                        "playing"
                                      ? "❚❚"
                                      : "▶"}
                                  </span>
                                </button>
                              )}
                            </div>
                          );
                        }
                      )}

                      {filteredItems.length ===
                        0 &&
                        filter !==
                          "music" && (
                          <div
                            className={
                              styles.mediaEmpty
                            }
                          >
                            No published
                            media{" "}
                            exists in
                            this{" "}
                            category
                            yet.
                          </div>
                        )}
                    </div>
                  </section>

                  <section
                    className={
                      styles.mediaPreview
                    }
                    aria-label="Selected work preview"
                  >
                    {!selected && (
                      <div
                        className={
                          styles.mediaPreviewEmpty
                        }
                      >
                        <span
                          className={
                            styles.mediaPreviewEmptyGlyph
                          }
                        >
                          EXPLORE
                        </span>

                        <strong>
                          Discover the{" "}
                          collection
                        </strong>

                        <p>
                          Choose a work to{" "}
                          see its preview,{" "}
                          story, and{" "}
                          publication{" "}
                          details.
                        </p>
                      </div>
                    )}

                    {selected && (
                      <article
                        className={
                          styles.mediaPreviewCard
                        }
                      >
                        <div
                          className={
                            styles.mediaPreviewArt
                          }
                          data-kind={
                            selected.kind
                          }
                          data-featured={
                            selected.featured
                              ? "true"
                              : "false"
                          }
                        >
                          <div
                            className={
                              styles.mediaPreviewArtGrid
                            }
                          />

                          <div
                            className={
                              styles.mediaPreviewArtOrbit
                            }
                          />

                          {selected.coverUrl ? (
                            <img
                              src={
                                selected.coverUrl
                              }
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className={
                                styles.mediaPreviewCover
                              }
                            />
                          ) : (
                            <>
                              <span
                                className={
                                  styles.mediaPreviewArtType
                                }
                              >
                                {
                                  getPreviewGlyph(
                                    selected
                                  )
                                }
                              </span>

                              <strong>
                                {
                                  selected.title
                                }
                              </strong>

                              {selected.author && (
                                <small>
                                  {
                                    selected.author
                                  }
                                </small>
                              )}
                            </>
                          )}

                          {selected.coverUrl &&
                            selected.author && (
                              <small
                                className={
                                  styles.mediaPreviewCoverAuthor
                                }
                              >
                                {
                                  selected.author
                                }
                              </small>
                            )}

                          {selected.featured && (
                            <span
                              className={
                                styles.mediaFeaturedMark
                              }
                            >
                              FEATURED
                            </span>
                          )}
                        </div>

                        <div
                          className={
                            styles.mediaPreviewContent
                          }
                        >
                          <div
                            className={
                              styles.mediaPreviewKicker
                            }
                          >
                            {
                              getCatalogLabel(
                                selected
                              )
                            }
                          </div>

                          <h2>
                            {
                              selected.title
                            }
                          </h2>

                          {selectedIsMusic && (
                            <p
                              className={
                                styles.mediaPreviewSubtitle
                              }
                            >
                              {[
                                selected.track
                                  .artist,
                                selected.track
                                  .album,
                                selected.track
                                  .year
                              ]
                                .filter(
                                  (
                                    part
                                  ) =>
                                    typeof
                                      part ===
                                      "string"
                                )
                                .join(
                                  " · "
                                )}
                            </p>
                          )}

                          {!selectedIsMusic &&
                            selected.subtitle && (
                              <p
                                className={
                                  styles.mediaPreviewSubtitle
                                }
                              >
                                {
                                  selected.subtitle
                                }
                              </p>
                            )}

                          <p>
                            {selected.description ??
                              "An original work from my archive."}
                          </p>

                          {selectedIsMusic && (
                            <div
                              className={
                                styles.mediaTrackMeta
                              }
                            >
                              {selected.track
                                .genre && (
                                <span>
                                  {
                                    selected.track
                                      .genre
                                  }
                                </span>
                              )}

                              {typeof selected
                                .track
                                .trackNumber ===
                                "number" && (
                                <span>
                                  TRACK{" "}
                                  {String(
                                    selected
                                      .track
                                      .trackNumber
                                  ).padStart(
                                    2,
                                    "0"
                                  )}
                                  {typeof selected
                                    .track
                                    .trackTotal ===
                                    "number"
                                    ? `/${selected.track.trackTotal}`
                                    : ""}
                                </span>
                              )}

                              {selected.track
                                .duration !==
                                undefined && (
                                <span>
                                  {formatPlayerTime(
                                    selected
                                      .track
                                      .duration
                                  ) ??
                                    ""}
                                </span>
                              )}
                            </div>
                          )}

                          {selected.tags &&
                            selected.tags.length >
                              0 && (
                              <div
                                className={
                                  styles.mediaPreviewTags
                                }
                              >
                                {selected.tags.map(
                                  (
                                    tag
                                  ) => (
                                    <span
                                      key={
                                        tag
                                      }
                                    >
                                      {
                                        tag
                                      }
                                    </span>
                                  )
                                )}
                              </div>
                            )}

                          <div
                            className={
                              styles.mediaPreviewMeta
                            }
                          >
                            {selected.author && (
                              <span>
                                {
                                  selected.author
                                }
                              </span>
                            )}

                            {selected.year && (
                              <span>
                                {
                                  selected.year
                                }
                              </span>
                            )}

                            {selected.language && (
                              <span>
                                {
                                  selected.language
                                }
                              </span>
                            )}

                            {selected.category ===
                              "book" &&
                              selected.series &&
                              typeof selected.volume ===
                                "number" && (
                                <span>
                                  {
                                    selected.series
                                  }{" "}
                                  · V
                                  {String(
                                    selected.volume
                                  ).padStart(
                                    2,
                                    "0"
                                  )}
                                </span>
                              )}

                            {selected.category ===
                              "book" &&
                              selected.readingTime && (
                              <span>
                                {
                                  selected.readingTime
                                }
                              </span>
                            )}
                          </div>

                          <div
                            className={
                              styles.mediaPreviewActions
                            }
                          >
                            <button
                              type="button"
                              className={
                                styles.mediaOpenButton
                              }
                              onClick={
                                openItem
                              }
                            >
                              {selectedIsMusic
                                ? selected.id ===
                                    playerState.currentTrackId
                                  ? playerState.status ===
                                    "playing"
                                    ? "PAUSE TRACK"
                                    : "RESUME TRACK"
                                  : `${getActionLabel(selected)} TRACK`
                                : `${getActionLabel(selected)} WORK`}

                              <span
                                aria-hidden="true"
                              >
                                {selectedIsMusic &&
                                selected.id ===
                                  playerState.currentTrackId
                                  ? playerState.status ===
                                    "playing"
                                    ? "❚❚"
                                    : "▶"
                                  : "→"}
                              </span>
                            </button>

                            {selectedIsMusic && (
                              <>
                                <button
                                  type="button"
                                  className={
                                    styles.mediaQueueButton
                                  }
                                  onClick={() =>
                                    getPlayerStore().playNext(
                                      selected.id
                                    )
                                  }
                                >
                                  PLAY NEXT
                                </button>

                                <button
                                  type="button"
                                  className={
                                    styles.mediaQueueButton
                                  }
                                  onClick={() =>
                                    getPlayerStore().addToQueue(
                                      selected.id
                                    )
                                  }
                                >
                                  ADD TO QUEUE
                                </button>
                              </>
                            )}
                          </div>

                          {selectedIsMusic && (
                            <p
                              className={
                                styles.mediaTrackSourceNote
                              }
                            >
                              Metadata:{" "}
                              {selected.track
                                .source ===
                              "embedded"
                                ? "extracted from the audio file's embedded tags"
                                : "provided by the publisher manifest"}
                              .{" "}
                              Source:{" "}
                              {selected.source
                                .kind ===
                              "direct"
                                ? "direct external URL — playback streams from the publisher, never proxied through this site"
                                : "repository-backed Contents file"}
                              .
                            </p>
                          )}
                        </div>
                      </article>
                    )}
                  </section>
                </div>
              )}
          </div>
        </section>
      </div>

      {viewer}
    </>
  );
}
