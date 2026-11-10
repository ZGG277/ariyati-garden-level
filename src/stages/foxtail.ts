import * as THREE from 'three'
import { foxtailSway, foxtailSwayVel, type Garden, type Wind } from '../assets.ts'
import {
  addFence,
  addGround,
  addPollen,
  cluster,
  placeStone,
  rng,
  scatterFloor,
} from '../dress.ts'
import { jumpSpeed, stepPlatformer, wishFromCamera, type Surface } from '../physics.ts'
import type { Stage } from '../stage.ts'
import { TUNE } from '../tune.ts'

const STALK_X = -0.02
const HAND = 0.064

type Stem = {
  x: number
  z: number
  phase: number
  speed: number
  amp: number
  wind: Wind
  play: boolean
}

function gust(time: number): number {
  return 0.86 + 0.14 * Math.sin(time * 0.33)
}

export function createFoxtail(garden: Garden): Stage {
  const group = new THREE.Group()
  const rand = rng(41)
  const winds: Wind[] = []
  addGround(group, 4.6, 2.6, 0)

  const start = { x: 0, z: 0, y: 0.05, r: 0.22 }
  const goal = { x: 2.5, z: 0, y: 0.055, r: 0.22 }
  placeStone(garden, group, start.x, start.z, start.y)
  placeStone(garden, group, goal.x, goal.z, goal.y)
  cluster(garden, group, 'clover', goal.x, goal.z + 0.08, 3, 0.06, rand)
  cluster(garden, group, 'daisy', goal.x - 0.08, goal.z - 0.1, 3, 0.06, rand)

  const playX = [0.36, 0.74, 1.12, 1.5, 1.9]
  const stems: Stem[] = []

  const addStem = (x: number, z: number, phase: number, play: boolean) => {
    const mesh = garden.clone('foxtail')
    mesh.position.set(x, 0, z)
    mesh.rotation.y = play ? 0 : (rand() - 0.5) * 0.5
    const wind = garden.wind(mesh, 0.17, 1.65, phase)
    winds.push(wind)
    group.add(mesh)
    if (play) {
      stems.push({ x, z, phase, speed: 1.65, amp: 0.17, wind, play })
    }
  }

  playX.forEach((x, i) => addStem(x, 0, i * 1.85, true))
  for (let i = 0; i < 5; i++) {
    addStem(0.25 + i * 0.5, i % 2 === 0 ? -0.48 : 0.55, i * 1.3 + 0.4, false)
  }

  for (let i = 0; i < 6; i++) {
    const tuft = garden.clone('grass_tuft')
    tuft.position.set(-0.2 + i * 0.5, 0, i % 2 === 0 ? 0.38 : -0.36)
    tuft.rotation.y = rand() * 6
    group.add(tuft)
  }
  scatterFloor(garden, group, rand, 18, { minX: -0.3, maxX: 2.8, minZ: -0.7, maxZ: 0.7 })

  const streakMat = new THREE.MeshBasicMaterial({
    color: 0xfffaf0,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  })
  const streaks: THREE.Mesh[] = []
  for (let i = 0; i < 7; i++) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.004), streakMat)
    mesh.position.set(-0.4 + i * 0.35, 0.18 + (i % 3) * 0.16, 0.12 + (i % 2) * 0.08)
    group.add(mesh)
    streaks.push(mesh)
  }

  const fence = addFence(group, 1.8, 1, 0.09)
  fence.position.set(0.4, 0, -0.95)

  const pollen = addPollen(group, 30, { x: 1.2, y: 0.05, z: 0, w: 3, h: 0.7, d: 1 })

  const stonePad = (id: string, x: number, z: number, y: number, goal = false): Surface => ({
    kind: 'rect',
    id,
    y,
    minX: x - 0.27,
    maxX: x + 0.27,
    minZ: z - 0.27,
    maxZ: z + 0.27,
    save: true,
    goal,
  })
  const surfaces: Surface[] = [stonePad('start', start.x, start.z, start.y), stonePad('goal', goal.x, goal.z, goal.y, true)]

  const spawn = { x: start.x, y: start.y, z: 0.02, yaw: Math.PI / 2 }
  let attached = -1
  let hand = 0.34
  let grabLock = 0
  let queued = 0
  let queueLeft = 0
  let bestStem = -1
  let now = 0

  function sample(index: number, handY: number, time: number): { x: number; vx: number } {
    const stem = stems[index]!
    const amp = stem.amp * gust(time)
    const sway = foxtailSway(time, amp, stem.speed, stem.phase, handY)
    const vx = foxtailSwayVel(time, amp, stem.speed, stem.phase, handY)
    return { x: stem.x + STALK_X + sway, vx }
  }

  const stage: Stage = {
    id: 'foxtail',
    title: '风中狗尾草',
    objective: '爬高一点，顺着风跳过草茎',
    hint: '左右靠近 · 抓住后上下爬 · 按住松手跳',
    failLine: '被风吹下去了',
    winLine: '穿过风区了',
    group,
    spawn,
    fogColor: 0xd5e4d4,
    fogNear: 1.8,
    fogFar: 7.5,
    surfaces,
    status: '',
    climbing: false,
    climbRate: 0,
    hanging: false,
    swing: 0,
    applySpawn(next, body) {
      queued = 0
      queueLeft = 0
      grabLock = 0.15
      body.vx = body.vy = body.vz = 0
      body.yaw = Math.PI / 2
      body.coyote = TUNE.coyote
      if (next.stem) {
        attached = next.stem.index
        hand = next.stem.hand
        bestStem = next.stem.index
        const p = sample(attached, hand, now)
        body.x = p.x
        body.y = hand - HAND
        body.z = stems[attached]!.z + 0.02
        body.grounded = false
        body.padId = null
      } else {
        attached = -1
        bestStem = -1
        hand = 0.34
        body.x = next.x
        body.y = next.y
        body.z = next.z
        body.grounded = true
        body.padId = 'start'
      }
      stage.hanging = attached >= 0
      stage.climbing = false
      stage.status = ''
    },
    simulate(ctx) {
      const time = ctx.time
      now = time
      for (const stem of stems) {
        stem.wind.uniforms.uTime.value = time
        stem.wind.uniforms.uAmp.value = stem.amp * gust(time)
      }
      for (const w of winds) {
        if (!stems.some((s) => s.wind === w)) {
          w.uniforms.uTime.value = time
          w.uniforms.uAmp.value = 0.14 * gust(time)
        }
      }

      const locked = ctx.lock > 0
      const axisX = locked ? 0 : ctx.input.axisX
      const axisY = locked ? 0 : ctx.input.axisY
      const released = ctx.input.consumeJump()
      grabLock = Math.max(0, grabLock - ctx.dt)

      if (attached >= 0) {
        hand = Math.max(0.18, Math.min(0.52, hand + axisY * 0.26 * ctx.dt))
        const p = sample(attached, hand, time)
        ctx.body.x = p.x
        ctx.body.y = hand - HAND
        ctx.body.z = stems[attached]!.z + 0.02
        ctx.body.vx = p.vx
        ctx.body.vy = 0
        ctx.body.vz = 0
        ctx.body.yaw = Math.PI / 2
        ctx.body.grounded = false
        if (attached > bestStem) {
          bestStem = attached
          ctx.save({
            x: p.x,
            y: hand - HAND,
            z: ctx.body.z,
            yaw: Math.PI / 2,
            stem: { index: attached, hand },
          })
        }
        const next = attached + 1 < stems.length ? sample(attached + 1, hand, time) : null
        const targetX = next ? next.x : goal.x - goal.r
        const gap = targetX - p.x
        stage.status = gap > 0.03 && gap < 0.2 ? '可以跳' : ''
        if (!locked && released > 0) {
          attached = -1
          stage.hanging = false
          grabLock = 0.22
          stage.status = ''
          ctx.body.vy = jumpSpeed(released)
          const bias = Math.abs(axisX) > 0.18 ? axisX * 0.36 : 0.18
          ctx.body.vx = p.vx + bias * (0.7 + 0.5 * released)
          ctx.body.vz = 0
          ctx.sfx.jump()
        }
      } else {
        stage.status = ''
        if (!locked && released > 0) {
          queued = released
          queueLeft = TUNE.jumpBuffer
        }
        const wish = wishFromCamera(axisX, axisY, ctx.rightX, ctx.rightZ, ctx.forwardX, ctx.forwardZ)
        const step = stepPlatformer(ctx.body, ctx.dt, wish.x, wish.z, locked ? 0 : queued, surfaces)
        if (step.jumped) {
          queued = 0
          queueLeft = 0
          ctx.sfx.jump()
        } else {
          queueLeft = Math.max(0, queueLeft - ctx.dt)
          if (queueLeft <= 0) queued = 0
        }
        if (step.landed) ctx.sfx.land()
        ctx.body.z = Math.max(-0.06, Math.min(0.1, ctx.body.z))
        if (step.pad?.goal && ctx.body.grounded) return 'win'
        if (grabLock <= 0) {
          const hy = ctx.body.y + HAND
          if (hy > 0.16 && hy < 0.54) {
            let best = -1
            let bestD = TUNE.stemGrab
            for (let i = 0; i < stems.length; i++) {
              const p = sample(i, hy, time)
              const d = Math.hypot(ctx.body.x - p.x, ctx.body.z - stems[i]!.z)
              if (d < bestD) {
                bestD = d
                best = i
              }
            }
            if (best >= 0) {
              attached = best
              hand = hy
              stage.hanging = true
              ctx.sfx.grab()
            }
          }
        }
        if (!locked && ctx.body.y < -0.05) ctx.fail()
      }

      for (let i = 0; i < streaks.length; i++) {
        const s = streaks[i]!
        s.position.x += ctx.dt * (0.55 + (i % 3) * 0.15)
        if (s.position.x > 2.8) s.position.x = -0.5
      }
      pollen.update(time)
      stage.climbing = false
      stage.hanging = attached >= 0
      stage.climbRate = attached >= 0 ? axisY * 0.26 : 0
      stage.swing = attached >= 0 ? ctx.body.vx : 0
      return 'play'
    },
    camera(pos, look, body, aspect) {
      const z = aspect < 0.9 ? 1.2 : 1.02
      pos.set(body.x - 0.18, body.y * 0.35 + 0.32, z)
      look.set(body.x + 0.32, body.y * 0.4 + 0.18, 0)
    },
    dispose() {
      for (const w of winds) w.dispose()
      streakMat.dispose()
    },
  }

  return stage
}
