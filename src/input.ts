import { TUNE } from './tune.ts'

export type StickDraw = {
  x: number
  y: number
  kx: number
  ky: number
}

/**
 * Touch-first: drag to move, quick tap to jump. A second finger can tap-jump
 * while the first finger holds the stick. WASD / arrows + Space are the fallback.
 */
export class Input {
  axisX = 0
  axisY = 0
  stick: StickDraw | null = null

  private keys = new Set<string>()
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>()
  private stickId: number | null = null
  private touchX = 0
  private touchY = 0
  private jumpQueued = false
  private retryQueued = false
  private hubQueued = false
  private holdUntil = 0

  constructor() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('pointerdown', this.onDown)
    window.addEventListener('pointermove', this.onMove)
    window.addEventListener('pointerup', this.onUp)
    window.addEventListener('pointercancel', this.onUp)
    window.addEventListener('blur', this.onBlur)
    window.addEventListener(
      'touchmove',
      (e) => {
        if (this.stickId !== null || this.pointers.size > 0) e.preventDefault()
      },
      { passive: false },
    )
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return
    const tag = (e.target as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    if (e.code === 'Space') this.jumpQueued = true
    if (e.code === 'KeyR') this.retryQueued = true
    if (e.code === 'Escape') this.hubQueued = true
    this.keys.add(e.key.toLowerCase())
    this.syncAxes()
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault()
    }
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    const px = this.axisX
    const py = this.axisY
    this.keys.delete(e.key.toLowerCase())
    this.syncAxes()
    this.carryTap(px, py)
  }

  private onBlur = (): void => {
    this.keys.clear()
    this.pointers.clear()
    this.stickId = null
    this.touchX = 0
    this.touchY = 0
    this.stick = null
    this.syncAxes()
  }

  private fromUi(e: Event): boolean {
    const t = e.target
    if (!(t instanceof Element)) return false
    return Boolean(t.closest('[data-ui]'))
  }

  private onDown = (e: PointerEvent): void => {
    if (this.fromUi(e)) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    this.pointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      sx: e.clientX,
      sy: e.clientY,
      t: performance.now(),
    })
  }

  private onMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId)
    if (!p) return
    p.x = e.clientX
    p.y = e.clientY
    const dx = p.x - p.sx
    const dy = p.y - p.sy
    if (this.stickId === null && Math.hypot(dx, dy) > 16) this.stickId = e.pointerId
    if (this.stickId === e.pointerId) {
      this.touchX = clamp(dx / 64, -1, 1)
      this.touchY = clamp(-dy / 64, -1, 1)
      this.stick = { x: p.sx, y: p.sy, kx: this.touchX * 28, ky: -this.touchY * 28 }
    }
    this.syncAxes()
  }

  private onUp = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId)
    if (!p) return
    const dist = Math.hypot(p.x - p.sx, p.y - p.sy)
    const held = performance.now() - p.t
    if (dist < 18 && held < 320) this.jumpQueued = true
    const dragged = this.stickId === e.pointerId
    const px = this.touchX
    const py = this.touchY
    if (dragged) {
      this.stickId = null
      this.touchX = 0
      this.touchY = 0
      this.stick = null
    }
    this.pointers.delete(e.pointerId)
    this.syncAxes()
    if (dragged && dist >= 18) this.carryTap(px, py)
  }

  /** A released direction keeps steering briefly, so a tap is a step. */
  private carryTap(x: number, y: number): void {
    if (Math.hypot(x, y) < 0.2) return
    if (this.axisX !== 0 || this.axisY !== 0) return
    this.axisX = x
    this.axisY = y
    this.holdUntil = performance.now() + TUNE.tapHold * 1000
  }

  tick(): void {
    if (this.holdUntil > 0 && performance.now() >= this.holdUntil) {
      this.holdUntil = 0
      if (this.keys.size === 0 && this.stickId === null) this.syncAxes()
    }
  }

  private syncAxes(): void {
    let kx = 0
    let ky = 0
    if (this.keys.has('a') || this.keys.has('arrowleft')) kx -= 1
    if (this.keys.has('d') || this.keys.has('arrowright')) kx += 1
    if (this.keys.has('w') || this.keys.has('arrowup')) ky += 1
    if (this.keys.has('s') || this.keys.has('arrowdown')) ky -= 1
    if (kx !== 0 || ky !== 0) {
      this.axisX = clamp(kx, -1, 1)
      this.axisY = clamp(ky, -1, 1)
      return
    }
    this.axisX = this.touchX
    this.axisY = this.touchY
  }

  consumeJump(): boolean {
    const v = this.jumpQueued
    this.jumpQueued = false
    return v
  }

  consumeRetry(): boolean {
    const v = this.retryQueued
    this.retryQueued = false
    return v
  }

  consumeHub(): boolean {
    const v = this.hubQueued
    this.hubQueued = false
    return v
  }

  flush(): void {
    this.jumpQueued = false
    this.retryQueued = false
    this.hubQueued = false
    this.holdUntil = 0
    this.axisX = 0
    this.axisY = 0
  }
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v))
}
