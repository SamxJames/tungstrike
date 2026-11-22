import type { Settings } from '../core/types.ts'

export type Rating = 'mostly' | 'sometimes' | 'rarely'

/**
 * One finished leg. The tags say which build, which (frozen) settings and which visit it belongs to, and where in
 * that visit's run log the leg began, so a rating can never be read against the wrong build, tuning or throws.
 */
export interface LegRecord {
  darts: number
  busts: number
  won: boolean
  rating: Rating | null
  build: string
  /** encodeSettings(frozen settings) plus `;lead=<ms>` (the lead is not part of the share hash). */
  settingsKey: string
  /** Random id per page load; the run log only covers one visit. */
  visit: string
  /** Index in this visit's run log where the leg began. */
  startThrow: number
}

export interface ResultsPayload { v: 1; build: string; visit: string; device: string; settings: Settings; legs: LegRecord[]; run: string; warmup: string | null }

const RATINGS: readonly string[] = ['mostly', 'sometimes', 'rarely']
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Read legs back from storage defensively: keep only objects with numeric darts and busts, and fill any missing tag. */
export function parseStoredLegs(stored: unknown): LegRecord[] {
  if (!Array.isArray(stored)) return []
  const out: LegRecord[] = []
  for (const raw of stored as unknown[]) {
    if (typeof raw !== 'object' || raw === null) continue
    const r = raw as Record<string, unknown>
    if (!isNum(r.darts) || !isNum(r.busts)) continue
    out.push({
      darts: r.darts,
      busts: r.busts,
      won: r.won === true,
      rating: typeof r.rating === 'string' && RATINGS.includes(r.rating) ? (r.rating as Rating) : null,
      build: typeof r.build === 'string' ? r.build : '',
      settingsKey: typeof r.settingsKey === 'string' ? r.settingsKey : '',
      visit: typeof r.visit === 'string' ? r.visit : '',
      startThrow: isNum(r.startThrow) ? r.startThrow : 0,
    })
  }
  return out
}

/** POST the results as JSON. Resolves false (never throws) when there is no URL, the network fails, or the reply is not OK. */
export async function sendResults(url: string | undefined, payload: ResultsPayload, fetchFn: typeof fetch = fetch): Promise<boolean> {
  if (!url) return false
  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch {
    return false
  }
}

/** The plain-text version of the results that "Copy my results" puts on the clipboard. */
export function resultsText(p: ResultsPayload): string {
  const legs = p.legs.length
    ? p.legs.map(
        (l, i) =>
          `Leg ${i + 1}: ${l.darts} darts, ${l.busts} busts, ${l.won ? 'won' : 'not finished'}, landed where aimed: ${l.rating ?? 'not rated'} (settings ${l.settingsKey}, starts at throw ${l.startThrow})`,
      )
    : ['No legs finished yet']
  return [`Tungstrike results (build ${p.build}, visit ${p.visit})`, `Device: ${p.device}`, ...legs, `Run code: ${p.run}`, p.warmup ? `Warm-up code: ${p.warmup}` : ''].filter(Boolean).join('\n')
}
