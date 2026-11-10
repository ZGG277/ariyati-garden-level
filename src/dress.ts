import * as THREE from 'three'
import type { Garden } from './assets.ts'

const wood = new THREE.MeshStandardMaterial({ color: 0xe6d3b4, roughness: 0.92, metalness: 0 })
const soilMat = new THREE.MeshStandardMaterial({ color: 0xd7e2c4, roughness: 1, metalness: 0 })
const pathMat = new THREE.MeshStandardMaterial({ color: 0xe6d4b4, roughness: 1, metalness: 0 })

let groundTexture: THREE.CanvasTexture | null = null

export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function mossTexture(): THREE.CanvasTexture {
  if (groundTexture) return groundTexture
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = '#d5e3c2'
  g.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 2200; i++) {
    g.globalAlpha = 0.22
    g.fillStyle = i % 3 === 0 ? '#edf5e4' : i % 3 === 1 ? '#b7cb9c' : '#c9d8ae'
    g.beginPath()
    g.arc(Math.random() * 512, Math.random() * 512, 6 + Math.random() * 28, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3, 3)
  groundTexture = tex
  return tex
}

export function addGround(parent: THREE.Object3D, w: number, d: number, y = 0): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, d)
  const mat = soilMat.clone()
  mat.map = mossTexture()
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = y
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

export function addPath(parent: THREE.Object3D, x: number, z: number, length: number, width: number): void {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(length, width), pathMat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(x, 0.004, z)
  mesh.receiveShadow = true
  parent.add(mesh)
}

/**
 * wall_brick.glb lies flat: 0.6 × 0.168 × 0.6, thickness along +Y.
 * Stood up, one panel is 0.6 m wide, 0.6 m tall, 0.168 m thick,
 * front face on local z = 0, thickness toward −Z.
 */
export function wallPanel(garden: Garden): THREE.Group {
  const group = new THREE.Group()
  const mesh = garden.clone('wall_brick')
  // Slab is authored flat. Stand it up and turn the far large face toward +Z.
  mesh.rotation.set(-Math.PI / 2, Math.PI, 0)
  mesh.position.set(0, 0.3, -0.168)
  group.add(mesh)
  return group
}

export function addWall(
  parent: THREE.Object3D,
  garden: Garden,
  cols: number,
  rows: number,
  origin: THREE.Vector3,
  rotY = 0,
): THREE.Group {
  const wall = new THREE.Group()
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const panel = wallPanel(garden)
      panel.position.set((col - (cols - 1) / 2) * 0.59, row * 0.6, 0)
      wall.add(panel)
    }
  }
  wall.position.copy(origin)
  wall.rotation.y = rotY
  parent.add(wall)
  return wall
}

/** Low picket topping. Concept art shows this on the wall, shorter than a 1 m yard fence. */
export function addFence(parent: THREE.Object3D, length: number, postH = 0.36, gap = 0.045): THREE.Group {
  const group = new THREE.Group()
  const postGeo = new THREE.BoxGeometry(0.014, postH, 0.014)
  const railGeo = new THREE.BoxGeometry(length, 0.01, 0.01)
  const count = Math.max(2, Math.round(length / gap))
  for (let i = 0; i <= count; i++) {
    const post = new THREE.Mesh(postGeo, wood)
    post.position.set((i / count) * length, postH / 2, 0)
    post.castShadow = true
    group.add(post)
  }
  for (const h of [postH * 0.35, postH * 0.72]) {
    const rail = new THREE.Mesh(railGeo, wood)
    rail.position.set(length / 2, h, 0)
    rail.castShadow = true
    group.add(rail)
  }
  parent.add(group)
  return group
}

/** Daisy flower head sits near local (−0.011, 0.185, 0.015). */
export function placeDaisy(garden: Garden, parent: THREE.Object3D, x: number, z: number, yaw = 0): THREE.Object3D {
  const mesh = garden.clone('daisy')
  mesh.position.set(x + 0.011, 0, z - 0.015)
  mesh.rotation.y = yaw
  parent.add(mesh)
  return mesh
}

export function placeClover(garden: Garden, parent: THREE.Object3D, x: number, z: number, yaw = 0): THREE.Object3D {
  const mesh = garden.clone('clover_ball')
  mesh.position.set(x, 0, z)
  mesh.rotation.y = yaw
  parent.add(mesh)
  return mesh
}

export function cluster(
  garden: Garden,
  parent: THREE.Object3D,
  kind: 'daisy' | 'clover',
  x: number,
  z: number,
  n: number,
  spread: number,
  rand: () => number,
): void {
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2
    const r = n === 1 ? 0 : Math.sqrt(rand()) * spread
    const px = x + Math.cos(a) * r
    const pz = z + Math.sin(a) * r
    if (kind === 'daisy') placeDaisy(garden, parent, px, pz, rand() * 6.28)
    else placeClover(garden, parent, px, pz, rand() * 6.28)
  }
}

/** Stepping stone. Top face ends up at `top`. */
export function placeStone(garden: Garden, parent: THREE.Object3D, x: number, z: number, top: number): THREE.Object3D {
  const mesh = garden.clone('wall_brick')
  mesh.position.set(x, top - 0.168, z)
  mesh.rotation.y = 0.2
  parent.add(mesh)
  return mesh
}

export function scatterFloor(
  garden: Garden,
  parent: THREE.Object3D,
  rand: () => number,
  count: number,
  area: { minX: number; maxX: number; minZ: number; maxZ: number },
): void {
  const kinds = ['pebble', 'pebble', 'fallen_leaf', 'fallen_leaf', 'dewdrop'] as const
  for (let i = 0; i < count; i++) {
    const name = kinds[i % kinds.length]!
    const mesh = garden.clone(name)
    mesh.position.set(
      THREE.MathUtils.lerp(area.minX, area.maxX, rand()),
      name === 'dewdrop' ? 0.012 : 0.002,
      THREE.MathUtils.lerp(area.minZ, area.maxZ, rand()),
    )
    mesh.rotation.y = rand() * Math.PI * 2
    if (name === 'fallen_leaf') mesh.rotation.x = -Math.PI / 2 + (rand() - 0.5) * 0.4
    parent.add(mesh)
  }
}

export type Pollen = { update: (time: number) => void }

export function addPollen(parent: THREE.Object3D, n: number, box: { x: number; y: number; z: number; w: number; h: number; d: number }): Pollen {
  const positions = new Float32Array(n * 3)
  const seeds: number[] = []
  for (let i = 0; i < n; i++) {
    seeds.push(Math.random() * 10)
    positions[i * 3] = box.x + (Math.random() - 0.5) * box.w
    positions[i * 3 + 1] = box.y + Math.random() * box.h
    positions[i * 3 + 2] = box.z + (Math.random() - 0.5) * box.d
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({
    color: 0xfff6d4,
    size: 0.012,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const points = new THREE.Points(geo, mat)
  parent.add(points)
  const base = positions.slice()
  return {
    update(time: number) {
      for (let i = 0; i < n; i++) {
        const s = seeds[i]!
        positions[i * 3] = base[i * 3]! + Math.sin(time * 0.35 + s) * 0.04
        positions[i * 3 + 1] = box.y + ((base[i * 3 + 1]! - box.y + time * 0.03 + s) % box.h)
        positions[i * 3 + 2] = base[i * 3 + 2]! + Math.cos(time * 0.28 + s) * 0.03
      }
      geo.attributes.position!.needsUpdate = true
    },
  }
}
