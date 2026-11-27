import { BOARD, SECTOR_NUMBERS } from '../core/constants.ts'
import { toPx } from './view.ts'
import type { View } from './view.ts'

const DEG = Math.PI / 180

function ring(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, r0: number, r1: number, a0: number, a1: number, colour: string) {
  ctx.beginPath()
  ctx.arc(cx, cy, r1 * s, a0, a1, false)
  ctx.arc(cx, cy, r0 * s, a1, a0, true)
  ctx.closePath()
  ctx.fillStyle = colour
  ctx.fill()
}

export function drawBoard(ctx: CanvasRenderingContext2D, view: View): void {
  ctx.save()
  const s = view.scale
  const c = toPx(view, { x: 0, y: 0 })
  ctx.fillStyle = '#0b0d10'
  ctx.fillRect(0, 0, view.w, view.h)
  ctx.fillStyle = '#14171c'
  ctx.beginPath()
  ctx.arc(c.px, c.py, 1900 * s, 0, Math.PI * 2)
  ctx.fill()

  for (let k = 0; k < 20; k++) {
    const a0 = (-9 + 18 * k - 90) * DEG
    const a1 = a0 + 18 * DEG
    const single = k % 2 === 0 ? '#1c1c1c' : '#e8dcb8'
    const multi = k % 2 === 0 ? '#b3261e' : '#1f7a3a'
    ring(ctx, c.px, c.py, s, BOARD.bullOuter, BOARD.trebleInner, a0, a1, single)
    ring(ctx, c.px, c.py, s, BOARD.trebleInner, BOARD.trebleOuter, a0, a1, multi)
    ring(ctx, c.px, c.py, s, BOARD.trebleOuter, BOARD.doubleInner, a0, a1, single)
    ring(ctx, c.px, c.py, s, BOARD.doubleInner, BOARD.doubleOuter, a0, a1, multi)
  }
  ctx.fillStyle = '#1f7a3a'
  ctx.beginPath()
  ctx.arc(c.px, c.py, BOARD.bullOuter * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#b3261e'
  ctx.beginPath()
  ctx.arc(c.px, c.py, BOARD.bullInner * s, 0, Math.PI * 2)
  ctx.fill()

  // Wires: the 6 ring lines in one path, the 20 spokes in another (each sub-path starts with moveTo, so no joins).
  ctx.strokeStyle = 'rgba(200,200,200,0.55)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const r of [BOARD.bullInner, BOARD.bullOuter, BOARD.trebleInner, BOARD.trebleOuter, BOARD.doubleInner, BOARD.doubleOuter]) {
    ctx.moveTo(c.px + r * s, c.py)
    ctx.arc(c.px, c.py, r * s, 0, Math.PI * 2)
  }
  ctx.stroke()
  ctx.beginPath()
  for (let k = 0; k < 20; k++) {
    const a = (-9 + 18 * k - 90) * DEG
    ctx.moveTo(c.px + Math.cos(a) * BOARD.bullOuter * s, c.py + Math.sin(a) * BOARD.bullOuter * s)
    ctx.lineTo(c.px + Math.cos(a) * BOARD.doubleOuter * s, c.py + Math.sin(a) * BOARD.doubleOuter * s)
  }
  ctx.stroke()

  ctx.fillStyle = '#d8d8d8'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${Math.max(10, 110 * s)}px system-ui, sans-serif`
  for (let k = 0; k < 20; k++) {
    const a = (18 * k - 90) * DEG
    ctx.fillText(String(SECTOR_NUMBERS[k]), c.px + Math.cos(a) * 1800 * s, c.py + Math.sin(a) * 1800 * s)
  }
  ctx.restore()
}
