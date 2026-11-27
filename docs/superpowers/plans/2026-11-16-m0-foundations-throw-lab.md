# M0 Foundations, Throw Lab and Playable Leg: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic darts core, a sticky-target wobble-and-tap throw, a Throw Lab at `/lab`, and a playable solo 501 leg at `/` so five testers can judge throw feel (Gate 1, 2026-12-06).

**Architecture:** `src/core/` is pure TypeScript (integer maths, no clock, no trig, hash-based randomness) and takes `{target, releaseTick}` as input. `src/render/` draws a Canvas 2D board from core state. `src/ui/` is Preact, with one shared `ThrowStage` component used by both the Lab and the leg screen. Tester feedback goes out through a free form service, with no backend.

**Tech Stack:** TypeScript, Vite (two HTML entries), Preact, Vitest, Playwright (chromium + webkit, mobile viewport), ESLint, Node 22 (native type stripping for scripts), Vercel previews.

**Spec:** `docs/superpowers/specs/2026-11-16-m0-foundations-throw-lab.md` (approved 2026-11-16, Gate 1 wording A). Decisions log: `docs/decisions.md`.

## Global Constraints

Every task includes these. Copied from the spec and `CLAUDE.md`.

- **Branch:** work on a branch in a worktree (`feat/m0-foundations`). Never push to `main`. PRs only. Commit messages end with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **Core purity:** `src/core/` has no DOM, no clock, no network. **Banned in `src/core/`:** `Math.random`, `Date.now`, `performance.now`, `new Date(`, `Math.sin`, `Math.cos`, `Math.atan2`, `Math.tan`. Integer maths and committed tables only.
- **Library docs:** before using any Vite, Vitest, Playwright, ESLint or Preact option, check the installed version's docs. Do not trust memory. If an option below is rejected by the installed version, use the documented equivalent and keep the behaviour.
- **Imports:** every relative import uses an explicit `.ts` / `.tsx` extension, and type-only imports use `import type` (so Node can run core files directly through type stripping). No enums, no constructor parameter properties, no namespaces.
- **Tick:** 8ms (`TICK_MS = 8`, 125 ticks per second). `releaseTick = floor((rawMs − leadMs) / 8)`, never below 0.
- **Units:** 1 board unit = 0.1mm. 1 treble width = 80 units. Sliders show treble widths.
- **Settings ranges (defaults):** wobble radius 10-40 in tenths of a treble width (25); loop 800-2500 ms (1600); shape 0-100, 0 = circle, 100 = figure-8 (100); scatter cap 0-20 in tenths of a treble width (10); release lead −150 to +150 ms (60); zoom 150-350 percent (200).
- **Scatter:** a hard cap, weighted to the centre (median about 0.29 of the cap, never above 0.35). Every throw consumes exactly 18 draws.
- **Run log v1:** `{v:1, seed, settings, throws:[{target, releaseTick, rawMs?}]}`. The format is versioned from the first tester build. Do not change it without bumping `v`.
- **Mobile first:** design at 390x844 portrait. Release on `pointerdown`. Board taps never release a dart. Re-aim lockout 200ms. After a throw, the pad is inert 600ms (long enough for the dart to land).
- **Never:** real player names or likenesses, PDC/WDF/Sky/Premier League/Ally Pally marks, gambling mechanics or styling, dark patterns, reading or committing `.env*` files. `.env.example` lists names only.
- **Done means:** `npm run check` passes, and mobile screenshots are attached to the PR.

## File map

```
package.json  tsconfig.json  vite.config.ts  eslint.config.js  playwright.config.ts  vercel.json  .env.example
index.html (leg)   lab.html (lab)
scripts/gen-tables.mjs  guard.mjs  guard.test.ts  make-golden.mjs  analyse-runs.mjs
src/env.d.ts
src/core/constants.ts types.ts settings.ts rng.ts board.ts throw.ts leg.ts replay.ts drill.ts lead.ts analysis.ts
src/core/tables/checksum.ts generated.ts sine.ts      (+ a .test.ts beside each module)
src/render/view.ts board.ts overlay.ts                (+ view.test.ts)
src/ui/session.ts store.ts feedback.ts styles.css ThrowStage.tsx Slider.tsx Calibrate.tsx DrillReport.tsx Lab.tsx Leg.tsx main-lab.tsx main-leg.tsx
tests/golden/replay-v1.json   tests/e2e/golden.spec.ts smoke-lab.spec.ts smoke-leg.spec.ts
```

## Task order and parallelism

1. Serial: Task 1 (scaffold), then Task 2 (contract: types, constants, settings).
2. Parallel batch 1, different files: **A** core chain (Tasks 3 → 4 → 5 → 6 → 7 → 8 → 9; 3 and 4 can run side by side), **B** render (Task 11), **C** guard and Playwright plumbing (Tasks 10 and 14), **D** aim session (Task 12, needs Task 6's `releaseTickFor`: stub it by finishing Task 6 first, or run Task 12 after Task 6).
3. Task 13 (`ThrowStage`) after Tasks 6, 11 and 12.
4. Parallel batch 2: Task 15 (Lab), Task 16 (leg screen), Task 17 (analysis script).
5. Task 18: code review, mobile playtester, `npm run check`, PR.

---

### Task 1: Scaffold (Vite, TypeScript, Preact, Vitest, ESLint, CI-ready `check`)

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `vercel.json`, `.env.example`, `index.html`, `lab.html`, `src/env.d.ts`, `src/ui/main-leg.tsx`, `src/ui/main-lab.tsx`, `scripts/guard.mjs` (stub), `src/smoke.test.ts`

**Interfaces:**
- Produces: the npm scripts `dev`, `build`, `preview`, `guard`, `lint`, `typecheck`, `test`, `check`, `e2e`, `gen:tables`; a global `__BUILD_ID__: string`; the dev route `/lab` → `lab.html`.

- [ ] **Step 1: Create the worktree and install**

```bash
git worktree add .claude/worktrees/m0 -b feat/m0-foundations main
cd .claude/worktrees/m0
npm init -y
npm install preact
npm install -D vite typescript vitest @playwright/test eslint @eslint/js typescript-eslint globals
```

Check the installed versions' docs for anything below that they reject.

- [ ] **Step 2: Write `package.json` fields** (merge into the generated file, keep installed versions)

```json
{
  "name": "tungstrike",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.18" },
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "guard": "node scripts/guard.mjs",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "check": "npm run guard && npm run lint && npm run typecheck && npm test",
    "e2e": "playwright test",
    "gen:tables": "node scripts/gen-tables.mjs"
  }
}
```

- [ ] **Step 3: Write config files**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src", "tests", "vite.config.ts", "playwright.config.ts"]
}
```
If the installed TypeScript rejects `erasableSyntaxOnly`, remove it and keep to the "no enums / parameter properties" rule by hand.

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const buildId = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7)

export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        lab: fileURLToPath(new URL('./lab.html', import.meta.url)),
      },
    },
  },
  plugins: [
    {
      name: 'lab-route',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/lab' || req.url?.startsWith('/lab?')) req.url = req.url.replace('/lab', '/lab.html')
          next()
        })
      },
    },
  ],
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'], environment: 'node' },
})
```

`eslint.config.js`:
```js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'test-results', 'playwright-report', 'coverage', '.claude', 'src/core/tables/generated.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts'], languageOptions: { globals: globals.browser } },
  { files: ['scripts/**/*.{mjs,ts}', '*.config.{js,ts}'], languageOptions: { globals: globals.node } },
  {
    files: ['src/core/**/*.ts'],
    rules: { 'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'localStorage', 'performance', 'fetch'] },
  },
)
```

`vercel.json`: `{ "cleanUrls": true }`

`.env.example`:
```
# Names only. Values live in Vercel settings.
VITE_FEEDBACK_URL=
```

`src/env.d.ts`: `declare const __BUILD_ID__: string`

`index.html` (the leg screen; `lab.html` is identical except the script and title):
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0b0d10" />
    <title>Tungstrike</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/ui/main-leg.tsx"></script>
  </body>
</html>
```
`lab.html` uses `<title>Tungstrike Lab</title>` and `src="/src/ui/main-lab.tsx"`.

`src/ui/main-leg.tsx`:
```tsx
import { render } from 'preact'
render(<p>Tungstrike</p>, document.getElementById('app')!)
```
`src/ui/main-lab.tsx` is the same with `<p>Tungstrike Lab</p>`.

`scripts/guard.mjs` (stub, replaced in Task 10): `console.log('guard: no rules yet')`

- [ ] **Step 4: Write a trivial test and prove the pipeline**

`src/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
describe('pipeline', () => { it('runs tests', () => { expect(1 + 1).toBe(2) }) })
```

Run: `npm run check && npm run build`
Expected: all pass, and `dist/index.html` and `dist/lab.html` exist.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite, Preact, Vitest, ESLint, two entries"
```
(`package-lock.json` must be committed: CI runs `npm ci`.)

---

### Task 2: Contract: constants, types and settings

**Files:**
- Create: `src/core/constants.ts`, `src/core/types.ts`, `src/core/settings.ts`
- Test: `src/core/settings.test.ts`
- Delete: `src/smoke.test.ts`

**Interfaces:**
- Produces (used by every later task):
```ts
// constants.ts
export const TICK_MS = 8
export const UNITS_PER_TREBLE_WIDTH = 80
export const DIR_SCALE = 65536
export const BOARD: { bullInner: 64; bullOuter: 159; trebleInner: 990; trebleOuter: 1070; doubleInner: 1620; doubleOuter: 1700 }
export const SECTOR_NUMBERS: readonly number[]   // clockwise from top: 20,1,18,...
export const START_SCORE = 501
export const DEFAULT_PAR = 33
export const DARTS_PER_TURN = 3
// types.ts
export interface Point { x: number; y: number }            // integers, x right, y up, origin = bull centre
export type Ring = 'bull' | 'outerBull' | 'innerSingle' | 'treble' | 'outerSingle' | 'double' | 'miss'
export interface Bed { ring: Ring; sector: number; score: number; isDouble: boolean }   // sector 1-20, 0 for bulls and miss
export interface Settings { wobbleRadius: number; loopMs: number; shape: number; scatterCap: number; leadMs: number; zoomPct: number }
export interface ThrowInput { target: Point; releaseTick: number; rawMs?: number }
export interface ThrowCtx { seed: number; throwIndex: number; settings: Settings; target: Point }
export interface ThrowResult { crosshair: Point; scatter: Point; landing: Point; bed: Bed }
export interface RunLog { v: 1; seed: number; settings: Settings; throws: ThrowInput[] }
// settings.ts
export const DEFAULT_SETTINGS: Settings
export const SETTING_RANGES: Record<keyof Settings, readonly [number, number]>
export function clampSettings(partial: Partial<Settings>): Settings
export function encodeSettings(s: Settings): string          // '#v1&rad=25&loop=1600&shp=100&sct=10&zm=200' (no lead)
export function decodeSettings(hash: string): Settings
```

- [ ] **Step 1: Write the failing test** (`src/core/settings.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS, clampSettings, decodeSettings, encodeSettings } from './settings.ts'

describe('settings', () => {
  it('encodes the defaults as a versioned integer hash without release lead', () => {
    expect(encodeSettings(DEFAULT_SETTINGS)).toBe('#v1&rad=25&loop=1600&shp=100&sct=10&zm=200')
  })
  it('round-trips everything except lead', () => {
    const s = { ...DEFAULT_SETTINGS, wobbleRadius: 31, loopMs: 1250, shape: 40, scatterCap: 14, zoomPct: 260 }
    expect(decodeSettings(encodeSettings(s))).toEqual({ ...s, leadMs: DEFAULT_SETTINGS.leadMs })
  })
  it('clamps out-of-range values and ignores junk and unknown keys', () => {
    const s = decodeSettings('#v1&rad=999&loop=1&shp=abc&zz=5&sct=-4')
    expect(s.wobbleRadius).toBe(40)
    expect(s.loopMs).toBe(800)
    expect(s.shape).toBe(100)
    expect(s.scatterCap).toBe(0)
  })
  it('returns defaults for an empty hash', () => {
    expect(decodeSettings('')).toEqual(DEFAULT_SETTINGS)
  })
  it('clampSettings rounds and handles NaN', () => {
    expect(clampSettings({ wobbleRadius: 24.6, leadMs: Number.NaN }).wobbleRadius).toBe(25)
    expect(clampSettings({ leadMs: Number.NaN }).leadMs).toBe(60)
  })
})
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `npx vitest run src/core/settings.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Write `constants.ts`, `types.ts`, `settings.ts`**

`src/core/constants.ts`:
```ts
export const TICK_MS = 8
export const UNITS_PER_TREBLE_WIDTH = 80
export const DIR_SCALE = 65536
export const BOARD = {
  bullInner: 64,
  bullOuter: 159,
  trebleInner: 990,
  trebleOuter: 1070,
  doubleInner: 1620,
  doubleOuter: 1700,
} as const
export const SECTOR_NUMBERS: readonly number[] = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]
export const START_SCORE = 501
export const DEFAULT_PAR = 33
export const DARTS_PER_TURN = 3
```

`src/core/types.ts`: the interfaces exactly as listed under Interfaces (use `export interface` / `export type`).

`src/core/settings.ts`:
```ts
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
```

- [ ] **Step 4: Run, expect PASS; delete the smoke test**

Run: `git rm src/smoke.test.ts && npx vitest run && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): types, constants and URL-encoded settings"
```

---

### Task 3: Generated tables (sine, sector directions) and `sin16`

**Files:**
- Create: `scripts/gen-tables.mjs`, `src/core/tables/checksum.ts`, `src/core/tables/generated.ts` (generated), `src/core/tables/sine.ts`
- Test: `src/core/tables/tables.test.ts`

**Interfaces:**
- Consumes: `DIR_SCALE` from `constants.ts`.
- Produces:
```ts
// generated.ts
export const SINE: readonly number[]                               // 1024 ints, amplitude 32767, index i = angle 2πi/1024
export const SECTOR_BOUNDARY: readonly (readonly [number, number])[]  // 20 unit vectors × 65536 at angles −9°+18k clockwise from top, as [x, y]
export const SECTOR_CENTRE: readonly (readonly [number, number])[]    // 20 unit vectors × 65536 at angles 18k clockwise from top
// checksum.ts
export function fnv1a(text: string): number
// sine.ts
export function sin16(phase: number): number    // phase 0..65535 is one full turn; any int is masked to 16 bits
export function cos16(phase: number): number
```

- [ ] **Step 1: Write the checksum helper and generator**

`src/core/tables/checksum.ts`:
```ts
export function fnv1a(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
```

`scripts/gen-tables.mjs` (this script may use `Math.sin`: it is not core, and its output is committed):
```js
import { writeFileSync } from 'node:fs'
import { fnv1a } from '../src/core/tables/checksum.ts'
import { DIR_SCALE } from '../src/core/constants.ts'

const sine = Array.from({ length: 1024 }, (_, i) => Math.round(Math.sin((2 * Math.PI * i) / 1024) * 32767))
const dir = (deg) => {
  const r = (deg * Math.PI) / 180
  return [Math.round(Math.sin(r) * DIR_SCALE), Math.round(Math.cos(r) * DIR_SCALE)]
}
const boundary = Array.from({ length: 20 }, (_, k) => dir(-9 + 18 * k))
const centre = Array.from({ length: 20 }, (_, k) => dir(18 * k))

const src = `// Generated by scripts/gen-tables.mjs. Do not edit. Run: npm run gen:tables
export const SINE: readonly number[] = ${JSON.stringify(sine)}
export const SECTOR_BOUNDARY: readonly (readonly [number, number])[] = ${JSON.stringify(boundary)}
export const SECTOR_CENTRE: readonly (readonly [number, number])[] = ${JSON.stringify(centre)}
`
writeFileSync(new URL('../src/core/tables/generated.ts', import.meta.url), src)
console.log('tables checksum:', fnv1a(JSON.stringify([sine, boundary, centre])))
```

`src/core/tables/sine.ts`:
```ts
import { SINE } from './generated.ts'

export function sin16(phase: number): number {
  return SINE[(phase & 0xffff) >> 6]
}
export function cos16(phase: number): number {
  return sin16(phase + 16384)
}
```

- [ ] **Step 2: Generate and note the checksum**

Run: `npm run gen:tables`
Expected: prints `tables checksum: <number>`. Use that number as `EXPECTED_CHECKSUM` below.

- [ ] **Step 3: Write the test** (`src/core/tables/tables.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { SINE, SECTOR_BOUNDARY, SECTOR_CENTRE } from './generated.ts'
import { fnv1a } from './checksum.ts'
import { sin16, cos16 } from './sine.ts'

const EXPECTED_CHECKSUM = 0 // replace with the number printed by `npm run gen:tables`

describe('generated tables', () => {
  it('match the committed checksum (regenerate deliberately, never by accident)', () => {
    expect(fnv1a(JSON.stringify([SINE, SECTOR_BOUNDARY, SECTOR_CENTRE]))).toBe(EXPECTED_CHECKSUM)
  })
  it('have the right sizes', () => {
    expect(SINE).toHaveLength(1024)
    expect(SECTOR_BOUNDARY).toHaveLength(20)
    expect(SECTOR_CENTRE).toHaveLength(20)
  })
  it('sin16 hits the quarter points and wraps', () => {
    expect(sin16(0)).toBe(0)
    expect(sin16(16384)).toBe(32767)
    expect(sin16(32768)).toBe(0)
    expect(sin16(49152)).toBe(-32767)
    expect(sin16(65536)).toBe(0)
    expect(cos16(0)).toBe(32767)
  })
  it('sector 20 is centred straight up', () => {
    expect(SECTOR_CENTRE[0]).toEqual([0, 65536])
  })
})
```
Set `EXPECTED_CHECKSUM` to the printed number.

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run src/core/tables && npm run lint`
Expected: PASS (generated file is lint-ignored).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(core): committed sine and sector tables with checksum"
```

---

### Task 4: Hash-based random draws

**Files:**
- Create: `src/core/rng.ts`
- Test: `src/core/rng.test.ts`

**Interfaces:**
- Produces: `export function draw(seed: number, throwIndex: number, n: number): number` (uint32). Draw `n` of throw `throwIndex` depends only on those three integers.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { draw } from './rng.ts'

describe('draw', () => {
  it('is deterministic', () => {
    expect(draw(1, 2, 3)).toBe(draw(1, 2, 3))
  })
  it('returns uint32 values', () => {
    for (let n = 0; n < 200; n++) {
      const v = draw(99, n, n % 18)
      expect(Number.isInteger(v) && v >= 0 && v <= 0xffffffff).toBe(true)
    }
  })
  it('differs when any input differs', () => {
    const base = draw(5, 5, 5)
    expect(draw(6, 5, 5)).not.toBe(base)
    expect(draw(5, 6, 5)).not.toBe(base)
    expect(draw(5, 5, 6)).not.toBe(base)
  })
  it('does not depend on call order (no shared stream)', () => {
    const a = draw(7, 10, 1)
    draw(7, 3, 0)
    draw(7, 11, 4)
    expect(draw(7, 10, 1)).toBe(a)
  })
  it('spreads roughly evenly across 16 buckets', () => {
    const buckets = new Array(16).fill(0)
    for (let i = 0; i < 4000; i++) buckets[draw(42, i, 0) % 16]++
    for (const b of buckets) expect(b).toBeGreaterThan(180)
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/core/rng.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
function mix32(h: number): number {
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

function hash2(a: number, b: number): number {
  return mix32((a ^ Math.imul(b + 1, 0x9e3779b1)) >>> 0)
}

/** Draw n of throw throwIndex for this seed. A pure function of its three integers. */
export function draw(seed: number, throwIndex: number, n: number): number {
  return hash2(hash2(seed >>> 0, throwIndex), n)
}
```

- [ ] **Step 4: Run, expect PASS.** `npx vitest run src/core/rng.test.ts`

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(core): per-throw hash draws"`

---

### Task 5: Board geometry (bed lookup, bed centres, tap-to-target)

**Files:**
- Create: `src/core/board.ts`
- Test: `src/core/board.test.ts`

**Interfaces:**
- Consumes: `BOARD`, `SECTOR_NUMBERS`, `DIR_SCALE` (constants); `SECTOR_BOUNDARY`, `SECTOR_CENTRE` (tables); `Point`, `Bed`, `Ring`.
- Produces:
```ts
export function makeBed(ring: Ring, sector: number): Bed
export function bedAt(p: Point): Bed
export function bedCentre(bed: Bed): Point
export function targetFromTap(p: Point): Point | null     // null when the tap is off the board
export function bedLabel(bed: Bed): string                // 'T20', 'D16', 'S5', '25', 'Bull', 'Miss'
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { bedAt, bedCentre, bedLabel, makeBed, targetFromTap } from './board.ts'
import type { Ring } from './types.ts'

describe('bedAt', () => {
  it('finds the four compass trebles', () => {
    expect(bedLabel(bedAt({ x: 0, y: 1030 }))).toBe('T20')
    expect(bedLabel(bedAt({ x: 1030, y: 0 }))).toBe('T6')
    expect(bedLabel(bedAt({ x: 0, y: -1030 }))).toBe('T3')
    expect(bedLabel(bedAt({ x: -1030, y: 0 }))).toBe('T11')
  })
  it('scores bulls and misses', () => {
    expect(bedAt({ x: 0, y: 0 }).score).toBe(50)
    expect(bedAt({ x: 0, y: 0 }).isDouble).toBe(true)
    expect(bedAt({ x: 100, y: 0 }).score).toBe(25)
    expect(bedAt({ x: 1701, y: 0 }).ring).toBe('miss')
    expect(bedAt({ x: 1701, y: 0 }).score).toBe(0)
  })
  it('puts exact ring edges in the inner bed', () => {
    expect(bedAt({ x: 0, y: 990 }).ring).toBe('innerSingle')
    expect(bedAt({ x: 0, y: 991 }).ring).toBe('treble')
    expect(bedAt({ x: 0, y: 1070 }).ring).toBe('treble')
    expect(bedAt({ x: 0, y: 1071 }).ring).toBe('outerSingle')
    expect(bedAt({ x: 0, y: 1700 }).ring).toBe('double')
  })
  it('scores trebles and doubles', () => {
    expect(bedAt({ x: 0, y: 1030 }).score).toBe(60)
    expect(bedAt({ x: 0, y: 1660 }).score).toBe(40)
    expect(bedAt({ x: 0, y: 1660 }).isDouble).toBe(true)
  })
  it('puts a point exactly on a wire in the sector clockwise of it', () => {
    // 9 degrees clockwise of straight up is the 20/1 wire; points on it belong to sector 1.
    expect(bedAt({ x: 0, y: 1030 }).sector).toBe(20)
    expect(bedAt({ x: 200, y: 1000 }).sector).toBe(1)
  })
})

describe('bedCentre', () => {
  const rings: Ring[] = ['innerSingle', 'treble', 'outerSingle', 'double']
  it('round-trips for every sector and ring', () => {
    for (let sector = 1; sector <= 20; sector++) {
      for (const ring of rings) {
        const bed = makeBed(ring, sector)
        expect(bedAt(bedCentre(bed))).toEqual(bed)
      }
    }
  })
  it('centres the bulls on the origin', () => {
    expect(bedCentre(makeBed('bull', 0))).toEqual({ x: 0, y: 0 })
    expect(bedCentre(makeBed('outerBull', 0))).toEqual({ x: 0, y: 0 })
  })
})

describe('targetFromTap', () => {
  it('snaps a tap to the centre of the bed', () => {
    expect(targetFromTap({ x: 30, y: 1000 })).toEqual(bedCentre(bedAt({ x: 30, y: 1000 })))
  })
  it('snaps either bull to the origin and ignores taps off the board', () => {
    expect(targetFromTap({ x: 100, y: 0 })).toEqual({ x: 0, y: 0 })
    expect(targetFromTap({ x: 5000, y: 5000 })).toBeNull()
  })
})
```

- [ ] **Step 2: Run, expect FAIL.** `npx vitest run src/core/board.test.ts`

- [ ] **Step 3: Implement** (`src/core/board.ts`)

```ts
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
```

- [ ] **Step 4: Run, expect PASS.** `npx vitest run src/core/board.test.ts`

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(core): integer board geometry and bed lookup"`

---

### Task 6: The throw (wobble path, bounded scatter, resolve)

**Files:**
- Create: `src/core/throw.ts`
- Test: `src/core/throw.test.ts`

**Interfaces:**
- Consumes: `draw` (rng), `sin16`/`cos16` (sine), `bedAt` (board), `TICK_MS`, `UNITS_PER_TREBLE_WIDTH`, types.
- Produces:
```ts
export const DRAWS_PER_THROW = 18
export function releaseTickFor(rawMs: number, leadMs: number): number
export function crosshairAt(ctx: ThrowCtx, tick: number): Point
export function scatterFor(ctx: ThrowCtx): Point
export function resolveThrow(ctx: ThrowCtx, releaseTick: number): ThrowResult
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS } from './settings.ts'
import { UNITS_PER_TREBLE_WIDTH } from './constants.ts'
import { crosshairAt, releaseTickFor, resolveThrow, scatterFor } from './throw.ts'
import type { ThrowCtx } from './types.ts'

const ctx = (over: Partial<ThrowCtx> = {}, settings = DEFAULT_SETTINGS): ThrowCtx => ({
  seed: 1234, throwIndex: 0, settings, target: { x: 0, y: 1030 }, ...over,
})

describe('releaseTickFor', () => {
  it('subtracts lead, floors to 8ms ticks and never goes below 0', () => {
    expect(releaseTickFor(1000, 60)).toBe(117)
    expect(releaseTickFor(10, 60)).toBe(0)
    expect(releaseTickFor(1000, -40)).toBe(130)
  })
})

describe('crosshairAt', () => {
  it('is deterministic and loops after one loop time', () => {
    const c = ctx()
    expect(crosshairAt(c, 37)).toEqual(crosshairAt(c, 37))
    const loopTicks = DEFAULT_SETTINGS.loopMs / 8
    expect(crosshairAt(c, 0)).toEqual(crosshairAt(c, loopTicks))
  })
  it('stays within the wobble radius of the target', () => {
    const radius = DEFAULT_SETTINGS.wobbleRadius * 8
    for (let t = 0; t < 400; t += 7) {
      const p = crosshairAt(ctx(), t)
      expect(Math.hypot(p.x - 0, p.y - 1030)).toBeLessThanOrEqual(radius + 1)
    }
  })
  it('starts each dart at a different place on the loop', () => {
    const starts = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const p = crosshairAt(ctx({ throwIndex: i }), 0)
      starts.add(`${p.x},${p.y}`)
    }
    expect(starts.size).toBeGreaterThan(10)
  })
  it('circle shape reaches the radius, figure-8 is at most about half as tall', () => {
    const circle = { ...DEFAULT_SETTINGS, shape: 0 }
    const eight = { ...DEFAULT_SETTINGS, shape: 100 }
    let maxCircleY = 0
    let maxEightY = 0
    for (let t = 0; t < 200; t++) {
      maxCircleY = Math.max(maxCircleY, Math.abs(crosshairAt(ctx({}, circle), t).y - 1030))
      maxEightY = Math.max(maxEightY, Math.abs(crosshairAt(ctx({}, eight), t).y - 1030))
    }
    expect(maxCircleY).toBeGreaterThan(maxEightY * 1.6)
  })
})

describe('scatterFor', () => {
  it('never exceeds the cap and is zero when the cap is zero', () => {
    const cap = DEFAULT_SETTINGS.scatterCap * 8
    for (let i = 0; i < 2000; i++) {
      const s = scatterFor(ctx({ throwIndex: i }))
      expect(Math.hypot(s.x, s.y)).toBeLessThanOrEqual(cap)
    }
    const none = scatterFor(ctx({}, { ...DEFAULT_SETTINGS, scatterCap: 0 }))
    expect(none).toEqual({ x: 0, y: 0 })
  })
  it('is weighted to the centre: median offset at most 35% of the cap', () => {
    const cap = DEFAULT_SETTINGS.scatterCap * 8
    const d: number[] = []
    for (let i = 0; i < 2000; i++) {
      const s = scatterFor(ctx({ throwIndex: i }))
      d.push(Math.hypot(s.x, s.y))
    }
    d.sort((a, b) => a - b)
    expect(d[1000]).toBeLessThanOrEqual(cap * 0.35)
    expect(d[1000]).toBeGreaterThan(cap * 0.2)
  })
  it('does not depend on the release time', () => {
    const a = resolveThrow(ctx(), 10).scatter
    const b = resolveThrow(ctx(), 90).scatter
    expect(a).toEqual(b)
  })
})

describe('resolveThrow', () => {
  it('lands at crosshair plus scatter and reports the bed there', () => {
    const r = resolveThrow(ctx(), 55)
    expect(r.landing).toEqual({ x: r.crosshair.x + r.scatter.x, y: r.crosshair.y + r.scatter.y })
    expect(r.bed.ring).toBeDefined()
  })
  it('guarantees a hit when the ring is fully inside the bed', () => {
    // Tiny cap (0.2 treble width = 16 units) around the middle of T20: every dart lands in the treble.
    const s = { ...DEFAULT_SETTINGS, wobbleRadius: 10, scatterCap: 2 }
    for (let i = 0; i < 300; i++) {
      const r = resolveThrow(ctx({ throwIndex: i }, s), 0)
      const cross = Math.hypot(r.crosshair.x, r.crosshair.y - 1030)
      if (cross + 2 * 8 < (UNITS_PER_TREBLE_WIDTH / 2) - 1) {
        expect(r.bed.ring === 'treble' && r.bed.sector === 20).toBe(true)
      }
    }
  })
})
```

- [ ] **Step 2: Run, expect FAIL.** `npx vitest run src/core/throw.test.ts`

- [ ] **Step 3: Implement** (`src/core/throw.ts`)

```ts
import { TICK_MS } from './constants.ts'
import { bedAt } from './board.ts'
import { draw } from './rng.ts'
import { cos16, sin16 } from './tables/sine.ts'
import type { Point, ThrowCtx, ThrowResult } from './types.ts'

/** Draw 0 = wobble phase, draws 1-16 = eight x/y attempts for the scatter disc, draw 17 = centre weight. */
export const DRAWS_PER_THROW = 18
const UNITS_PER_TENTH_TW = 8

export function releaseTickFor(rawMs: number, leadMs: number): number {
  return Math.max(0, Math.floor((rawMs - leadMs) / TICK_MS))
}

export function crosshairAt(ctx: ThrowCtx, tick: number): Point {
  const { settings, seed, throwIndex, target } = ctx
  const startPhase = draw(seed, throwIndex, 0) % 65536
  const phase = (startPhase + Math.floor((tick * TICK_MS * 65536) / settings.loopMs)) % 65536
  const radius = settings.wobbleRadius * UNITS_PER_TENTH_TW
  const sx = sin16(phase)
  const circleY = cos16(phase)
  const eightY = sin16(2 * phase) >> 1
  const sy = Math.trunc(((100 - settings.shape) * circleY + settings.shape * eightY) / 100)
  return {
    x: target.x + Math.round((sx * radius) / 32767),
    y: target.y + Math.round((sy * radius) / 32767),
  }
}

/** A point in a disc of radius scatterCap, weighted to the centre. Always consumes the same draws. */
export function scatterFor(ctx: ThrowCtx): Point {
  const { seed, throwIndex, settings } = ctx
  let pickX = 0
  let pickY = 0
  let found = false
  for (let i = 0; i < 8; i++) {
    const dx = (draw(seed, throwIndex, 1 + 2 * i) % 65536) - 32768
    const dy = (draw(seed, throwIndex, 2 + 2 * i) % 65536) - 32768
    if (!found && dx * dx + dy * dy <= 32768 * 32768) {
      pickX = dx
      pickY = dy
      found = true
    }
  }
  const weight = draw(seed, throwIndex, 17) % 65536
  const cap = settings.scatterCap * UNITS_PER_TENTH_TW
  return {
    x: Math.trunc((pickX * weight * cap) / (32768 * 65536)),
    y: Math.trunc((pickY * weight * cap) / (32768 * 65536)),
  }
}

export function resolveThrow(ctx: ThrowCtx, releaseTick: number): ThrowResult {
  const crosshair = crosshairAt(ctx, releaseTick)
  const scatter = scatterFor(ctx)
  const landing = { x: crosshair.x + scatter.x, y: crosshair.y + scatter.y }
  return { crosshair, scatter, landing, bed: bedAt(landing) }
}
```
Note for the guarantee test: the T20 bed is 322 units wide and 80 tall, so the limiting half-height is 40 units (`UNITS_PER_TREBLE_WIDTH / 2`).

- [ ] **Step 4: Run, expect PASS.** `npx vitest run src/core/throw.test.ts`
If the "median" test fails by a hair, check the weighting maths before touching the threshold (the expected median is about 0.29 of the cap).

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(core): wobble path, bounded scatter and throw resolution"`

---

### Task 7: 501 double-out leg state

**Files:**
- Create: `src/core/leg.ts`
- Test: `src/core/leg.test.ts`

**Interfaces:**
- Consumes: `Bed`, `makeBed` (test only), `START_SCORE`, `DARTS_PER_TURN`.
- Produces:
```ts
export interface LegState { remaining: number; turnStart: number; dartsInTurn: number; dartsTotal: number; busts: number; won: boolean; lastBust: boolean }
export function newLeg(): LegState
export function applyDart(state: LegState, bed: Bed): LegState
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { makeBed } from './board.ts'
import { applyDart, newLeg } from './leg.ts'

const at = (remaining: number) => ({ ...newLeg(), remaining, turnStart: remaining })

describe('leg', () => {
  it('starts at 501', () => {
    expect(newLeg().remaining).toBe(501)
  })
  it('subtracts a dart and counts it', () => {
    const s = applyDart(newLeg(), makeBed('treble', 20))
    expect(s.remaining).toBe(441)
    expect(s.dartsTotal).toBe(1)
    expect(s.dartsInTurn).toBe(1)
  })
  it('starts a new turn after three darts', () => {
    let s = newLeg()
    for (let i = 0; i < 3; i++) s = applyDart(s, makeBed('treble', 20))
    expect(s.remaining).toBe(321)
    expect(s.turnStart).toBe(321)
    expect(s.dartsInTurn).toBe(0)
  })
  it('busts on overshoot and resets to the start of the turn', () => {
    let s = at(100)
    s = applyDart(s, makeBed('treble', 20)) // 40 left
    s = applyDart(s, makeBed('treble', 20)) // bust: -20
    expect(s.remaining).toBe(100)
    expect(s.dartsInTurn).toBe(0)
    expect(s.busts).toBe(1)
    expect(s.lastBust).toBe(true)
    expect(s.dartsTotal).toBe(2)
  })
  it('busts on leaving 1', () => {
    const s = applyDart(at(21), makeBed('double', 10))
    expect(s.remaining).toBe(21)
    expect(s.lastBust).toBe(true)
  })
  it('busts on reaching 0 without a double', () => {
    const s = applyDart(at(20), makeBed('innerSingle', 20))
    expect(s.won).toBe(false)
    expect(s.remaining).toBe(20)
    expect(s.lastBust).toBe(true)
  })
  it('wins on a double and on the bull', () => {
    expect(applyDart(at(40), makeBed('double', 20)).won).toBe(true)
    expect(applyDart(at(50), makeBed('bull', 0)).won).toBe(true)
  })
  it('ignores darts after the leg is won', () => {
    const won = applyDart(at(40), makeBed('double', 20))
    expect(applyDart(won, makeBed('treble', 20))).toBe(won)
  })
  it('clears lastBust on the next normal dart', () => {
    let s = applyDart(at(21), makeBed('double', 10))
    s = applyDart(s, makeBed('innerSingle', 1))
    expect(s.lastBust).toBe(false)
  })
})
```

- [ ] **Step 2: Run, expect FAIL.** `npx vitest run src/core/leg.test.ts`

- [ ] **Step 3: Implement**

```ts
import { DARTS_PER_TURN, START_SCORE } from './constants.ts'
import type { Bed } from './types.ts'

export interface LegState {
  remaining: number
  turnStart: number
  dartsInTurn: number
  dartsTotal: number
  busts: number
  won: boolean
  lastBust: boolean
}

export function newLeg(): LegState {
  return { remaining: START_SCORE, turnStart: START_SCORE, dartsInTurn: 0, dartsTotal: 0, busts: 0, won: false, lastBust: false }
}

export function applyDart(state: LegState, bed: Bed): LegState {
  if (state.won) return state
  const after = state.remaining - bed.score
  const dartsTotal = state.dartsTotal + 1
  const bust = after < 0 || after === 1 || (after === 0 && !bed.isDouble)
  if (bust) {
    return { ...state, remaining: state.turnStart, dartsInTurn: 0, dartsTotal, busts: state.busts + 1, lastBust: true }
  }
  if (after === 0) {
    return { ...state, remaining: 0, dartsInTurn: state.dartsInTurn + 1, dartsTotal, won: true, lastBust: false }
  }
  const dartsInTurn = state.dartsInTurn + 1
  if (dartsInTurn === DARTS_PER_TURN) {
    return { ...state, remaining: after, turnStart: after, dartsInTurn: 0, dartsTotal, lastBust: false }
  }
  return { ...state, remaining: after, dartsInTurn, dartsTotal, lastBust: false }
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(core): 501 double-out leg rules"`

---

### Task 8: Replay, run codes and the golden file

**Files:**
- Create: `src/core/replay.ts` (replay and run codes live in this one module), `scripts/make-golden.mjs`, `tests/golden/replay-v1.json` (generated)
- Test: `src/core/replay.test.ts`, `src/core/runcode.test.ts`

**Interfaces:**
- Consumes: `resolveThrow`, `newLeg`, `applyDart`, types.
- Produces:
```ts
export interface ThrowOutcome { index: number; leg: number; crosshair: Point; landing: Point; ring: Ring; sector: number; score: number; remaining: number; bust: boolean }
export interface LegSummary { darts: number; won: boolean; busts: number }
export interface ReplayResult { throws: ThrowOutcome[]; legs: LegSummary[] }
export function replayRun(log: RunLog): ReplayResult
export function encodeRunCode(log: RunLog): string      // base64url of the JSON
export function decodeRunCode(code: string): RunLog     // throws Error('Bad run code') on junk
```
Throw `i` of the log uses `throwIndex = i`. A new leg starts after a won leg.

- [ ] **Step 1: Write the failing tests**

`src/core/replay.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { bedCentre, makeBed } from './board.ts'
import { applyDart, newLeg } from './leg.ts'
import { DEFAULT_SETTINGS } from './settings.ts'
import { replayRun } from './replay.ts'
import { resolveThrow } from './throw.ts'
import type { RunLog, ThrowInput } from './types.ts'

/** Builds a log that finishes `legsWanted` legs by scanning for a release tick that lands in the bed we want. */
function finishingLog(legsWanted: number): RunLog {
  const settings = { ...DEFAULT_SETTINGS, scatterCap: 0, shape: 100 }
  const seed = 777
  const throws: ThrowInput[] = []
  let leg = newLeg()
  let won = 0
  while (won < legsWanted && throws.length < 400) {
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
    throws.push({ target, releaseTick: tick })
    leg = applyDart(leg, resolveThrow({ seed, throwIndex: index, settings, target }, tick).bed)
    if (leg.won) {
      won++
      leg = newLeg()
    }
  }
  return { v: 1, seed, settings, throws }
}

function sampleLog(n: number): RunLog {
  return {
    v: 1,
    seed: 12345,
    settings: DEFAULT_SETTINGS,
    throws: Array.from({ length: n }, (_, i) => ({ target: { x: 0, y: 1030 }, releaseTick: 20 + ((i * 37) % 160) })),
  }
}

describe('replayRun', () => {
  it('gives identical results every time', () => {
    expect(replayRun(sampleLog(40))).toEqual(replayRun(sampleLog(40)))
  })
  it('records one outcome per throw with running scores', () => {
    const r = replayRun(sampleLog(12))
    expect(r.throws).toHaveLength(12)
    expect(r.throws[0].index).toBe(0)
    expect(r.throws[0].remaining).toBe(501 - r.throws[0].score)
  })
  it('summarises the unfinished leg', () => {
    const r = replayRun(sampleLog(5))
    expect(r.legs).toHaveLength(1)
    expect(r.legs[0]).toMatchObject({ darts: 5, won: false })
  })
  it('starts a new leg after a win', () => {
    const r = replayRun(finishingLog(2))
    expect(r.legs).toHaveLength(2)
    expect(r.legs[0].won).toBe(true)
    expect(r.legs[1].won).toBe(true)
    expect(r.throws.at(-1)?.leg).toBe(1)
  })
})
```

`src/core/runcode.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS } from './settings.ts'
import { decodeRunCode, encodeRunCode } from './replay.ts'
import type { RunLog } from './types.ts'

const log: RunLog = { v: 1, seed: 7, settings: DEFAULT_SETTINGS, throws: [{ target: { x: 0, y: 1030 }, releaseTick: 90, rawMs: 760 }] }

describe('run codes', () => {
  it('round-trips', () => {
    expect(decodeRunCode(encodeRunCode(log))).toEqual(log)
  })
  it('is URL-safe', () => {
    expect(encodeRunCode(log)).toMatch(/^[A-Za-z0-9_-]+$/)
  })
  it('rejects junk', () => {
    expect(() => decodeRunCode('not a run code')).toThrow('Bad run code')
    expect(() => decodeRunCode(btoa('{"v":2}'))).toThrow('Bad run code')
  })
})
```
(`runcode.test.ts` imports from `./replay.ts`; implement the run-code functions in `replay.ts` too, and delete `runcode.ts` from the file list. Keep it as one module.)

- [ ] **Step 2: Run, expect FAIL.** `npx vitest run src/core/replay.test.ts src/core/runcode.test.ts`

- [ ] **Step 3: Implement** (`src/core/replay.ts`)

```ts
import { applyDart, newLeg } from './leg.ts'
import { resolveThrow } from './throw.ts'
import type { Point, Ring, RunLog } from './types.ts'

export interface ThrowOutcome {
  index: number
  leg: number
  crosshair: Point
  landing: Point
  ring: Ring
  sector: number
  score: number
  remaining: number
  bust: boolean
}
export interface LegSummary { darts: number; won: boolean; busts: number }
export interface ReplayResult { throws: ThrowOutcome[]; legs: LegSummary[] }

export function replayRun(log: RunLog): ReplayResult {
  const throws: ThrowOutcome[] = []
  const legs: LegSummary[] = []
  let leg = newLeg()
  let legIndex = 0
  log.throws.forEach((input, index) => {
    const result = resolveThrow({ seed: log.seed, throwIndex: index, settings: log.settings, target: input.target }, input.releaseTick)
    leg = applyDart(leg, result.bed)
    throws.push({
      index,
      leg: legIndex,
      crosshair: result.crosshair,
      landing: result.landing,
      ring: result.bed.ring,
      sector: result.bed.sector,
      score: result.bed.score,
      remaining: leg.remaining,
      bust: leg.lastBust,
    })
    if (leg.won) {
      legs.push({ darts: leg.dartsTotal, won: true, busts: leg.busts })
      leg = newLeg()
      legIndex += 1
    }
  })
  if (leg.dartsTotal > 0) legs.push({ darts: leg.dartsTotal, won: false, busts: leg.busts })
  return { throws, legs }
}

export function encodeRunCode(log: RunLog): string {
  return btoa(JSON.stringify(log)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeRunCode(code: string): RunLog {
  try {
    const padded = code.replace(/-/g, '+').replace(/_/g, '/')
    const parsed: unknown = JSON.parse(atob(padded + '='.repeat((4 - (padded.length % 4)) % 4)))
    const log = parsed as RunLog
    if (log.v !== 1 || typeof log.seed !== 'number' || !Array.isArray(log.throws) || typeof log.settings !== 'object') {
      throw new Error('shape')
    }
    return log
  } catch {
    throw new Error('Bad run code')
  }
}
```

- [ ] **Step 4: Make the golden file and its guard test**

`scripts/make-golden.mjs`:
```js
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
```
Run: `node scripts/make-golden.mjs`. Then add this test to `src/core/replay.test.ts`:
```ts
import { readFileSync } from 'node:fs'
it('matches the committed golden file (a change here means the run-log format needs a version bump)', () => {
  const golden = JSON.parse(readFileSync(new URL('../../tests/golden/replay-v1.json', import.meta.url), 'utf8'))
  expect(replayRun(golden.log)).toEqual(golden.expected)
})
```
(Add `import { readFileSync } from 'node:fs'` at the top of the file. ESLint's browser globals don't cover this because it is a test file under `src/`: if lint complains, add `/* global URL */` is not needed; Node imports are fine.)

- [ ] **Step 5: Run everything, commit**

Run: `npx vitest run && npm run lint && npm run typecheck`
Expected: PASS.
```bash
git add -A && git commit -m "feat(core): replay, run codes and committed golden file"
```

---

### Task 9: Drill analysis, lead search and run summary

**Files:**
- Create: `src/core/drill.ts`, `src/core/lead.ts`, `src/core/analysis.ts`
- Test: `src/core/drill.test.ts`, `src/core/lead.test.ts`, `src/core/analysis.test.ts`

**Interfaces:**
- Consumes: `bedAt`, `bedLabel`, `crosshairAt`, `releaseTickFor`, `replayRun`, `UNITS_PER_TREBLE_WIDTH`, types.
- Produces:
```ts
// drill.ts
export interface DrillDart { crosshair: Point; landing: Point; bed: Bed }
export type Verdict = 'not-enough-darts' | 'too-loose' | 'right' | 'too-easy'
export interface DrillSummary { n: number; counts: Record<string, number>; total: number; t20: number; in20: number; nearT20: number; timingShare: number | null; verdict: Verdict }
export function summariseDrill(darts: DrillDart[]): DrillSummary
// lead.ts
export const LEAD_MIN = -150; export const LEAD_MAX = 150; export const LEAD_STEP = 4
export interface LeadSuggestion { usable: boolean; leadMs: number; before: number; after: number; gain: number }   // before/after = mean aim error in board units
export function bestLead(ctxs: ThrowCtx[], rawMs: number[], target: Point, currentLeadMs: number): LeadSuggestion
export function estimateLead(errorsMs: number[]): number     // median, rounded, clamped to ±150
// analysis.ts
export interface RunSummary { throws: number; legsStarted: number; legsWon: number; dartsPerWonLeg: number | null; busts: number; hitRate: number; meanMissTrebleWidths: number }
export function summariseRun(log: RunLog): RunSummary        // hitRate = share of darts landing in the bed of the target; meanMiss = mean distance from target centre to landing, in treble widths
```

- [ ] **Step 1: Write the failing tests**

`src/core/drill.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { makeBed } from './board.ts'
import { summariseDrill } from './drill.ts'
import type { DrillDart } from './drill.ts'

const dart = (ring: Parameters<typeof makeBed>[0], sector: number, crosshairInT20: boolean): DrillDart => ({
  crosshair: crosshairInT20 ? { x: 0, y: 1030 } : { x: 600, y: 600 },
  landing: { x: 0, y: 0 },
  bed: makeBed(ring, sector),
})

describe('summariseDrill', () => {
  it('counts beds, total and T20 hits', () => {
    const darts = [dart('treble', 20, true), dart('treble', 20, true), dart('innerSingle', 20, true), dart('innerSingle', 1, false)]
    const s = summariseDrill(darts)
    expect(s.counts).toEqual({ T20: 2, S20: 1, S1: 1 })
    expect(s.total).toBe(60 + 60 + 20 + 1)
    expect(s.t20).toBe(2)
    expect(s.in20).toBe(3)
    expect(s.nearT20).toBe(4)
  })
  it('splits misses into timing and scatter', () => {
    const darts = [dart('innerSingle', 20, true), dart('innerSingle', 1, false), dart('innerSingle', 5, false), dart('treble', 20, true)]
    expect(summariseDrill(darts).timingShare).toBeCloseTo(2 / 3)
  })
  it('has no timing share without misses', () => {
    expect(summariseDrill([dart('treble', 20, true)]).timingShare).toBeNull()
  })
  it('gives a verdict only with enough darts', () => {
    expect(summariseDrill([dart('treble', 20, true)]).verdict).toBe('not-enough-darts')
    const tooEasy = Array.from({ length: 10 }, () => dart('treble', 20, true))
    expect(summariseDrill(tooEasy).verdict).toBe('too-easy')
    const tooLoose = Array.from({ length: 10 }, () => dart('innerSingle', 5, false))
    expect(summariseDrill(tooLoose).verdict).toBe('too-loose')
    const right = [...Array.from({ length: 3 }, () => dart('treble', 20, true)), ...Array.from({ length: 7 }, () => dart('innerSingle', 20, true))]
    expect(summariseDrill(right).verdict).toBe('right')
  })
})
```

`src/core/lead.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS } from './settings.ts'
import { bestLead, estimateLead } from './lead.ts'
import { crosshairAt } from './throw.ts'
import type { ThrowCtx } from './types.ts'

const target = { x: 0, y: 1030 }
const ctxFor = (i: number): ThrowCtx => ({ seed: 99, throwIndex: i, settings: DEFAULT_SETTINGS, target })

/** The tick (0..399) where this dart's crosshair is closest to the target. */
function bestTick(ctx: ThrowCtx): number {
  let best = 0
  let bestD = Infinity
  for (let t = 0; t < 400; t++) {
    const p = crosshairAt(ctx, t)
    const d = Math.hypot(p.x - target.x, p.y - target.y)
    if (d < bestD) { bestD = d; best = t }
  }
  return best
}

describe('bestLead', () => {
  it('finds the lead a consistently late tapper needs', () => {
    const ctxs = Array.from({ length: 10 }, (_, i) => ctxFor(i))
    const rawMs = ctxs.map((c) => bestTick(c) * 8 + 40)
    const s = bestLead(ctxs, rawMs, target, 0)
    expect(s.usable).toBe(true)
    expect(Math.abs(s.leadMs - 40)).toBeLessThanOrEqual(8)
    expect(s.after).toBeLessThan(s.before)
    expect(s.gain).toBeGreaterThan(0.1)
  })
  it('is not usable with fewer than 8 darts', () => {
    const ctxs = Array.from({ length: 5 }, (_, i) => ctxFor(i))
    expect(bestLead(ctxs, ctxs.map(() => 500), target, 0).usable).toBe(false)
  })
})

describe('estimateLead', () => {
  it('takes the median and clamps', () => {
    expect(estimateLead([30, 50, 40, 400, 45])).toBe(45)
    expect(estimateLead([500, 600, 700])).toBe(150)
    expect(estimateLead([-500, -600, -700])).toBe(-150)
    expect(estimateLead([])).toBe(0)
  })
})
```

`src/core/analysis.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS } from './settings.ts'
import { summariseRun } from './analysis.ts'
import type { RunLog } from './types.ts'

describe('summariseRun', () => {
  it('summarises legs, busts and aim', () => {
    const log: RunLog = {
      v: 1, seed: 5, settings: DEFAULT_SETTINGS,
      throws: Array.from({ length: 300 }, (_, i) => ({ target: { x: 0, y: 0 }, releaseTick: i % 150 })),
    }
    const s = summariseRun(log)
    expect(s.throws).toBe(300)
    expect(s.legsStarted).toBeGreaterThanOrEqual(1)
    expect(s.hitRate).toBeGreaterThanOrEqual(0)
    expect(s.hitRate).toBeLessThanOrEqual(1)
    expect(s.meanMissTrebleWidths).toBeGreaterThan(0)
  })
  it('handles an empty log', () => {
    const s = summariseRun({ v: 1, seed: 1, settings: DEFAULT_SETTINGS, throws: [] })
    expect(s).toMatchObject({ throws: 0, legsStarted: 0, legsWon: 0, dartsPerWonLeg: null })
  })
})
```

- [ ] **Step 2: Run, expect FAIL.** `npx vitest run src/core/drill.test.ts src/core/lead.test.ts src/core/analysis.test.ts`

- [ ] **Step 3: Implement**

`src/core/drill.ts`:
```ts
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
```

`src/core/lead.ts`:
```ts
import { crosshairAt, releaseTickFor } from './throw.ts'
import type { Point, ThrowCtx } from './types.ts'

export const LEAD_MIN = -150
export const LEAD_MAX = 150
export const LEAD_STEP = 4

export interface LeadSuggestion { usable: boolean; leadMs: number; before: number; after: number; gain: number }

function meanAimError(ctxs: ThrowCtx[], rawMs: number[], target: Point, leadMs: number): number {
  let sum = 0
  ctxs.forEach((ctx, i) => {
    const p = crosshairAt(ctx, releaseTickFor(rawMs[i], leadMs))
    sum += Math.hypot(p.x - target.x, p.y - target.y)
  })
  return sum / ctxs.length
}

export function bestLead(ctxs: ThrowCtx[], rawMs: number[], target: Point, currentLeadMs: number): LeadSuggestion {
  const before = ctxs.length === 0 ? 0 : meanAimError(ctxs, rawMs, target, currentLeadMs)
  if (ctxs.length < 8) return { usable: false, leadMs: currentLeadMs, before, after: before, gain: 0 }
  let bestLeadMs = currentLeadMs
  let best = before
  for (let lead = LEAD_MIN; lead <= LEAD_MAX; lead += LEAD_STEP) {
    const e = meanAimError(ctxs, rawMs, target, lead)
    if (e < best - 1e-9 || (Math.abs(e - best) <= 1e-9 && Math.abs(lead - currentLeadMs) < Math.abs(bestLeadMs - currentLeadMs))) {
      best = e
      bestLeadMs = lead
    }
  }
  const gain = before === 0 ? 0 : (before - best) / before
  return { usable: gain >= 0.1, leadMs: bestLeadMs, before, after: best, gain }
}

export function estimateLead(errorsMs: number[]): number {
  if (errorsMs.length === 0) return 0
  const sorted = [...errorsMs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  return Math.min(LEAD_MAX, Math.max(LEAD_MIN, Math.round(median)))
}
```
(Test 1 expects `usable` true with a gain above 10%; "usable" means at least 8 darts and a gain of 10% or more.)

`src/core/analysis.ts`:
```ts
import { bedAt } from './board.ts'
import { UNITS_PER_TREBLE_WIDTH } from './constants.ts'
import { replayRun } from './replay.ts'
import type { RunLog } from './types.ts'

export interface RunSummary {
  throws: number
  legsStarted: number
  legsWon: number
  dartsPerWonLeg: number | null
  busts: number
  hitRate: number
  meanMissTrebleWidths: number
}

export function summariseRun(log: RunLog): RunSummary {
  const r = replayRun(log)
  const won = r.legs.filter((l) => l.won)
  let hits = 0
  let missUnits = 0
  r.throws.forEach((t, i) => {
    const target = log.throws[i].target
    const targetBed = bedAt(target)
    const landedBed = { ring: t.ring, sector: t.sector }
    if (landedBed.ring === targetBed.ring && landedBed.sector === targetBed.sector) hits++
    missUnits += Math.hypot(t.landing.x - target.x, t.landing.y - target.y)
  })
  const n = r.throws.length
  return {
    throws: n,
    legsStarted: r.legs.length,
    legsWon: won.length,
    dartsPerWonLeg: won.length === 0 ? null : won.reduce((s, l) => s + l.darts, 0) / won.length,
    busts: r.legs.reduce((s, l) => s + l.busts, 0),
    hitRate: n === 0 ? 0 : hits / n,
    meanMissTrebleWidths: n === 0 ? 0 : missUnits / n / UNITS_PER_TREBLE_WIDTH,
  }
}
```

- [ ] **Step 4: Run, expect PASS.** `npx vitest run && npm run lint && npm run typecheck`

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(core): drill summary, lead search and run summary"`

---

### Task 10: Guard script

**Files:**
- Modify: `scripts/guard.mjs` (replace the stub)
- Test: `scripts/guard.test.ts`

**Interfaces:**
- Produces: `export function scanRoot(root: string): string[]` (one line per violation, `path:line: reason`); running the file as a script scans the repo root and exits 1 on any violation.

Rules: in `src/core/**` (`*.ts`), flag `Math.random`, `Date.now`, `performance.now`, `new Date(`, `Math.sin`, `Math.cos`, `Math.atan2`, `Math.tan`. In `src/`, `public/`, `index.html`, `lab.html`, flag the banned terms: PDC, WDF, Sky Sports, Ally Pally, Alexandra Palace, Premier League, and a short list of real darts player names (Littler, van Gerwen, Humphries, Phil Taylor, Fallon Sherrock, Gerwyn Price, Gary Anderson, Rob Cross, Peter Wright). Banned terms are matched case-insensitively on word boundaries.

- [ ] **Step 1: Write the failing test** (`scripts/guard.test.ts`)

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanRoot } from './guard.mjs'

let root = ''
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'guard-'))
  mkdirSync(join(root, 'src', 'core'), { recursive: true })
  mkdirSync(join(root, 'src', 'ui'), { recursive: true })
})
const put = (rel: string, body: string) => writeFileSync(join(root, rel), body)

describe('guard', () => {
  it('passes clean code', () => {
    put('src/core/a.ts', 'export const a = 1\n')
    expect(scanRoot(root)).toEqual([])
  })
  it.each(['Math.random()', 'Date.now()', 'performance.now()', 'new Date()', 'Math.sin(1)', 'Math.cos(1)', 'Math.atan2(1, 2)'])(
    'flags %s in core',
    (snippet) => {
      put('src/core/a.ts', `export const a = ${snippet}\n`)
      expect(scanRoot(root)).toHaveLength(1)
    },
  )
  it('allows those APIs outside core', () => {
    put('src/ui/a.ts', 'export const a = Math.random() + Date.now() + Math.sin(1)\n')
    expect(scanRoot(root)).toEqual([])
  })
  it('flags banned brand and player terms anywhere in src', () => {
    put('src/ui/a.ts', "export const t = 'Premier League'\n")
    put('src/core/b.ts', '// Luke Littler\nexport const b = 1\n')
    expect(scanRoot(root)).toHaveLength(2)
  })
  it('does not flag lookalike words', () => {
    put('src/ui/a.ts', "export const t = 'pdcx skyline'\n")
    expect(scanRoot(root)).toEqual([])
  })
})
```

- [ ] **Step 2: Run, expect FAIL.** `npx vitest run scripts/guard.test.ts`

- [ ] **Step 3: Implement** (`scripts/guard.mjs`)

```js
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const CORE_BANNED = [
  [/\bMath\.random\b/, 'Math.random is banned in src/core (use the seeded draws)'],
  [/\bDate\.now\b/, 'Date.now is banned in src/core (core never sees a clock)'],
  [/\bperformance\.now\b/, 'performance.now is banned in src/core'],
  [/\bnew Date\(/, 'new Date is banned in src/core'],
  [/\bMath\.(sin|cos|tan|atan2)\b/, 'trig is banned in src/core (use the committed tables)'],
]

const TERMS = [
  'PDC', 'WDF', 'Sky Sports', 'Ally Pally', 'Alexandra Palace', 'Premier League',
  'Littler', 'van Gerwen', 'Humphries', 'Phil Taylor', 'Fallon Sherrock', 'Gerwyn Price', 'Gary Anderson', 'Rob Cross', 'Peter Wright',
]
const TERM_RES = TERMS.map((t) => [new RegExp(`\\b${t.replace(/ /g, '\\s+')}\\b`, 'i'), `banned term "${t}"`])

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

export function scanRoot(root) {
  const problems = []
  const files = [...walk(join(root, 'src')), ...walk(join(root, 'public')), join(root, 'index.html'), join(root, 'lab.html')].filter(existsSync)
  for (const file of files) {
    const rel = relative(root, file).replace(/\\/g, '/')
    const isCore = rel.startsWith('src/core/') && rel.endsWith('.ts')
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      if (isCore && !rel.endsWith('/tables/generated.ts')) {
        for (const [re, why] of CORE_BANNED) if (re.test(line)) problems.push(`${rel}:${i + 1}: ${why}`)
      }
      for (const [re, why] of TERM_RES) if (re.test(line)) problems.push(`${rel}:${i + 1}: ${why}`)
    })
  }
  return problems
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const problems = scanRoot(root)
  if (problems.length) {
    console.error(problems.join('\n'))
    console.error(`guard: ${problems.length} problem(s)`)
    process.exit(1)
  }
  console.log('guard: ok')
}
```
If TypeScript complains about importing `.mjs` in the test, add `// @ts-expect-error` is not allowed to hide real errors: instead add `"allowJs": true` to `tsconfig.json` and include `scripts` in `include`.

- [ ] **Step 4: Run, expect PASS; run the real guard**

Run: `npx vitest run scripts/guard.test.ts && npm run guard`
Expected: PASS, and `guard: ok` on the repo.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: guard script for core purity and banned terms"`

---

### Task 11: Render: view maths, board and overlays

**Files:**
- Create: `src/render/view.ts`, `src/render/board.ts`, `src/render/overlay.ts`
- Test: `src/render/view.test.ts`

**Interfaces:**
- Consumes: `BOARD`, `SECTOR_NUMBERS`, `Point`.
- Produces:
```ts
// view.ts
export interface View { w: number; h: number; centre: Point; scale: number }       // scale = CSS pixels per board unit
export function makeView(w: number, h: number, centre: Point, zoomPct: number): View
export function toPx(v: View, p: Point): { px: number; py: number }
export function toBoard(v: View, px: number, py: number): Point                    // rounded to integers
// board.ts
export function drawBoard(ctx: CanvasRenderingContext2D, view: View): void
// overlay.ts
export function drawTargetMarker(ctx: CanvasRenderingContext2D, view: View, target: Point): void
export function drawAim(ctx: CanvasRenderingContext2D, view: View, crosshair: Point, capUnits: number): void
export function drawGhost(ctx: CanvasRenderingContext2D, view: View, crosshair: Point, capUnits: number): void
export function drawDart(ctx: CanvasRenderingContext2D, view: View, from: Point, to: Point, t: number): void   // t 0..1
```

- [ ] **Step 1: Write the failing test** (`src/render/view.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { makeView, toBoard, toPx } from './view.ts'

describe('view', () => {
  it('puts the view centre in the middle of the canvas', () => {
    const v = makeView(390, 500, { x: 0, y: 1030 }, 200)
    const c = toPx(v, { x: 0, y: 1030 })
    expect(c.px).toBeCloseTo(195)
    expect(c.py).toBeCloseTo(250)
  })
  it('flips y so up on the board is up on the screen', () => {
    const v = makeView(390, 500, { x: 0, y: 0 }, 100)
    expect(toPx(v, { x: 0, y: 500 }).py).toBeLessThan(toPx(v, { x: 0, y: 0 }).py)
  })
  it('round-trips pixels and board points', () => {
    const v = makeView(390, 500, { x: 120, y: 900 }, 250)
    const p = { x: 300, y: 1000 }
    const px = toPx(v, p)
    expect(toBoard(v, px.px, px.py)).toEqual(p)
  })
  it('scales with zoom', () => {
    const a = makeView(390, 500, { x: 0, y: 0 }, 100)
    const b = makeView(390, 500, { x: 0, y: 0 }, 200)
    expect(b.scale).toBeCloseTo(a.scale * 2)
  })
  it('fits the whole board at 100 percent', () => {
    const v = makeView(390, 500, { x: 0, y: 0 }, 100)
    expect(toPx(v, { x: 1700, y: 0 }).px).toBeLessThan(390)
    expect(toPx(v, { x: -1700, y: 0 }).px).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run, expect FAIL.** `npx vitest run src/render/view.test.ts`

- [ ] **Step 3: Implement**

`src/render/view.ts`:
```ts
import type { Point } from '../core/types.ts'

export interface View { w: number; h: number; centre: Point; scale: number }

/** 100 percent fits the whole board (radius 1700 plus a margin for numbers) in the smaller side. */
export function makeView(w: number, h: number, centre: Point, zoomPct: number): View {
  const fit = Math.min(w, h) / (2 * 1900)
  return { w, h, centre, scale: (fit * zoomPct) / 100 }
}

export function toPx(v: View, p: Point): { px: number; py: number } {
  return { px: v.w / 2 + (p.x - v.centre.x) * v.scale, py: v.h / 2 - (p.y - v.centre.y) * v.scale }
}

export function toBoard(v: View, px: number, py: number): Point {
  return { x: Math.round(v.centre.x + (px - v.w / 2) / v.scale), y: Math.round(v.centre.y - (py - v.h / 2) / v.scale) }
}
```

`src/render/board.ts`:
```ts
import { BOARD } from '../core/constants.ts'
import { SECTOR_NUMBERS } from '../core/constants.ts'
import { toPx } from './view.ts'
import type { View } from './view.ts'

const DEG = Math.PI / 180

function ring(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, r0: number, r1: number, a0: number, a1: number, colour: string) {
  ctx.beginPath()
  ctx.arc(cx, cy, r1 * s, a0, a1, false)
  ctx.arc(cx, cy, r0 * s, a1, a0, true)
  ctx.closePath()
  ctx.fillStyle = colour
  ctx.fill()
}

export function drawBoard(ctx: CanvasRenderingContext2D, view: View): void {
  const s = view.scale
  const c = toPx(view, { x: 0, y: 0 })
  ctx.fillStyle = '#0b0d10'
  ctx.fillRect(0, 0, view.w, view.h)
  ctx.fillStyle = '#14171c'
  ctx.beginPath()
  ctx.arc(c.px, c.py, 1900 * s, 0, Math.PI * 2)
  ctx.fill()

  for (let k = 0; k < 20; k++) {
    const a0 = (-9 + 18 * k - 90) * DEG
    const a1 = a0 + 18 * DEG
    const single = k % 2 === 0 ? '#1c1c1c' : '#e8dcb8'
    const multi = k % 2 === 0 ? '#b3261e' : '#1f7a3a'
    ring(ctx, c.px, c.py, s, BOARD.bullOuter, BOARD.trebleInner, a0, a1, single)
    ring(ctx, c.px, c.py, s, BOARD.trebleInner, BOARD.trebleOuter, a0, a1, multi)
    ring(ctx, c.px, c.py, s, BOARD.trebleOuter, BOARD.doubleInner, a0, a1, single)
    ring(ctx, c.px, c.py, s, BOARD.doubleInner, BOARD.doubleOuter, a0, a1, multi)
  }
  ctx.fillStyle = '#1f7a3a'
  ctx.beginPath()
  ctx.arc(c.px, c.py, BOARD.bullOuter * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#b3261e'
  ctx.beginPath()
  ctx.arc(c.px, c.py, BOARD.bullInner * s, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = 'rgba(200,200,200,0.55)'
  ctx.lineWidth = 1
  for (const r of [BOARD.bullInner, BOARD.bullOuter, BOARD.trebleInner, BOARD.trebleOuter, BOARD.doubleInner, BOARD.doubleOuter]) {
    ctx.beginPath()
    ctx.arc(c.px, c.py, r * s, 0, Math.PI * 2)
    ctx.stroke()
  }
  for (let k = 0; k < 20; k++) {
    const a = (-9 + 18 * k - 90) * DEG
    ctx.beginPath()
    ctx.moveTo(c.px + Math.cos(a) * BOARD.bullOuter * s, c.py + Math.sin(a) * BOARD.bullOuter * s)
    ctx.lineTo(c.px + Math.cos(a) * BOARD.doubleOuter * s, c.py + Math.sin(a) * BOARD.doubleOuter * s)
    ctx.stroke()
  }

  ctx.fillStyle = '#d8d8d8'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${Math.max(10, 110 * s)}px system-ui, sans-serif`
  for (let k = 0; k < 20; k++) {
    const a = (18 * k - 90) * DEG
    ctx.fillText(String(SECTOR_NUMBERS[k]), c.px + Math.cos(a) * 1800 * s, c.py + Math.sin(a) * 1800 * s)
  }
}
```

`src/render/overlay.ts`:
```ts
import { toPx } from './view.ts'
import type { View } from './view.ts'
import type { Point } from '../core/types.ts'

const AIM = '#ffd400'

function ringAt(ctx: CanvasRenderingContext2D, view: View, p: Point, capUnits: number, dashed: boolean, alpha: number) {
  const c = toPx(view, p)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.lineWidth = 2
  ctx.strokeStyle = '#000000'
  ctx.setLineDash(dashed ? [4, 4] : [])
  ctx.beginPath()
  ctx.arc(c.px, c.py, Math.max(2, capUnits * view.scale), 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 1
  ctx.strokeStyle = AIM
  ctx.stroke()
  ctx.restore()
}

export function drawTargetMarker(ctx: CanvasRenderingContext2D, view: View, target: Point): void {
  const c = toPx(view, target)
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(c.px - 5, c.py)
  ctx.lineTo(c.px + 5, c.py)
  ctx.moveTo(c.px, c.py - 5)
  ctx.lineTo(c.px, c.py + 5)
  ctx.stroke()
  ctx.restore()
}

export function drawAim(ctx: CanvasRenderingContext2D, view: View, crosshair: Point, capUnits: number): void {
  ringAt(ctx, view, crosshair, capUnits, false, 0.95)
  const c = toPx(view, crosshair)
  ctx.save()
  ctx.lineWidth = 3
  ctx.strokeStyle = '#000000'
  ctx.beginPath()
  ctx.moveTo(c.px - 9, c.py)
  ctx.lineTo(c.px + 9, c.py)
  ctx.moveTo(c.px, c.py - 9)
  ctx.lineTo(c.px, c.py + 9)
  ctx.stroke()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = AIM
  ctx.stroke()
  ctx.restore()
}

export function drawGhost(ctx: CanvasRenderingContext2D, view: View, crosshair: Point, capUnits: number): void {
  ringAt(ctx, view, crosshair, capUnits, true, 0.7)
  const c = toPx(view, crosshair)
  ctx.save()
  ctx.strokeStyle = AIM
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(c.px, c.py, 4, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

export function drawDart(ctx: CanvasRenderingContext2D, view: View, from: Point, to: Point, t: number): void {
  const a = toPx(view, from)
  const b = toPx(view, to)
  const x = a.px + (b.px - a.px) * t
  const y = a.py + (b.py - a.py) * t
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(a.px, a.py)
  ctx.lineTo(b.px, b.py)
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(x, y, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}
```
(Merge the two `constants.ts` imports in `board.ts` into one line if lint complains.)

- [ ] **Step 4: Run, expect PASS.** `npx vitest run src/render && npm run typecheck && npm run lint`
Canvas drawing itself is checked by the Playwright screenshots in Tasks 15 and 16.

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(render): view maths, board and aim overlays"`

---

### Task 12: Aim session (clock, lockouts, pause)

**Files:**
- Create: `src/ui/session.ts`
- Test: `src/ui/session.test.ts` (add `src/**/*.test.ts` already matches)

**Interfaces:**
- Consumes: `TICK_MS`, `releaseTickFor`, `Point`, `ThrowInput`.
- Produces:
```ts
export const RETARGET_LOCK_MS = 200
export const THROW_LOCK_MS = 600
export type Phase = 'aiming' | 'cooldown'
export class AimSession {
  target: Point
  throwIndex: number          // index of the dart being aimed (0-based)
  phase: Phase
  constructor(target: Point, nowMs: number)
  tick(nowMs: number): number                         // ticks since the wobble started, never negative
  retarget(nowMs: number, target: Point): boolean     // restarts the wobble, locks release for 200ms; false when not aiming
  release(eventMs: number, leadMs: number): ThrowInput | null
  advance(nowMs: number): boolean                     // true when the next dart has just begun
  pause(): void
  resume(nowMs: number): void
}
```
Times are DOM high-resolution milliseconds (`event.timeStamp`, `performance.now()`); the class never reads a clock itself.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { AimSession, RETARGET_LOCK_MS, THROW_LOCK_MS } from './session.ts'

const T20 = { x: 0, y: 1030 }

describe('AimSession', () => {
  it('counts 8ms ticks from the start of the aim', () => {
    const s = new AimSession(T20, 1000)
    expect(s.tick(1000)).toBe(0)
    expect(s.tick(1080)).toBe(10)
    expect(s.tick(900)).toBe(0)
  })
  it('releases with raw time, lead-adjusted tick and the current target', () => {
    const s = new AimSession(T20, 1000)
    expect(s.release(1800, 60)).toEqual({ target: T20, releaseTick: 92, rawMs: 800 })
  })
  it('ignores a release right after a re-aim', () => {
    const s = new AimSession(T20, 0)
    s.retarget(1000, { x: 0, y: 0 })
    expect(s.release(1000 + RETARGET_LOCK_MS - 1, 0)).toBeNull()
    expect(s.release(1000 + RETARGET_LOCK_MS, 0)).not.toBeNull()
  })
  it('restarts the wobble on re-aim', () => {
    const s = new AimSession(T20, 0)
    s.retarget(1000, { x: 0, y: 0 })
    expect(s.tick(1000)).toBe(0)
    expect(s.target).toEqual({ x: 0, y: 0 })
  })
  it('is inert after a throw until the lockout ends, then starts the next dart', () => {
    const s = new AimSession(T20, 0)
    s.release(500, 0)
    expect(s.phase).toBe('cooldown')
    expect(s.release(600, 0)).toBeNull()
    expect(s.retarget(600, { x: 0, y: 0 })).toBe(false)
    expect(s.advance(500 + THROW_LOCK_MS - 1)).toBe(false)
    expect(s.advance(500 + THROW_LOCK_MS)).toBe(true)
    expect(s.phase).toBe('aiming')
    expect(s.throwIndex).toBe(1)
    expect(s.tick(500 + THROW_LOCK_MS)).toBe(0)
  })
  it('cannot release while paused and restarts the wobble on resume', () => {
    const s = new AimSession(T20, 0)
    s.pause()
    expect(s.release(900, 0)).toBeNull()
    s.resume(5000)
    expect(s.tick(5000)).toBe(0)
    expect(s.release(5400, 0)).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run, expect FAIL.** `npx vitest run src/ui/session.test.ts`

- [ ] **Step 3: Implement** (`src/ui/session.ts`)

```ts
import { TICK_MS } from '../core/constants.ts'
import { releaseTickFor } from '../core/throw.ts'
import type { Point, ThrowInput } from '../core/types.ts'

export const RETARGET_LOCK_MS = 200
export const THROW_LOCK_MS = 600
export type Phase = 'aiming' | 'cooldown'

export class AimSession {
  target: Point
  throwIndex = 0
  phase: Phase = 'aiming'
  private aimStartMs: number
  private lockedUntilMs = 0
  private cooldownUntilMs = 0
  private paused = false

  constructor(target: Point, nowMs: number) {
    this.target = target
    this.aimStartMs = nowMs
  }

  tick(nowMs: number): number {
    return Math.max(0, Math.floor((nowMs - this.aimStartMs) / TICK_MS))
  }

  retarget(nowMs: number, target: Point): boolean {
    if (this.phase !== 'aiming') return false
    this.target = target
    this.aimStartMs = nowMs
    this.lockedUntilMs = nowMs + RETARGET_LOCK_MS
    return true
  }

  release(eventMs: number, leadMs: number): ThrowInput | null {
    if (this.paused || this.phase !== 'aiming' || eventMs < this.lockedUntilMs) return null
    const rawMs = Math.max(0, Math.floor(eventMs - this.aimStartMs))
    this.phase = 'cooldown'
    this.cooldownUntilMs = eventMs + THROW_LOCK_MS
    return { target: this.target, releaseTick: releaseTickFor(rawMs, leadMs), rawMs }
  }

  advance(nowMs: number): boolean {
    if (this.phase === 'cooldown' && !this.paused && nowMs >= this.cooldownUntilMs) {
      this.phase = 'aiming'
      this.throwIndex += 1
      this.aimStartMs = nowMs
      return true
    }
    return false
  }

  pause(): void {
    this.paused = true
  }

  resume(nowMs: number): void {
    this.paused = false
    if (this.phase === 'aiming') this.aimStartMs = nowMs
    else this.cooldownUntilMs = Math.max(this.cooldownUntilMs, nowMs)
  }
}
```

- [ ] **Step 4: Run, expect PASS.** `npx vitest run src/ui/session.test.ts`

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(ui): aim session with lockouts and pause"`

---

### Task 13: `ThrowStage` (canvas, release pad), local store and styles

**Files:**
- Create: `src/ui/store.ts`, `src/ui/styles.css`, `src/ui/ThrowStage.tsx`
- Test: `src/ui/store.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 5, 6, 11, 12.
- Produces:
```ts
// store.ts (all reads and writes are try/catch-safe; storage can be unavailable)
export function loadLead(storage?: Storage): number | null
export function saveLead(ms: number, storage?: Storage): void
export function loadJson<T>(key: string, fallback: T, storage?: Storage): T
export function saveJson(key: string, value: unknown, storage?: Storage): boolean   // false when it could not save
// ThrowStage.tsx
export interface ThrowEvent { index: number; input: ThrowInput; ctx: ThrowCtx; result: ThrowResult }
export interface ThrowStageProps {
  settings: Settings
  seed: number
  initialTarget: Point
  fixedTarget?: boolean                       // drills: board taps do nothing
  hud?: ComponentChildren                     // drawn over the top of the board
  boardFlex?: number                          // default 6
  padFlex?: number                            // default 4
  onThrow: (e: ThrowEvent) => void            // called when the dart lands (about 450ms after release)
}
export function ThrowStage(props: ThrowStageProps): JSX.Element
```
Test ids: `board` (canvas), `release-pad`, `whole-board`.

- [ ] **Step 1: Write the failing store test**

```ts
import { describe, it, expect } from 'vitest'
import { loadJson, loadLead, saveJson, saveLead } from './store.ts'

function memory(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  }
}
const broken: Storage = new Proxy({} as Storage, { get() { throw new Error('blocked') } })

describe('store', () => {
  it('saves and loads the release lead', () => {
    const s = memory()
    expect(loadLead(s)).toBeNull()
    saveLead(44, s)
    expect(loadLead(s)).toBe(44)
  })
  it('round-trips JSON and falls back on bad data', () => {
    const s = memory()
    expect(saveJson('k', { a: 1 }, s)).toBe(true)
    expect(loadJson('k', null, s)).toEqual({ a: 1 })
    s.setItem('bad', '{nope')
    expect(loadJson('bad', 'fallback', s)).toBe('fallback')
  })
  it('never throws when storage is blocked', () => {
    expect(loadLead(broken)).toBeNull()
    expect(() => saveLead(10, broken)).not.toThrow()
    expect(saveJson('k', 1, broken)).toBe(false)
    expect(loadJson('k', 5, broken)).toBe(5)
  })
})
```

- [ ] **Step 2: Run, expect FAIL.** `npx vitest run src/ui/store.test.ts`

- [ ] **Step 3: Implement `store.ts`**

```ts
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
```
(With the `broken` Proxy, `storage ?? defaultStorage()` keeps the Proxy and every access throws inside the `try`, which the code catches.)

- [ ] **Step 4: Write `styles.css`**

```css
:root { color-scheme: dark; --bg: #0b0d10; --panel: #14171c; --text: #e8e8e8; --muted: #9aa3ad; --accent: #ffd400; }
* { box-sizing: border-box; }
html, body, #app { margin: 0; height: 100%; background: var(--bg); color: var(--text); font-family: system-ui, sans-serif; }
body { overscroll-behavior: none; -webkit-tap-highlight-color: transparent; }
button { font: inherit; color: inherit; }

.stage { display: flex; flex-direction: column; height: 100%; touch-action: manipulation; user-select: none; -webkit-user-select: none; }
.board-wrap { position: relative; min-height: 0; }
.board-wrap canvas { width: 100%; height: 100%; display: block; touch-action: manipulation; }
.hud { position: absolute; top: 0; left: 0; right: 0; min-height: 48px; padding: 6px 12px; display: flex; gap: 16px; align-items: center; background: rgba(11, 13, 16, 0.6); font-variant-numeric: tabular-nums; pointer-events: none; }
.hud strong { font-size: 1.3rem; }
.chip { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); padding: 6px 14px; border-radius: 999px; background: rgba(0, 0, 0, 0.75); border: 1px solid var(--accent); font-weight: 700; pointer-events: none; }
.whole-board { position: absolute; right: 8px; bottom: 8px; min-width: 44px; min-height: 44px; padding: 0 12px; border-radius: 22px; border: 1px solid #444; background: rgba(20, 23, 28, 0.85); }
.gap { flex: 0 0 12px; }
.pad { min-height: 0; display: flex; align-items: center; justify-content: center; margin: 0 8px; border-radius: 16px; background: #1c2128; border: 2px solid var(--accent); font-size: 1.2rem; font-weight: 700; letter-spacing: 0.08em; padding-bottom: env(safe-area-inset-bottom); }
.pad:active { background: #2a323c; }

.page { padding: 12px 16px 32px; max-width: 560px; margin: 0 auto; }
.lab-stage { position: sticky; top: 0; z-index: 2; height: 60dvh; background: var(--bg); }
.slider-row { display: grid; grid-template-columns: 1fr auto; gap: 4px 8px; align-items: center; min-height: 56px; padding: 6px 0; border-bottom: 1px solid #222; }
.slider-row .lbl { grid-column: 1; text-align: left; background: none; border: 0; padding: 4px 0; font-weight: 600; }
.slider-row output { grid-column: 2; font-variant-numeric: tabular-nums; color: var(--accent); font-size: 1.1rem; }
.slider-row .control { grid-column: 1 / -1; display: flex; gap: 8px; align-items: center; }
.slider-row input[type='range'] { flex: 1; height: 32px; }
.step { width: 44px; height: 44px; border-radius: 8px; border: 1px solid #444; background: var(--panel); font-size: 1.3rem; }
.btn { min-height: 48px; padding: 0 18px; border-radius: 10px; border: 1px solid #555; background: var(--panel); font-weight: 600; }
.btn.primary { background: var(--accent); color: #000; border-color: var(--accent); }
.overlay { position: fixed; inset: 0; z-index: 10; display: flex; flex-direction: column; gap: 12px; align-items: center; justify-content: center; padding: 24px; background: rgba(0, 0, 0, 0.88); text-align: center; }
.row { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.report { background: var(--panel); border-radius: 12px; padding: 12px; margin: 12px 0; }
.muted { color: var(--muted); }
```

- [ ] **Step 5: Implement `ThrowStage.tsx`**

```tsx
import { useEffect, useRef, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { bedLabel, targetFromTap } from '../core/board.ts'
import { resolveThrow, crosshairAt } from '../core/throw.ts'
import type { Point, Settings, ThrowCtx, ThrowInput, ThrowResult } from '../core/types.ts'
import { drawBoard } from '../render/board.ts'
import { drawAim, drawDart, drawGhost, drawTargetMarker } from '../render/overlay.ts'
import { makeView, toBoard } from '../render/view.ts'
import { AimSession } from './session.ts'

export interface ThrowEvent { index: number; input: ThrowInput; ctx: ThrowCtx; result: ThrowResult }
export interface ThrowStageProps {
  settings: Settings
  seed: number
  initialTarget: Point
  fixedTarget?: boolean
  hud?: ComponentChildren
  boardFlex?: number
  padFlex?: number
  onThrow: (e: ThrowEvent) => void
}

interface Landed { event: ThrowEvent; releasedAt: number; reported: boolean }

const GHOST_MS = 300
const FLY_MS = 150

export function ThrowStage(props: ThrowStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sessionRef = useRef<AimSession | null>(null)
  const landedRef = useRef<Landed | null>(null)
  const wholeRef = useRef(false)
  const propsRef = useRef(props)
  propsRef.current = props
  const [chip, setChip] = useState<string | null>(null)
  const [whole, setWhole] = useState(false)
  wholeRef.current = whole

  if (sessionRef.current === null) sessionRef.current = new AimSession(props.initialTarget, performance.now())

  const viewFor = (w: number, h: number) => {
    const s = sessionRef.current!
    return wholeRef.current ? makeView(w, h, { x: 0, y: 0 }, 100) : makeView(w, h, s.target, propsRef.current.settings.zoomPct)
  }

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx2d = canvas.getContext('2d')!
    let raf = 0
    let chipTimer = 0

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(r.width * dpr)
      canvas.height = Math.round(r.height * dpr)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    const frame = (now: number) => {
      const session = sessionRef.current!
      const p = propsRef.current
      const rect = canvas.getBoundingClientRect()
      const dpr = canvas.width / Math.max(1, rect.width)
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
      session.advance(now)
      const view = viewFor(rect.width, rect.height)
      const capUnits = p.settings.scatterCap * 8
      drawBoard(ctx2d, view)
      drawTargetMarker(ctx2d, view, session.target)
      const landed = landedRef.current
      if (session.phase === 'aiming' || landed === null) {
        const ctx: ThrowCtx = { seed: p.seed, throwIndex: session.throwIndex, settings: p.settings, target: session.target }
        drawAim(ctx2d, view, crosshairAt(ctx, session.tick(now)), capUnits)
      } else {
        const dt = now - landed.releasedAt
        const r = landed.event.result
        drawGhost(ctx2d, view, r.crosshair, capUnits)
        if (dt >= GHOST_MS) drawDart(ctx2d, view, r.crosshair, r.landing, Math.min(1, (dt - GHOST_MS) / FLY_MS))
        if (!landed.reported && dt >= GHOST_MS + FLY_MS) {
          landed.reported = true
          setChip(`${bedLabel(r.bed)} · ${r.bed.score}`)
          window.clearTimeout(chipTimer)
          chipTimer = window.setTimeout(() => setChip(null), 600)
          p.onThrow(landed.event)
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const onVisibility = () => {
      const s = sessionRef.current!
      if (document.hidden) s.pause()
      else s.resume(performance.now())
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(chipTimer)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const onBoardDown = (e: PointerEvent) => {
    if (!e.isPrimary || propsRef.current.fixedTarget) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const view = viewFor(rect.width, rect.height)
    const t = targetFromTap(toBoard(view, e.clientX - rect.left, e.clientY - rect.top))
    if (t && sessionRef.current!.retarget(e.timeStamp, t)) setWhole(false)
  }

  const onPadDown = (e: PointerEvent) => {
    if (!e.isPrimary) return
    const s = sessionRef.current!
    const p = propsRef.current
    const input = s.release(e.timeStamp, p.settings.leadMs)
    if (!input) return
    const ctx: ThrowCtx = { seed: p.seed, throwIndex: s.throwIndex, settings: p.settings, target: input.target }
    const result = resolveThrow(ctx, input.releaseTick)
    landedRef.current = { event: { index: s.throwIndex, input, ctx, result }, releasedAt: e.timeStamp, reported: false }
    navigator.vibrate?.(15)
  }

  return (
    <div class="stage">
      <div class="board-wrap" style={{ flex: props.boardFlex ?? 6 }}>
        <canvas ref={canvasRef} data-testid="board" onPointerDown={onBoardDown} />
        {props.hud !== undefined && <div class="hud">{props.hud}</div>}
        {chip !== null && <div class="chip">{chip}</div>}
        {!props.fixedTarget && (
          <button class="whole-board" data-testid="whole-board" onClick={() => setWhole(true)}>
            Whole board
          </button>
        )}
      </div>
      <div class="gap" />
      <div class="pad" data-testid="release-pad" style={{ flex: props.padFlex ?? 4 }} onPointerDown={onPadDown}>
        TAP TO THROW
      </div>
    </div>
  )
}
```
Notes for the implementer: `window.clearTimeout(0)` is harmless. The `ThrowStage` must be mounted in a parent with a definite height (`height: 100dvh` for the leg screen, `.lab-stage` for the Lab). Import `./styles.css` once from each entry file.

- [ ] **Step 6: Run, expect PASS, commit**

Run: `npx vitest run && npm run lint && npm run typecheck`
Expected: PASS. Fix any strict-null complaints around the `ResizeObserver` and refs without changing behaviour.
```bash
git add -A && git commit -m "feat(ui): ThrowStage with canvas, release pad, safe local store"
```

---

### Task 14: Playwright plumbing and the cross-engine golden test

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/golden.spec.ts`
- Modify: `.github/workflows/ci.yml` (install webkit as well as chromium)

**Interfaces:**
- Produces: projects `mobile-chromium` (390x844, touch) and `mobile-webkit` (iPhone 13, 390x844); a dev server on port 4173; screenshots to `test-results/`.

- [ ] **Step 1: Check the installed Playwright docs** for `defineConfig`, `devices`, `webServer` and project options, then write `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'] } },
  ],
})
```

- [ ] **Step 2: Write the cross-engine golden test** (`tests/e2e/golden.spec.ts`)

```ts
import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'

const golden = JSON.parse(readFileSync(new URL('../golden/replay-v1.json', import.meta.url), 'utf8'))

test('replay gives the same result in this browser engine as in Node', async ({ page }) => {
  await page.goto('/')
  const actual = await page.evaluate(async (log) => {
    const path = '/src/core/replay.ts'
    const mod = await import(/* @vite-ignore */ path)
    return mod.replayRun(log)
  }, golden.log)
  expect(actual).toEqual(golden.expected)
})
```

- [ ] **Step 3: Install browsers, run, expect PASS**

```bash
npx playwright install chromium webkit
npx playwright test tests/e2e/golden.spec.ts
```
Expected: 2 passed (one per project). If WebKit cannot start on Windows, run the WebKit project in CI only and say so in the PR.

- [ ] **Step 4: Update CI to install WebKit**

In `.github/workflows/ci.yml`, change `npx playwright install --with-deps chromium` to `npx playwright install --with-deps chromium webkit`.

- [ ] **Step 5: Commit** `git add -A && git commit -m "test: Playwright mobile projects and cross-engine replay golden"`

---

### Task 15: Throw Lab (`/lab`)

**Files:**
- Create: `src/ui/Slider.tsx`, `src/ui/Calibrate.tsx`, `src/ui/DrillReport.tsx`, `src/ui/Lab.tsx`; modify `src/ui/main-lab.tsx`
- Test: `tests/e2e/smoke-lab.spec.ts`

**Interfaces:**
- Consumes: `ThrowStage`, `store`, settings, `summariseDrill`, `bestLead`, `estimateLead`, `encodeRunCode`, `bedCentre`, `makeBed`.
- Produces: `Calibrate` (reused by Task 16):
```tsx
export function Calibrate(props: { onDone: (leadMs: number) => void; onSkip?: () => void }): JSX.Element
```
Test ids: `lab-slider-<key>`, `start-drill`, `drill-report`, `apply-lead`, `play-leg`, `skip-calibration`.

- [ ] **Step 1: Write the e2e smoke test first** (`tests/e2e/smoke-lab.spec.ts`)

```ts
import { test, expect } from '@playwright/test'

test('lab: tune, throw a drill dart, and screenshot', async ({ page }, info) => {
  await page.goto('/lab')
  await expect(page.getByTestId('board')).toBeVisible()
  const wobble = page.getByTestId('lab-slider-wobbleRadius').locator('input')
  await wobble.fill('30')
  await expect.poll(() => page.url()).toContain('rad=30')
  await page.getByTestId('start-drill').click()
  await page.waitForTimeout(300)
  await page.getByTestId('release-pad').click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `test-results/lab-${info.project.name}.png`, fullPage: false })
})
```

- [ ] **Step 2: Run, expect FAIL** (`npx playwright test tests/e2e/smoke-lab.spec.ts`, no Lab yet).

- [ ] **Step 3: Implement `Slider.tsx`**

```tsx
interface SliderProps {
  id: string
  label: string
  min: number
  max: number
  step: number
  value: number
  reset: number
  display: (v: number) => string
  onChange: (v: number) => void
}

export function Slider(p: SliderProps) {
  const clamp = (v: number) => Math.min(p.max, Math.max(p.min, v))
  return (
    <div class="slider-row" data-testid={`lab-slider-${p.id}`}>
      <button class="lbl" onClick={() => p.onChange(p.reset)} aria-label={`Reset ${p.label}`}>{p.label}</button>
      <output>{p.display(p.value)}</output>
      <div class="control">
        <button class="step" aria-label={`${p.label} down`} onClick={() => p.onChange(clamp(p.value - p.step))}>−</button>
        <input type="range" min={p.min} max={p.max} step={p.step} value={p.value} onInput={(e) => p.onChange(Number((e.target as HTMLInputElement).value))} />
        <button class="step" aria-label={`${p.label} up`} onClick={() => p.onChange(clamp(p.value + p.step))}>+</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement `Calibrate.tsx`** (5 taps, median error becomes the lead)

```tsx
import { useEffect, useRef, useState } from 'preact/hooks'
import { estimateLead } from '../core/lead.ts'

const CYCLE_MS = 1000
const CROSS_MS = 500
const TAPS_NEEDED = 5

export function Calibrate(props: { onDone: (leadMs: number) => void; onSkip?: () => void }) {
  const t0 = useRef(performance.now())
  const errors = useRef<number[]>([])
  const bar = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState(0)

  useEffect(() => {
    let raf = 0
    const frame = (now: number) => {
      const phase = ((now - t0.current) % CYCLE_MS) / CYCLE_MS
      if (bar.current) bar.current.style.transform = `translateX(${phase * 100}%)`
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  const tap = (e: PointerEvent) => {
    const since = e.timeStamp - t0.current - CROSS_MS
    const error = since - Math.round(since / CYCLE_MS) * CYCLE_MS
    errors.current.push(error)
    const n = errors.current.length
    setCount(n)
    if (n >= TAPS_NEEDED) props.onDone(estimateLead(errors.current))
  }

  return (
    <div class="overlay">
      <h2>Quick timing check</h2>
      <p class="muted">Tap the big area exactly when the yellow bar crosses the white line. {count} of {TAPS_NEEDED} taps.</p>
      <div style={{ position: 'relative', width: '80%', height: '16px', background: '#222', borderRadius: '8px', overflow: 'hidden' }}>
        <div ref={bar} style={{ position: 'absolute', left: 0, top: 0, width: '16px', height: '16px', background: '#ffd400', borderRadius: '8px' }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, width: '2px', height: '16px', background: '#fff' }} />
      </div>
      <div class="pad" style={{ width: '90%', height: '35dvh', flex: 'none' }} onPointerDown={tap}>TAP</div>
      {props.onSkip && <button class="btn" data-testid="skip-calibration" onClick={props.onSkip}>Skip</button>}
    </div>
  )
}
```
(The bar travels from 0 to 100% of its container; because the dot is 16px wide it crosses the centre line at about 50%.)

- [ ] **Step 5: Implement `DrillReport.tsx`**

```tsx
import { bedCentre, makeBed } from '../core/board.ts'
import { bestLead } from '../core/lead.ts'
import { summariseDrill } from '../core/drill.ts'
import { UNITS_PER_TREBLE_WIDTH } from '../core/constants.ts'
import type { Settings, ThrowCtx, ThrowInput } from '../core/types.ts'
import type { DrillDart } from '../core/drill.ts'

export interface DrillRecord { dart: DrillDart; ctx: ThrowCtx; input: ThrowInput; rawMs: number }

const VERDICT: Record<string, string> = {
  'not-enough-darts': 'Throw at least 8 darts for a verdict.',
  'too-loose': 'Too loose: very few treble 20s. Try a smaller wobble or a smaller scatter ring.',
  right: 'Right: a good spread of hits and near-misses.',
  'too-easy': 'Too easy: more than 4 in 10 darts are treble 20. Try a bigger wobble.',
}

export function DrillReport(props: { records: DrillRecord[]; settings: Settings; tally: { t20: number; n: number }; shareUrl: string; onApplyLead: (ms: number) => void }) {
  const darts = props.records.map((r) => r.dart)
  const s = summariseDrill(darts)
  const target = bedCentre(makeBed('treble', 20))
  const suggestion = bestLead(props.records.map((r) => r.ctx), props.records.map((r) => r.rawMs), target, props.settings.leadMs)
  const counts = Object.entries(s.counts).map(([k, v]) => `${k} x${v}`).join(', ')
  const tw = (u: number) => (u / UNITS_PER_TREBLE_WIDTH).toFixed(1)

  return (
    <div class="report" data-testid="drill-report">
      <svg viewBox="-300 -1380 600 600" width="100%" role="img" aria-label="Where your darts landed on treble 20">
        <rect x="-161" y="-1070" width="322" height="80" fill="#b3261e" opacity="0.5" />
        {props.records.map((r, i) => (
          <g key={i}>
            <circle cx={r.dart.crosshair.x} cy={-r.dart.crosshair.y} r={props.settings.scatterCap * 8} fill="none" stroke="#ffd400" stroke-width="2" opacity="0.35" />
            <line x1={r.dart.crosshair.x} y1={-r.dart.crosshair.y} x2={r.dart.landing.x} y2={-r.dart.landing.y} stroke="#fff" stroke-width="2" opacity="0.6" />
            <circle cx={r.dart.landing.x} cy={-r.dart.landing.y} r="9" fill="#fff" stroke="#000" stroke-width="2" />
          </g>
        ))}
      </svg>
      <p><strong>{counts}.</strong> Score {s.total}.</p>
      {s.timingShare !== null && (
        <p>{Math.round(s.timingShare * 100)}% of your misses were your timing, {100 - Math.round(s.timingShare * 100)}% were scatter.</p>
      )}
      <p>{VERDICT[s.verdict]}</p>
      {suggestion.usable && (
        <p>
          Group {tw(suggestion.before)} → {tw(suggestion.after)} treble widths with {suggestion.leadMs >= 0 ? '+' : ''}{suggestion.leadMs} ms.{' '}
          <button class="btn primary" data-testid="apply-lead" onClick={() => props.onApplyLead(suggestion.leadMs)}>
            Apply {suggestion.leadMs >= 0 ? '+' : ''}{suggestion.leadMs} ms
          </button>
        </p>
      )}
      <p class="muted">Last {props.tally.n} darts at T20: {props.tally.n === 0 ? 0 : Math.round((props.tally.t20 / props.tally.n) * 100)}% treble 20.</p>
      <button class="btn" onClick={() => navigator.clipboard?.writeText(props.shareUrl)}>Copy link</button>
    </div>
  )
}
```

- [ ] **Step 6: Implement `Lab.tsx` and the entry**

```tsx
import { useEffect, useState } from 'preact/hooks'
import { bedCentre, makeBed } from '../core/board.ts'
import { decodeSettings, DEFAULT_SETTINGS, encodeSettings } from '../core/settings.ts'
import { encodeRunCode } from '../core/replay.ts'
import type { Settings } from '../core/types.ts'
import { Calibrate } from './Calibrate.tsx'
import { DrillReport } from './DrillReport.tsx'
import type { DrillRecord } from './DrillReport.tsx'
import { Slider } from './Slider.tsx'
import { loadJson, loadLead, saveJson, saveLead } from './store.ts'
import { ThrowStage } from './ThrowStage.tsx'

const T20 = bedCentre(makeBed('treble', 20))
const DRILL_DARTS = 10
const TALLY_KEY = 'ts.tally.v1'
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]

type Tally = { t20: boolean }[]

export function Lab() {
  const [settings, setSettings] = useState<Settings>(() => ({ ...decodeSettings(location.hash), leadMs: loadLead() ?? DEFAULT_SETTINGS.leadMs }))
  const [drill, setDrill] = useState<{ id: number; seed: number } | null>(null)
  const [records, setRecords] = useState<DrillRecord[]>([])
  const [done, setDone] = useState(false)
  const [calibrating, setCalibrating] = useState(false)
  const [tally, setTally] = useState<Tally>(() => loadJson<Tally>(TALLY_KEY, []))
  const [freeSeed] = useState(newSeed)

  useEffect(() => {
    const id = window.setTimeout(() => history.replaceState(null, '', encodeSettings(settings)), 300)
    return () => window.clearTimeout(id)
  }, [settings])

  const set = (key: keyof Settings) => (v: number) => {
    setSettings((s) => ({ ...s, [key]: v }))
    if (key === 'leadMs') saveLead(v)
  }

  const startDrill = () => {
    setRecords([])
    setDone(false)
    setDrill({ id: Date.now(), seed: newSeed() })
  }

  const onDrillThrow = (rec: DrillRecord) => {
    setRecords((prev) => {
      const next = [...prev, rec]
      if (next.length === DRILL_DARTS) {
        setDone(true)
        const merged = [...tally, ...next.map((r) => ({ t20: r.dart.bed.ring === 'treble' && r.dart.bed.sector === 20 }))].slice(-30)
        setTally(merged)
        saveJson(TALLY_KEY, merged)
      }
      return next
    })
  }

  const shareUrl =
    location.origin +
    '/lab' +
    encodeSettings(settings) +
    (drill && done ? '&run=' + encodeRunCode({ v: 1, seed: drill.seed, settings, throws: records.map((r) => r.input) }) : '')

  return (
    <div>
      {calibrating && (
        <Calibrate onDone={(ms) => { set('leadMs')(ms); setCalibrating(false) }} onSkip={() => setCalibrating(false)} />
      )}
      <div class="lab-stage">
        <ThrowStage
          key={drill?.id ?? 'free'}
          settings={settings}
          seed={drill?.seed ?? freeSeed}
          initialTarget={T20}
          fixedTarget={drill !== null}
          boardFlex={8}
          padFlex={3}
          hud={drill && !done ? <span>Drill {records.length}/{DRILL_DARTS} at T20</span> : <span>Lab</span>}
          onThrow={(e) => {
            if (drill && !done) onDrillThrow({ dart: { crosshair: e.result.crosshair, landing: e.result.landing, bed: e.result.bed }, ctx: e.ctx, input: e.input, rawMs: e.input.rawMs ?? 0 })
          }}
        />
      </div>
      <div class="page">
        <div class="row">
          <button class="btn primary" data-testid="start-drill" onClick={startDrill}>10 darts at T20</button>
          <button class="btn" onClick={() => setCalibrating(true)}>Timing check</button>
          <a class="btn" data-testid="play-leg" href={'/' + encodeSettings(settings)} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Play a leg with these settings</a>
        </div>
        {done && (
          <DrillReport
            records={records}
            settings={settings}
            tally={{ n: tally.length, t20: tally.filter((t) => t.t20).length }}
            shareUrl={shareUrl}
            onApplyLead={(ms) => set('leadMs')(ms)}
          />
        )}
        <Slider id="wobbleRadius" label="Wobble size" min={10} max={40} step={1} value={settings.wobbleRadius} reset={DEFAULT_SETTINGS.wobbleRadius} display={(v) => `${(v / 10).toFixed(1)} treble widths`} onChange={set('wobbleRadius')} />
        <Slider id="loopMs" label="Wobble speed (time per lap)" min={800} max={2500} step={50} value={settings.loopMs} reset={DEFAULT_SETTINGS.loopMs} display={(v) => `${(v / 1000).toFixed(2)} s`} onChange={set('loopMs')} />
        <Slider id="shape" label="Wobble shape (0 circle, 100 figure-8)" min={0} max={100} step={5} value={settings.shape} reset={DEFAULT_SETTINGS.shape} display={(v) => `${v}`} onChange={set('shape')} />
        <Slider id="scatterCap" label="Scatter ring (hard limit)" min={0} max={20} step={1} value={settings.scatterCap} reset={DEFAULT_SETTINGS.scatterCap} display={(v) => `${(v / 10).toFixed(1)} treble widths`} onChange={set('scatterCap')} />
        <Slider id="leadMs" label="Release lead (this phone only)" min={-150} max={150} step={4} value={settings.leadMs} reset={DEFAULT_SETTINGS.leadMs} display={(v) => `${v} ms`} onChange={set('leadMs')} />
        <Slider id="zoomPct" label="Zoom" min={150} max={350} step={10} value={settings.zoomPct} reset={DEFAULT_SETTINGS.zoomPct} display={(v) => `${(v / 100).toFixed(1)}x`} onChange={set('zoomPct')} />
      </div>
    </div>
  )
}
```
The share link is the settings link plus, after a finished drill, `&run=<run code>` (`decodeSettings` ignores the unknown `run` key). `DrillRecord` therefore carries the throw's `input` (see Step 5 and the `onThrow` call above).

`src/ui/main-lab.tsx`:
```tsx
import { render } from 'preact'
import './styles.css'
import { Lab } from './Lab.tsx'

render(<Lab />, document.getElementById('app')!)
```

- [ ] **Step 7: Run e2e and checks, expect PASS**

Run: `npx playwright test tests/e2e/smoke-lab.spec.ts && npm run check`
Expected: PASS in both projects, with screenshots in `test-results/`. Open the screenshots and confirm the board, sliders and pad are readable at 390x844.

- [ ] **Step 8: Commit** `git add -A && git commit -m "feat(ui): Throw Lab with sliders, drill report, lead apply and timing check"`

---

### Task 16: Leg screen and tester feedback

**Files:**
- Create: `src/ui/feedback.ts`, `src/ui/Leg.tsx`; modify `src/ui/main-leg.tsx`
- Test: `src/ui/feedback.test.ts`, `tests/e2e/smoke-leg.spec.ts`

**Interfaces:**
- Consumes: `ThrowStage`, `Calibrate`, `store`, `applyDart`, `newLeg`, `DEFAULT_PAR`, `encodeRunCode`, `bestLead`.
- Produces:
```ts
// feedback.ts
export interface ResultsPayload { v: 1; build: string; device: string; settings: Settings; legs: LegRecord[]; run: string; warmup: string | null }
export interface LegRecord { darts: number; busts: number; won: boolean; rating: 'mostly' | 'sometimes' | 'rarely' | null }
export function sendResults(url: string | undefined, payload: ResultsPayload, fetchFn?: typeof fetch): Promise<boolean>
export function resultsText(payload: ResultsPayload): string       // the text "Copy my results" puts on the clipboard
```
Test ids: `skip-calibration`, `skip-warmup`, `darts-used`, `remaining`, `rating-mostly`, `rating-sometimes`, `rating-rarely`, `another-leg`, `send-results`, `copy-results`.

- [ ] **Step 1: Write the failing feedback test** (`src/ui/feedback.test.ts`)

```ts
import { describe, it, expect, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../core/settings.ts'
import { resultsText, sendResults } from './feedback.ts'
import type { ResultsPayload } from './feedback.ts'

const payload: ResultsPayload = {
  v: 1, build: 'abc1234', device: 'test-phone', settings: DEFAULT_SETTINGS,
  legs: [{ darts: 31, busts: 1, won: true, rating: 'mostly' }], run: 'RUNCODE', warmup: null,
}

describe('sendResults', () => {
  it('posts JSON and reports success', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 }))
    expect(await sendResults('https://form.example/x', payload, f as unknown as typeof fetch)).toBe(true)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://form.example/x')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toMatchObject({ build: 'abc1234', run: 'RUNCODE' })
  })
  it('reports failure on a non-OK response, a thrown error, or no URL', async () => {
    expect(await sendResults('https://x', payload, (async () => new Response('', { status: 500 })) as unknown as typeof fetch)).toBe(false)
    expect(await sendResults('https://x', payload, (async () => { throw new Error('offline') }) as unknown as typeof fetch)).toBe(false)
    expect(await sendResults(undefined, payload)).toBe(false)
    expect(await sendResults('', payload)).toBe(false)
  })
})

describe('resultsText', () => {
  it('includes the build, the ratings and the run code', () => {
    const t = resultsText(payload)
    expect(t).toContain('abc1234')
    expect(t).toContain('mostly')
    expect(t).toContain('RUNCODE')
  })
})
```

- [ ] **Step 2: Run, expect FAIL.** `npx vitest run src/ui/feedback.test.ts`

- [ ] **Step 3: Implement `feedback.ts`**

```ts
import type { Settings } from '../core/types.ts'

export interface LegRecord { darts: number; busts: number; won: boolean; rating: 'mostly' | 'sometimes' | 'rarely' | null }
export interface ResultsPayload { v: 1; build: string; device: string; settings: Settings; legs: LegRecord[]; run: string; warmup: string | null }

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

export function resultsText(p: ResultsPayload): string {
  const legs = p.legs.map((l, i) => `Leg ${i + 1}: ${l.darts} darts, ${l.busts} busts, ${l.won ? 'won' : 'not finished'}, landed where aimed: ${l.rating ?? 'not rated'}`)
  return [`Tungstrike results (build ${p.build})`, `Device: ${p.device}`, ...legs, `Run code: ${p.run}`, p.warmup ? `Warm-up code: ${p.warmup}` : ''].filter(Boolean).join('\n')
}
```

- [ ] **Step 4: Write the e2e smoke test first** (`tests/e2e/smoke-leg.spec.ts`)

```ts
import { test, expect } from '@playwright/test'

test('leg: aim, throw, darts counter moves, screenshot', async ({ page }, info) => {
  await page.goto('/')
  await page.getByTestId('skip-calibration').click()
  await page.getByTestId('skip-warmup').click()
  await expect(page.getByTestId('board')).toBeVisible()
  await expect(page.getByTestId('remaining')).toHaveText('501')
  await page.getByTestId('board').click({ position: { x: 195, y: 150 } })
  await page.waitForTimeout(300)
  await page.getByTestId('release-pad').click()
  await expect(page.getByTestId('darts-used')).toHaveText('1', { timeout: 3000 })
  await page.screenshot({ path: `test-results/leg-${info.project.name}.png` })
})
```

- [ ] **Step 5: Implement `Leg.tsx`**

Flow: `calibrate` (only when no stored lead; skippable) → `warmup` (10 darts at T20 on its own seed; skippable; ends with an optional "Apply +N ms" panel) → `playing`. While playing, a leg runs from `newLeg()` with `applyDart`; every throw's input is pushed onto the run log in order (the stage's throw index equals the log position because the stage is never remounted while playing). When the leg is won, show an overlay: "Leg won in N darts (par 33)", the question "Did darts land where you aimed?" with three buttons, then "Another leg", "Send my results" and "Copy my results".

```tsx
import { useRef, useState } from 'preact/hooks'
import { bedCentre, makeBed } from '../core/board.ts'
import { DEFAULT_PAR } from '../core/constants.ts'
import { bestLead } from '../core/lead.ts'
import { applyDart, newLeg } from '../core/leg.ts'
import { encodeRunCode } from '../core/replay.ts'
import { decodeSettings, DEFAULT_SETTINGS } from '../core/settings.ts'
import type { RunLog, Settings, ThrowInput } from '../core/types.ts'
import { Calibrate } from './Calibrate.tsx'
import { resultsText, sendResults } from './feedback.ts'
import type { LegRecord, ResultsPayload } from './feedback.ts'
import { loadJson, loadLead, saveJson, saveLead } from './store.ts'
import { ThrowStage } from './ThrowStage.tsx'
import type { ThrowEvent } from './ThrowStage.tsx'

const T20 = bedCentre(makeBed('treble', 20))
const BULL = { x: 0, y: 0 }
const LEGS_KEY = 'ts.legs.v1'
const WARMUP_DARTS = 10
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]
const FEEDBACK_URL = import.meta.env.VITE_FEEDBACK_URL as string | undefined

type Step = 'calibrate' | 'warmup' | 'playing'

export function Leg() {
  const [storedLead] = useState(loadLead)
  const [settings, setSettings] = useState<Settings>(() => ({ ...decodeSettings(location.hash), leadMs: storedLead ?? DEFAULT_SETTINGS.leadMs }))
  const [step, setStep] = useState<Step>(storedLead === null ? 'calibrate' : 'warmup')
  const [warmSeed] = useState(newSeed)
  const [legSeed] = useState(newSeed)
  const warm = useRef<{ inputs: ThrowInput[]; ctxs: ThrowEvent['ctx'][] }>({ inputs: [], ctxs: [] })
  const [warmCount, setWarmCount] = useState(0)
  const [suggest, setSuggest] = useState<ReturnType<typeof bestLead> | null>(null)
  const runInputs = useRef<ThrowInput[]>([])
  const frozen = useRef<Settings>(settings)
  const [leg, setLeg] = useState(newLeg)
  const [legs, setLegs] = useState<LegRecord[]>(() => loadJson<LegRecord[]>(LEGS_KEY, []))
  const [ratingPending, setRatingPending] = useState(false)
  const [sent, setSent] = useState<'idle' | 'ok' | 'failed'>('idle')

  const setLead = (ms: number) => {
    saveLead(ms)
    setSettings((s) => ({ ...s, leadMs: ms }))
  }

  const onWarm = (e: ThrowEvent) => {
    warm.current.inputs.push(e.input)
    warm.current.ctxs.push(e.ctx)
    const n = warm.current.inputs.length
    setWarmCount(n)
    if (n === WARMUP_DARTS) {
      const s = bestLead(warm.current.ctxs, warm.current.inputs.map((i) => i.rawMs ?? 0), T20, settings.leadMs)
      if (s.usable) setSuggest(s)
      else startPlaying()
    }
  }

  const startPlaying = () => {
    frozen.current = settings
    setSuggest(null)
    setStep('playing')
  }

  const onThrow = (e: ThrowEvent) => {
    runInputs.current.push(e.input)
    setLeg((prev) => {
      const next = applyDart(prev, e.result.bed)
      if (next.won) setRatingPending(true)
      return next
    })
  }

  const rate = (rating: LegRecord['rating']) => {
    const record: LegRecord = { darts: leg.dartsTotal, busts: leg.busts, won: true, rating }
    const all = [...legs, record]
    setLegs(all)
    saveJson(LEGS_KEY, all)
    setRatingPending(false)
  }

  const payload = (): ResultsPayload => {
    const run: RunLog = { v: 1, seed: legSeed, settings: frozen.current, throws: runInputs.current }
    const warmLog: RunLog | null = warm.current.inputs.length ? { v: 1, seed: warmSeed, settings, throws: warm.current.inputs } : null
    return { v: 1, build: __BUILD_ID__, device: navigator.userAgent, settings: frozen.current, legs, run: encodeRunCode(run), warmup: warmLog ? encodeRunCode(warmLog) : null }
  }

  const send = async () => setSent((await sendResults(FEEDBACK_URL, payload())) ? 'ok' : 'failed')
  const copy = () => navigator.clipboard?.writeText(resultsText(payload()))
  const another = () => {
    setLeg(newLeg())
    setSent('idle')
  }

  if (step === 'calibrate') {
    return <Calibrate onDone={(ms) => { setLead(ms); setStep('warmup') }} onSkip={() => setStep('warmup')} />
  }

  if (step === 'warmup') {
    return (
      <div style={{ height: '100dvh' }}>
        <ThrowStage
          settings={settings}
          seed={warmSeed}
          initialTarget={T20}
          fixedTarget
          hud={<span>Warm-up {warmCount}/{WARMUP_DARTS} at the treble 20</span>}
          onThrow={onWarm}
        />
        <div style={{ position: 'fixed', top: 8, right: 8 }}>
          <button class="btn" data-testid="skip-warmup" onClick={startPlaying}>Skip warm-up</button>
        </div>
        {suggest && (
          <div class="overlay">
            <p>Your taps run {suggest.leadMs >= 0 ? 'late' : 'early'}. Adjust for this phone?</p>
            <div class="row">
              <button class="btn primary" onClick={() => { setLead(suggest.leadMs); startPlaying() }}>Apply {suggest.leadMs >= 0 ? '+' : ''}{suggest.leadMs} ms</button>
              <button class="btn" onClick={startPlaying}>Keep as is</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ height: '100dvh' }}>
      <ThrowStage
        settings={frozen.current}
        seed={legSeed}
        initialTarget={T20}
        hud={
          <>
            <span><strong data-testid="remaining">{leg.remaining}</strong> left</span>
            <span>Darts <strong data-testid="darts-used">{leg.dartsTotal}</strong></span>
            <span class="muted">Par {DEFAULT_PAR}</span>
            {leg.lastBust && <span style={{ color: '#ff6b6b' }}>BUST</span>}
          </>
        }
        onThrow={onThrow}
      />
      {leg.won && (
        <div class="overlay">
          <h2>Leg won in {leg.dartsTotal} darts</h2>
          <p class="muted">{leg.dartsTotal <= DEFAULT_PAR ? `Under par (${DEFAULT_PAR}).` : `Par is ${DEFAULT_PAR}. Beat it next leg.`}</p>
          {ratingPending ? (
            <>
              <p>Did darts land where you aimed?</p>
              <div class="row">
                <button class="btn" data-testid="rating-mostly" onClick={() => rate('mostly')}>Mostly</button>
                <button class="btn" data-testid="rating-sometimes" onClick={() => rate('sometimes')}>Sometimes</button>
                <button class="btn" data-testid="rating-rarely" onClick={() => rate('rarely')}>Rarely</button>
              </div>
            </>
          ) : (
            <div class="row">
              <button class="btn primary" data-testid="another-leg" onClick={another}>Another leg</button>
              <button class="btn" data-testid="send-results" onClick={send}>Send my results</button>
              <button class="btn" data-testid="copy-results" onClick={copy}>Copy my results</button>
            </div>
          )}
          {sent === 'ok' && <p>Sent. Thank you!</p>}
          {sent === 'failed' && <p>Could not send. Tap "Copy my results" and paste them to Sam.</p>}
        </div>
      )}
    </div>
  )
}
```
Implementer notes: `leg.won` can only be true after the stage reports the landing, so the overlay never hides a dart in flight. Add `/// <reference types="vite/client" />` support for `import.meta.env.VITE_FEEDBACK_URL` through `src/env.d.ts` (`interface ImportMetaEnv { readonly VITE_FEEDBACK_URL?: string }`) if the type check complains. If `localStorage` is unavailable, the leg still plays and the legs list simply isn't kept between visits (that is the designed fallback).

`src/ui/main-leg.tsx`:
```tsx
import { render } from 'preact'
import './styles.css'
import { Leg } from './Leg.tsx'

render(<Leg />, document.getElementById('app')!)
```

- [ ] **Step 6: Run feedback test and e2e, expect PASS**

Run: `npx vitest run src/ui/feedback.test.ts && npx playwright test tests/e2e/smoke-leg.spec.ts && npm run check`
Expected: PASS in both projects, with screenshots. Open them and confirm the HUD, board and pad at 390x844.

- [ ] **Step 7: Commit** `git add -A && git commit -m "feat(ui): solo 501 leg screen, par, rating and tester feedback"`

---

### Task 17: Analysis script for tester run codes

**Files:**
- Create: `scripts/analyse-runs.mjs`
- Test: `scripts/analyse-runs.test.ts`

**Interfaces:**
- Consumes: `decodeRunCode`, `summariseRun`.
- Produces: `export function analyse(text: string): string[]` (one formatted line per non-empty input line; an input line is a run code, or a pasted results message that contains `Run code: <code>`; bad lines give `line N: not a valid run code`). CLI: `node scripts/analyse-runs.mjs results.txt`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/core/settings.ts'
import { encodeRunCode } from '../src/core/replay.ts'
import { analyse } from './analyse-runs.mjs'

const code = encodeRunCode({
  v: 1, seed: 3, settings: DEFAULT_SETTINGS,
  throws: Array.from({ length: 60 }, (_, i) => ({ target: { x: 0, y: 0 }, releaseTick: i % 100 })),
})

describe('analyse', () => {
  it('summarises a plain run code', () => {
    const [line] = analyse(code)
    expect(line).toContain('throws 60')
    expect(line).toContain('legs started')
  })
  it('finds the run code inside a pasted results message', () => {
    const [line] = analyse(`Tungstrike results\nDevice: x\nRun code: ${code}\n`)
    expect(line).toContain('throws 60')
  })
  it('flags junk without stopping', () => {
    const lines = analyse(`nonsense\n${code}`)
    expect(lines[0]).toContain('not a valid run code')
    expect(lines[1]).toContain('throws 60')
  })
})
```

- [ ] **Step 2: Run, expect FAIL.** `npx vitest run scripts/analyse-runs.test.ts`

- [ ] **Step 3: Implement**

```js
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { summariseRun } from '../src/core/analysis.ts'
import { decodeRunCode } from '../src/core/replay.ts'

export function analyse(text) {
  const out = []
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  lines.forEach((raw, i) => {
    if (/^(Tungstrike results|Device:|Leg \d+:|Warm-up code:)/.test(raw)) return
    const code = raw.replace(/^Run code:\s*/, '')
    try {
      const s = summariseRun(decodeRunCode(code))
      out.push(
        `run ${out.length + 1}: throws ${s.throws}, legs started ${s.legsStarted}, won ${s.legsWon}, ` +
          `darts per won leg ${s.dartsPerWonLeg === null ? 'n/a' : s.dartsPerWonLeg.toFixed(1)}, busts ${s.busts}, ` +
          `on-target ${(s.hitRate * 100).toFixed(0)}%, mean miss ${s.meanMissTrebleWidths.toFixed(2)} treble widths`,
      )
    } catch {
      out.push(`line ${i + 1}: not a valid run code`)
    }
  })
  return out
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: node scripts/analyse-runs.mjs <file with run codes or pasted results>')
    process.exit(1)
  }
  console.log(analyse(readFileSync(file, 'utf8')).join('\n'))
}
```

- [ ] **Step 4: Run, expect PASS.** `npx vitest run scripts/analyse-runs.test.ts && npm run check`

- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: script to replay and summarise tester run codes"`

---

### Task 18: Review, mobile check, PR

**Files:** none new. Updates `docs/handover.md` and the M0 issue checklist.

- [ ] **Step 1: Full verification**

Run: `npm run check && npm run build && npx playwright test`
Expected: all pass, in both mobile projects. Keep the screenshots from `test-results/`.

- [ ] **Step 2: Mobile playtester**

Dispatch the `mobile-playtester` agent on `/` and `/lab` at 390x844. It must report tap-target sizes (release pad, "Whole board" chip, sliders), one-thumb reach, and whether the ghost, dart and chip are readable. Fix its fails.

- [ ] **Step 3: Code review**

Use `superpowers:requesting-code-review` on the branch diff. Fix what it finds. In particular check: nothing in `src/core/` reads a clock or trig; the run-log format matches the spec; no `.env*` is committed.

- [ ] **Step 4: Handover**

Run `/handover`. It updates `docs/handover.md` (status M0 built, waiting on Sam: tune and freeze settings, form account, Vercel link, testers) and ticks the M0 checklist items in issue #1 with `gh issue edit`.

- [ ] **Step 5: Open the PR** with `superpowers:finishing-a-development-branch`

PR body: what changed in plain English, the mobile screenshots, the Vercel preview link (read it from `gh pr checks`), what Sam must do (tune in `/lab`, tap "Play a leg with these settings", copy the link), and what is not verified (real-phone latency, Vercel preview protection). End with the attribution line from the repo's conventions. **Stop: Sam merges.**

- [ ] **Step 6: After Sam merges (release-manager)**

Create the long-lived `gate1` branch from `main` and push it (a branch, never `main`). Read the Vercel preview URL for it. Check on a phone that is not signed in to Vercel that the page opens without a login wall; if it does not, tell Sam to create the shareable link. Then run `/playtest-pack`, with the settings Sam froze in the link.

---

## Self-review (against the spec)

| Spec requirement | Task |
|---|---|
| Sticky target, tap bed snaps to centre, crosshair wobble, release pad | 5, 6, 12, 13 |
| Layout 60/40, dead gap, safe-area, "Whole board" chip | 13 (CSS and component) |
| Re-aim lockout 200ms; pad inert after a throw; primary pointer only; `pointerdown` | 12, 13 |
| Bounded scatter weighted to centre; ring is a hard bound | 6 |
| Ghost, dart flight, result chip, vibrate | 11, 13 |
| 8ms tick, `releaseTick` formula, clock freezes on `visibilitychange` | 12, 13 |
| No trig in core, sine table with checksum, integer cross-products, fixed draw count | 3, 5, 6, 10 |
| Per-throw `hash(seed, index)` draws | 4, 6 |
| Run log v1 and run codes | 2, 8 |
| Settings, ranges, URL format, lead not in the link, clamp on read | 2, 15 |
| Lab: pinned board, big sliders, drill report, share link, apply measured lead, timing check, "Play a leg" button | 9, 15 |
| Leg screen: frozen settings, par, rating after each leg, warm-up with lead apply | 16 |
| Send results (form service) with "Copy my results" fallback; localStorage fallback | 13, 16 |
| Replay-analysis script | 9, 17 |
| Guard (core purity + banned terms), `npm run check`, CI | 1, 10, 14 |
| Playwright mobile smoke and cross-engine golden test | 14, 15, 16 |
| Mobile screenshots, `mobile-playtester`, review, PR, `gate1` branch | 18 |
| Simulator deferred to M1, no AI opponent | (intentionally absent) |

Type names used across tasks: `Point`, `Bed`, `Ring`, `Settings`, `ThrowInput`, `ThrowCtx`, `ThrowResult`, `RunLog` (Task 2); `ThrowEvent`, `ThrowStageProps` (Task 13); `DrillRecord` (Task 15); `LegRecord`, `ResultsPayload` (Task 16). The function names `bedAt`, `bedCentre`, `makeBed`, `bedLabel`, `targetFromTap`, `crosshairAt`, `scatterFor`, `resolveThrow`, `releaseTickFor`, `applyDart`, `newLeg`, `replayRun`, `encodeRunCode`, `decodeRunCode`, `summariseDrill`, `bestLead`, `estimateLead`, `summariseRun`, `scanRoot`, `analyse` are used with the same signatures in every task that calls them.

Known judgement calls for the implementer to flag, not silently change: the post-throw lockout is 600ms (the spec said about 400ms; 600ms lets the dart land before the next wobble starts); the default zoom is 200 as in the spec, but at 390px wide a treble is only about 17px tall, so Sam may well raise it in the Lab.
