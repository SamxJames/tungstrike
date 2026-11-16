import type { Settings } from './types.ts'

export const DEFAULT_SETTINGS: Settings = { wobbleRadius: 25, loopMs: 1600, shape: 100, scatterCap: 10, leadMs: 60, zoomPct: 200 }

export const SETTING_RANGES: Record<keyof Settings, readonly [number, number]> = {
  wobbleRadius: [10, 40],
  loopMs: [800, 2500],
  shape: [0, 100],
  scatterCap: [0, 20],
  leadMs: [-150, 150],
  zoomPct: [150, 350],
}

type UrlField = Exclude<keyof Settings, 'leadMs'>
const URL_KEYS: Record<UrlField, string> = { wobbleRadius: 'rad', loopMs: 'loop', shape: 'shp', scatterCap: 'sct', zoomPct: 'zm' }
const URL_ORDER: UrlField[] = ['wobbleRadius', 'loopMs', 'shape', 'scatterCap', 'zoomPct']

export function clampSettings(partial: Partial<Settings>): Settings {
  const out = { ...DEFAULT_SETTINGS }
  for (const key of Object.keys(SETTING_RANGES) as (keyof Settings)[]) {
    const v = partial[key]
    if (v === undefined || !Number.isFinite(v)) continue
    const [lo, hi] = SETTING_RANGES[key]
    out[key] = Math.min(hi, Math.max(lo, Math.round(v)))
  }
  return out
}

export function encodeSettings(s: Settings): string {
  return '#v1&' + URL_ORDER.map((f) => `${URL_KEYS[f]}=${s[f]}`).join('&')
}

export function decodeSettings(hash: string): Settings {
  const found: Partial<Settings> = {}
  for (const part of hash.replace(/^#/, '').split('&')) {
    const [k, v] = part.split('=')
    const field = URL_ORDER.find((f) => URL_KEYS[f] === k)
    if (field === undefined || v === undefined) continue
    const n = Number.parseInt(v, 10)
    if (Number.isFinite(n)) found[field] = n
  }
  return clampSettings(found)
}
