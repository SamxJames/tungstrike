import { describe, it, expect } from 'vitest'
import { AimSession, RETARGET_LOCK_MS, THROW_LOCK_MS } from './session.ts'

const T20 = { x: 0, y: 1030 }

describe('AimSession', () => {
  it('counts 8ms ticks from the start of the aim', () => {
    const s = new AimSession(T20, 1000)
    expect(s.tick(1000)).toBe(0)
    expect(s.tick(1080)).toBe(10)
    expect(s.tick(900)).toBe(0)
  })
  it('releases with raw time, lead-adjusted tick and the current target', () => {
    const s = new AimSession(T20, 1000)
    expect(s.release(1800, 60)).toEqual({ target: T20, releaseTick: 92, rawMs: 800 })
  })
  it('ignores a release right after a re-aim', () => {
    const s = new AimSession(T20, 0)
    s.retarget(1000, { x: 0, y: 0 })
    expect(s.release(1000 + RETARGET_LOCK_MS - 1, 0)).toBeNull()
    expect(s.release(1000 + RETARGET_LOCK_MS, 0)).not.toBeNull()
  })
  it('restarts the wobble on re-aim', () => {
    const s = new AimSession(T20, 0)
    s.retarget(1000, { x: 0, y: 0 })
    expect(s.tick(1000)).toBe(0)
    expect(s.target).toEqual({ x: 0, y: 0 })
  })
  it('is inert after a throw until the lockout ends, then starts the next dart', () => {
    const s = new AimSession(T20, 0)
    s.release(500, 0)
    expect(s.phase).toBe('cooldown')
    expect(s.release(600, 0)).toBeNull()
    expect(s.retarget(600, { x: 0, y: 0 })).toBe(false)
    expect(s.advance(500 + THROW_LOCK_MS - 1)).toBe(false)
    expect(s.advance(500 + THROW_LOCK_MS)).toBe(true)
    expect(s.phase).toBe('aiming')
    expect(s.throwIndex).toBe(1)
    expect(s.tick(500 + THROW_LOCK_MS)).toBe(0)
  })
  it('cannot release while paused and restarts the wobble on resume', () => {
    const s = new AimSession(T20, 0)
    s.pause()
    expect(s.release(900, 0)).toBeNull()
    s.resume(5000)
    expect(s.tick(5000)).toBe(0)
    expect(s.release(5400, 0)).not.toBeNull()
  })
  it('ignores a release stamped before resume()', () => {
    const s = new AimSession(T20, 0)
    s.pause()
    s.resume(5000)
    expect(s.release(4999, 0)).toBeNull()
  })
  it('ignores a release stamped before the next dart starts', () => {
    const s = new AimSession(T20, 0)
    s.release(500, 0)
    expect(s.advance(1100)).toBe(true)
    expect(s.release(1099, 0)).toBeNull()
    expect(s.release(1100, 0)).not.toBeNull()
  })
  it('accepts a release stamped exactly at the aim start', () => {
    const s = new AimSession(T20, 1000)
    expect(s.release(1000, 0)).toEqual({ target: T20, releaseTick: 0, rawMs: 0 })
  })
  it('resume() when not paused does not restart the wobble', () => {
    const s = new AimSession(T20, 0)
    s.resume(1000)
    expect(s.tick(1000)).toBe(125)
  })
  it('retarget() while paused returns false and leaves the target unchanged', () => {
    const s = new AimSession(T20, 0)
    s.pause()
    expect(s.retarget(100, { x: 0, y: 0 })).toBe(false)
    expect(s.target).toEqual(T20)
  })
})
