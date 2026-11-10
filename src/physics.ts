import { TUNE } from './tune.ts'

export type Body = {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  grounded: boolean
  padId: string | null
  coyote: number
  yaw: number
}

export type Surface = {
  id: string
  y: number
  save?: boolean
  goal?: boolean
} & (
  | { kind: 'disc'; x: number; z: number; r: number }
  | { kind: 'rect'; minX: number; maxX: number; minZ: number; maxZ: number }
)

export function makeBody(x: number, y: number, z: number, yaw = 0): Body {
  return { x, y, z, vx: 0, vy: 0, vz: 0, grounded: true, padId: null, coyote: TUNE.coyote, yaw }
}

export type StepResult = {
  landed: boolean
  pad: Surface | null
  jumped: boolean
}

export function stepPlatformer(
  body: Body,
  dt: number,
  wishX: number,
  wishZ: number,
  jumpPower: number,
  surfaces: Surface[],
): StepResult {
  const wishMag = Math.hypot(wishX, wishZ)
  const rate = body.grounded
    ? wishMag > 0.02
      ? TUNE.groundAccel
      : TUNE.groundFriction
    : wishMag > 0.02
      ? TUNE.airAccel
      : TUNE.airDrag
  body.vx = approach(body.vx, wishX, rate * dt)
  body.vz = approach(body.vz, wishZ, rate * dt)

  let jumped = false
  if (jumpPower > 0 && (body.grounded || body.coyote > 0)) {
    body.vy = jumpSpeed(jumpPower)
    body.grounded = false
    body.coyote = 0
    body.padId = null
    jumped = true
    if (wishMag > 0.05) {
      const min = TUNE.maxRun * 0.92
      const along = (body.vx * wishX + body.vz * wishZ) / wishMag
      if (along < min) {
        body.vx += (wishX / wishMag) * (min - along)
        body.vz += (wishZ / wishMag) * (min - along)
      }
    }
  }

  if (!body.grounded) body.vy -= TUNE.gravity * dt

  const prevY = body.y
  body.x += body.vx * dt
  body.y += body.vy * dt
  body.z += body.vz * dt

  let landed = false
  let pad: Surface | null = null
  if (body.vy <= 0.35) {
    let best: Surface | null = null
    for (const s of surfaces) {
      if (!covers(s, body.x, body.z)) continue
      if (prevY >= s.y - 0.012 && body.y <= s.y + 0.03) {
        if (!best || s.y > best.y) best = s
      }
    }
    if (best) {
      landed = !body.grounded && body.vy < -0.35
      body.y = best.y
      body.vy = 0
      body.grounded = true
      body.padId = best.id
      pad = best
    } else {
      body.grounded = false
      body.padId = null
    }
  } else {
    body.grounded = false
    body.padId = null
  }

  if (body.grounded) body.coyote = TUNE.coyote
  else body.coyote = Math.max(0, body.coyote - dt)

  const speed = Math.hypot(body.vx, body.vz)
  if (speed > 0.05) {
    const target = Math.atan2(body.vx, body.vz)
    body.yaw = dampAngle(body.yaw, target, dt, 12)
  }

  return { landed, pad, jumped }
}

function covers(s: Surface, x: number, z: number): boolean {
  if (s.kind === 'disc') {
    const dx = x - s.x
    const dz = z - s.z
    return dx * dx + dz * dz <= s.r * s.r
  }
  return x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ
}

export function groundBelow(surfaces: Surface[], x: number, z: number, maxY: number): number {
  let y = 0
  for (const s of surfaces) {
    if (s.y > maxY + 0.02) continue
    if (!covers(s, x, z)) continue
    if (s.y > y) y = s.y
  }
  return y
}

function approach(current: number, target: number, maxDelta: number): number {
  const d = target - current
  if (Math.abs(d) <= maxDelta) return target
  return current + Math.sign(d) * maxDelta
}

/** power 0.3 is a tap hop; 1 is a full charged jump. */
export function jumpSpeed(power: number): number {
  const p = Math.min(1, Math.max(0, power))
  return TUNE.jumpV * (0.52 + 0.6 * p)
}

export function dampAngle(current: number, target: number, dt: number, sharpness: number): number {
  let d = target - current
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return current + d * Math.min(1, dt * sharpness)
}

export function wishFromCamera(
  axisX: number,
  axisY: number,
  rightX: number,
  rightZ: number,
  forwardX: number,
  forwardZ: number,
): { x: number; z: number } {
  let x = rightX * axisX + forwardX * axisY
  let z = rightZ * axisX + forwardZ * axisY
  const m = Math.hypot(x, z)
  if (m < 0.08) return { x: 0, z: 0 }
  if (m > 1) {
    x /= m
    z /= m
  }
  return { x: x * TUNE.maxRun, z: z * TUNE.maxRun }
}
