import {
  GITHUB_LINK
} from "@/lib/links";

import {
  featuredProjects,
  projectGroups,
  TOTAL_PROJECTS,
  type FeaturedProject,
  type GroupProject,
  type ProjectGroup
} from "@/components/scenes/workSceneModel";

import styles from "./WorkScene.module.css";

/*
 * WORK SCENE (v2.7 / v4.0.1) — full portfolio / research index.
 *
 * The scene presents the verified public project ecosystem in a
 * two-tier hierarchy: FEATURED SYSTEMS (the four highest-signal
 * projects, presented as rich cards with repository, notes, and
 * live destinations) followed by grouped coverage of everything
 * else that matters — AI + reasoning frameworks, the UHIT
 * measurement programme's public specifications, RED THEORY, the
 * content infrastructure, and the RED MAGIC creative line.
 *
 * DATA (v4.0.1): every card fact comes from the canonical work
 * catalogue — lib/workRegistry.ts WORK_ENTRIES — through
 * workSceneModel.ts (the presentation derivation). This file
 * contains no project table of its own; the /work/ document, the
 * article lateral graph and this scene render the same registry.
 *
 * Destination law (unchanged): a link exists ONLY where a real
 * destination exists. Featured cards carry several destinations
 * (repository / notes / live), so they are panels of individual
 * links — never a full-card anchor with nested anchors inside.
 * Single-destination cards remain full-card links (data-linked),
 * exactly like the v2.6.1 behaviour.
 */

/*
 * Shared body for featured cards (multi-link panels — the card
 * itself is never an anchor).
 */
function FeaturedBody({
  project
}: {
  project: FeaturedProject;
}) {
  return (
    <>
      <div
        className={
          styles.workProjectNumber
        }
      >
        {
          project.number
        }
      </div>

      <div
        className={
          styles.workProjectMain
        }
      >
        <div
          className={
            styles.workProjectMeta
          }
        >
          <span
            className={
              styles.workProjectCode
            }
          >
            {
              project.code
            }
          </span>

          <span
            className={
              styles.workProjectType
            }
          >
            {
              project.type
            }
          </span>
        </div>

        <h2>
          {
            project.title
          }
        </h2>

        <p
          className={
            styles.workProjectCopy
          }
        >
          {
            project.copy
          }
        </p>

        <div
          className={
            styles.workProjectTags
          }
        >
          {project.tags.map(
            (tag) => (
              <span
                key={tag}
              >
                {tag}
              </span>
            )
          )}
        </div>

        <div
          className={
            styles.workProjectLinks
          }
        >
          {project.links.map(
            (link) => (
              <a
                key={
                  link.href
                }
                className={
                  styles.workProjectLink
                }
                href={
                  link.href
                }
                target={
                  link.external
                    ? "_blank"
                    : undefined
                }
                rel={
                  link.external
                    ? "noreferrer"
                    : undefined
                }
              >
                {
                  link.label
                }

                {!link.external && (
                  <span
                    aria-hidden="true"
                  >
                    {" "}
                    →
                  </span>
                )}
              </a>
            )
          )}
        </div>
      </div>

      <div
        className={
          styles.workProjectState
        }
      >
        <span>
          {
            project.status
          }
        </span>

        <i
          aria-hidden="true"
        />
      </div>
    </>
  );
}

/*
 * Shared card body for grouped cards — identical to the v2.6.1
 * card body so linked and informational variants render the same.
 */
function ProjectBody({
  project
}: {
  project: GroupProject;
}) {
  return (
    <>
      <div
        className={
          styles.workProjectNumber
        }
      >
        {
          project.number
        }
      </div>

      <div
        className={
          styles.workProjectMain
        }
      >
        <div
          className={
            styles.workProjectMeta
          }
        >
          <span
            className={
              styles.workProjectCode
            }
          >
            {
              project.code
            }
          </span>

          <span
            className={
              styles.workProjectType
            }
          >
            {
              project.type
            }
          </span>
        </div>

        <h2>
          {
            project.title
          }
        </h2>

        <p
          className={
            styles.workProjectCopy
          }
        >
          {
            project.copy
          }
        </p>

        <div
          className={
            styles.workProjectTags
          }
        >
          {project.tags.map(
            (tag) => (
              <span
                key={tag}
              >
                {tag}
              </span>
            )
          )}
        </div>

        {project.notes && (
          <p
            className={
              styles.workProjectNotes
            }
          >
            <span
              aria-hidden="true"
            >
              ↳&nbsp;
            </span>

            {project.notes}
          </p>
        )}
      </div>

      <div
        className={
          styles.workProjectState
        }
      >
        <span>
          {
            project.status
          }
        </span>

        <i
          aria-hidden="true"
        />
      </div>
    </>
  );
}

export default function WorkScene() {
  const github =
    GITHUB_LINK;

  return (
    <div className={styles.workScene}>
      <section
        className={`section ${styles.workLaboratory}`}
      >
        <div
          className={styles.workLaboratoryField}
          aria-hidden="true"
        >
          <span
            className={styles.workGridPlane}
          />

          <span
            className={`${styles.workGridAxis} ${styles.workGridAxisX}`}
          />

          <span
            className={`${styles.workGridAxis} ${styles.workGridAxisY}`}
          />

          <span
            className={`${styles.workMarker} ${styles.workMarkerOne}`}
          />

          <span
            className={`${styles.workMarker} ${styles.workMarkerTwo}`}
          />

          <span
            className={`${styles.workMarker} ${styles.workMarkerThree}`}
          />

          <span
            className={`${styles.workMarker} ${styles.workMarkerFour}`}
          />
        </div>

        <div className="page-container">
          <div className={styles.workHeader}>
            <div className={styles.workHeaderCopy}>
              <p className="kicker">
                WORK
              </p>

              <h1
                className={`section-title ${styles.workTitle}`}
              >
                What I am building
              </h1>

              <p
                className={`body-large ${styles.workLead}`}
              >
                Research becomes projects.
              </p>
            </div>

            <div
              className={styles.workStatus}
              aria-label="Work status"
            >
              <span
                className={styles.workStatusDot}
                aria-hidden="true"
              />

              <span>
                OPEN
              </span>
            </div>
          </div>

          <div className={styles.workIntro}>
            <p
              className={styles.workIntroStatement}
            >
              I build experiments around intelligence:{" "}
              systems that can be measured, challenged,{" "}
              visualised, and improved.
            </p>
          </div>

          <div className={styles.workInstrument}>
            <div
              className={
                styles.workInstrumentHeader
              }
            >
              <div>
                <p className="kicker">
                  FEATURED SYSTEMS
                </p>

                <strong>
                  THE HIGHEST-SIGNAL WORK
                </strong>
              </div>

              <span>
                {String(
                  TOTAL_PROJECTS
                ).padStart(
                  2,
                  "0"
                )}
              </span>
            </div>

            <div
              className={
                styles.workProjectList
              }
              aria-label="Featured systems"
            >
              {featuredProjects.map(
                (project) => (
                  <article
                    className={
                      styles.workProject
                    }
                    key={
                      project.number
                    }
                    data-status={
                      project.status.toLowerCase()
                    }
                    data-featured="true"
                  >
                    <FeaturedBody
                      project={project}
                    />
                  </article>
                )
              )}
            </div>
          </div>

          {projectGroups.map(
            (group) => (
              <div
                className={
                  styles.workGroup
                }
                key={group.id}
                id={
                  group.id
                }
              >
                <div
                  className={
                    styles.workGroupHeader
                  }
                >
                  <p
                    className="kicker"
                  >
                    {
                      group.kicker
                    }
                  </p>

                  <strong>
                    {
                      group.title
                    }
                  </strong>

                  <p
                    className={
                      styles.workGroupDescription
                    }
                  >
                    {
                      group.description
                    }
                  </p>

                  <span
                    className={
                      styles.workGroupCount
                    }
                  >
                    {String(
                      group.projects.length
                    ).padStart(
                      2,
                      "0"
                    )}
                  </span>
                </div>

                <div
                  className={
                    styles.workProjectList
                  }
                >
                  {group.projects.map(
                    (project) =>
                      project.href !==
                      null ? (
                        <a
                          className={
                            styles.workProject
                          }
                          key={
                            project.number
                          }
                          data-status={
                            project.status.toLowerCase()
                          }
                          data-linked="true"
                          href={
                            project.href
                          }
                          /*
                           * External destinations (GitHub
                           * specifications, repositories) open in a
                           * new tab exactly like the featured
                           * cards' external links — same tab was a
                           * v2.7 regression for these group rows.
                           */
                          target={
                            project.href.startsWith(
                              "http"
                            )
                              ? "_blank"
                              : undefined
                          }
                          rel={
                            project.href.startsWith(
                              "http"
                            )
                              ? "noreferrer"
                              : undefined
                          }
                          aria-label={
                            project.ariaLabel
                          }
                        >
                          <ProjectBody
                            project={project}
                          />
                        </a>
                      ) : (
                        <article
                          className={
                            styles.workProject
                          }
                          key={
                            project.number
                          }
                          data-status={
                            project.status.toLowerCase()
                          }
                          data-linked="false"
                        >
                          <ProjectBody
                            project={project}
                          />
                        </article>
                      )
                  )}
                </div>
              </div>
            )
          )}

          {github && (
            <div
              className={
                styles.workLaboratoryFooter
              }
            >
              <a
                className={
                  styles.workArchiveLink
                }
                href={
                  github.href
                }
                target="_blank"
                rel="noreferrer"
              >
                <span>
                  FULL ARCHIVE
                </span>

                <strong>
                  GitHub ↗
                </strong>
              </a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
