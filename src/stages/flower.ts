import * as THREE from 'three'
import type { Garden } from '../assets.ts'
import {
  addGround,
  addPath,
  addPollen,
  cluster,
  placeStone,
  rng,
  scatterFloor,
} from '../dress.ts'
import { stepPlatformer, wishFromCamera, type Surface } from '../physics.ts'
import type { Stage } from '../stage.ts'
import { TUNE } from '../tune.ts'

type Pad = {
  id: string
  x: number
  z: number
  y: number
  r: number
  kind: 'stone' | 'daisy' | 'clover'
  n: number
  goal?: boolean
}

const PADS: Pad[] = [
  { id: 'start', x: 0, z: 0, y: 0.046, r: 0.24, kind: 'stone', n: 0 },
  { id: 'd1', x: 0.4, z: 0, y: 0.16, r: 0.14, kind: 'daisy', n: 6 },
  { id: 'c1', x: 0.88, z: 0, y: 0.135, r: 0.15, kind: 'clover', n: 5 },
  { id: 'd2', x: 1.32, z: 0, y: 0.17, r: 0.13, kind: 'daisy', n: 5 },
  { id: 'c2', x: 1.74, z: 0, y: 0.14, r: 0.14, kind: 'clover', n: 4 },
  { id: 'd3', x: 2.16, z: 0, y: 0.17, r: 0.13, kind: 'daisy', n: 5 },
  { id: 'goal', x: 2.73, z: 0, y: 0.05, r: 0.22, kind: 'stone', n: 0, goal: true },
]

export function createFlower(garden: Garden): Stage {
  const group = new THREE.Group()
  const rand = rng(23)
  addGround(group, 4.4, 2.4, 0)
  addPath(group, 1.25, 0, 3.3, 0.22)

  for (const pad of PADS) {
    if (pad.kind === 'stone') placeStone(garden, group, pad.x, pad.z, pad.y)
    else cluster(garden, group, pad.kind, pad.x, pad.z, pad.n, pad.r * 0.55, rand)
  }

  for (let i = 0; i < 5; i++) {
    const x = 0.35 + i * 0.42
    const side = i % 2 === 0 ? 1 : -1
    cluster(garden, group, i % 2 === 0 ? 'clover' : 'daisy', x, side * (0.48 + rand() * 0.12), 2, 0.05, rand)
  }
  for (const [x, z] of [
    [-0.15, 0.55],
    [0.7, -0.58],
    [1.7, 0.6],
    [2.35, -0.55],
  ] as const) {
    const tuft = garden.clone('grass_tuft')
    tuft.position.set(x, 0, z)
    tuft.rotation.y = rand() * 6
    group.add(tuft)
  }

  const bug = garden.clone('ladybug')
  bug.position.set(0.5, 0.195, 0.09)
  group.add(bug)
  const mushroom = garden.clone('mushroom')
  mushroom.position.set(1.15, 0, 0.28)
  mushroom.rotation.y = 0.6
  group.add(mushroom)
  scatterFloor(garden, group, rand, 22, { minX: -0.4, maxX: 2.9, minZ: -0.7, maxZ: 0.7 })
  const pollen = addPollen(group, 40, { x: 1.2, y: 0.05, z: 0, w: 3, h: 0.45, d: 1.2 })

  const surfaces: Surface[] = PADS.map((pad) =>
    pad.kind === 'stone'
      ? {
          kind: 'rect' as const,
          id: pad.id,
          y: pad.y,
          minX: pad.x - 0.27,
          maxX: pad.x + 0.27,
          minZ: pad.z - 0.27,
          maxZ: pad.z + 0.27,
          save: true,
          goal: pad.goal,
        }
      : {
          kind: 'disc' as const,
          id: pad.id,
          x: pad.x,
          z: pad.z,
          y: pad.y,
          r: pad.r,
          save: true,
          goal: pad.goal,
        },
  )

  const spawn = { x: 0, y: PADS[0]!.y, z: 0, yaw: Math.PI / 2 }
  let jumpBuf = 0
  let bestX = spawn.x

  return {
    id: 'flower',
    title: '花朵横跳',
    objective: '跳过雏菊和三叶草，到达对岸',
    hint: '滑动移动 · 点按跳跃',
    failLine: '掉进花径里了',
    winLine: '到达对岸了',
    group,
    spawn,
    fogColor: 0xd9ead0,
    fogNear: 1.6,
    fogFar: 7,
    surfaces,
    status: '',
    climbing: false,
    applySpawn(next, body) {
      jumpBuf = 0
      bestX = next.x
      body.x = next.x
      body.y = next.y
      body.z = next.z
      body.vx = body.vy = body.vz = 0
      body.yaw = next.yaw
      body.grounded = true
      body.coyote = TUNE.coyote
      body.padId = 'start'
    },
    simulate(ctx) {
      const locked = ctx.lock > 0
      const axisX = locked ? 0 : ctx.input.axisX
      const axisY = locked ? 0 : ctx.input.axisY
      const jumped = ctx.input.consumeJump()
      if (!locked && jumped) jumpBuf = TUNE.jumpBuffer
      jumpBuf = Math.max(0, jumpBuf - ctx.dt)
      const wish = wishFromCamera(axisX, axisY, ctx.rightX, ctx.rightZ, ctx.forwardX, ctx.forwardZ)
      const step = stepPlatformer(ctx.body, ctx.dt, wish.x, wish.z, !locked && jumpBuf > 0, surfaces)
      if (step.jumped) {
        jumpBuf = 0
        ctx.sfx.jump()
      }
      if (step.landed) ctx.sfx.land()
      if (step.pad?.goal && ctx.body.grounded) return 'win'
      if (step.pad?.save && step.pad.kind === 'disc' && step.pad.x > bestX + 0.02) {
        bestX = step.pad.x
        ctx.save({ x: step.pad.x, y: step.pad.y, z: step.pad.z, yaw: ctx.body.yaw })
      }
      bug.position.x = 0.5 + Math.sin(ctx.time * 0.8) * 0.015
      bug.rotation.y = -ctx.time * 0.5
      pollen.update(ctx.time)
      if (!locked && ctx.body.y < -0.06) ctx.fail()
      return 'play'
    },
    camera(pos, look, body, aspect) {
      const back = aspect < 0.9 ? 0.82 : 0.64
      pos.set(body.x - back, body.y + 0.24, body.z + 0.02)
      look.set(body.x + 0.32, body.y + 0.06, body.z)
    },
    dispose() {
      void pollen
    },
  }
}
