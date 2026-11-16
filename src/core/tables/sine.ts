import { SINE } from './generated.ts'

export function sin16(phase: number): number {
  return SINE[(phase & 0xffff) >> 6]
}
export function cos16(phase: number): number {
  return sin16(phase + 16384)
}
