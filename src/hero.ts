import * as THREE from 'three'
import type { Body } from './physics.ts'

/** Added to the mesh yaw if the glTF faces a direction other than +Z. */
export const FACE_OFFSET = 0

export class Hero {
  readonly root = new THREE.Group()
  private readonly visual = new THREE.Group()
  private bob = 0
  private squash = 0

  constructor(template: THREE.Object3D) {
    this.visual.add(template)
    this.root.add(this.visual)
  }

  place(body: Body): void {
    this.root.position.set(body.x, body.y, body.z)
    this.root.rotation.y = body.yaw + FACE_OFFSET
  }

  bounce(): void {
    this.squash = 1
  }

  update(dt: number, moving: boolean, airborne: boolean, climbing: boolean, vy: number): void {
    const tempo = moving ? 14 : 2.2
    this.bob += dt * tempo
    const hop = moving && !airborne ? Math.abs(Math.sin(this.bob)) * 0.0035 : 0
    this.visual.position.y = hop
    this.visual.position.x = climbing ? Math.sin(this.bob * 1.3) * 0.003 : 0
    this.squash = Math.max(0, this.squash - dt * 3.2)
    const sy = 1 - this.squash * 0.22
    const sx = 1 + this.squash * 0.14
    this.visual.scale.set(sx, sy, sx)
    this.visual.rotation.x = airborne ? THREE.MathUtils.clamp(-vy * 0.22, -0.45, 0.35) : 0
    this.visual.rotation.z = climbing ? Math.sin(this.bob) * 0.12 : 0
  }
}
