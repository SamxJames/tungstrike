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
      <p class="muted">
        Tap the big area exactly when the yellow bar crosses the white line. {count} of {TAPS_NEEDED} taps.
      </p>
      <div style={{ position: 'relative', width: '80%', height: '16px', background: '#222', borderRadius: '8px', overflow: 'hidden' }}>
        <div ref={bar} style={{ position: 'absolute', left: 0, top: 0, width: '16px', height: '16px', background: '#ffd400', borderRadius: '8px' }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, width: '2px', height: '16px', background: '#fff' }} />
      </div>
      <div class="pad" style={{ width: '90%', height: '35dvh', flex: 'none' }} onPointerDown={tap}>
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
