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
  it('fits the whole board, numbers margin included, in a landscape canvas (height is the smaller side)', () => {
    const v = makeView(500, 390, { x: 0, y: 0 }, 100)
    expect(toPx(v, { x: 0, y: 1900 }).py).toBeGreaterThanOrEqual(0)
    expect(toPx(v, { x: 0, y: -1900 }).py).toBeLessThanOrEqual(390)
    expect(toPx(v, { x: 1900, y: 0 }).px).toBeLessThanOrEqual(500)
    expect(toPx(v, { x: -1900, y: 0 }).px).toBeGreaterThanOrEqual(0)
  })
  it('toBoard never returns -0', () => {
    const v = makeView(390, 500, { x: 0, y: 0 }, 350)
    const p = toBoard(v, 195 - 0.01, 250 + 0.01) // a hair left of and below the centre rounds to -0 without normalising
    expect(Object.is(p.x, 0)).toBe(true)
    expect(Object.is(p.y, 0)).toBe(true)
  })
  it('fits the whole board at 100 percent', () => {
    const v = makeView(390, 500, { x: 0, y: 0 }, 100)
    expect(toPx(v, { x: 1700, y: 0 }).px).toBeLessThan(390)
    expect(toPx(v, { x: -1700, y: 0 }).px).toBeGreaterThan(0)
  })
})
