import * as THREE from 'three'
import type { Garden, Wind } from '../assets.ts'
import {
  addFence,
  addGround,
  addPollen,
  addWall,
  cluster,
  placeDaisy,
  rng,
  scatterFloor,
} from '../dress.ts'
import type { Stage } from '../stage.ts'
import { TUNE } from '../tune.ts'

export function createHub(garden: Garden): Stage {
  const group = new THREE.Group()
  const rand = rng(7)
  const winds: Wind[] = []

  addGround(group, 3.4, 3.2, 0)
  const wall = addWall(group, garden, 3, 3, new THREE.Vector3(-0.72, 0, 0.05), Math.PI / 2)
  const fence = addFence(wall, 1.75, 0.32, 0.06)
  fence.position.set(-0.88, 1.8, 0.02)

  for (let i = 0; i < 10; i++) {
    const leaf = garden.clone('ivy_leaf')
    leaf.rotation.x = Math.PI / 2
    leaf.rotation.y = rand() * 3
    leaf.position.set(-0.55 + rand() * 1.1, 0.25 + rand() * 1.35, 0.03)
    wall.add(leaf)
  }
  const stem = garden.clone('ivy_stem')
  stem.position.set(0.1, 0.7, -0.02)
  stem.rotation.z = 0.8
  wall.add(stem)

  cluster(garden, group, 'daisy', 0.05, 0.12, 5, 0.08, rand)
  cluster(garden, group, 'clover', 0.22, -0.08, 4, 0.07, rand)
  cluster(garden, group, 'daisy', -0.05, -0.22, 3, 0.06, rand)
  placeDaisy(garden, group, 0.12, 0.02, 0.4)

  for (let i = 0; i < 3; i++) {
    const fox = garden.clone('foxtail')
    fox.position.set(0.48 + i * 0.18, 0, -0.35 + i * 0.22)
    fox.rotation.y = (i - 1) * 0.25
    winds.push(garden.wind(fox, 0.12, 1.3, i * 1.4))
    group.add(fox)
  }

  for (let i = 0; i < 5; i++) {
    const tuft = garden.clone('grass_tuft')
    tuft.position.set(-0.2 + i * 0.22, 0, 0.55)
    tuft.rotation.y = rand() * 6
    group.add(tuft)
  }
  const bug = garden.clone('ladybug')
  bug.position.set(0.16, 0.2, 0.08)
  group.add(bug)
  const shroom = garden.clone('mushroom')
  shroom.position.set(0.42, 0, 0.28)
  group.add(shroom)
  scatterFloor(garden, group, rand, 20, { minX: -0.2, maxX: 0.9, minZ: -0.2, maxZ: 0.7 })
  const pollen = addPollen(group, 28, { x: 0.1, y: 0.05, z: 0.05, w: 1.6, h: 0.7, d: 1.4 })

  const spawn = { x: 0.12, y: 0.182, z: 0.02, yaw: 0.85 }

  return {
    id: 'hub',
    title: '花园',
    objective: '选一段路，或者连续闯过三关',
    hint: '',
    failLine: '',
    winLine: '',
    group,
    spawn,
    fogColor: 0xdcead4,
    fogNear: 2.2,
    fogFar: 8,
    surfaces: [],
    status: '',
    climbing: false,
    climbRate: 0,
    hanging: false,
    swing: 0,
    applySpawn(next, body) {
      body.x = next.x
      body.y = next.y
      body.z = next.z
      body.vx = body.vy = body.vz = 0
      body.yaw = next.yaw
      body.grounded = true
      body.coyote = TUNE.coyote
      body.padId = null
    },
    simulate(ctx) {
      ctx.input.consumeJump()
      for (const w of winds) w.uniforms.uTime.value = ctx.time
      bug.position.x = 0.16 + Math.sin(ctx.time * 0.6) * 0.012
      bug.rotation.y = ctx.time * 0.4
      pollen.update(ctx.time)
      return 'play'
    },
    camera(pos, look, _body, _aspect, time) {
      const wobble = Math.sin(time * 0.35) * 0.05
      pos.set(0.78 + wobble, 0.58, 0.86)
      look.set(0.02, 0.2, 0.02)
    },
    dispose() {
      for (const w of winds) w.dispose()
    },
  }
}
