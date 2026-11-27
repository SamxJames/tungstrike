import { useEffect, useRef, useState } from 'preact/hooks'
import { estimateLead } from '../core/lead.ts'
import { CYCLE_MS, barLeftPx, tapError } from './calibrate-math.ts'

const TAPS_NEEDED = 5
const BAR_PX = 16

export function Calibrate(props: {
  onDone: (leadMs: number) => void
  onSkip?: () => void
  /** First screen of the game (`/`): show the game name and one line on what it is. */
  intro?: boolean
}) {
  const t0 = useRef(performance.now())
  const errors = useRef<number[]>([])
  const finished = useRef(false)
  const track = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState(0)

  useEffect(() => {
    let raf = 0
    const frame = (now: number) => {
      const phase = ((now - t0.current) % CYCLE_MS) / CYCLE_MS
      if (bar.current && track.current) {
        bar.current.style.left = `${barLeftPx(phase, track.current.clientWidth, BAR_PX)}px`
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  const tap = (e: PointerEvent) => {
    if (finished.current) return
    errors.current.push(tapError(e.timeStamp, t0.current))
    const n = errors.current.length
    setCount(n)
    if (n >= TAPS_NEEDED) {
      finished.current = true
      props.onDone(estimateLead(errors.current))
    }
  }

  return (
    <div class="overlay">
      {props.intro && (
        <div data-testid="calibrate-intro">
          <h1 style={{ margin: 0 }}>Tungstrike</h1>
          <p style={{ margin: '6px 0 0' }}>A darts game: time your tap to throw. First, a 10-second timing check (or skip).</p>
        </div>
      )}
      <h2 style={{ margin: 0 }}>Quick timing check</h2>
      <p class="muted" style={{ margin: 0 }}>
        Tap the big area exactly when the yellow bar crosses the white line. {count} of {TAPS_NEEDED} taps.
      </p>
      <div ref={track} class="calibrate-track" data-testid="calibrate-track">
        <div ref={bar} data-testid="calibrate-bar" style={{ position: 'absolute', left: 0, top: 0, width: `${BAR_PX}px`, height: `${BAR_PX}px`, background: '#ffd400', borderRadius: '8px' }} />
        <div style={{ position: 'absolute', left: 'calc(50% - 1px)', top: 0, width: '2px', height: `${BAR_PX}px`, background: '#fff' }} />
      </div>
      {props.onSkip && (
        <button class="btn" data-testid="skip-calibration" style={{ minHeight: '48px', minWidth: '120px' }} onClick={props.onSkip}>
          Skip
        </button>
      )}
      <div class="pad" data-testid="calibrate-pad" style={{ width: '90%', height: '35dvh', minHeight: '120px', flex: 'none' }} onPointerDown={tap}>
        TAP
      </div>
    </div>
  )
}
