import { encodeRunCode } from '../core/replay.ts'
import type { RunLog, Settings } from '../core/types.ts'
import { earlierEntries } from './visits.ts'
import type { EarlierVisit, VisitRecord } from './visits.ts'

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

export interface ResultsPayload {
  v: 1
  build: string
  visit: string
  device: string
  settings: Settings
  /** This visit's legs only. */
  legs: LegRecord[]
  run: string
  warmup: string | null
  /** Earlier visits on this phone that were never sent (each with its own logs and legs), oldest first. */
  earlier: EarlierVisit[]
  /** Present (true) when a dart was reported out of order, so the run code may not replay this visit faithfully. */
  logGap?: true
}

export interface PayloadInput {
  build: string
  visit: string
  device: string
  /** The frozen settings this visit's leg is played with. */
  settings: Settings
  /** Every stored leg (any visit): this visit's go in `legs`, earlier visits' go with their entry. */
  legs: LegRecord[]
  run: RunLog
  warm: RunLog | null
  earlier: VisitRecord[]
  logGap: boolean
}

/** Assemble what Send posts and Copy turns into text: this visit plus every unsent earlier visit. */
export function buildPayload(i: PayloadInput): ResultsPayload {
  const p: ResultsPayload = {
    v: 1,
    build: i.build,
    visit: i.visit,
    device: i.device,
    settings: i.settings,
    legs: i.legs.filter((l) => l.visit === i.visit),
    run: encodeRunCode(i.run),
    warmup: i.warm ? encodeRunCode(i.warm) : null,
    earlier: earlierEntries(i.earlier, i.legs),
  }
  if (i.logGap) p.logGap = true
  return p
}

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

/** Printed at the start of a visit's block when a dart was reported out of order (the analyse script looks for this prefix). */
export const LOG_GAP_LINE = 'Log gap detected: the throw log has a gap, so this run code may not replay every dart.'

/** The plain-text version of the results that "Copy my results" puts on the clipboard. */
export function resultsText(p: ResultsPayload): string {
  // Each visit is a block: its legs, then its run code, then its warm-up code (the analyse script relies on this order).
  const block = (legs: LegRecord[], run: string, warmup: string | null, logGap?: true) => [
    logGap ? LOG_GAP_LINE : '',
    ...(legs.length
      ? legs.map(
          (l, i) =>
            `Leg ${i + 1}: ${l.darts} darts, ${l.busts} busts, ${l.won ? 'won' : 'not finished'}, landed where aimed: ${l.rating ?? 'not rated'} (settings ${l.settingsKey}, starts at throw ${l.startThrow})`,
        )
      : ['No legs finished yet']),
    `Run code: ${run}`,
    warmup ? `Warm-up code: ${warmup}` : '',
  ]
  return [
    `Tungstrike results (build ${p.build}, visit ${p.visit})`,
    `Device: ${p.device}`,
    ...block(p.legs, p.run, p.warmup, p.logGap),
    ...p.earlier.flatMap((e) => [`Earlier visit ${e.visit} (started ${new Date(e.startedAt).toISOString()}, not sent before)`, ...block(e.legs, e.run, e.warmup, e.logGap)]),
  ]
    .filter(Boolean)
    .join('\n')
}
