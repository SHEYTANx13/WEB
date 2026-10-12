"use client";

import { useEffect, useRef } from "react";

import {
  getPlayerStore
} from "@/lib/player/playerStore";

import { usePlayerState } from "@/lib/player/usePlayer";

import {
  formatPlayerTime,
  formatSeekValueText
} from "@/lib/player/format";

import PlayerArtwork from "@/components/player/PlayerArtwork";

import styles from "@/components/player/Player.module.css";

/*
 * EXPANDED PLAYER (v4.0.0) — portal overlay with large artwork, full
 * metadata, complete controls and the queue (current / upcoming with
 * remove + clear; history powers the previous gesture and is not a
 * browsing surface here).
 *
 * The dialog is a portal + focus-cycling shell, the same contract as
 * the Media viewer modal: focus moves in on open, Tab cycles inside,
 * Escape restores focus to the trigger.
 */
export default function ExpandedPlayer() {
  const state = usePlayerState();

  const store = getPlayerStore();

  const track = store.getTrack(state.currentTrackId);

  const shellRef = useRef<HTMLDivElement | null>(
    null
  );

  /*
   * Focus + escape management (open/close lifecycle only).
   */
  useEffect(() => {
    const shell = shellRef.current;

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    shell?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();

        store.setExpanded(false);

        return;
      }

      if (event.key !== "Tab" || !shellRef.current) {
        return;
      }

      const focusable =
        shellRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

      if (focusable.length === 0) {
        event.preventDefault();

        return;
      }

      const first = focusable[0];

      const last = focusable[focusable.length - 1];

      const active = document.activeElement;

      if (
        event.shiftKey &&
        (active === first || active === shellRef.current)
      ) {
        event.preventDefault();

        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();

        first.focus();
      } else if (
        active !== shellRef.current &&
        !shellRef.current.contains(active)
      ) {
        event.preventDefault();

        first.focus();
      }
    };

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;

      window.removeEventListener("keydown", handleKeyDown);

      previousFocus?.focus();
    };
  }, [store]);

  const isPlaying = state.status === "playing";

  const progressValue =
    state.duration > 0
      ? Math.min(state.currentTime, state.duration)
      : 0;

  return (
    <div
      className={styles.expandedBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          store.setExpanded(false);
        }
      }}
    >
      <div
        className={styles.expandedShell}
        ref={shellRef}
        role="dialog"
        aria-modal="true"
        aria-label="Expanded music player"
        tabIndex={-1}
      >
        <header className={styles.expandedHeader}>
          <span className={styles.expandedKicker}>
            NOW PLAYING
          </span>

          <button
            type="button"
            className={styles.expandedClose}
            onClick={() => store.setExpanded(false)}
            aria-label="Close expanded player"
          >
            ×
          </button>
        </header>

        <div className={styles.expandedBody}>
          <div className={styles.expandedArtwork}>
            <PlayerArtwork
              track={track}
              size={220}
              large
            />
          </div>

          <div className={styles.expandedInfo}>
            <h2 className={styles.expandedTitle}>
              {track?.title ?? "NOTHING PLAYING"}
            </h2>

            {track?.artist && (
              <p className={styles.expandedArtist}>
                {track.artist}
              </p>
            )}

            {track?.album && (
              <p className={styles.expandedAlbum}>
                {track.album}
              </p>
            )}

            <div className={styles.expandedSeek}>
              <span className={styles.timeLabel}>
                {formatPlayerTime(state.currentTime) ?? "0:00"}
              </span>

              <input
                type="range"
                className={styles.seekSlider}
                min={0}
                max={state.duration > 0 ? state.duration : 0}
                step={0.1}
                value={progressValue}
                disabled={!track || state.duration <= 0}
                aria-label="Seek"
                aria-valuetext={formatSeekValueText(
                  progressValue,
                  state.duration
                )}
                onChange={(event) =>
                  store.seek(Number(event.target.value))
                }
              />

              <span className={styles.timeLabel}>
                {formatPlayerTime(state.duration) ?? "0:00"}
              </span>
            </div>

            <div className={styles.expandedTransport}>
              <button
                type="button"
                className={styles.expandedSecondary}
                onClick={() => store.previous()}
                aria-label="Previous track"
              >
                <span aria-hidden="true">◀◀</span>
              </button>

              <button
                type="button"
                className={styles.expandedPrimary}
                onClick={() => store.togglePlay()}
                aria-label={
                  isPlaying ? "Pause" : "Play"
                }
              >
                <span aria-hidden="true">
                  {isPlaying ? "❚❚" : "▶"}
                </span>
              </button>

              <button
                type="button"
                className={styles.expandedSecondary}
                onClick={() => store.next()}
                aria-label="Next track"
              >
                <span aria-hidden="true">▶▶</span>
              </button>

              <button
                type="button"
                className={styles.expandedSecondary}
                onClick={() => store.cycleRepeat()}
                aria-label={`Repeat mode: ${state.repeat}. Change repeat mode.`}
                aria-pressed={state.repeat !== "off"}
                data-mode={state.repeat}
              >
                <span aria-hidden="true">
                  {state.repeat === "one"
                    ? "↻1"
                    : state.repeat === "all"
                      ? "↻ALL"
                      : "↻OFF"}
                </span>
              </button>

              <button
                type="button"
                className={styles.expandedSecondary}
                onClick={() => store.toggleShuffle()}
                aria-label={`Shuffle. Currently ${state.shuffle ? "on" : "off"}.`}
                aria-pressed={state.shuffle}
                data-mode={state.shuffle ? "on" : "off"}
              >
                <span aria-hidden="true">
                  {state.shuffle ? "⇄ ON" : "⇄ OFF"}
                </span>
              </button>
            </div>

            <div className={styles.expandedVolumeRow}>
              <span className={styles.volumeLabel}>
                {state.muted ? "MUTED" : "VOL"}
              </span>

              <input
                type="range"
                className={styles.volumeSlider}
                min={0}
                max={1}
                step={0.01}
                value={state.muted ? 0 : state.volume}
                aria-label="Volume"
                aria-valuetext={`${Math.round((state.muted ? 0 : state.volume) * 100)} percent`}
                onChange={(event) =>
                  store.setVolume(Number(event.target.value))
                }
              />

              <button
                type="button"
                className={styles.expandedSecondary}
                onClick={() => store.toggleMute()}
                aria-label={
                  state.muted ? "Unmute" : "Mute"
                }
                aria-pressed={state.muted}
              >
                <span aria-hidden="true">
                  {state.muted ? "UNMUTE" : "MUTE"}
                </span>
              </button>
            </div>

            {state.error && (
              <p
                className={styles.expandedError}
                role="alert"
              >
                {state.error}{" "}

                {track && (
                  <button
                    type="button"
                    className={styles.expandedRetry}
                    onClick={() => store.retry()}
                    aria-label="Retry playback of the current track"
                  >
                    RETRY
                  </button>
                )}
              </p>
            )}
          </div>
        </div>

        <section
          className={styles.queueSection}
          aria-label="Playback queue"
        >
          <header className={styles.queueHeader}>
            <h3>UP NEXT</h3>

            <span className={styles.queueCount}>
              {String(state.upcoming.length).padStart(2, "0")}
            </span>

            {state.upcoming.length > 0 && (
              <button
                type="button"
                className={styles.queueClear}
                onClick={() => store.clearUpcoming()}
              >
                CLEAR
              </button>
            )}
          </header>

          {state.upcoming.length === 0 ? (
            <p className={styles.queueEmpty}>
              The queue is empty. Play a track or add one from the
              Media collection.
            </p>
          ) : (
            <ol className={styles.queueList}>
              {state.upcoming.map((trackId, index) => {
                const queued = store.getTrack(trackId);

                if (!queued) {
                  return null;
                }

                return (
                  <li
                    className={styles.queueRow}
                    key={trackId}
                  >
                    <span
                      className={styles.queueIndex}
                      aria-hidden="true"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <button
                      type="button"
                      className={styles.queuePlay}
                      onClick={() => store.selectQueued(trackId)}
                      aria-label={`Play now: ${queued.title}${queued.artist ? ` by ${queued.artist}` : ""}`}
                    >
                      <strong>{queued.title}</strong>

                      {queued.artist && (
                        <span>{queued.artist}</span>
                      )}
                    </button>

                    <button
                      type="button"
                      className={styles.queueRemove}
                      onClick={() => store.removeFromQueue(trackId)}
                      aria-label={`Remove ${queued.title} from the queue`}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

          {state.history.length > 0 && (
            <p className={styles.queueHistoryNote}>
              {String(state.history.length).padStart(2, "0")}{" "}
              played — the previous control steps back through history.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
