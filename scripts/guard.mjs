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
