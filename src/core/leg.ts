import { DARTS_PER_TURN, START_SCORE } from './constants.ts'
import type { Bed } from './types.ts'

export interface LegState {
  remaining: number
  turnStart: number
  dartsInTurn: number
  dartsTotal: number
  busts: number
  won: boolean
  lastBust: boolean
}

export function newLeg(): LegState {
  return { remaining: START_SCORE, turnStart: START_SCORE, dartsInTurn: 0, dartsTotal: 0, busts: 0, won: false, lastBust: false }
}

export function applyDart(state: LegState, bed: Bed): LegState {
  if (state.won) return state
  const after = state.remaining - bed.score
  const dartsTotal = state.dartsTotal + 1
  const bust = after < 0 || after === 1 || (after === 0 && !bed.isDouble)
  if (bust) {
    return { ...state, remaining: state.turnStart, dartsInTurn: 0, dartsTotal, busts: state.busts + 1, lastBust: true }
  }
  if (after === 0) {
    return { ...state, remaining: 0, dartsInTurn: state.dartsInTurn + 1, dartsTotal, won: true, lastBust: false }
  }
  const dartsInTurn = state.dartsInTurn + 1
  if (dartsInTurn === DARTS_PER_TURN) {
    return { ...state, remaining: after, turnStart: after, dartsInTurn: 0, dartsTotal, lastBust: false }
  }
  return { ...state, remaining: after, dartsInTurn, dartsTotal, lastBust: false }
}
