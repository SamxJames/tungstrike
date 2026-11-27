import { useEffect, useRef, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { bedLabel, targetFromTap } from '../core/board.ts'
import { resolveThrow, crosshairAt } from '../core/throw.ts'
import type { Point, Settings, ThrowCtx, ThrowInput, ThrowResult } from '../core/types.ts'
import { drawBoard } from '../render/board.ts'
import { drawAim, drawDart, drawGhost, drawTargetMarker } from '../render/overlay.ts'
import { makeView, toBoard } from '../render/view.ts'
import { GHOST_MS, flightProgress, shouldReport } from './landing.ts'
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
      // A target tapped during the cooldown becomes the target as the next dart begins: zoom to it then.
      const hadPending = session.pendingTarget !== null
      if (session.advance(now) && hadPending && wholeRef.current) setWhole(false)
      const view = viewFor(rect.width, rect.height)
      const capUnits = p.settings.scatterCap * 8
      drawBoard(ctx2d, view)
      drawTargetMarker(ctx2d, view, session.target)
      // Show a tap made during the cooldown straight away, so the player sees it registered.
      if (session.pendingTarget !== null) drawTargetMarker(ctx2d, view, session.pendingTarget)
      const landed = landedRef.current
      // Report first, independent of the draw branch, so a dropped frame window can never lose a throw.
      if (landed !== null && shouldReport(landed, now, session.phase)) {
        landed.reported = true
        const r = landed.event.result
        setChip(`${bedLabel(r.bed)} · ${r.bed.score}`)
        window.clearTimeout(chipTimer)
        chipTimer = window.setTimeout(() => setChip(null), 600)
        p.onThrow(landed.event)
      }
      if (session.phase === 'aiming' || landed === null) {
        const ctx: ThrowCtx = { seed: p.seed, throwIndex: session.throwIndex, settings: p.settings, target: session.target }
        drawAim(ctx2d, view, crosshairAt(ctx, session.tick(now)), capUnits)
      } else {
        const dt = now - landed.releasedAt
        const r = landed.event.result
        drawGhost(ctx2d, view, r.crosshair, capUnits)
        if (dt >= GHOST_MS) drawDart(ctx2d, view, r.crosshair, r.landing, flightProgress(dt))
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
