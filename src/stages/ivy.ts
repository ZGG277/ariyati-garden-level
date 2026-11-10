import * as THREE from 'three'
import type { Garden } from '../assets.ts'
import { addFence, addGround, addPollen, addWall, rng, scatterFloor, type Pollen } from '../dress.ts'
import { stepPlatformer, wishFromCamera, type Body } from '../physics.ts'
import type { Sim, Spawn, Stage } from '../stage.ts'
import { TUNE } from '../tune.ts'

type Pt = { x: number; y: number }

type Vine = {
  pts: Pt[]
  segLen: number[]
  length: number
  z: number
}

const VINE_Z = 0.034
const HAND = 0.062

const PATHS: Pt[][] = [
  [
    { x: -0.85, y: 0.1 },
    { x: -0.48, y: 0.24 },
    { x: -0.12, y: 0.36 },
    { x: 0.2, y: 0.5 },
  ],
  [
    { x: 0.38, y: 0.44 },
    { x: 0.64, y: 0.6 },
    { x: 0.88, y: 0.74 },
    { x: 0.58, y: 0.9 },
  ],
  [
    { x: 0.38, y: 1.0 },
    { x: 0.05, y: 1.14 },
    { x: -0.28, y: 1.26 },
    { x: -0.58, y: 1.4 },
  ],
  [
    { x: -0.38, y: 1.5 },
    { x: -0.02, y: 1.62 },
    { x: 0.32, y: 1.72 },
    { x: 0.62, y: 1.84 },
  ],
]

function makeVine(pts: Pt[]): Vine {
  const segLen: number[] = []
  let length = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.y - pts[i]!.y)
    segLen.push(len)
    length += len
  }
  return { pts, segLen, length, z: VINE_Z }
}

function pointOn(vine: Vine, s: number): Pt {
  let left = Math.max(0, Math.min(vine.length, s))
  for (let i = 0; i < vine.segLen.length; i++) {
    const len = vine.segLen[i]!
    if (left <= len || i === vine.segLen.length - 1) {
      const t = len === 0 ? 0 : Math.min(1, left / len)
      const a = vine.pts[i]!
      const b = vine.pts[i + 1]!
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    left -= len
  }
  return vine.pts[vine.pts.length - 1]!
}

function nearest(vine: Vine, x: number, y: number): { s: number; d: number; x: number; y: number } {
  let best = { s: 0, d: Infinity, x: vine.pts[0]!.x, y: vine.pts[0]!.y }
  let base = 0
  for (let i = 0; i < vine.segLen.length; i++) {
    const a = vine.pts[i]!
    const b = vine.pts[i + 1]!
    const abx = b.x - a.x
    const aby = b.y - a.y
    const len2 = abx * abx + aby * aby
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / len2))
    const px = a.x + abx * t
    const py = a.y + aby * t
    const d = Math.hypot(x - px, y - py)
    if (d < best.d) best = { s: base + Math.sqrt(len2) * t, d, x: px, y: py }
    base += vine.segLen[i]!
  }
  return best
}

export function createIvy(garden: Garden): Stage {
  const group = new THREE.Group()
  const vines = PATHS.map(makeVine)
  const rand = rng(11)
  const leaves: { mesh: THREE.Object3D; base: number; phase: number }[] = []

  addGround(group, 3.2, 2.2, 0)
  addWall(group, garden, 4, 3, new THREE.Vector3(0, 0, 0), 0)

  const fence = addFence(group, 2.35, 0.34, 0.055)
  fence.position.set(-1.18, 1.8, -0.05)

  for (let v = 0; v < vines.length; v++) {
    const vine = vines[v]!
    for (let s = 0; s <= vine.length; s += 0.15) {
      const p = pointOn(vine, s)
      const leaf = garden.clone('ivy_leaf')
      leaf.rotation.x = Math.PI / 2
      leaf.rotation.y = (rand() - 0.5) * 0.9
      leaf.rotation.z = (rand() - 0.5) * 0.25
      leaf.position.set(p.x, p.y - 0.01, 0.012)
      group.add(leaf)
      leaves.push({ mesh: leaf, base: leaf.rotation.z, phase: rand() * 6 })
      if (rand() > 0.55) {
        const drop = garden.clone('dewdrop')
        drop.position.set(p.x + (rand() - 0.5) * 0.03, p.y, 0.04)
        group.add(drop)
      }
    }
    const at = 0.48
    {
      const p = pointOn(vine, vine.length * at)
      const stem = garden.clone('ivy_stem')
      const ahead = pointOn(vine, Math.min(vine.length, vine.length * at + 0.12))
      stem.rotation.z = Math.atan2(ahead.y - p.y, ahead.x - p.x)
      stem.position.set(p.x, p.y - 0.02, -0.12)
      group.add(stem)
      const tendril = garden.clone('ivy_tendril')
      tendril.position.set(p.x + 0.02, p.y, 0.03)
      tendril.rotation.set(rand(), rand(), rand())
      group.add(tendril)
    }
  }

  const bug = garden.clone('ladybug')
  bug.position.set(-0.72, 0.16, 0.045)
  group.add(bug)

  for (const [x, z] of [
    [-1.4, 0.18],
    [-1.35, 0.42],
    [1.4, 0.2],
    [1.35, 0.45],
  ] as const) {
    const tuft = garden.clone('grass_tuft')
    tuft.position.set(x, 0, z)
    tuft.rotation.y = rand() * 6
    group.add(tuft)
  }
  scatterFloor(garden, group, rand, 16, { minX: -1.2, maxX: 1.2, minZ: 0.2, maxZ: 0.7 })
  const pollen = addPollen(group, 36, { x: 0, y: 0.1, z: 0.2, w: 2, h: 1.6, d: 0.5 })

  const surfaces = [
    {
      kind: 'rect' as const,
      id: 'base',
      y: 0,
      minX: -1.2,
      maxX: 1.2,
      minZ: 0.02,
      maxZ: 0.48,
    },
  ]

  const spawn: Spawn = { x: -0.9, y: 0, z: 0.16, yaw: Math.PI }
  let attached = false
  let vineIndex = 0
  let along = 0
  let grabLock = 0
  let jumpBuf = 0
  let bestVine = -1
  let bestS = -1

  function stick(body: Body): void {
    const vine = vines[vineIndex]!
    const p = pointOn(vine, along)
    body.x = p.x
    body.y = p.y - HAND
    body.z = vine.z
    body.vx = 0
    body.vy = 0
    body.vz = 0
    body.grounded = false
    body.yaw = Math.PI
    body.padId = null
  }

  function remember(ctx: Sim): void {
    if (vineIndex > bestVine || (vineIndex === bestVine && along > bestS + 0.08)) {
      bestVine = vineIndex
      bestS = along
      const vine = vines[vineIndex]!
      const p = pointOn(vine, along)
      ctx.save({
        x: p.x,
        y: p.y - HAND,
        z: vine.z,
        yaw: Math.PI,
        vine: { index: vineIndex, s: along },
      })
    }
  }

  const stage: Stage = {
    id: 'ivy',
    title: '爬山虎攀爬',
    objective: '顺着藤叶爬上墙头',
    hint: '左右滑动挪步 · 上下滑动攀爬 · 点按起跳',
    failLine: '手滑了',
    winLine: '爬上墙头了',
    group,
    spawn,
    fogColor: 0xd7e7cf,
    fogNear: 1.4,
    fogFar: 6,
    surfaces,
    status: '',
    climbing: false,
    applySpawn(next, body) {
      jumpBuf = 0
      grabLock = 0.12
      body.x = next.x
      body.y = next.y
      body.z = next.z
      body.vx = body.vy = body.vz = 0
      body.yaw = next.yaw
      body.coyote = TUNE.coyote
      body.grounded = !next.vine
      body.padId = next.vine ? null : 'base'
      if (next.vine) {
        attached = true
        vineIndex = next.vine.index
        along = next.vine.s
        bestVine = next.vine.index
        bestS = next.vine.s
        stick(body)
      } else {
        attached = false
        bestVine = -1
        bestS = -1
      }
      stage.climbing = attached
    },
    simulate(ctx) {
      const locked = ctx.lock > 0
      const axisX = locked ? 0 : ctx.input.axisX
      const axisY = locked ? 0 : ctx.input.axisY
      const jumped = ctx.input.consumeJump()
      grabLock = Math.max(0, grabLock - ctx.dt)

      if (attached) {
        const vine = vines[vineIndex]!
        if (!locked && jumped) {
          attached = false
          stage.climbing = false
          grabLock = 0.2
          ctx.body.vy = TUNE.jumpV * 0.94
          ctx.body.vx = axisX * 0.5
          ctx.body.vz = axisY < -0.45 ? 0.45 : 0.02
          ctx.body.grounded = false
          ctx.sfx.jump()
        } else {
          const dir = axisY > 0.22 ? 1 : axisY < -0.22 ? -1 : 0
          along = Math.max(0, Math.min(vine.length, along + dir * TUNE.climbSpeed * ctx.dt))
          if (Math.abs(axisX) > 0.62 && Math.abs(axisY) < 0.4) {
            const cur = pointOn(vine, along)
            let best: { i: number; s: number; d: number } | null = null
            for (let i = 0; i < vines.length; i++) {
              if (i === vineIndex) continue
              const hit = nearest(vines[i]!, cur.x, cur.y)
              const dx = hit.x - cur.x
              if (Math.abs(dx) > 0.02 && Math.sign(dx) !== Math.sign(axisX)) continue
              if (hit.d < 0.11 && Math.abs(hit.y - cur.y) < 0.1 && (!best || hit.d < best.d)) {
                best = { i, s: hit.s, d: hit.d }
              }
            }
            if (best) {
              vineIndex = best.i
              along = best.s
              ctx.sfx.grab()
            }
          }
          stick(ctx.body)
          remember(ctx)
          if (vineIndex === vines.length - 1 && along > vine.length - 0.04) return 'win'
        }
      } else {
        if (!locked && jumped) jumpBuf = TUNE.jumpBuffer
        jumpBuf = Math.max(0, jumpBuf - ctx.dt)
        const wish = wishFromCamera(axisX, axisY, ctx.rightX, ctx.rightZ, ctx.forwardX, ctx.forwardZ)
        const step = stepPlatformer(ctx.body, ctx.dt, wish.x, wish.z, !locked && jumpBuf > 0, surfaces)
        if (step.jumped) {
          jumpBuf = 0
          ctx.sfx.jump()
        }
        if (step.landed) ctx.sfx.land()
        if (ctx.body.z < 0.02) {
          ctx.body.z = 0.02
          ctx.body.vz = Math.max(0, ctx.body.vz)
        }
        if (grabLock <= 0 && ctx.body.vz < 0.3) {
          const handY = ctx.body.y + HAND
          let best: { i: number; s: number; d: number } | null = null
          for (let i = 0; i < vines.length; i++) {
            const hit = nearest(vines[i]!, ctx.body.x, handY)
            const d = Math.hypot(hit.d, ctx.body.z - vines[i]!.z)
            if (d < TUNE.gripRadius && (!best || d < best.d)) best = { i, s: hit.s, d }
          }
          if (best) {
            attached = true
            stage.climbing = true
            vineIndex = best.i
            along = best.s
            stick(ctx.body)
            remember(ctx)
            ctx.sfx.grab()
          }
        }
        const out =
          ctx.body.y < -0.28 ||
          ctx.body.z > 0.9 ||
          ((ctx.body.x < -1.45 || ctx.body.x > 1.45) && ctx.body.y < 0.45)
        if (!locked && out) ctx.fail()
      }

      for (const leaf of leaves) {
        leaf.mesh.rotation.z = leaf.base + Math.sin(ctx.time * 1.3 + leaf.phase) * 0.045
      }
      bug.position.x = -0.72 + Math.sin(ctx.time * 0.7) * 0.02
      bug.rotation.y = ctx.time * 0.8
      pollen.update(ctx.time)
      stage.climbing = attached
      return 'play'
    },
    camera(pos, look, body, aspect) {
      const dist = aspect < 0.9 ? 0.62 : 0.5
      const x = body.x * 0.88
      pos.set(x, body.y + 0.02, dist)
      look.set(x, body.y + 0.16, 0)
    },
    dispose() {
      disposePollen(pollen)
    },
  }

  stage.applySpawn(spawn, { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true, padId: null, coyote: 0, yaw: 0 })
  return stage
}

function disposePollen(pollen: Pollen): void {
  void pollen
}
