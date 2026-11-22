import type { Settings } from '../core/types.ts'

export interface LegRecord { darts: number; busts: number; won: boolean; rating: 'mostly' | 'sometimes' | 'rarely' | null }
export interface ResultsPayload { v: 1; build: string; device: string; settings: Settings; legs: LegRecord[]; run: string; warmup: string | null }

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
  const legs = p.legs.map((l, i) => `Leg ${i + 1}: ${l.darts} darts, ${l.busts} busts, ${l.won ? 'won' : 'not finished'}, landed where aimed: ${l.rating ?? 'not rated'}`)
  return [`Tungstrike results (build ${p.build})`, `Device: ${p.device}`, ...legs, `Run code: ${p.run}`, p.warmup ? `Warm-up code: ${p.warmup}` : ''].filter(Boolean).join('\n')
}
