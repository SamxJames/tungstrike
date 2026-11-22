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

export function DrillReport(props: {
  records: DrillRecord[]
  /** The settings in force during the drill (not the live sliders). */
  settings: Settings
  tally: { t20: number; n: number }
  onShare: () => void
  shareNote: string | null
  onApplyLead: (ms: number) => void
}) {
  const darts = props.records.map((r) => r.dart)
  const s = summariseDrill(darts)
  const target = bedCentre(makeBed('treble', 20))
  const suggestion = bestLead(
    props.records.map((r) => r.ctx),
    props.records.map((r) => r.rawMs),
    target,
    props.settings.leadMs,
  )
  const counts = Object.entries(s.counts).map(([k, v]) => `${k} x${v}`).join(', ')
  const tw = (u: number) => (u / UNITS_PER_TREBLE_WIDTH).toFixed(1)
  const sign = suggestion.leadMs >= 0 ? '+' : ''
  const ring = props.settings.scatterCap * 8

  // Fit every aim circle (crosshair + scatter ring) around T20, with a sensible minimum window.
  let xHalf = 250
  let yHalf = 150
  for (const d of darts) {
    xHalf = Math.max(xHalf, Math.abs(d.crosshair.x - target.x) + ring + 20)
    yHalf = Math.max(yHalf, Math.abs(d.crosshair.y - target.y) + ring + 20)
  }
  const viewBox = `${target.x - xHalf} ${-target.y - yHalf} ${2 * xHalf} ${2 * yHalf}`

  return (
    <div class="report" data-testid="drill-report">
      <svg viewBox={viewBox} width="100%" role="img" aria-label="Where your darts landed on treble 20">
        <rect x={target.x - 161} y={-target.y - 40} width="322" height="80" fill="#b3261e" opacity="0.5" />
        {props.records.map((r, i) => (
          <g key={i}>
            <circle cx={r.dart.crosshair.x} cy={-r.dart.crosshair.y} r={ring} fill="none" stroke="#ffd400" stroke-width="2" opacity="0.35" />
            <line x1={r.dart.crosshair.x} y1={-r.dart.crosshair.y} x2={r.dart.landing.x} y2={-r.dart.landing.y} stroke="#fff" stroke-width="2" opacity="0.6" />
            <circle cx={r.dart.landing.x} cy={-r.dart.landing.y} r="9" fill="#fff" stroke="#000" stroke-width="2" />
          </g>
        ))}
      </svg>
      <p>
        <strong>{counts}.</strong> Score {s.total}.
      </p>
      {s.timingShare !== null && (
        <p>
          {Math.round(s.timingShare * 100)}% of your misses were your timing, {100 - Math.round(s.timingShare * 100)}% were scatter.
        </p>
      )}
      <p>{VERDICT[s.verdict]}</p>
      <p>
        {suggestion.usable && (
          <span>
            Group {tw(suggestion.before)} → {tw(suggestion.after)} treble widths with {sign}
            {suggestion.leadMs} ms.{' '}
          </span>
        )}
        <button class="btn primary" data-testid="apply-lead" disabled={!suggestion.usable} onClick={() => props.onApplyLead(suggestion.leadMs)}>
          {suggestion.usable ? `Apply ${sign}${suggestion.leadMs} ms` : 'Apply lead'}
        </button>
        {!suggestion.usable && (
          <span class="muted" data-testid="apply-lead-reason">
            {' '}
            Not enough gain yet: a different lead would not tighten this group by 10%.
          </span>
        )}
      </p>
      <p class="muted">
        Last {props.tally.n} darts at T20: {props.tally.n === 0 ? 0 : Math.round((props.tally.t20 / props.tally.n) * 100)}% treble 20.
      </p>
      <button class="btn" data-testid="report-share" onClick={props.onShare}>
        Share link
      </button>
      {props.shareNote !== null && <span class="muted" role="status"> {props.shareNote}</span>}
    </div>
  )
}
