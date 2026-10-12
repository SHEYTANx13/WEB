import RedEye from "@/components/RedEye";
import MagicConsole from "@/components/MagicConsole";
import styles from "./RedMagicScene.module.css";

const layers = [
  {
    number: "01",
    title: "CORE",
    copy:
      "A dense red heart. Its pulse sets the rhythm every other layer follows."
  },
  {
    number: "02",
    title: "MEMBRANE",
    copy:
      "A breathing boundary. It swells toward your pointer and settles when the pointer rests."
  },
  {
    number: "03",
    title: "FLOWS",
    copy:
      "Currents running between the core and the membrane, carrying energy outward."
  },
  {
    number: "04",
    title: "PARTICLES",
    copy:
      "Orbiting bodies drifting through the field, brightening as the pointer passes them."
  },
  {
    number: "05",
    title: "SIGNAL",
    copy:
      "You. Pointer movement becomes energy the organism absorbs and radiates back."
  }
];

const principles = [
  {
    number: "01",
    title: "RESPOND",
    copy: "React to the environment."
  },
  {
    number: "02",
    title: "ADAPT",
    copy: "Change behaviour with conditions."
  },
  {
    number: "03",
    title: "PERSIST",
    copy: "Remain coherent while changing."
  }
];

export default function RedMagicScene() {
  return (
    <div className={styles.redMagicScene}>
      <section className={`section ${styles.magicOrganism}`}>
        <div
          className={styles.magicOrganismField}
          aria-hidden="true"
        >
          <span
            className={`${styles.magicOrganismRing} ${styles.magicOrganismRingOne}`}
          />
          <span
            className={`${styles.magicOrganismRing} ${styles.magicOrganismRingTwo}`}
          />
          <span
            className={`${styles.magicOrganismRing} ${styles.magicOrganismRingThree}`}
          />

          <span
            className={`${styles.magicOrganismAxis} ${styles.magicOrganismAxisX}`}
          />
          <span
            className={`${styles.magicOrganismAxis} ${styles.magicOrganismAxisY}`}
          />

          <span
            className={`${styles.magicOrganismNode} ${styles.magicOrganismNodeOne}`}
          />
          <span
            className={`${styles.magicOrganismNode} ${styles.magicOrganismNodeTwo}`}
          />
          <span
            className={`${styles.magicOrganismNode} ${styles.magicOrganismNodeThree}`}
          />
          <span
            className={`${styles.magicOrganismNode} ${styles.magicOrganismNodeFour}`}
          />
        </div>

        <div className="page-container">
          <header className={styles.magicOrganismHeader}>
            <div className={styles.magicOrganismHeading}>
              {/*
               * THE RED MAGIC SIGIL (v2.9). Since the 13-point star
               * became the site's primary identity mark, the all-
               * seeing eye belongs to RED MAGIC alone — this scene is
               * its artistic home. aria-hidden: the h1 beside it
               * already names RED MAGIC, so the sigil stays decorative
               * and never duplicates the announcement.
               */}
              <span
                className={
                  styles.magicOrganismSigil
                }
                aria-hidden="true"
              >
                <RedEye size={44} />
              </span>

              <p className="kicker">
                RED MAGIC
              </p>

              <h1
                className={`section-title ${styles.magicOrganismTitle}`}
              >
                RED MAGIC
              </h1>

              <p
                className={`body-large ${styles.magicOrganismLead}`}
              >
                A living interface for exploring{" "}
                responsive systems.
              </p>
            </div>

            <div className={styles.magicOrganismStatus}>
              <span
                className="status-dot"
                aria-hidden="true"
              />

              <span>
                ALIVE
              </span>
            </div>
          </header>

          <div className={styles.magicLabIntro}>
            <div>
              <p className="kicker">
                LIVE ORGANISM
              </p>

              <h2 className="section-title">
                Run the
                <br />
                experiment
              </h2>
            </div>

            <p
              className={`body-large ${styles.magicLabIntroCopy}`}
            >
              This is the organism itself, running{" "}
              in front of you. Move through its{" "}
              field and touch it: every change you{" "}
              see is computed live, from the pulse{" "}
              of the core to the reach of the{" "}
              membrane — and with sound on, the{" "}
              same motion drives its voice.
            </p>
          </div>

          <MagicConsole />

          <section className={styles.magicOrganismPurpose}>
            <div>
              <p className="kicker">
                PURPOSE
              </p>

              <h2 className="section-title">
                Not decoration
                <br />
                An experiment
              </h2>
            </div>

            <p
              className={`body-large ${styles.magicOrganismPurposeCopy}`}
            >
              RED MAGIC explores what happens when{" "}
              a digital interface behaves less like{" "}
              a static page and more like a living system:{" "}
              responsive, adaptive, and continuously changing.
            </p>
          </section>

          <section className={styles.magicModel}>
            <div className={styles.magicModelHeader}>
              <div>
                <p className="kicker">
                  SIMULATION MODEL
                </p>

                <h2 className="section-title">
                  One organism,
                  <br />
                  five layers
                </h2>
              </div>

              <p
                className={`body ${styles.magicModelIntro}`}
              >
                Everything you saw in the console is{" "}
                produced by five simple layers working{" "}
                together. Nothing is prerecorded, and{" "}
                nothing is random noise.
              </p>
            </div>

            <div className={styles.magicModelGrid}>
              {layers.map((layer) => (
                <article
                  className={styles.magicModelLayer}
                  key={layer.number}
                >
                  <span>
                    {layer.number}
                  </span>

                  <h3>
                    {layer.title}
                  </h3>

                  <p>
                    {layer.copy}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section
            className={styles.magicOrganismPrinciples}
          >
            <div
              className={
                styles.magicOrganismPrinciplesHeader
              }
            >
              <div>
                <p className="kicker">
                  PRINCIPLES
                </p>

                <h2 className="section-title">
                  Living behaviour
                </h2>
              </div>

              <p
                className={`body ${styles.magicPrinciplesIntro}`}
              >
                The organism is designed around{" "}
                response, adaptation, and persistence.
              </p>
            </div>

            <div
              className={
                styles.magicOrganismPrinciplesGrid
              }
            >
              {principles.map((principle) => (
                <article
                  className={
                    styles.magicOrganismPrinciple
                  }
                  key={principle.number}
                >
                  <span>
                    {principle.number}
                  </span>

                  <h3>
                    {principle.title}
                  </h3>

                  <p>
                    {principle.copy}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.magicOrganismFuture}>
            <div>
              <p className="kicker">
                LONG TERM
              </p>

              <h2 className="section-title">
                Toward living
                <br />
                digital systems
              </h2>
            </div>

            <p
              className={`body-large ${styles.magicOrganismFutureCopy}`}
            >
              RED MAGIC is one small experiment inside{" "}
              a larger question: how far can software{" "}
              move from being a passive tool toward{" "}
              becoming an adaptive system with its own{" "}
              observable behaviour?
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}
