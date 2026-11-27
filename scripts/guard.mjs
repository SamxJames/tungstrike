import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const TRIG = [/\bMath\.(sin|cos|tan|atan2)\b/, 'trig is banned in src/core (use the committed tables)']
const CORE_BANNED = [
  [/\bMath\.random\b/, 'Math.random is banned in src/core (use the seeded draws)'],
  [/\bDate\.now\b/, 'Date.now is banned in src/core (core never sees a clock)'],
  [/\bperformance\.now\b/, 'performance.now is banned in src/core'],
  [/\bnew Date\(/, 'new Date is banned in src/core'],
  TRIG,
]
// The generated sine table is built with trig at generation time; only the trig rule is lifted, only for that file.
const TRIG_EXEMPT = 'src/core/tables/generated.ts'
const CODE_EXT = /\.(ts|tsx|mts|js|mjs)$/
const TEXT_EXT = /\.(html|css|js|mjs|ts|tsx|json|svg|txt|md|webmanifest)$/

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
    const isCore = rel.startsWith('src/core/') && CODE_EXT.test(rel)
    if (!isCore && !TEXT_EXT.test(rel)) continue
    const rules = isCore ? CORE_BANNED.filter((r) => !(r === TRIG && rel === TRIG_EXEMPT)) : []
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      for (const [re, why] of rules) if (re.test(line)) problems.push(`${rel}:${i + 1}: ${why}`)
      for (const [re, why] of TERM_RES) if (re.test(line)) problems.push(`${rel}:${i + 1}: ${why}`)
    })
  }
  return problems
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Optional root argument (used by the tests); defaults to this repository.
  const root = process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url))
  const problems = scanRoot(root)
  if (problems.length) {
    console.error(problems.join('\n'))
    console.error(`guard: ${problems.length} problem(s)`)
    process.exitCode = 1
  } else {
    console.log('guard: ok')
  }
}
