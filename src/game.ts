import * as THREE from 'three'
import { Garden } from './assets.ts'
import { groundBelow, makeBody, type Body } from './physics.ts'
import { Hero } from './hero.ts'
import { Hud, type HudAction } from './hud.ts'
import { Input } from './input.ts'
import { Sfx } from './sfx.ts'
import type { LevelId, Sim, Spawn, Stage } from './stage.ts'
import { createFlower } from './stages/flower.ts'
import { createFoxtail } from './stages/foxtail.ts'
import { createHub } from './stages/hub.ts'
import { createIvy } from './stages/ivy.ts'
import { TUNE } from './tune.ts'

const ROUTE: LevelId[] = ['ivy', 'flower', 'foxtail']

export class Game {
  private renderer!: THREE.WebGLRenderer
  private scene!: THREE.Scene
  private camera!: THREE.PerspectiveCamera
  private garden!: Garden
  private hero!: Hero
  private blob!: THREE.Mesh
  private keyLight!: THREE.DirectionalLight
  private stage!: Stage
  private body!: Body
  private checkpoint!: Spawn
  private readonly sfx = new Sfx()
  private readonly camPos = new THREE.Vector3()
  private readonly look = new THREE.Vector3(0, 0.2, 0)
  private readonly lookCur = new THREE.Vector3()
  private continuous = false
  private totalTime = 0
  private levelTime = 0
  private worldTime = 0
  private lock = 0
  private won = false
  private snap = true
  private pending: LevelId | null = null
  private lastNow = 0

  private readonly hud: Hud
  private readonly input: Input

  constructor(hud: Hud, input: Input) {
    this.hud = hud
    this.input = input
  }

  async start(): Promise<void> {
    this.hud.loadingProgress(0)
    try {
      this.garden = await Garden.load((ratio) => this.hud.loadingProgress(ratio))
    } catch (err) {
      console.error(err)
      this.hud.showError('模型没有加载出来。请用本地服务器打开这个页面。')
      return
    }
    this.hud.loadingProgress(null)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.08
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    document.getElementById('game-root')!.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.02, 30)
    this.scene.add(new THREE.HemisphereLight(0xfff6e4, 0x7ea56c, 0.92))
    this.keyLight = new THREE.DirectionalLight(0xfff1d2, 1.55)
    this.keyLight.castShadow = true
    this.keyLight.shadow.mapSize.set(1024, 1024)
    this.keyLight.shadow.bias = -0.0004
    this.keyLight.shadow.normalBias = 0.02
    this.scene.add(this.keyLight)
    this.scene.add(this.keyLight.target)
    const fill = new THREE.DirectionalLight(0xd7e7c4, 0.42)
    fill.position.set(-1.4, 1.1, -0.6)
    this.scene.add(fill)
    const rim = new THREE.DirectionalLight(0xffe2c4, 0.28)
    rim.position.set(-0.2, 1.4, 1.6)
    this.scene.add(rim)

    this.hero = new Hero(this.garden.heroTemplate.clone(true))
    this.scene.add(this.hero.root)
    this.blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.022, 18),
      new THREE.MeshBasicMaterial({ color: 0x24301c, transparent: true, opacity: 0.28, depthWrite: false }),
    )
    this.blob.rotation.x = -Math.PI / 2
    this.scene.add(this.blob)

    window.addEventListener('resize', this.onResize)
    window.addEventListener('pointerdown', () => this.sfx.unlock())
    const query = new URLSearchParams(location.search).get('level')
    if (query === 'ivy' || query === 'flower' || query === 'foxtail') this.enter(query, false)
    else this.enter('hub', false)
    this.lastNow = performance.now()
    this.renderer.setAnimationLoop(() => this.frame())
  }

  handle(action: HudAction): void {
    if (action.type === 'mute') {
      this.hud.setMuted(this.sfx.toggle())
      return
    }
    this.sfx.unlock()
    if (action.type === 'play') {
      if (action.continuous) this.totalTime = 0
      this.enter(action.level, action.continuous)
      return
    }
    if (action.type === 'hub') {
      this.enter('hub', false)
      return
    }
    if (action.type === 'retry' || action.type === 'again') {
      this.retry()
      return
    }
    if (action.type === 'next' && this.pending) this.enter(this.pending, this.continuous)
  }

  private onResize = (): void => {
    if (!this.renderer) return
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / Math.max(1, h)
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  private enter(id: LevelId, continuous: boolean): void {
    if (id === 'hub') this.continuous = false
    else this.continuous = continuous
    if (this.stage) {
      this.scene.remove(this.stage.group)
      this.stage.dispose()
    }
    this.stage = this.make(id)
    this.scene.add(this.stage.group)
    this.scene.fog = new THREE.Fog(this.stage.fogColor, this.stage.fogNear, this.stage.fogFar)
    this.scene.background = new THREE.Color(this.stage.fogColor)
    this.renderer.setClearColor(this.stage.fogColor)
    this.body = makeBody(this.stage.spawn.x, this.stage.spawn.y, this.stage.spawn.z, this.stage.spawn.yaw)
    this.stage.applySpawn(this.stage.spawn, this.body)
    this.checkpoint = cloneSpawn(this.stage.spawn)
    this.won = false
    this.levelTime = 0
    this.lock = 0.12
    this.snap = true
    this.pending = null
    this.input.flush()
    this.hud.hideWin()
    if (id === 'hub') this.hud.showHub()
    else this.hud.showPlay(this.stage.title, this.stage.objective, this.stage.hint)
  }

  private make(id: LevelId): Stage {
    if (id === 'ivy') return createIvy(this.garden)
    if (id === 'flower') return createFlower(this.garden)
    if (id === 'foxtail') return createFoxtail(this.garden)
    return createHub(this.garden)
  }

  private retry(): void {
    if (this.stage.id === 'hub') return
    this.checkpoint = cloneSpawn(this.stage.spawn)
    this.stage.applySpawn(this.stage.spawn, this.body)
    this.won = false
    this.levelTime = 0
    this.lock = 0.15
    this.snap = true
    this.hud.hideWin()
    this.input.flush()
  }

  private fail(): void {
    this.stage.applySpawn(this.checkpoint, this.body)
    this.lock = TUNE.invuln
    this.sfx.fail()
    this.hud.toast(this.stage.failLine)
  }

  private onWin(): void {
    if (this.won || this.stage.id === 'hub') return
    this.won = true
    this.sfx.win()
    const segment = this.levelTime
    const previous = rememberBest(this.stage.id, segment)
    const bestLine =
      previous === null ? '' : ` · 最好 ${Math.min(previous, segment).toFixed(1)} 秒`
    if (this.continuous) {
      this.totalTime += segment
      const index = ROUTE.indexOf(this.stage.id)
      if (index < ROUTE.length - 1) {
        this.pending = ROUTE[index + 1]!
        this.hud.showWin(this.stage.winLine, `这一段 ${segment.toFixed(1)} 秒${bestLine}`, '下一段')
      } else {
        this.pending = null
        this.hud.showWin('花园冒险完成', `三段一共 ${this.totalTime.toFixed(1)} 秒`, null)
      }
      return
    }
    const index = ROUTE.indexOf(this.stage.id)
    this.pending = index >= 0 && index < ROUTE.length - 1 ? ROUTE[index + 1]! : null
    this.hud.showWin(this.stage.winLine, `用时 ${segment.toFixed(1)} 秒${bestLine}`, this.pending ? '下一段' : null)
  }

  private frame(): void {
    const now = performance.now()
    const dt = Math.min((now - this.lastNow) / 1000, 0.033)
    this.lastNow = now
    this.input.tick()
    if (this.input.consumeRetry()) this.retry()
    if (this.input.consumeHub() && this.stage.id !== 'hub') this.enter('hub', false)

    const aspect = this.camera.aspect
    if (aspect < 0.85 && this.camera.fov !== 50) {
      this.camera.fov = 50
      this.camera.updateProjectionMatrix()
    } else if (aspect >= 0.85 && this.camera.fov !== 42) {
      this.camera.fov = 42
      this.camera.updateProjectionMatrix()
    }

    this.worldTime += dt
    if (this.snap) {
      this.stage.camera(this.camPos, this.look, this.body, aspect, this.worldTime)
      this.camera.position.copy(this.camPos)
      this.lookCur.copy(this.look)
      this.camera.lookAt(this.lookCur)
      this.snap = false
    }

    const forward = new THREE.Vector3()
    this.camera.getWorldDirection(forward)
    forward.y = 0
    if (forward.lengthSq() < 1e-8) forward.set(0, 0, -1)
    forward.normalize()
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

    if (!this.won) {
      if (this.stage.id !== 'hub') this.levelTime += dt
      this.lock = Math.max(0, this.lock - dt)
      const ctx: Sim = {
        dt,
        time: this.worldTime,
        body: this.body,
        input: this.input,
        rightX: right.x,
        rightZ: right.z,
        forwardX: forward.x,
        forwardZ: forward.z,
        sfx: this.sfx,
        checkpoint: this.checkpoint,
        lock: this.lock,
        save: (spawn) => {
          this.checkpoint = cloneSpawn(spawn)
        },
        fail: () => this.fail(),
      }
      const result = this.stage.simulate(ctx)
      if (result === 'win') this.onWin()
      if (this.stage.id !== 'hub') this.hud.setTime(this.levelTime)
    } else {
      this.input.consumeJump()
    }

    const moving = Math.hypot(this.body.vx, this.body.vz) > 0.05
    this.hero.place(this.body)
    this.hero.update(dt, moving, !this.body.grounded && !this.stage.climbing, this.stage.climbing, this.body.vy)

    if (this.stage.id === 'hub' || this.stage.climbing) {
      this.blob.visible = false
    } else {
      const gy = groundBelow(this.stage.surfaces, this.body.x, this.body.z, this.body.y)
      const lift = Math.max(0, this.body.y - gy)
      const scale = Math.max(0.35, 1 - lift * 3.2)
      this.blob.visible = lift < 0.4
      this.blob.position.set(this.body.x, gy + 0.007, this.body.z)
      this.blob.scale.setScalar(scale)
      ;(this.blob.material as THREE.MeshBasicMaterial).opacity = 0.32 * scale
    }

    this.hud.setWind(this.stage.status)
    this.hud.setStick(this.input.stick)

    this.stage.camera(this.camPos, this.look, this.body, aspect, this.worldTime)
    const k = 1 - Math.exp(-dt * 5)
    this.camera.position.lerp(this.camPos, this.snap ? 1 : k)
    this.lookCur.lerp(this.look, k)
    this.camera.lookAt(this.lookCur)

    const span = this.stage.id === 'ivy' ? 1.35 : this.stage.id === 'hub' ? 1.8 : 0.85
    this.keyLight.position.set(this.body.x + 0.7, this.body.y + 1.7, this.body.z + 0.55)
    this.keyLight.target.position.set(this.body.x, this.body.y + 0.08, this.body.z)
    const cam = this.keyLight.shadow.camera
    cam.left = -span
    cam.right = span
    cam.top = span
    cam.bottom = -span
    cam.near = 0.1
    cam.far = 5
    cam.updateProjectionMatrix()

    this.renderer.render(this.scene, this.camera)
  }

}

function cloneSpawn(spawn: Spawn): Spawn {
  return {
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    yaw: spawn.yaw,
    vine: spawn.vine ? { ...spawn.vine } : undefined,
    stem: spawn.stem ? { ...spawn.stem } : undefined,
  }
}

function rememberBest(id: LevelId, time: number): number | null {
  const key = `arrietty-best:${id}`
  try {
    const prevRaw = localStorage.getItem(key)
    const prev = prevRaw === null ? null : Number(prevRaw)
    const had = prev !== null && !Number.isNaN(prev)
    if (!had || time < prev) localStorage.setItem(key, String(time))
    return had ? prev : null
  } catch {
    return null
  }
}
