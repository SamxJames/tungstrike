export interface Point { x: number; y: number }            // integers, x right, y up, origin = bull centre
export type Ring = 'bull' | 'outerBull' | 'innerSingle' | 'treble' | 'outerSingle' | 'double' | 'miss'
export interface Bed { ring: Ring; sector: number; score: number; isDouble: boolean }   // sector 1-20, 0 for bulls and miss
export interface Settings { wobbleRadius: number; loopMs: number; shape: number; scatterCap: number; leadMs: number; zoomPct: number }
export interface ThrowInput { target: Point; releaseTick: number; rawMs?: number }
export interface ThrowCtx { seed: number; throwIndex: number; settings: Settings; target: Point }
export interface ThrowResult { crosshair: Point; scatter: Point; landing: Point; bed: Bed }
export interface RunLog { v: 1; seed: number; settings: Settings; throws: ThrowInput[] }
