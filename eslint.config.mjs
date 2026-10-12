import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,

  /*
   * eslint-config-next sets settings.react.version to "detect",
   * which routes eslint-plugin-react into detectReactVersion().
   * The plugin version bundled with eslint-config-next@16.3.3 calls
   * context.getFilename() — an API removed in ESLint 10 — so lint
   * crashed on the first TSX file. Pinning the React version skips
   * detection entirely. Update this value when React is upgraded.
   */
  {
    settings: {
      react: {
        version: "19.2.8"
      }
    }
  },

  /*
   * react-hooks/set-state-in-effect (v6) flags synchronous setState
   * inside effects. Three audited patterns intentionally keep it:
   * - LivingShell: reads location.hash on mount (hydration-safe
   *   initialization — cannot be a lazy initializer without a
   *   server/client mismatch)
   * - MagicConsole: reads the localStorage sound preference on
   *   mount (same hydration constraint)
   * - MediaPdfReader: resets load state when `src` changes
   * The rule stays active as a warning so genuine cascading-render
   * regressions remain visible.
   */
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "node_modules/**",
    "next-env.d.ts",
    /* Ambient declaration files for the .mjs tooling modules —
     * type-only, never executed, and not parseable as scripts. */
    "**/*.d.mts"
  ])
]);
