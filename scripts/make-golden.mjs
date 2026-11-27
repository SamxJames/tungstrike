import { mkdirSync, writeFileSync } from 'node:fs'
import { bedCentre, makeBed } from '../src/core/board.ts'
import { applyDart, newLeg } from '../src/core/leg.ts'
import { DEFAULT_SETTINGS } from '../src/core/settings.ts'
import { replayRun } from '../src/core/replay.ts'
import { resolveThrow } from '../src/core/throw.ts'

const dir = new URL('../tests/golden/', import.meta.url)
mkdirSync(dir, { recursive: true })
const write = (name, log) => writeFileSync(new URL(name, dir), JSON.stringify({ log, expected: replayRun(log) }, null, 1))

// Golden 1 (frozen: must stay byte-identical): 60 darts at T20 and the bull.
const log = {
  v: 1,
  seed: 12345,
  settings: DEFAULT_SETTINGS,
  throws: Array.from({ length: 60 }, (_, i) => ({
    target: i % 5 === 4 ? { x: 0, y: 0 } : { x: 0, y: 1030 },
    releaseTick: 15 + ((i * 53) % 170),
  })),
}
write('replay-v1.json', log)

// Golden 2: legs. A deliberate miss first, then darts aimed (by scanning release ticks) at beds that finish the leg on
// a double, twice; every throw carries rawMs. Covers won legs, a double finish, a miss and the optional rawMs field.
function legsLog() {
  const settings = { ...DEFAULT_SETTINGS, scatterCap: 0 }
  const seed = 4242
  const throws = []
  let leg = newLeg()
  let won = 0
  const push = (target, releaseTick) => {
    const index = throws.length
    throws.push({ target, releaseTick, rawMs: releaseTick * 8 + settings.leadMs })
    leg = applyDart(leg, resolveThrow({ seed, throwIndex: index, settings, target }, releaseTick).bed)
    if (leg.won) {
      won++
      leg = newLeg()
    }
  }
  push({ x: 0, y: 1900 }, 10) // off the board: a miss
  while (won < 2 && throws.length < 400) {
    const r = leg.remaining
    const want =
      r > 100 ? makeBed('treble', 20)
      : r > 60 ? makeBed('innerSingle', 20)
      : r > 40 ? makeBed('innerSingle', r - 40)
      : r % 2 === 0 ? makeBed('double', r / 2)
      : makeBed('innerSingle', 1)
    const target = bedCentre(want)
    const index = throws.length
    let tick = 0
    for (let t = 0; t < 200; t++) {
      const b = resolveThrow({ seed, throwIndex: index, settings, target }, t).bed
      if (b.ring === want.ring && b.sector === want.sector) {
        tick = t
        break
      }
    }
    push(target, tick)
  }
  return { v: 1, seed, settings, throws }
}
write('replay-v1-legs.json', legsLog())
console.log('golden written')
