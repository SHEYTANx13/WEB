"use client";

import {
  getPlayerStore,
  type TrackRegistryEntry
} from "@/lib/player/playerStore";

import { usePlayerState } from "@/lib/player/usePlayer";

import {
  formatPlayerTime,
  formatSeekValueText
} from "@/lib/player/format";

import PlayerArtwork from "@/components/player/PlayerArtwork";

import styles from "@/components/player/Player.module.css";

/*
 * MINI PLAYER (v4.0.0) — the persistent player surface.
 *
 * Desktop (≥861px): fixed bottom bar — artwork, track identity,
 * transport controls, seek slider, time readout, volume, mute,
 * expand.
 *
 * Mobile (≤860px): sticky compact bar — artwork, one-line identity,
 * play/pause + next; the whole bar is a button that opens the
 * expanded player (44px+ touch targets, safe-area aware).
 *
 * The store is THE state owner: this component renders it and never
 * duplicates playback state.
 */

function controlClass(kind: string) {
  const extra = styles[kind];

  /* Not every control has a dedicated class — the shared base is
   * the contract; a missing modifier must never leak "undefined"
   * into the class list. */
  return extra
    ? `${styles.controlButton} ${extra}`
    : styles.controlButton;
}

function TrackIdentity({
  track,
  compact
}: {
  track: TrackRegistryEntry | null;
  compact?: boolean;
}) {
  if (!track) {
    return (
      <div className={styles.identity}>
        <span className={styles.identityTitle}>
          NOTHING PLAYING
        </span>
      </div>
    );
  }

  return (
    <div className={styles.identity}>
      <span className={styles.identityTitle}>
        {track.title}
      </span>

      {(track.artist || track.album) && (
        <span
          className={
            compact
              ? styles.identityMeta
              : styles.identityArtist
          }
        >
          {track.artist ?? track.album}
        </span>
      )}
    </div>
  );
}

export default function MiniPlayer() {
  const state = usePlayerState();

  const store = getPlayerStore();

  const track = store.getTrack(state.currentTrackId);

  const isPlaying = state.status === "playing";

  const isLoading = state.status === "loading";

  const hasTrack = track !== null;

  const progressValue =
    state.duration > 0
      ? Math.min(state.currentTime, state.duration)
      : 0;
  return (
    <div
      className={styles.bar}
      role="region"
      aria-label="Music player"
      data-status={state.status}
    >
      {/*
        * MOBILE COMPACT BAR (≤860px) — tap anywhere (except the
        * controls) expands the player.
        */}
      <button
        type="button"
        className={styles.compactBar}
        onClick={() => store.setExpanded(true)}
        aria-haspopup="dialog"
        aria-label={
          hasTrack
            ? `Open player — ${track.title}${track.artist ? ` by ${track.artist}` : ""}`
            : "Open player"
        }
      >
        <PlayerArtwork
          track={track}
          size={44}
        />

        <TrackIdentity
          track={track}
          compact
        />

        <span className={styles.compactControls}>
          <button
            type="button"
            className={controlClass("controlPlay")}
            onClick={(event) => {
              event.stopPropagation();

              store.togglePlay();
            }}
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
            className={controlClass("controlNext")}
            onClick={(event) => {
              event.stopPropagation();

              store.next();
            }}
            aria-label="Next track"
          >
            <span aria-hidden="true">▶▶</span>
          </button>
        </span>
      </button>

      {/*
        * DESKTOP BOTTOM BAR (≥861px).
        */}
      <div className={styles.desktopBar}>
        <div className={styles.barLeft}>
          <PlayerArtwork
            track={track}
            size={44}
          />

          <TrackIdentity track={track} />
        </div>

        <div className={styles.barCenter}>
          <div className={styles.transport}>
            <button
              type="button"
              className={controlClass("controlPrevious")}
              onClick={() => store.previous()}
              aria-label="Previous track (restarts when playback is sufficiently progressed)"
              disabled={!hasTrack}
            >
              <span aria-hidden="true">◀◀</span>
            </button>

            <button
              type="button"
              className={controlClass("controlPlay")}
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
              className={controlClass("controlNext")}
              onClick={() => store.next()}
              aria-label="Next track"
              disabled={!hasTrack}
            >
              <span aria-hidden="true">▶▶</span>
            </button>
          </div>

          <div className={styles.seekRow}>
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
              disabled={!hasTrack || state.duration <= 0}
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
        </div>

        <div className={styles.barRight}>
          {state.error && (
            <span
              className={styles.barError}
              role="alert"
            >
              {state.error}
            </span>
          )}

          {state.error && hasTrack && (
            <button
              type="button"
              className={controlClass("controlRetry")}
              onClick={() => store.retry()}
              aria-label="Retry playback of the current track"
            >
              <span aria-hidden="true">RETRY</span>
            </button>
          )}

          {isLoading && (
            <span className={styles.barState}>
              LOADING
            </span>
          )}

          <button
            type="button"
            className={controlClass("controlShuffle")}
            onClick={() => store.toggleShuffle()}
            aria-label={`Shuffle. Currently ${state.shuffle ? "on" : "off"}.`}
            aria-pressed={state.shuffle}
            data-mode={state.shuffle ? "on" : "off"}
          >
            <span aria-hidden="true">⇄</span>
          </button>

          <button
            type="button"
            className={controlClass("controlMute")}
            onClick={() => store.toggleMute()}
            aria-label={
              state.muted ? "Unmute" : "Mute"
            }
            aria-pressed={state.muted}
          >
            <span aria-hidden="true">
              {state.muted ? "MUTED" : "VOL"}
            </span>
          </button>

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
            className={controlClass("controlExpand")}
            onClick={() => store.setExpanded(true)}
            aria-label="Open expanded player and queue"
            aria-haspopup="dialog"
          >
            <span aria-hidden="true">⌃</span>
          </button>
        </div>
      </div>
    </div>
  );
}
