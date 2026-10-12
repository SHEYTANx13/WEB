/*
 * lib/connection.ts — the ONE connection / device-capability probe
 * module (v4.0.3).
 *
 * Previously these probes lived inside lib/backgroundScheduler.ts, so
 * any module that needed to ask "may I speculate?" had to pull the
 * whole scheduler into its chunk. The unified navigation needs the
 * network check on EVERY route (to skip speculative warming under
 * save-data or constrained connections) but must not ship the task
 * queue with it.
 *
 * Extracted here: pure capability reads with zero dependencies.
 * lib/backgroundScheduler.ts re-exports them (its public API is
 * unchanged) and the navigation imports them directly.
 *
 * Every probe is defensive: the APIs are progressive enhancements
 * and their absence must mean "allowed", never "broken" — the core
 * website is never degraded by a missing probe.
 */

type ConnectionState = {
  saveData?: boolean;
  effectiveType?: string;
};

export function getConnectionState(): ConnectionState | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  const navigatorWithConnection = navigator as Navigator & {
    connection?: ConnectionState;
  };

  return navigatorWithConnection.connection ?? null;
}

/*
 * True when the connection is good enough for SPECULATIVE work.
 * Explicit user-triggered work is never gated by this.
 */
export function allowsSpeculativeNetwork(): boolean {
  const connection = getConnectionState();

  if (!connection) {
    return true;
  }

  if (connection.saveData) {
    return false;
  }

  return (
    connection.effectiveType !== "slow-2g" &&
    connection.effectiveType !== "2g"
  );
}

/*
 * Conservative memory-pressure signal. Only used to shed SPECULATIVE
 * work; the core website is never degraded by it. Returns true when
 * the device reports a constrained memory budget.
 */
export function isMemoryConstrained(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const navigatorWithMemory = navigator as Navigator & {
    deviceMemory?: number;
  };

  const deviceMemory = navigatorWithMemory.deviceMemory;

  return typeof deviceMemory === "number" && deviceMemory <= 2;
}
