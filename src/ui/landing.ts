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

/** 0 during the ghost, then 0..1 over the flight, clamped to 1. */
export function flightProgress(dtMs: number): number {
  if (dtMs < GHOST_MS) return 0
  return Math.min(1, (dtMs - GHOST_MS) / FLY_MS)
}
