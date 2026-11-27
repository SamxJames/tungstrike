import { decodeRunCode, encodeRunCode, MAX_THROWS } from '../core/replay.ts'
import { DEFAULT_SETTINGS } from '../core/settings.ts'
import type { RunLog, Settings, ThrowInput } from '../core/types.ts'
import type { LegRecord } from './feedback.ts'
import { defaultStorage, loadJson, saveJson } from './store.ts'

export const VISITS_KEY = 'ts.visits.v1'
export const MAX_VISITS = 5

/**
 * One page load's throw logs, saved after every dart and every rating so a reload or a discarded tab does not lose
 * them. Legs (and their ratings) are saved separately under ts.legs.v1, tagged with the same visit id.
 */
export interface VisitRecord {
  visit: string
  /** Wall-clock start of the visit, passed in by the UI. */
  startedAt: number
  seed: number
  /** The frozen settings the leg was played with; null while only the warm-up has been thrown. */
  played: Settings | null
  inputs: ThrowInput[]
  warmSeed: number
  /** The settings the warm-up was thrown with (needed to replay the warm-up code). */
  warmSettings: Settings | null
  warmInputs: ThrowInput[]
  /** True once these logs went out in a Send that returned OK or a Copy that succeeded. */
  sent: boolean
}

/** An earlier, unsent visit as it goes into the results payload. */
export interface EarlierVisit { visit: string; startedAt: number; run: string; warmup: string | null; legs: LegRecord[] }

const MAX_TIME = 8.64e15
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Validate a log by round-tripping it through the run-code decoder: same checks a pasted code gets. */
function readLog(seed: unknown, settings: unknown, throws: unknown): RunLog {
  return decodeRunCode(encodeRunCode({ v: 1, seed, settings, throws } as RunLog))
}

function readVisit(raw: unknown): VisitRecord | null {
  // startedAt must be a valid Date time value, so the results text can always print it.
  if (!isObject(raw) || typeof raw.visit !== 'string' || !isNum(raw.startedAt) || Math.abs(raw.startedAt) > MAX_TIME || typeof raw.sent !== 'boolean') return null
  try {
    const playedRaw = raw.played ?? null
    const warmRaw = raw.warmSettings ?? null
    const run = readLog(raw.seed, playedRaw ?? warmRaw ?? DEFAULT_SETTINGS, raw.inputs)
    const warm = readLog(raw.warmSeed, warmRaw ?? DEFAULT_SETTINGS, raw.warmInputs)
    return {
      visit: raw.visit,
      startedAt: raw.startedAt,
      seed: run.seed,
      played: playedRaw === null ? null : run.settings,
      inputs: run.throws,
      warmSeed: warm.seed,
      warmSettings: warmRaw === null ? null : warm.settings,
      warmInputs: warm.throws,
      sent: raw.sent,
    }
  } catch {
    return null
  }
}

function readAll(storage: Storage | undefined): VisitRecord[] {
  const stored = loadJson<unknown>(VISITS_KEY, [], storage)
  if (!Array.isArray(stored)) return []
  return stored.map(readVisit).filter((v): v is VisitRecord => v !== null)
}

/** Save (or replace) one visit, keeping the last MAX_VISITS. Returns false, never throws, when storage fails. */
export function saveVisit(input: VisitRecord, storage?: Storage): boolean {
  const s = storage ?? defaultStorage()
  // The decoder rejects logs over MAX_THROWS, so never store more: a prefix of a log is itself a valid, replayable log.
  const record: VisitRecord = {
    ...input,
    inputs: input.inputs.slice(0, MAX_THROWS),
    warmInputs: input.warmInputs.slice(0, MAX_THROWS),
  }
  const all = readAll(s)
  const at = all.findIndex((v) => v.visit === record.visit)
  if (at >= 0) all[at] = record
  else all.push(record)
  return saveJson(VISITS_KEY, all.slice(-MAX_VISITS), s)
}

/** Earlier visits that were never sent and have at least one dart, oldest first. The current visit is left out. */
export function loadUnsentVisits(currentVisit: string, storage?: Storage): VisitRecord[] {
  return readAll(storage ?? defaultStorage()).filter((v) => !v.sent && v.visit !== currentVisit && (v.inputs.length > 0 || v.warmInputs.length > 0))
}

/** Mark the named visits as sent. Returns false, never throws, when storage fails. */
export function markSent(visits: string[], storage?: Storage): boolean {
  const s = storage ?? defaultStorage()
  const all = readAll(s)
  if (all.length === 0) return false
  return saveJson(VISITS_KEY, all.map((v) => (visits.includes(v.visit) ? { ...v, sent: true } : v)), s)
}

/** Build the payload entries for earlier visits: their run and warm-up codes, and their legs from the stored list. */
export function earlierEntries(visits: VisitRecord[], legs: LegRecord[]): EarlierVisit[] {
  return visits.map((v) => ({
    visit: v.visit,
    startedAt: v.startedAt,
    run: encodeRunCode({ v: 1, seed: v.seed, settings: v.played ?? v.warmSettings ?? DEFAULT_SETTINGS, throws: v.inputs }),
    warmup: v.warmInputs.length ? encodeRunCode({ v: 1, seed: v.warmSeed, settings: v.warmSettings ?? DEFAULT_SETTINGS, throws: v.warmInputs }) : null,
    legs: legs.filter((l) => l.visit === v.visit),
  }))
}
