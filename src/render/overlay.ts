import { toPx } from './view.ts'
import type { View } from './view.ts'
import type { Point } from '../core/types.ts'

const AIM = '#ffd400'

function ringAt(ctx: CanvasRenderingContext2D, view: View, p: Point, capUnits: number, dashed: boolean, alpha: number) {
  const c = toPx(view, p)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.lineWidth = 2
  ctx.strokeStyle = '#000000'
  ctx.setLineDash(dashed ? [4, 4] : [])
  ctx.beginPath()
  ctx.arc(c.px, c.py, Math.max(2, capUnits * view.scale), 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 1
  ctx.strokeStyle = AIM
  ctx.stroke()
  ctx.restore()
}

export function drawTargetMarker(ctx: CanvasRenderingContext2D, view: View, target: Point): void {
  const c = toPx(view, target)
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(c.px - 5, c.py)
  ctx.lineTo(c.px + 5, c.py)
  ctx.moveTo(c.px, c.py - 5)
  ctx.lineTo(c.px, c.py + 5)
  ctx.stroke()
  ctx.restore()
}

export function drawAim(ctx: CanvasRenderingContext2D, view: View, crosshair: Point, capUnits: number): void {
  ringAt(ctx, view, crosshair, capUnits, false, 0.95)
  const c = toPx(view, crosshair)
  ctx.save()
  ctx.lineWidth = 3
  ctx.strokeStyle = '#000000'
  ctx.beginPath()
  ctx.moveTo(c.px - 9, c.py)
  ctx.lineTo(c.px + 9, c.py)
  ctx.moveTo(c.px, c.py - 9)
  ctx.lineTo(c.px, c.py + 9)
  ctx.stroke()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = AIM
  ctx.stroke()
  ctx.restore()
}

export function drawGhost(ctx: CanvasRenderingContext2D, view: View, crosshair: Point, capUnits: number): void {
  ringAt(ctx, view, crosshair, capUnits, true, 0.7)
  const c = toPx(view, crosshair)
  ctx.save()
  ctx.strokeStyle = AIM
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(c.px, c.py, 4, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

export function drawDart(ctx: CanvasRenderingContext2D, view: View, from: Point, to: Point, t: number): void {
  const a = toPx(view, from)
  const b = toPx(view, to)
  const x = a.px + (b.px - a.px) * t
  const y = a.py + (b.py - a.py) * t
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(a.px, a.py)
  ctx.lineTo(b.px, b.py)
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(x, y, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}
