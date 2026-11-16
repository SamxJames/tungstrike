import { mkdirSync, writeFileSync } from 'node:fs'
import { DEFAULT_SETTINGS } from '../src/core/settings.ts'
import { replayRun } from '../src/core/replay.ts'

const log = {
  v: 1,
  seed: 12345,
  settings: DEFAULT_SETTINGS,
  throws: Array.from({ length: 60 }, (_, i) => ({
    target: i % 5 === 4 ? { x: 0, y: 0 } : { x: 0, y: 1030 },
    releaseTick: 15 + ((i * 53) % 170),
  })),
}
mkdirSync(new URL('../tests/golden/', import.meta.url), { recursive: true })
writeFileSync(new URL('../tests/golden/replay-v1.json', import.meta.url), JSON.stringify({ log, expected: replayRun(log) }, null, 1))
console.log('golden written')
