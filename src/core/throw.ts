import { TICK_MS } from './constants.ts'
import { bedAt } from './board.ts'
import { draw } from './rng.ts'
import { cos16, sin16 } from './tables/sine.ts'
import type { Point, ThrowCtx, ThrowResult } from './types.ts'

/** Draw 0 = wobble phase, draws 1-16 = eight x/y attempts for the scatter disc, draw 17 = centre weight. */
export const DRAWS_PER_THROW = 18
const UNITS_PER_TENTH_TW = 8

export function releaseTickFor(rawMs: number, leadMs: number): number {
  return Math.max(0, Math.floor((rawMs - leadMs) / TICK_MS))
}

export function crosshairAt(ctx: ThrowCtx, tick: number): Point {
  const { settings, seed, throwIndex, target } = ctx
  const startPhase = draw(seed, throwIndex, 0) % 65536
  const phase = (startPhase + Math.floor((tick * TICK_MS * 65536) / settings.loopMs)) % 65536
  const radius = settings.wobbleRadius * UNITS_PER_TENTH_TW
  const sx = sin16(phase)
  const circleY = cos16(phase)
  const eightY = sin16(2 * phase) >> 1
  const sy = Math.trunc(((100 - settings.shape) * circleY + settings.shape * eightY) / 100)
  return {
    x: target.x + Math.round((sx * radius) / 32767),
    y: target.y + Math.round((sy * radius) / 32767),
  }
}

/** A point in a disc of radius scatterCap, weighted to the centre. Always consumes the same draws. */
export function scatterFor(ctx: ThrowCtx): Point {
  const { seed, throwIndex, settings } = ctx
  let pickX = 0
  let pickY = 0
  let found = false
  for (let i = 0; i < 8; i++) {
    const dx = (draw(seed, throwIndex, 1 + 2 * i) % 65536) - 32768
    const dy = (draw(seed, throwIndex, 2 + 2 * i) % 65536) - 32768
    if (!found && dx * dx + dy * dy <= 32768 * 32768) {
      pickX = dx
      pickY = dy
      found = true
    }
  }
  const weight = draw(seed, throwIndex, 17) % 65536
  const cap = settings.scatterCap * UNITS_PER_TENTH_TW
  // `+ 0` turns -0 (a negative pick truncated to nothing) into +0, so equal scatters compare equal and survive a JSON round trip.
  return {
    x: Math.trunc((pickX * weight * cap) / (32768 * 65536)) + 0,
    y: Math.trunc((pickY * weight * cap) / (32768 * 65536)) + 0,
  }
}

export function resolveThrow(ctx: ThrowCtx, releaseTick: number): ThrowResult {
  const crosshair = crosshairAt(ctx, releaseTick)
  const scatter = scatterFor(ctx)
  const landing = { x: crosshair.x + scatter.x, y: crosshair.y + scatter.y }
  return { crosshair, scatter, landing, bed: bedAt(landing) }
}
