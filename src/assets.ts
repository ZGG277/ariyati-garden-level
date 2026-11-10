import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { TUNE } from './tune.ts'

export const PROP_NAMES = [
  'girl',
  'ivy_leaf',
  'ivy_stem',
  'ivy_tendril',
  'wall_brick',
  'daisy',
  'clover_ball',
  'foxtail',
  'grass_tuft',
  'pebble',
  'fallen_leaf',
  'dewdrop',
  'ladybug',
  'mushroom',
] as const

export type PropName = (typeof PROP_NAMES)[number]

const NO_SHADOW = new Set<PropName>(['dewdrop', 'pebble', 'ivy_tendril', 'fallen_leaf', 'ladybug'])

export type Wind = {
  uniforms: {
    uTime: { value: number }
    uAmp: { value: number }
    uSpeed: { value: number }
    uPhase: { value: number }
  }
  dispose: () => void
}

export class Garden {
  private readonly props = new Map<PropName, THREE.Object3D>()
  /** Feet at local origin, height 0.09 m, facing +Z before yaw. */
  readonly heroTemplate: THREE.Object3D
  readonly measuredGirl: number

  private constructor(hero: THREE.Object3D, measured: number) {
    this.heroTemplate = hero
    this.measuredGirl = measured
  }

  static async load(onProgress: (ratio: number) => void): Promise<Garden> {
    const manager = new THREE.LoadingManager()
    manager.onProgress = (_url, loaded, total) => {
      if (total > 0) onProgress(loaded / total)
    }
    const loader = new GLTFLoader(manager)
    const base = import.meta.env.BASE_URL
    const loaded = new Map<PropName, THREE.Object3D>()
    await Promise.all(
      PROP_NAMES.map(async (name) => {
        const gltf = await loader.loadAsync(`${base}assets/${name}.glb`)
        prep(gltf.scene, !NO_SHADOW.has(name))
        loaded.set(name, gltf.scene)
      }),
    )
    const girl = loaded.get('girl')!
    const box = new THREE.Box3().setFromObject(girl)
    const height = box.max.y - box.min.y
    girl.position.y -= box.min.y
    const scaler = new THREE.Group()
    scaler.scale.setScalar(TUNE.girlHeight / height)
    scaler.add(girl)
    const rig = new THREE.Group()
    rig.add(scaler)
    const garden = new Garden(rig, height)
    for (const [name, obj] of loaded) {
      if (name === 'girl') continue
      garden.props.set(name, obj)
    }
    console.info(
      `[arrietty] girl.glb height ${height.toFixed(3)} m → scaled ×${(TUNE.girlHeight / height).toFixed(4)} to ${TUNE.girlHeight} m (one ivy leaf).`,
    )
    return garden
  }

  clone(name: Exclude<PropName, 'girl'>): THREE.Object3D {
    const src = this.props.get(name)
    if (!src) throw new Error(`Missing prop ${name}`)
    return src.clone(true)
  }

  /** Shear the plant in object-space X so collision can share the same formula. */
  wind(root: THREE.Object3D, amp: number, speed: number, phase: number): Wind {
    const uniforms = {
      uTime: { value: 0 },
      uAmp: { value: amp },
      uSpeed: { value: speed },
      uPhase: { value: phase },
    }
    const materials: THREE.Material[] = []
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const source = mesh.material
      const list = Array.isArray(source) ? source : [source]
      const cloned = list.map((mat) => {
        const next = (mat as THREE.MeshStandardMaterial).clone()
        next.customProgramCacheKey = () => 'foxtail-wind-v1'
        next.onBeforeCompile = (shader) => {
          shader.uniforms.uTime = uniforms.uTime
          shader.uniforms.uAmp = uniforms.uAmp
          shader.uniforms.uSpeed = uniforms.uSpeed
          shader.uniforms.uPhase = uniforms.uPhase
          shader.vertexShader =
            `uniform float uTime;\nuniform float uAmp;\nuniform float uSpeed;\nuniform float uPhase;\n` +
            shader.vertexShader.replace(
              '#include <begin_vertex>',
              `#include <begin_vertex>
              float windH = clamp(transformed.y / 0.60, 0.0, 1.25);
              float sway = sin(uTime * uSpeed + uPhase) * uAmp * pow(windH, 1.35);
              transformed.x += sway;
              transformed.z += sin(uTime * uSpeed * 1.7 + uPhase + transformed.y * 8.0) * 0.005 * windH;`,
            )
        }
        next.needsUpdate = true
        materials.push(next)
        return next
      })
      mesh.material = Array.isArray(source) ? cloned : cloned[0]!
    })
    return {
      uniforms,
      dispose: () => {
        for (const m of materials) m.dispose()
      },
    }
  }
}

function prep(root: THREE.Object3D, cast: boolean): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = cast
    mesh.receiveShadow = true
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial
      if (std.color) std.color.setHex(0xffffff)
      if ('roughness' in std && std.roughness < 0.78) std.roughness = 0.82
      if ('metalness' in std) std.metalness = 0
      std.side = THREE.DoubleSide
      std.needsUpdate = true
    }
  })
}

/** Tip displacement of a foxtail bent with the wind shader, in meters. */
export function foxtailSway(time: number, amp: number, speed: number, phase: number, height: number): number {
  const h = Math.min(1.25, Math.max(0, height / 0.6))
  return Math.sin(time * speed + phase) * amp * Math.pow(h, 1.35)
}

export function foxtailSwayVel(time: number, amp: number, speed: number, phase: number, height: number): number {
  const h = Math.min(1.25, Math.max(0, height / 0.6))
  return Math.cos(time * speed + phase) * speed * amp * Math.pow(h, 1.35)
}
