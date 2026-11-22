import { describe, it, expect } from 'vitest'
import { makeView, toBoard, toPx } from './view.ts'

describe('view', () => {
  it('puts the view centre in the middle of the canvas', () => {
    const v = makeView(390, 500, { x: 0, y: 1030 }, 200)
    const c = toPx(v, { x: 0, y: 1030 })
    expect(c.px).toBeCloseTo(195)
    expect(c.py).toBeCloseTo(250)
  })
  it('flips y so up on the board is up on the screen', () => {
    const v = makeView(390, 500, { x: 0, y: 0 }, 100)
    expect(toPx(v, { x: 0, y: 500 }).py).toBeLessThan(toPx(v, { x: 0, y: 0 }).py)
  })
  it('round-trips pixels and board points', () => {
    const v = makeView(390, 500, { x: 120, y: 900 }, 250)
    const p = { x: 300, y: 1000 }
    const px = toPx(v, p)
    expect(toBoard(v, px.px, px.py)).toEqual(p)
  })
  it('scales with zoom', () => {
    const a = makeView(390, 500, { x: 0, y: 0 }, 100)
    const b = makeView(390, 500, { x: 0, y: 0 }, 200)
    expect(b.scale).toBeCloseTo(a.scale * 2)
  })
  it('fits the whole board at 100 percent', () => {
    const v = makeView(390, 500, { x: 0, y: 0 }, 100)
    expect(toPx(v, { x: 1700, y: 0 }).px).toBeLessThan(390)
    expect(toPx(v, { x: -1700, y: 0 }).px).toBeGreaterThan(0)
  })
})
