import { bedAt, bedLabel } from './board.ts'
import type { Bed, Point } from './types.ts'

export interface DrillDart { crosshair: Point; landing: Point; bed: Bed }
export type Verdict = 'not-enough-darts' | 'too-loose' | 'right' | 'too-easy'
export interface DrillSummary {
  n: number
  counts: Record<string, number>
  total: number
  t20: number
  in20: number
  nearT20: number
  timingShare: number | null
  verdict: Verdict
}

const isT20 = (b: Bed) => b.ring === 'treble' && b.sector === 20

export function summariseDrill(darts: DrillDart[]): DrillSummary {
  const counts: Record<string, number> = {}
  let total = 0
  let t20 = 0
  let in20 = 0
  let nearT20 = 0
  let misses = 0
  let timingMisses = 0
  for (const d of darts) {
    const label = bedLabel(d.bed)
    counts[label] = (counts[label] ?? 0) + 1
    total += d.bed.score
    if (isT20(d.bed)) t20++
    else {
      misses++
      if (!isT20(bedAt(d.crosshair))) timingMisses++
    }
    if (d.bed.sector === 20) in20++
    if (d.bed.sector === 20 || d.bed.sector === 1 || d.bed.sector === 5) nearT20++
  }
  const n = darts.length
  let verdict: Verdict = 'not-enough-darts'
  if (n >= 8) {
    const rate = t20 / n
    verdict = rate < 0.1 ? 'too-loose' : rate > 0.4 ? 'too-easy' : 'right'
  }
  return { n, counts, total, t20, in20, nearT20, timingShare: misses === 0 ? null : timingMisses / misses, verdict }
}
