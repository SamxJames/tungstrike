import type { Point } from '../core/types.ts'

export interface View { w: number; h: number; centre: Point; scale: number }

/** 100 percent fits the whole board (radius 1700 plus a margin for numbers) in the smaller side. */
export function makeView(w: number, h: number, centre: Point, zoomPct: number): View {
  const fit = Math.min(w, h) / (2 * 1900)
  return { w, h, centre, scale: (fit * zoomPct) / 100 }
}

export function toPx(v: View, p: Point): { px: number; py: number } {
  return { px: v.w / 2 + (p.x - v.centre.x) * v.scale, py: v.h / 2 - (p.y - v.centre.y) * v.scale }
}

/** Pixel to board point. Adding 0 turns -0 into 0, since the point can become a logged target. */
export function toBoard(v: View, px: number, py: number): Point {
  return { x: Math.round(v.centre.x + (px - v.w / 2) / v.scale) + 0, y: Math.round(v.centre.y - (py - v.h / 2) / v.scale) + 0 }
}
