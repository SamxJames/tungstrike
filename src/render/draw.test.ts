import { describe, it, expect } from 'vitest'
import { drawBoard } from './board.ts'
import { drawDart, drawTargetMarker } from './overlay.ts'
import { makeView } from './view.ts'

type Call = { op: string; strokeStyle?: unknown; lineWidth?: unknown }

/** A stand-in 2D context that records every method call, with the stroke style and width in force for strokes. */
function recorder(): { ctx: CanvasRenderingContext2D; calls: Call[]; state: Record<string, unknown> } {
  const calls: Call[] = []
  const state: Record<string, unknown> = {}
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(_t, key: string) {
      if (key in state) return state[key]
      return () => {
        calls.push(key === 'stroke' ? { op: key, strokeStyle: state.strokeStyle, lineWidth: state.lineWidth } : { op: key })
      }
    },
    set(_t, key: string, value) {
      state[key] = value
      return true
    },
  })
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, state }
}

const view = makeView(390, 500, { x: 0, y: 1030 }, 250)
const strokes = (calls: Call[]) => calls.filter((c) => c.op === 'stroke')

describe('overlay contrast on light (cream) beds', () => {
  it('the target marker is stroked dark and wide first, then light and thin', () => {
    const r = recorder()
    drawTargetMarker(r.ctx, view, { x: 0, y: 1030 })
    const s = strokes(r.calls)
    expect(s).toHaveLength(2)
    expect(s[0]).toMatchObject({ strokeStyle: '#000000' })
    expect(Number(s[0].lineWidth)).toBeGreaterThanOrEqual(3)
    expect(String(s[1].strokeStyle)).not.toBe('#000000')
    expect(Number(s[1].lineWidth)).toBeLessThan(Number(s[0].lineWidth))
  })
  it('the ghost-to-landing line has a dark underlay before the light line', () => {
    const r = recorder()
    drawDart(r.ctx, view, { x: 0, y: 1030 }, { x: 40, y: 1000 }, 1)
    const s = strokes(r.calls)
    // underlay, line, then the dart dot's outline (unchanged)
    expect(s.slice(0, 2).map((c) => c.strokeStyle)).toEqual(['#000000', 'rgba(255,255,255,0.8)'])
    expect(Number(s[0].lineWidth)).toBeGreaterThanOrEqual(3)
    expect(s).toHaveLength(3)
  })
})

describe('drawBoard', () => {
  it('leaks no canvas state: save first, restore last', () => {
    const r = recorder()
    drawBoard(r.ctx, view)
    expect(r.calls[0].op).toBe('save')
    expect(r.calls.at(-1)!.op).toBe('restore')
  })
  it('strokes the 6 ring lines and the 20 spokes as two batched paths', () => {
    const r = recorder()
    drawBoard(r.ctx, view)
    expect(strokes(r.calls)).toHaveLength(2)
  })
})
