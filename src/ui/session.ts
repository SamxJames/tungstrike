import { TICK_MS } from '../core/constants.ts'
import { releaseTickFor } from '../core/throw.ts'
import type { Point, ThrowInput } from '../core/types.ts'

export const RETARGET_LOCK_MS = 200
export const THROW_LOCK_MS = 600
export type Phase = 'aiming' | 'cooldown'

export class AimSession {
  target: Point
  throwIndex = 0
  phase: Phase = 'aiming'
  private aimStartMs: number
  private lockedUntilMs = 0
  private cooldownUntilMs = 0
  private paused = false

  constructor(target: Point, nowMs: number) {
    this.target = target
    this.aimStartMs = nowMs
  }

  tick(nowMs: number): number {
    return Math.max(0, Math.floor((nowMs - this.aimStartMs) / TICK_MS))
  }

  retarget(nowMs: number, target: Point): boolean {
    if (this.paused || this.phase !== 'aiming') return false
    this.target = target
    this.aimStartMs = nowMs
    this.lockedUntilMs = nowMs + RETARGET_LOCK_MS
    return true
  }

  release(eventMs: number, leadMs: number): ThrowInput | null {
    if (this.paused || this.phase !== 'aiming') return null
    if (eventMs < this.lockedUntilMs || eventMs < this.aimStartMs) return null
    const rawMs = Math.max(0, Math.floor(eventMs - this.aimStartMs))
    this.phase = 'cooldown'
    this.cooldownUntilMs = eventMs + THROW_LOCK_MS
    return { target: this.target, releaseTick: releaseTickFor(rawMs, leadMs), rawMs }
  }

  advance(nowMs: number): boolean {
    if (this.phase === 'cooldown' && !this.paused && nowMs >= this.cooldownUntilMs) {
      this.phase = 'aiming'
      this.throwIndex += 1
      this.aimStartMs = nowMs
      return true
    }
    return false
  }

  pause(): void {
    this.paused = true
  }

  resume(nowMs: number): void {
    if (!this.paused) return
    this.paused = false
    if (this.phase === 'aiming') this.aimStartMs = nowMs
    else this.cooldownUntilMs = Math.max(this.cooldownUntilMs, nowMs)
  }
}
