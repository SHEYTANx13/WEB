"use client";

import {
  useEffect,
  useState
} from "react";

import {
  loadResource
} from "@/lib/resourceStore";

import styles from "@/components/MediaPdfReader.module.css";

type PdfResourceInfo = {
  contentLength: number | null;
  acceptsRanges: boolean;
  rangeVerified: boolean;
  contentType: string | null;
};

type MediaPdfReaderProps = {
  src: string;
  title: string;
};

const RANGE_PROBE_SIZE = 1;

function formatBytes(
  bytes: number | null
) {
  if (
    bytes === null ||
    !Number.isFinite(bytes)
  ) {
    return null;
  }

  if (
    bytes <
    1024
  ) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${Math.round(
      bytes / 1024
    )} KB`;
  }

  if (
    bytes <
    1024 * 1024 * 1024
  ) {
    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  return `${(
    bytes /
    (1024 * 1024 * 1024)
  ).toFixed(2)} GB`;
}

async function inspectPdfResource(
  src: string,
  signal: AbortSignal
): Promise<PdfResourceInfo> {
  let contentLength:
    | number
    | null = null;

  let acceptsRanges =
    false;

  let rangeVerified =
    false;

  let contentType:
    | string
    | null = null;

  try {
    const headResponse =
      await fetch(
        src,
        {
          method:
            "HEAD",
          cache:
            "no-store",
          signal
        }
      );

    if (
      headResponse.ok ||
      headResponse.status ===
        206
    ) {
      const length =
        headResponse.headers.get(
          "content-length"
        );

      const ranges =
        headResponse.headers.get(
          "accept-ranges"
        );

      contentType =
        headResponse.headers.get(
          "content-type"
        );

      if (
        length
      ) {
        const parsed =
          Number(
            length
          );

        if (
          Number.isFinite(
            parsed
          ) &&
          parsed >= 0
        ) {
          contentLength =
            parsed;
        }
      }

      acceptsRanges =
        ranges?.toLowerCase() ===
        "bytes";
    }
  } catch {
    /* Best-effort metadata probe. */
  }

  try {
    const rangeResponse =
      await fetch(
        src,
        {
          method:
            "GET",
          headers: {
            Range:
              `bytes=0-${RANGE_PROBE_SIZE - 1}`
          },
          cache:
            "no-store",
          signal
        }
      );

    rangeVerified =
      rangeResponse.status ===
      206;

    if (
      rangeResponse.status ===
      206
    ) {
      acceptsRanges =
        true;

      const contentRange =
        rangeResponse.headers.get(
          "content-range"
        );

      if (
        contentRange
      ) {
        const match =
          contentRange.match(
            /\/(\d+)$/
          );

        if (
          match
        ) {
          const parsed =
            Number(
              match[1]
            );

          if (
            Number.isFinite(
              parsed
            )
          ) {
            contentLength =
              parsed;
          }
        }
      }

      if (
        !contentType
      ) {
        contentType =
          rangeResponse.headers.get(
            "content-type"
          );
      }
    }
  } catch {
    /* Range verification is best-effort. */
  }

  return {
    contentLength,
    acceptsRanges,
    rangeVerified,
    contentType
  };
}

export default function MediaPdfReader({
  src,
  title
}: MediaPdfReaderProps) {
  const [
    loaded,
    setLoaded
  ] = useState(false);

  const [
    failed,
    setFailed
  ] = useState(false);

  const [
    inspecting,
    setInspecting
  ] = useState(true);

  const [
    resourceInfo,
    setResourceInfo
  ] = useState<PdfResourceInfo | null>(
    null
  );

  /*
   * Native Chrome PDF viewer owns the iframe. Its internal cursor cannot
   * be styled from the parent document, so temporarily hide our custom
   * cursor while the PDF reader is mounted.
   */
  useEffect(() => {
    document.documentElement.classList.add(
      "pdf-reader-active"
    );

    return () => {
      document.documentElement.classList.remove(
        "pdf-reader-active"
      );
    };
  }, []);

  useEffect(() => {
    const controller =
      new AbortController();

    setLoaded(
      false
    );

    setFailed(
      false
    );

    setInspecting(
      true
    );

    setResourceInfo(
      null
    );

    /*
     * The probe is deduplicated through the shared resource store:
     * reopening the same document (or two components asking about
     * the same source) reuses one in-flight inspection instead of
     * firing duplicate HEAD + range requests. The underlying fetch
     * still honors the per-mount AbortSignal for unmount cleanup.
     *
     * Memory policy: probe metadata is SHORT-LIVED. A TTL of ten
     * minutes means a reopened document re-verifies size/range
     * support against the CDN instead of trusting a possibly stale
     * result, and the tiny record cannot accumulate across a long
     * browsing session.
     */
    void loadResource(
      `pdf-resource-probe:${src}`,
      () =>
        inspectPdfResource(
          src,
          controller.signal
        ),
      {
        lifetime: "short-lived",
        staleAfter: 10 * 60 * 1000
      }
    )
      .then(
        (
          info
        ) => {
          if (
            controller.signal
              .aborted
          ) {
            return;
          }

          setResourceInfo(
            info
          );
        }
      )
      .finally(() => {
        if (
          !controller.signal
            .aborted
        ) {
          setInspecting(
            false
          );
        }
      });

    return () => {
      controller.abort();
    };
  }, [src]);

  const fileSize =
    formatBytes(
      resourceInfo?.contentLength ??
        null
    );

  const rangeState =
    resourceInfo?.rangeVerified
      ? "RANGE ENABLED"
      : resourceInfo?.acceptsRanges
        ? "RANGE SUPPORTED"
        : "NATIVE STREAM";

  return (
    <div
      className={
        styles.reader
      }
    >
      <div
        className={
          styles.toolbar
        }
      >
        <div
          className={
            styles.identity
          }
        >
          <span
            className={
              styles.dot
            }
            aria-hidden="true"
          />

          <div
            className={
              styles.identityCopy
            }
          >
            <span
              className={
                styles.kicker
              }
            >
              PDF READER
            </span>

            <strong>
              {title}
            </strong>
          </div>
        </div>

        <div
          className={
            styles.stats
          }
        >
          {fileSize && (
            <span>
              {fileSize}
            </span>
          )}

          <span
            data-range={
              resourceInfo?.rangeVerified
                ? "verified"
                : resourceInfo?.acceptsRanges
                  ? "supported"
                  : "native"
            }
          >
            {rangeState}
          </span>

          {inspecting && (
            <span>
              CHECKING
            </span>
          )}
        </div>

        <a
          className={
            styles.open
          }
          href={src}
          target="_blank"
          rel="noopener noreferrer"
        >
          OPEN PDF ↗
        </a>
      </div>

      <div
        className={
          styles.stage
        }
      >
        {!loaded &&
          !failed && (
            <div
              className={
                styles.loading
              }
            >
              <span
                className={
                  styles.loadingDot
                }
              />

              <div
                className={
                  styles.loadingCopy
                }
              >
                <strong>
                  OPENING DOCUMENT
                </strong>

                <span>
                  Native browser PDF viewer
                </span>
              </div>
            </div>
          )}

        {failed && (
          <div
            className={
              styles.fallback
            }
            role="alert"
          >
            <span
              className={
                styles.fallbackLabel
              }
            >
              PDF PREVIEW UNAVAILABLE
            </span>

            <h3>
              Open the document directly
            </h3>

            <p>
              Your browser could not embed this PDF in the reader.
            </p>

            <a
              className={
                styles.downloadButton
              }
              href={src}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>
                OPEN PDF
              </span>

              <span
                aria-hidden="true"
              >
                ↗
              </span>
            </a>
          </div>
        )}

        <iframe
          key={src}
          className={
            loaded
              ? `${styles.frame} ${styles.frameLoaded}`
              : styles.frame
          }
          src={src}
          title={title}
          loading="eager"
          referrerPolicy="no-referrer"
          onLoad={() =>
            setLoaded(
              true
            )
          }
          onError={() =>
            setFailed(
              true
            )
          }
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
