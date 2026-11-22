import { useEffect, useRef, useState } from 'preact/hooks'
import { estimateLead } from '../core/lead.ts'
import { CYCLE_MS, barLeftPx, tapError } from './calibrate-math.ts'

const TAPS_NEEDED = 5
const BAR_PX = 16

export function Calibrate(props: { onDone: (leadMs: number) => void; onSkip?: () => void }) {
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
      <h2>Quick timing check</h2>
      <p class="muted">
        Tap the big area exactly when the yellow bar crosses the white line. {count} of {TAPS_NEEDED} taps.
      </p>
      <div ref={track} data-testid="calibrate-track" style={{ position: 'relative', width: '80%', height: `${BAR_PX}px`, background: '#222', borderRadius: '8px', overflow: 'hidden' }}>
        <div ref={bar} data-testid="calibrate-bar" style={{ position: 'absolute', left: 0, top: 0, width: `${BAR_PX}px`, height: `${BAR_PX}px`, background: '#ffd400', borderRadius: '8px' }} />
        <div style={{ position: 'absolute', left: 'calc(50% - 1px)', top: 0, width: '2px', height: `${BAR_PX}px`, background: '#fff' }} />
      </div>
      <div class="pad" data-testid="calibrate-pad" style={{ width: '90%', height: '35dvh', flex: 'none' }} onPointerDown={tap}>
        TAP
      </div>
      {props.onSkip && (
        <button class="btn" data-testid="skip-calibration" onClick={props.onSkip}>
          Skip
        </button>
      )}
    </div>
  )
}
