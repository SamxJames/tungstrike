import { useRef, useState } from 'preact/hooks'
import { bedCentre, makeBed } from '../core/board.ts'
import { DEFAULT_PAR } from '../core/constants.ts'
import { bestLead } from '../core/lead.ts'
import type { LeadSuggestion } from '../core/lead.ts'
import { decodeSettings, DEFAULT_SETTINGS, encodeSettings } from '../core/settings.ts'
import type { Settings, ThrowInput } from '../core/types.ts'
import { leadAdvice, snapLead } from './calibrate-math.ts'
import { Calibrate } from './Calibrate.tsx'
import { buildPayload, parseStoredLegs, resultsText, sendResults } from './feedback.ts'
import type { Rating, ResultsPayload } from './feedback.ts'
import { another as nextLeg, initFlow, onDart, rate as rateLeg } from './legFlow.ts'
import type { LegFlow } from './legFlow.ts'
import { loadJson, loadLead, saveJson, saveLead } from './store.ts'
import { ThrowStage } from './ThrowStage.tsx'
import type { ThrowEvent } from './ThrowStage.tsx'
import { loadUnsentVisits, markSent, saveVisit } from './visits.ts'
import type { VisitRecord } from './visits.ts'

const T20 = bedCentre(makeBed('treble', 20))
const LEGS_KEY = 'ts.legs.v1'
const WARMUP_DARTS = 10
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]
const newVisitId = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('')
const FEEDBACK_URL = import.meta.env.VITE_FEEDBACK_URL
const settingsKey = (s: Settings) => `${encodeSettings(s)};lead=${s.leadMs}`

type Step = 'calibrate' | 'warmup' | 'playing'

interface WarmRun { inputs: ThrowInput[]; ctxs: ThrowEvent['ctx'][]; settings: Settings | null }

export function Leg() {
  const [storedLead] = useState(loadLead)
  const [settings, setSettings] = useState<Settings>(() => ({ ...decodeSettings(location.hash), leadMs: storedLead ?? DEFAULT_SETTINGS.leadMs }))
  const [step, setStep] = useState<Step>(storedLead === null ? 'calibrate' : 'warmup')
  // The settings the leg is played with: frozen when play starts, so the run log always matches what the player felt.
  const [played, setPlayed] = useState<Settings | null>(null)
  const [warmSeed] = useState(newSeed)
  const [legSeed] = useState(newSeed)
  const [visit] = useState(newVisitId)
  const [startedAt] = useState(() => Date.now())
  // Probe once: a private tab (or blocked storage) cannot keep anything, and the results panel says so.
  const [storageOk] = useState(() => saveJson('ts.probe', 1))
  // Earlier visits on this phone whose logs were never sent: they go out with this visit's results.
  const [earlier, setEarlier] = useState<VisitRecord[]>(() => loadUnsentVisits(visit))
  // Set if a dart is ever reported out of order, so a log that cannot replay faithfully is flagged in the results.
  const logGap = useRef(false)
  const warm = useRef<WarmRun>({ inputs: [], ctxs: [], settings: null })
  const [warmCount, setWarmCount] = useState(0)
  const [suggest, setSuggest] = useState<LeadSuggestion | null>(null)
  // Every dart thrown while playing, across legs, in order. The stage is never remounted while playing, so
  // the stage's throw index is the position in this list and the log replays from the seed.
  const runInputs = useRef<ThrowInput[]>([])
  // The play flow lives in a ref and is advanced outside any state updater, then pushed to state.
  const flowRef = useRef<LegFlow | null>(null)
  if (flowRef.current === null) flowRef.current = initFlow(parseStoredLegs(loadJson<unknown>(LEGS_KEY, [])))
  const [flow, setFlow] = useState<LegFlow>(flowRef.current)
  const [showResults, setShowResults] = useState(false)
  const [sent, setSent] = useState<'idle' | 'sending' | 'ok' | 'failed'>('idle')
  const [copied, setCopied] = useState<'idle' | 'ok' | 'failed'>('idle')
  const [copyText, setCopyText] = useState('')
  // Bumped whenever the payload content changes, so a send/copy that finishes late cannot mark newer data as sent.
  const statusVersion = useRef(0)

  /** Sent/Copied/fallback text only describe the payload they were made from: clear them whenever it changes. */
  const resetResultsStatus = () => {
    statusVersion.current += 1
    setSent('idle')
    setCopied('idle')
    setCopyText('')
  }

  /** Save this visit's logs so far (unsent: there is new data since any earlier send). Never throws. */
  const persist = (frozen: Settings | null = played) => {
    const w = warm.current
    saveVisit({
      visit,
      startedAt,
      seed: legSeed,
      played: frozen,
      inputs: runInputs.current,
      warmSeed,
      warmSettings: w.settings,
      warmInputs: w.inputs,
      sent: false,
      ...(logGap.current ? { logGap: true as const } : {}),
    })
  }

  const advance = (next: LegFlow) => {
    flowRef.current = next
    setFlow(next)
  }

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
    persist(null)
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
    // The stage index must equal this dart's position in the log; if not, the log no longer replays faithfully.
    if (e.index !== runInputs.current.length) logGap.current = true
    runInputs.current.push(e.input)
    advance(onDart(flowRef.current!, e.result.bed))
    resetResultsStatus()
    persist()
  }

  const rate = (rating: Rating) => {
    const frozen = played ?? settings
    const next = rateLeg(flowRef.current!, rating, { build: __BUILD_ID__, settingsKey: settingsKey(frozen), visit })
    if (next === flowRef.current) return // one rating per won leg, however fast the taps come
    advance(next)
    resetResultsStatus()
    saveJson(LEGS_KEY, next.legs)
    persist()
  }

  const another = () => {
    advance(nextLeg(flowRef.current!))
    resetResultsStatus()
    setShowResults(false)
    persist()
  }

  const closeResults = () => {
    resetResultsStatus()
    setShowResults(false)
  }

  /** This visit's legs and logs, plus every earlier visit on this phone that was never sent. */
  const payload = (): ResultsPayload => {
    const frozen = played ?? settings
    const w = warm.current
    return buildPayload({
      build: __BUILD_ID__,
      visit,
      device: navigator.userAgent,
      settings: frozen,
      legs: flowRef.current!.legs,
      run: { v: 1, seed: legSeed, settings: frozen, throws: runInputs.current },
      warm: w.inputs.length ? { v: 1, seed: warmSeed, settings: w.settings ?? settings, throws: w.inputs } : null,
      earlier,
      logGap: logGap.current,
    })
  }

  /** After a Send that returned OK or a Copy that worked: those earlier visits are done, and so is this one unless it moved on. */
  const delivered = (p: ResultsPayload, version: number) => {
    const ids = p.earlier.map((e) => e.visit)
    if (version === statusVersion.current) ids.push(visit)
    markSent(ids)
    setEarlier((list) => list.filter((v) => !ids.includes(v.visit)))
  }

  const send = async () => {
    const version = statusVersion.current
    setSent('sending')
    const p = payload()
    const ok = await sendResults(FEEDBACK_URL, p)
    if (ok) delivered(p, version)
    if (version === statusVersion.current) setSent(ok ? 'ok' : 'failed') // the data moved on while sending: drop the stale answer
  }

  const copy = async () => {
    const version = statusVersion.current
    const p = payload()
    const text = resultsText(p)
    setCopyText(text)
    try {
      await navigator.clipboard.writeText(text)
      delivered(p, version)
      if (version === statusVersion.current) setCopied('ok')
    } catch {
      if (version === statusVersion.current) setCopied('failed')
    }
  }

  if (step === 'calibrate') {
    return (
      <Calibrate
        intro
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
            <p data-testid="lead-advice">Your taps run {leadAdvice(suggest, settings.leadMs).direction}. Adjust for this phone?</p>
            <p class="muted">{leadAdvice(suggest, settings.leadMs).group}</p>
            <div class="row">
              <button class="btn primary" data-testid="apply-lead" onClick={() => applySuggestion(suggest)}>Apply {suggest.leadMs >= 0 ? '+' : ''}{snapLead(suggest.leadMs)} ms</button>
              <button class="btn" data-testid="keep-lead" onClick={() => startPlaying(settings)}>Keep as is</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const { leg } = flow
  const overlayOpen = leg.won || showResults
  const resultsActions = (
    <>
      <div class="row">
        {FEEDBACK_URL && (
          <button class="btn" data-testid="send-results" disabled={sent === 'sending' || sent === 'ok'} onClick={send}>Send my results</button>
        )}
        <button class="btn" data-testid="copy-results" onClick={copy}>Copy my results</button>
      </div>
      {sent === 'ok' && <p>Sent. Thank you!</p>}
      {sent === 'failed' && <p>Could not send. Tap "Copy my results" and paste them to Sam.</p>}
      {copied === 'ok' && <p>Copied.</p>}
      {copied === 'failed' && (
        <>
          <p>Could not copy. Select this text and copy it by hand.</p>
          <textarea readOnly rows={6} style={{ width: '100%', maxWidth: 420 }} value={copyText} onFocus={(e) => e.currentTarget.select()} />
        </>
      )}
      {earlier.length > 0 && (
        <p class="muted" data-testid="earlier-visits">Also includes {earlier.length} earlier {earlier.length === 1 ? 'visit' : 'visits'} on this phone that {earlier.length === 1 ? 'was' : 'were'} not sent yet.</p>
      )}
      {storageOk ? (
        <p class="muted">Your throws are kept on this phone, so a reload does not lose them.</p>
      ) : (
        <p class="muted" data-testid="not-saved">Private tab: your progress isn't saved on this phone. Copy or send after each leg.</p>
      )}
    </>
  )

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
      {!overlayOpen && (
        <button class="btn results-btn" data-testid="open-results" onClick={() => setShowResults(true)}>Results</button>
      )}
      {overlayOpen && (
        <div class="overlay">
          {leg.won ? (
            <>
              <h2>Leg won in {leg.dartsTotal} darts</h2>
              <p class="muted">{leg.dartsTotal <= DEFAULT_PAR ? `Par is ${DEFAULT_PAR}. You beat it.` : `Par is ${DEFAULT_PAR}. Beat it next leg.`}</p>
              {flow.awaitingRating ? (
                <>
                  <p>Did darts land where you aimed?</p>
                  <div class="row">
                    <button class="btn" data-testid="rating-mostly" onClick={() => rate('mostly')}>Mostly</button>
                    <button class="btn" data-testid="rating-sometimes" onClick={() => rate('sometimes')}>Sometimes</button>
                    <button class="btn" data-testid="rating-rarely" onClick={() => rate('rarely')}>Rarely</button>
                  </div>
                </>
              ) : (
                <>
                  <div class="row">
                    <button class="btn primary wide" data-testid="another-leg" onClick={another}>Another leg</button>
                  </div>
                  {resultsActions}
                </>
              )}
            </>
          ) : (
            <>
              <h2>Your results so far</h2>
              <p class="muted">{leg.dartsTotal} {leg.dartsTotal === 1 ? 'dart' : 'darts'} in this leg, {flow.legs.filter((l) => l.visit === visit).length} finished.</p>
              {resultsActions}
              <div class="row">
                <button class="btn primary" data-testid="close-results" onClick={closeResults}>Back to the leg</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
