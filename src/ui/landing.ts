export const GHOST_MS = 300
export const FLY_MS = 150

/**
 * True when a released dart should be reported to the game exactly once:
 * the flight has finished, or the session has already moved on to aiming
 * (so a missed frame window can never drop a throw).
 */
export function shouldReport(
  landed: { releasedAt: number; reported: boolean } | null,
  nowMs: number,
  phase: 'aiming' | 'cooldown',
): boolean {
  if (landed === null || landed.reported) return false
  return nowMs - landed.releasedAt >= GHOST_MS + FLY_MS || phase === 'aiming'
}

/**
 * Hand a landed dart to the game. An exception in the game's handler is logged, never rethrown, so it cannot stop
 * the frame loop (and freeze the board). Returns false when the handler threw.
 */
export function reportSafely<E>(onThrow: (e: E) => void, event: E, log: (...args: unknown[]) => void = console.error): boolean {
  try {
    onThrow(event)
    return true
  } catch (err) {
    log('Tungstrike: onThrow failed', err)
    return false
  }
}

/** 0 during the ghost, then 0..1 over the flight, clamped to 1. */
export function flightProgress(dtMs: number): number {
  if (dtMs < GHOST_MS) return 0
  return Math.min(1, (dtMs - GHOST_MS) / FLY_MS)
}
