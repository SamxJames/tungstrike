const LEAD_KEY = 'ts.lead.v1'

function defaultStorage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export function loadJson<T>(key: string, fallback: T, storage: Storage | undefined = defaultStorage()): T {
  try {
    const raw = storage?.getItem(key)
    return raw == null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function saveJson(key: string, value: unknown, storage: Storage | undefined = defaultStorage()): boolean {
  try {
    if (!storage) return false
    storage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function loadLead(storage?: Storage): number | null {
  const v = loadJson<number | null>(LEAD_KEY, null, storage ?? defaultStorage())
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function saveLead(ms: number, storage?: Storage): void {
  saveJson(LEAD_KEY, ms, storage ?? defaultStorage())
}
