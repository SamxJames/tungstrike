import { useEffect, useRef, useState } from 'preact/hooks'
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
const TALLY_MAX = 30
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]

type Tally = { t20: boolean }[]

export function Lab() {
  const [settings, setSettings] = useState<Settings>(() => ({
    ...decodeSettings(location.hash),
    leadMs: loadLead() ?? DEFAULT_SETTINGS.leadMs,
  }))
  const [drill, setDrill] = useState<{ id: number; seed: number } | null>(null)
  const [records, setRecords] = useState<DrillRecord[]>([])
  const [done, setDone] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [calibrating, setCalibrating] = useState(false)
  const [tally, setTally] = useState<Tally>(() => loadJson<Tally>(TALLY_KEY, []))
  const [freeSeed] = useState(newSeed)
  const recordsRef = useRef<DrillRecord[]>([])
  const tallyRef = useRef(tally)
  tallyRef.current = tally

  // Keep the share link in the address bar. Lead is deliberately left out (it lives in localStorage).
  useEffect(() => {
    const id = window.setTimeout(() => history.replaceState(null, '', encodeSettings(settings)), 300)
    return () => window.clearTimeout(id)
  }, [settings])

  const set = (key: keyof Settings) => (v: number) => {
    setSettings((s) => ({ ...s, [key]: v }))
    if (key === 'leadMs') saveLead(v)
  }

  const startDrill = () => {
    recordsRef.current = []
    setRecords([])
    setDone(false)
    setReportOpen(false)
    setDrill({ id: Date.now(), seed: newSeed() })
  }

  const onDrillThrow = (rec: DrillRecord) => {
    const next = [...recordsRef.current, rec]
    recordsRef.current = next
    setRecords(next)
    if (next.length === DRILL_DARTS) {
      const added = next.map((r) => ({ t20: r.dart.bed.ring === 'treble' && r.dart.bed.sector === 20 }))
      const merged = [...tallyRef.current, ...added].slice(-TALLY_MAX)
      setTally(merged)
      saveJson(TALLY_KEY, merged)
      setDone(true)
      setReportOpen(true)
    }
  }

  const shareUrl =
    location.origin +
    '/lab' +
    encodeSettings(settings) +
    (drill && done ? '&run=' + encodeRunCode({ v: 1, seed: drill.seed, settings, throws: records.map((r) => r.input) }) : '')

  return (
    <div>
      {calibrating && (
        <Calibrate
          onDone={(ms) => {
            set('leadMs')(ms)
            setCalibrating(false)
          }}
          onSkip={() => setCalibrating(false)}
        />
      )}
      {done && reportOpen && (
        <div class="sheet">
          <div class="sheet-inner">
            <DrillReport
              records={records}
              settings={settings}
              tally={{ n: tally.length, t20: tally.filter((t) => t.t20).length }}
              shareUrl={shareUrl}
              onApplyLead={(ms) => set('leadMs')(ms)}
            />
            <button class="btn primary close" data-testid="close-report" onClick={() => setReportOpen(false)}>
              Back to the Lab
            </button>
          </div>
        </div>
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
            if (drill && !done) {
              onDrillThrow({
                dart: { crosshair: e.result.crosshair, landing: e.result.landing, bed: e.result.bed },
                ctx: e.ctx,
                input: e.input,
                rawMs: e.input.rawMs ?? 0,
              })
            }
          }}
        />
      </div>
      <div class="page">
        <div class="row">
          <button class="btn primary" data-testid="start-drill" onClick={startDrill}>
            10 darts at T20
          </button>
          <button class="btn" onClick={() => setCalibrating(true)}>
            Timing check
          </button>
          <a class="btn" data-testid="play-leg" href={'/' + encodeSettings(settings)}>
            Play a leg with these settings
          </a>
        </div>
        {done && !reportOpen && (
          <button class="btn" data-testid="show-report" style={{ width: '100%', marginTop: '8px' }} onClick={() => setReportOpen(true)}>
            Show drill report
          </button>
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
