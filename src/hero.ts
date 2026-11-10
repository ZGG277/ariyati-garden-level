import * as THREE from 'three'
import type { Body } from './physics.ts'
import { rigGirl, type Rig } from './rig.ts'

/** The mesh's face points down -Z, and yaw 0 in the game looks down +Z. */
export const FACE_OFFSET = Math.PI

export type Motion = {
  dt: number
  time: number
  speed: number
  vy: number
  grounded: boolean
  charge: number
  climbing: boolean
  climbRate: number
  hanging: boolean
  swing: number
}

type Euler = { x: number; y: number; z: number }

const BONE_NAMES = [
  'hips',
  'spine',
  'chest',
  'head',
  'armL',
  'foreL',
  'armR',
  'foreR',
  'legL',
  'shinL',
  'legR',
  'shinR',
] as const

export class Hero {
  readonly root = new THREE.Group()
  private readonly visual = new THREE.Group()
  private readonly rig: Rig
  private readonly targets = new Map<string, Euler>()
  private phase = 0.6
  private land = 0
  private wasAir = false
  private squash = 0
  private stateName = 'idle'
  private immediate = false

  constructor(template: THREE.Object3D) {
    this.rig = rigGirl(template)
    this.visual.add(template)
    this.root.add(this.visual)
    for (const name of BONE_NAMES) this.targets.set(name, { x: 0, y: 0, z: 0 })
  }

  get state(): string {
    return this.stateName
  }

  place(body: Body): void {
    this.root.position.set(body.x, body.y, body.z)
    this.root.rotation.y = body.yaw + FACE_OFFSET
  }

  update(motion: Motion): void {
    const { dt, time, speed, vy, grounded, charge, climbing, climbRate, hanging, swing } = motion
    if (this.wasAir && grounded && vy <= 0.2) {
      this.land = 1
      this.squash = 1
    }
    this.wasAir = !grounded && !climbing && !hanging
    this.land = Math.max(0, this.land - dt * 3.4)
    this.squash = Math.max(0, this.squash - dt * 3.2)

    let state = 'idle'
    if (hanging) state = 'hang'
    else if (climbing && charge > 0.08) state = 'coil'
    else if (climbing) state = 'climb'
    else if (charge > 0.04 && grounded) state = 'charge'
    else if (!grounded && vy > 0.12) state = 'rise'
    else if (!grounded) state = 'fall'
    else if (this.land > 0.2) state = 'land'
    else if (speed > 0.05) state = 'walk'
    this.stateName = state

    if (state === 'walk') this.phase += (speed * dt) / 0.11 * Math.PI * 2
    else if (state === 'climb') this.phase += climbRate * dt * 9
    else if (state === 'idle' || state === 'hang' || state === 'fall') this.phase += dt * 2.2

    for (const name of BONE_NAMES) this.targets.set(name, { x: 0, y: 0, z: 0 })
    if (state === 'idle') this.poseIdle(time)
    else if (state === 'walk') this.poseWalk()
    else if (state === 'charge') this.poseCharge(charge, time)
    else if (state === 'rise') this.poseRise()
    else if (state === 'fall') this.poseFall(time)
    else if (state === 'land') this.poseLand(this.land)
    else if (state === 'climb' || state === 'coil') this.poseClimb(charge)
    else this.poseHang(time, swing)

    const k = this.immediate ? 1 : 1 - Math.exp(-dt * 14)
    for (const name of BONE_NAMES) {
      const bone = this.rig.bones[name]
      const target = this.targets.get(name)!
      if (!bone) continue
      bone.rotation.x += (target.x - bone.rotation.x) * k
      bone.rotation.y += (target.y - bone.rotation.y) * k
      bone.rotation.z += (target.z - bone.rotation.z) * k
    }
    const drop = state === 'charge' ? -0.1 * Math.min(1, charge) : state === 'land' ? -0.05 * this.land : 0
    const hips = this.rig.bones.hips!
    hips.position.y += (this.rig.hipsRestY + drop - hips.position.y) * k

    const sy = 1 - this.squash * 0.18 - (state === 'charge' ? charge * 0.08 : 0)
    const sx = 1 + this.squash * 0.1
    this.visual.scale.set(sx, sy, sx)
    this.rig.mesh.skeleton.update()
  }

  /** Drive one named pose for the capture reel. */
  preview(name: string, time: number, dt: number): void {
    const speed = name === 'walk' ? 0.5 : 0
    const charge = name === 'charge' ? 0.55 + 0.45 * Math.sin(time * 2.2) : name === 'coil' ? 0.75 : 0
    if (name === 'land') this.land = 1
    this.immediate = true
    this.update({
      dt,
      time,
      speed,
      vy: name === 'rise' ? 0.8 : name === 'fall' ? -0.8 : 0,
      grounded: name === 'idle' || name === 'walk' || name === 'charge' || name === 'land',
      charge,
      climbing: name === 'climb' || name === 'coil',
      climbRate: name === 'climb' ? 0.45 : 0,
      hanging: name === 'hang',
      swing: name === 'hang' ? Math.sin(time * 2) * 0.6 : 0,
    })
    if (name === 'land') this.land = 0.8
  }

  private set(name: string, x: number, y = 0, z = 0): void {
    this.targets.set(name, { x, y, z })
  }

  private poseIdle(time: number): void {
    const b = Math.sin(time * 2.1)
    this.set('spine', b * 0.05, 0, 0)
    this.set('chest', b * 0.04, 0, 0)
    this.set('head', -b * 0.04, Math.sin(time * 0.7) * 0.08, 0)
    this.set('armL', 0.2 + b * 0.12, 0, 0.42)
    this.set('armR', 0.2 - b * 0.12, 0, -0.42)
    this.set('foreL', 0.45 + b * 0.08, 0, 0)
    this.set('foreR', 0.45 - b * 0.08, 0, 0)
    this.set('legL', b * 0.08, 0, 0.04)
    this.set('legR', -b * 0.08, 0, -0.04)
    this.set('shinL', 0.12, 0, 0)
    this.set('shinR', 0.12, 0, 0)
  }

  private poseWalk(): void {
    const s = Math.sin(this.phase)
    this.set('hips', 0, s * 0.14, 0)
    this.set('spine', 0.08, -s * 0.12, 0)
    this.set('head', 0, -s * 0.06, 0)
    this.set('armL', s * 1.05, 0, 0.28)
    this.set('armR', -s * 1.05, 0, -0.28)
    this.set('foreL', 0.25 + Math.max(0, s) * 0.7, 0, 0)
    this.set('foreR', 0.25 + Math.max(0, -s) * 0.7, 0, 0)
    this.set('legL', -s * 0.95, 0, 0)
    this.set('legR', s * 0.95, 0, 0)
    this.set('shinL', Math.max(0, s) * 1.15, 0, 0)
    this.set('shinR', Math.max(0, -s) * 1.15, 0, 0)
  }

  private poseCharge(charge: number, time: number): void {
    const k = Math.min(1, charge)
    const shiver = Math.sin(time * 26) * 0.03 * k
    this.set('spine', 0.4 * k, 0, shiver)
    this.set('chest', 0.22 * k, 0, 0)
    this.set('head', -0.18 * k, 0, 0)
    this.set('armL', 0.15 + 0.45 * k, 0, 0.3)
    this.set('armR', 0.15 + 0.45 * k, 0, -0.3)
    this.set('foreL', 0.25 + 0.55 * k, 0, 0)
    this.set('foreR', 0.25 + 0.55 * k, 0, 0)
    this.set('legL', 0.55 * k, 0, 0.04)
    this.set('legR', 0.55 * k, 0, -0.04)
    this.set('shinL', 0.7 * k, 0, 0)
    this.set('shinR', 0.7 * k, 0, 0)
  }

  private poseRise(): void {
    this.set('spine', -0.22, 0, 0)
    this.set('chest', -0.12, 0, 0)
    this.set('head', 0.18, 0, 0)
    this.set('armL', -0.85, 0, 0.28)
    this.set('armR', -0.85, 0, -0.28)
    this.set('foreL', 0.2, 0, 0)
    this.set('foreR', 0.2, 0, 0)
    this.set('legL', -0.25, 0, 0.04)
    this.set('legR', 0.35, 0, -0.04)
    this.set('shinL', 0.55, 0, 0)
    this.set('shinR', 0.3, 0, 0)
  }

  private poseFall(time: number): void {
    const w = Math.sin(time * 7)
    this.set('spine', 0.18, 0, w * 0.05)
    this.set('head', 0.1, 0, 0)
    this.set('armL', 0.35, 0, 0.9)
    this.set('armR', 0.35, 0, -0.9)
    this.set('foreL', 0.15, 0, 0)
    this.set('foreR', 0.15, 0, 0)
    this.set('legL', 0.5 + w * 0.12, 0, 0)
    this.set('legR', -0.15 - w * 0.12, 0, 0)
    this.set('shinL', 0.35, 0, 0)
    this.set('shinR', 0.7, 0, 0)
  }

  private poseLand(k: number): void {
    this.set('spine', 0.32 * k, 0, 0)
    this.set('head', 0.1 * k, 0, 0)
    this.set('armL', 0.55 * k, 0, 0.4)
    this.set('armR', 0.55 * k, 0, -0.4)
    this.set('foreL', 0.4 * k, 0, 0)
    this.set('foreR', 0.4 * k, 0, 0)
    this.set('legL', 0.75 * k, 0, 0)
    this.set('legR', 0.75 * k, 0, 0)
    this.set('shinL', 1.2 * k, 0, 0)
    this.set('shinR', 1.2 * k, 0, 0)
  }

  private poseClimb(charge: number): void {
    const s = Math.sin(this.phase)
    const tuck = Math.min(1, charge)
    this.set('spine', 0.28 + tuck * 0.2, s * 0.08, 0)
    this.set('head', -0.12, 0, 0)
    this.set('armL', -0.4 - s * 0.75 + tuck * 0.25, 0, 0.35)
    this.set('armR', -0.4 + s * 0.75 + tuck * 0.25, 0, -0.35)
    this.set('foreL', 0.55, 0, 0)
    this.set('foreR', 0.55, 0, 0)
    this.set('legL', 0.45 + s * 0.75 + tuck * 0.3, 0, 0)
    this.set('legR', 0.45 - s * 0.75 + tuck * 0.3, 0, 0)
    this.set('shinL', 0.55 + Math.max(0, -s) * 0.75 + tuck * 0.3, 0, 0)
    this.set('shinR', 0.55 + Math.max(0, s) * 0.75 + tuck * 0.3, 0, 0)
  }

  private poseHang(time: number, swing: number): void {
    const d = Math.sin(time * 2.6) * 0.28 + swing * 0.35
    this.set('hips', 0.05, 0, swing * 0.18)
    this.set('spine', 0.12, 0, swing * 0.12)
    this.set('head', -0.08, 0, 0)
    this.set('armL', -0.95, 0, 0.42)
    this.set('armR', -0.95, 0, -0.42)
    this.set('foreL', 0.45, 0, 0)
    this.set('foreR', 0.45, 0, 0)
    this.set('legL', 0.28 + d, 0, 0.06)
    this.set('legR', 0.12 - d, 0, -0.06)
    this.set('shinL', 0.4, 0, 0)
    this.set('shinR', 0.55, 0, 0)
  }
}
