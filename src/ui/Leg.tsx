import { useRef, useState } from 'preact/hooks'
import { bedCentre, makeBed } from '../core/board.ts'
import { DEFAULT_PAR } from '../core/constants.ts'
import { bestLead } from '../core/lead.ts'
import type { LeadSuggestion } from '../core/lead.ts'
import { applyDart, newLeg } from '../core/leg.ts'
import type { LegState } from '../core/leg.ts'
import { encodeRunCode } from '../core/replay.ts'
import { decodeSettings, DEFAULT_SETTINGS } from '../core/settings.ts'
import type { RunLog, Settings, ThrowInput } from '../core/types.ts'
import { snapLead } from './calibrate-math.ts'
import { Calibrate } from './Calibrate.tsx'
import { resultsText, sendResults } from './feedback.ts'
import type { LegRecord, ResultsPayload } from './feedback.ts'
import { loadJson, loadLead, saveJson, saveLead } from './store.ts'
import { ThrowStage } from './ThrowStage.tsx'
import type { ThrowEvent } from './ThrowStage.tsx'

const T20 = bedCentre(makeBed('treble', 20))
const LEGS_KEY = 'ts.legs.v1'
const WARMUP_DARTS = 10
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]
const FEEDBACK_URL = import.meta.env.VITE_FEEDBACK_URL

type Step = 'calibrate' | 'warmup' | 'playing'
type Rating = NonNullable<LegRecord['rating']>

interface WarmRun { inputs: ThrowInput[]; ctxs: ThrowEvent['ctx'][]; settings: Settings | null }

export function Leg() {
  const [storedLead] = useState(loadLead)
  const [settings, setSettings] = useState<Settings>(() => ({ ...decodeSettings(location.hash), leadMs: storedLead ?? DEFAULT_SETTINGS.leadMs }))
  const [step, setStep] = useState<Step>(storedLead === null ? 'calibrate' : 'warmup')
  // The settings the leg is played with: frozen when play starts, so the run log always matches what the player felt.
  const [played, setPlayed] = useState<Settings | null>(null)
  const [warmSeed] = useState(newSeed)
  const [legSeed] = useState(newSeed)
  const warm = useRef<WarmRun>({ inputs: [], ctxs: [], settings: null })
  const [warmCount, setWarmCount] = useState(0)
  const [suggest, setSuggest] = useState<LeadSuggestion | null>(null)
  // Every dart thrown while playing, across legs, in order. The stage is never remounted while playing, so
  // the stage's throw index is the position in this list and the log replays from the seed.
  const runInputs = useRef<ThrowInput[]>([])
  // The leg lives in a ref so the next state is computed outside any state updater.
  const legRef = useRef<LegState>(newLeg())
  const [leg, setLeg] = useState<LegState>(legRef.current)
  const [legs, setLegs] = useState<LegRecord[]>(() => {
    const stored = loadJson<unknown>(LEGS_KEY, [])
    return Array.isArray(stored) ? (stored as LegRecord[]) : []
  })
  const [ratingPending, setRatingPending] = useState(false)
  const awaitingRating = useRef(false)
  const [sent, setSent] = useState<'idle' | 'sending' | 'ok' | 'failed'>('idle')
  const [copied, setCopied] = useState<'idle' | 'ok' | 'failed'>('idle')

  const setLead = (ms: number) => {
    saveLead(ms)
    setSettings((s) => ({ ...s, leadMs: ms }))
  }

  const startPlaying = (withSettings: Settings) => {
    setPlayed(withSettings)
    setSuggest(null)
    setStep('playing')
  }

  const onWarm = (e: ThrowEvent) => {
    const w = warm.current
    if (w.settings === null) w.settings = settings
    w.inputs.push(e.input)
    w.ctxs.push(e.ctx)
    const n = w.inputs.length
    setWarmCount(n)
    if (n === WARMUP_DARTS) {
      const s = bestLead(w.ctxs, w.inputs.map((i) => i.rawMs ?? 0), T20, settings.leadMs)
      if (s.usable) setSuggest(s)
      else startPlaying(settings)
    }
  }

  const applySuggestion = (s: LeadSuggestion) => {
    const ms = snapLead(s.leadMs)
    setLead(ms)
    startPlaying({ ...settings, leadMs: ms })
  }

  const onThrow = (e: ThrowEvent) => {
    runInputs.current.push(e.input)
    const before = legRef.current
    const next = applyDart(before, e.result.bed)
    legRef.current = next
    setLeg(next)
    if (next.won && !before.won) {
      awaitingRating.current = true
      setRatingPending(true)
    }
  }

  const rate = (rating: Rating) => {
    if (!awaitingRating.current) return // one rating per won leg, however fast the taps come
    awaitingRating.current = false
    const finished = legRef.current
    const all = [...legs, { darts: finished.dartsTotal, busts: finished.busts, won: true, rating }]
    setLegs(all)
    saveJson(LEGS_KEY, all)
    setRatingPending(false)
  }

  const payload = (): ResultsPayload => {
    const frozen = played ?? settings
    const run: RunLog = { v: 1, seed: legSeed, settings: frozen, throws: runInputs.current }
    const w = warm.current
    const warmLog: RunLog | null = w.inputs.length ? { v: 1, seed: warmSeed, settings: w.settings ?? settings, throws: w.inputs } : null
    return { v: 1, build: __BUILD_ID__, device: navigator.userAgent, settings: frozen, legs, run: encodeRunCode(run), warmup: warmLog ? encodeRunCode(warmLog) : null }
  }

  const send = async () => {
    setSent('sending')
    setSent((await sendResults(FEEDBACK_URL, payload())) ? 'ok' : 'failed')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(resultsText(payload()))
      setCopied('ok')
    } catch {
      setCopied('failed')
    }
  }

  const another = () => {
    legRef.current = newLeg()
    setLeg(legRef.current)
    setSent('idle')
    setCopied('idle')
  }

  if (step === 'calibrate') {
    return (
      <Calibrate
        onDone={(ms) => {
          setLead(snapLead(ms))
          setStep('warmup')
        }}
        onSkip={() => setStep('warmup')}
      />
    )
  }

  if (step === 'warmup') {
    return (
      <div style={{ height: '100dvh' }}>
        <ThrowStage
          key="warmup"
          settings={settings}
          seed={warmSeed}
          initialTarget={T20}
          fixedTarget
          hud={
            <>
              <span>Warm-up <strong>{warmCount}</strong>/{WARMUP_DARTS}</span>
              <span class="muted">Aim for the treble 20</span>
            </>
          }
          onThrow={onWarm}
        />
        <div class="hud-skip">
          <button class="btn" data-testid="skip-warmup" onClick={() => startPlaying(settings)}>Skip</button>
        </div>
        {suggest && (
          <div class="overlay">
            <p>Your taps run {suggest.leadMs >= 0 ? 'late' : 'early'}. Adjust for this phone?</p>
            <div class="row">
              <button class="btn primary" data-testid="apply-lead" onClick={() => applySuggestion(suggest)}>Apply {suggest.leadMs >= 0 ? '+' : ''}{snapLead(suggest.leadMs)} ms</button>
              <button class="btn" data-testid="keep-lead" onClick={() => startPlaying(settings)}>Keep as is</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ height: '100dvh' }}>
      <ThrowStage
        key="leg"
        settings={played ?? settings}
        seed={legSeed}
        initialTarget={T20}
        hud={
          <>
            <span><strong data-testid="remaining">{leg.remaining}</strong> left</span>
            <span>Darts <strong data-testid="darts-used">{leg.dartsTotal}</strong></span>
            <span class="muted">Par {DEFAULT_PAR}</span>
            {leg.lastBust && <span style={{ color: '#ff6b6b', fontWeight: 700 }}>BUST</span>}
          </>
        }
        onThrow={onThrow}
      />
      {leg.won && (
        <div class="overlay">
          <h2>Leg won in {leg.dartsTotal} darts</h2>
          <p class="muted">{leg.dartsTotal <= DEFAULT_PAR ? `Par is ${DEFAULT_PAR}. You beat it.` : `Par is ${DEFAULT_PAR}. Beat it next leg.`}</p>
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
              <button class="btn primary wide" data-testid="another-leg" onClick={another}>Another leg</button>
              <button class="btn" data-testid="send-results" disabled={sent === 'sending' || sent === 'ok'} onClick={send}>Send my results</button>
              <button class="btn" data-testid="copy-results" onClick={copy}>Copy my results</button>
            </div>
          )}
          {sent === 'ok' && <p>Sent. Thank you!</p>}
          {sent === 'failed' && <p>Could not send. Tap "Copy my results" and paste them to Sam.</p>}
          {copied === 'ok' && <p>Copied.</p>}
          {copied === 'failed' && (
            <>
              <p>Could not copy. Select this text and copy it by hand.</p>
              <textarea readOnly rows={6} style={{ width: '100%', maxWidth: 420 }} value={resultsText(payload())} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
