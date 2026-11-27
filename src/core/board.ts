import { BOARD, DIR_SCALE, SECTOR_NUMBERS } from './constants.ts'
import { SECTOR_BOUNDARY, SECTOR_CENTRE } from './tables/generated.ts'
import type { Bed, Point, Ring } from './types.ts'

const MULTIPLIER: Record<Ring, number> = { bull: 2, outerBull: 1, innerSingle: 1, treble: 3, outerSingle: 1, double: 2, miss: 0 }

export function makeBed(ring: Ring, sector: number): Bed {
  if (ring === 'miss') return { ring, sector: 0, score: 0, isDouble: false }
  if (ring === 'bull') return { ring, sector: 0, score: 50, isDouble: true }
  if (ring === 'outerBull') return { ring, sector: 0, score: 25, isDouble: false }
  return { ring, sector, score: MULTIPLIER[ring] * sector, isDouble: ring === 'double' }
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx
}

/** Index 0..19 of the wedge containing p (clockwise from straight up). Integer cross-products only. */
function sectorIndex(p: Point): number {
  for (let k = 0; k < 20; k++) {
    const [ax, ay] = SECTOR_BOUNDARY[k]
    const [bx, by] = SECTOR_BOUNDARY[(k + 1) % 20]
    if (cross(ax, ay, p.x, p.y) <= 0 && cross(bx, by, p.x, p.y) > 0) return k
  }
  return 0
}

export function bedAt(p: Point): Bed {
  const r2 = p.x * p.x + p.y * p.y
  if (r2 > BOARD.doubleOuter * BOARD.doubleOuter) return makeBed('miss', 0)
  if (r2 <= BOARD.bullInner * BOARD.bullInner) return makeBed('bull', 0)
  if (r2 <= BOARD.bullOuter * BOARD.bullOuter) return makeBed('outerBull', 0)
  const sector = SECTOR_NUMBERS[sectorIndex(p)]
  if (r2 <= BOARD.trebleInner * BOARD.trebleInner) return makeBed('innerSingle', sector)
  if (r2 <= BOARD.trebleOuter * BOARD.trebleOuter) return makeBed('treble', sector)
  if (r2 <= BOARD.doubleInner * BOARD.doubleInner) return makeBed('outerSingle', sector)
  return makeBed('double', sector)
}

const MID_RADIUS: Partial<Record<Ring, number>> = {
  innerSingle: Math.round((BOARD.bullOuter + BOARD.trebleInner) / 2),
  treble: Math.round((BOARD.trebleInner + BOARD.trebleOuter) / 2),
  outerSingle: Math.round((BOARD.trebleOuter + BOARD.doubleInner) / 2),
  double: Math.round((BOARD.doubleInner + BOARD.doubleOuter) / 2),
}

export function bedCentre(bed: Bed): Point {
  const radius = MID_RADIUS[bed.ring]
  if (radius === undefined) return { x: 0, y: 0 }
  const [dx, dy] = SECTOR_CENTRE[SECTOR_NUMBERS.indexOf(bed.sector)]
  return { x: Math.round((dx * radius) / DIR_SCALE), y: Math.round((dy * radius) / DIR_SCALE) }
}

export function targetFromTap(p: Point): Point | null {
  const bed = bedAt(p)
  return bed.ring === 'miss' ? null : bedCentre(bed)
}

export function bedLabel(bed: Bed): string {
  switch (bed.ring) {
    case 'miss': return 'Miss'
    case 'bull': return 'Bull'
    case 'outerBull': return '25'
    case 'treble': return `T${bed.sector}`
    case 'double': return `D${bed.sector}`
    default: return `S${bed.sector}`
  }
}
