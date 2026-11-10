import * as THREE from 'three'

/**
 * girl.glb is one static mesh (no skin, no joints, no clips).
 * This builds a humanoid skeleton in the mesh's own space and
 * skins the vertices so arms and legs can bend.
 */
export type Rig = {
  mesh: THREE.SkinnedMesh
  bones: Record<string, THREE.Bone>
  hipsRestY: number
}

type BoneDef = { name: string; parent: string | null; x: number; y: number; z: number }

const BONE_DEFS: BoneDef[] = [
  { name: 'hips', parent: null, x: 0, y: -0.06, z: 0.06 },
  { name: 'spine', parent: 'hips', x: 0, y: 0.16, z: 0.05 },
  { name: 'chest', parent: 'spine', x: 0, y: 0.38, z: 0.02 },
  { name: 'head', parent: 'chest', x: 0, y: 0.64, z: 0.0 },
  { name: 'armL', parent: 'chest', x: -0.16, y: 0.4, z: 0.02 },
  { name: 'foreL', parent: 'armL', x: -0.24, y: 0.16, z: 0.02 },
  { name: 'armR', parent: 'chest', x: 0.16, y: 0.4, z: 0.02 },
  { name: 'foreR', parent: 'armR', x: 0.26, y: 0.14, z: 0.02 },
  { name: 'legL', parent: 'hips', x: -0.1, y: -0.2, z: 0.06 },
  { name: 'shinL', parent: 'legL', x: -0.16, y: -0.62, z: 0.08 },
  { name: 'legR', parent: 'hips', x: 0.1, y: -0.2, z: 0.06 },
  { name: 'shinR', parent: 'legR', x: 0.16, y: -0.62, z: 0.08 },
]

export function rigGirl(root: THREE.Object3D): Rig {
  let source: THREE.Mesh | null = null
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!source && mesh.isMesh) source = mesh
  })
  if (!source) throw new Error('girl.glb has no mesh')
  const found: THREE.Mesh = source
  const geometry = found.geometry.clone()
  geometry.computeVertexNormals()

  const bones: Record<string, THREE.Bone> = {}
  const list: THREE.Bone[] = []
  for (const def of BONE_DEFS) {
    const bone = new THREE.Bone()
    bone.name = def.name
    const parent = def.parent ? bones[def.parent] : null
    const px = parent ? BONE_DEFS.find((d) => d.name === def.parent)!.x : 0
    const py = parent ? BONE_DEFS.find((d) => d.name === def.parent)!.y : 0
    const pz = parent ? BONE_DEFS.find((d) => d.name === def.parent)!.z : 0
    bone.position.set(def.x - (parent ? px : 0), def.y - (parent ? py : 0), def.z - (parent ? pz : 0))
    if (parent) parent.add(bone)
    bones[def.name] = bone
    list.push(bone)
  }

  paintWeights(geometry)
  const material = found.material
  const skinned = new THREE.SkinnedMesh(geometry, material)
  skinned.name = found.name
  skinned.castShadow = true
  skinned.receiveShadow = true
  skinned.frustumCulled = false
  const parent = found.parent
  if (parent) {
    parent.remove(found)
    parent.add(skinned)
  }
  skinned.add(bones.hips!)
  const skeleton = new THREE.Skeleton(list)
  skinned.updateMatrixWorld(true)
  skinned.bind(skeleton)
  skinned.normalizeSkinWeights()

  return { mesh: skinned, bones, hipsRestY: bones.hips!.position.y }
}

function paintWeights(geometry: THREE.BufferGeometry): void {
  const pos = geometry.getAttribute('position')
  if (!pos) throw new Error('girl mesh has no positions')
  const count = pos.count
  const indices = new Uint16Array(count * 4)
  const weights = new Float32Array(count * 4)
  const names = BONE_DEFS.map((d) => d.name)
  const nameIndex = new Map(names.map((n, i) => [n, i]))

  for (let i = 0; i < count; i++) {
    const scored = scoreVertex(pos.getX(i), pos.getY(i), pos.getZ(i))
    scored.sort((a, b) => b[1] - a[1])
    let sum = 0
    const top = scored.slice(0, 4)
    for (const pair of top) sum += pair[1]
    if (sum <= 1e-5) {
      indices[i * 4] = nameIndex.get('hips') ?? 0
      weights[i * 4] = 1
      continue
    }
    for (let k = 0; k < 4; k++) {
      const pair = top[k]
      indices[i * 4 + k] = pair ? (nameIndex.get(pair[0]) ?? 0) : 0
      weights[i * 4 + k] = pair ? pair[1] / sum : 0
    }
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4))
}

function scoreVertex(x: number, y: number, z: number): [string, number][] {
  const left = x < 0
  const acc = new Map<string, number>()
  const add = (name: string, w: number) => {
    if (w <= 0) return
    acc.set(name, (acc.get(name) ?? 0) + w)
  }
  const leg = left ? 'legL' : 'legR'
  const shin = left ? 'shinL' : 'shinR'
  const arm = left ? 'armL' : 'armR'
  const fore = left ? 'foreL' : 'foreR'

  if (y < -0.5) {
    add(shin, y < -0.68 ? 1 : 0.7)
    add(leg, y < -0.68 ? 0 : 0.3)
  } else if (y < 0.02) {
    if (Math.abs(x) > 0.09) {
      add(leg, 0.82)
      add('hips', 0.18)
    } else {
      add('hips', 0.75)
      add('spine', 0.25)
    }
  } else if (y < 0.58 && Math.abs(x) > 0.18) {
    const upper = y > 0.24 ? 0.8 : 0.2
    add(arm, upper)
    add(fore, 1 - upper)
  } else if (y > 0.62) {
    add('head', 0.9)
    add('chest', 0.1)
  } else if (y > 0.36) {
    add('chest', 0.75)
    add('spine', 0.25)
  } else {
    add('spine', 0.55)
    add('hips', 0.45)
  }
  if (z > 0.14 && y > 0.2 && y < 0.85) add('spine', 0.9)
  if (acc.size === 0) add('hips', 1)
  return [...acc.entries()]
}
