import * as THREE from 'three'
import type { Garden } from './assets.ts'
import type { Input } from './input.ts'
import type { Body, Surface } from './physics.ts'
import type { Sfx } from './sfx.ts'

export type LevelId = 'hub' | 'ivy' | 'flower' | 'foxtail'

export type Spawn = {
  x: number
  y: number
  z: number
  yaw: number
  vine?: { index: number; s: number }
  stem?: { index: number; hand: number }
}

export type Sim = {
  dt: number
  time: number
  body: Body
  input: Input
  rightX: number
  rightZ: number
  forwardX: number
  forwardZ: number
  sfx: Sfx
  checkpoint: Spawn
  /** Seconds after a respawn during which slips are ignored. */
  lock: number
  save: (spawn: Spawn) => void
  fail: () => void
}

export type Stage = {
  readonly id: LevelId
  readonly title: string
  readonly objective: string
  readonly hint: string
  readonly failLine: string
  readonly winLine: string
  readonly group: THREE.Group
  readonly spawn: Spawn
  readonly fogColor: number
  readonly fogNear: number
  readonly fogFar: number
  surfaces: Surface[]
  /** Extra line for the wind-timing hint. Empty hides it. */
  status: string
  climbing: boolean
  /** Signed climb speed along a vine or stem, meters per second. */
  climbRate: number
  hanging: boolean
  /** Lateral speed while hanging, used to swing the legs. */
  swing: number
  simulate: (ctx: Sim) => 'play' | 'win'
  applySpawn: (spawn: Spawn, body: Body) => void
  camera: (pos: THREE.Vector3, look: THREE.Vector3, body: Body, aspect: number, time: number) => void
  dispose: () => void
}

export type StageFactory = (garden: Garden) => Stage
