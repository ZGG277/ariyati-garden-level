import type { StickDraw } from './input.ts'
import type { LevelId } from './stage.ts'

export type HudAction =
  | { type: 'play'; level: LevelId; continuous: boolean }
  | { type: 'retry' }
  | { type: 'hub' }
  | { type: 'next' }
  | { type: 'again' }
  | { type: 'mute' }

export class Hud {
  private readonly loading: HTMLElement
  private readonly bar: HTMLElement
  private readonly top: HTMLElement
  private readonly title: HTMLElement
  private readonly objective: HTMLElement
  private readonly timer: HTMLElement
  private readonly hint: HTMLElement
  private readonly toastEl: HTMLElement
  private readonly wind: HTMLElement
  private readonly hub: HTMLElement
  private readonly play: HTMLElement
  private readonly result: HTMLElement
  private readonly resultTitle: HTMLElement
  private readonly resultDetail: HTMLElement
  private readonly nextBtn: HTMLButtonElement
  private readonly stick: HTMLElement
  private readonly knob: HTMLElement
  private readonly muteBtn: HTMLButtonElement
  private toastTimer = 0

  constructor(onAction: (action: HudAction) => void) {
    this.loading = must('loading')
    this.bar = must('loading-bar')
    this.top = must('topbar')
    this.title = must('level-title')
    this.objective = must('level-objective')
    this.timer = must('timer')
    this.hint = must('hint')
    this.toastEl = must('toast')
    this.wind = must('windpill')
    this.hub = must('hub')
    this.play = must('play-chrome')
    this.result = must('result')
    this.resultTitle = must('result-title')
    this.resultDetail = must('result-detail')
    this.nextBtn = must('btn-next') as HTMLButtonElement
    this.stick = must('stick')
    this.knob = must('stick-knob')
    this.muteBtn = must('mute') as HTMLButtonElement

    wire('btn-ivy', () => onAction({ type: 'play', level: 'ivy', continuous: false }))
    wire('btn-flower', () => onAction({ type: 'play', level: 'flower', continuous: false }))
    wire('btn-fox', () => onAction({ type: 'play', level: 'foxtail', continuous: false }))
    wire('btn-run', () => onAction({ type: 'play', level: 'ivy', continuous: true }))
    wire('retry', () => onAction({ type: 'retry' }))
    wire('home', () => onAction({ type: 'hub' }))
    wire('btn-next', () => onAction({ type: 'next' }))
    wire('btn-again', () => onAction({ type: 'again' }))
    wire('btn-back', () => onAction({ type: 'hub' }))
    wire('mute', () => onAction({ type: 'mute' }))
  }

  setMuted(muted: boolean): void {
    this.muteBtn.textContent = muted ? '声音关' : '声音'
    this.muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false')
  }

  loadingProgress(ratio: number | null): void {
    if (ratio === null) {
      this.loading.hidden = true
      return
    }
    this.loading.hidden = false
    this.bar.style.width = `${Math.round(ratio * 100)}%`
  }

  showError(message: string): void {
    this.loading.hidden = false
    const copy = this.loading.querySelector('p')
    if (copy) copy.textContent = message
  }

  showHub(): void {
    this.hub.hidden = false
    this.play.hidden = true
    this.top.hidden = true
    this.result.hidden = true
    this.hint.hidden = true
    this.wind.hidden = true
    this.toastEl.hidden = true
  }

  showPlay(title: string, objective: string, hint: string): void {
    this.hub.hidden = true
    this.play.hidden = false
    this.top.hidden = false
    this.result.hidden = true
    this.title.textContent = title
    this.objective.textContent = objective
    this.timer.textContent = '0.0'
    this.hint.textContent = hint
    this.hint.hidden = hint.length === 0
    this.hint.classList.remove('fade')
    if (hint) {
      window.setTimeout(() => this.hint.classList.add('fade'), 6500)
    }
    this.wind.hidden = true
  }

  setTime(seconds: number): void {
    this.timer.textContent = seconds.toFixed(1)
  }

  setWind(text: string): void {
    if (!text) {
      this.wind.hidden = true
      return
    }
    this.wind.hidden = false
    this.wind.textContent = text
  }

  toast(text: string): void {
    this.toastEl.hidden = false
    this.toastEl.textContent = text
    this.toastTimer += 1
    const token = this.toastTimer
    window.setTimeout(() => {
      if (this.toastTimer === token) this.toastEl.hidden = true
    }, 900)
  }

  showWin(title: string, detail: string, nextLabel: string | null): void {
    this.result.hidden = false
    this.resultTitle.textContent = title
    this.resultDetail.textContent = detail
    this.nextBtn.hidden = !nextLabel
    if (nextLabel) this.nextBtn.textContent = nextLabel
  }

  hideWin(): void {
    this.result.hidden = true
  }

  setStick(stick: StickDraw | null): void {
    if (!stick) {
      this.stick.hidden = true
      return
    }
    this.stick.hidden = false
    this.stick.style.left = `${stick.x}px`
    this.stick.style.top = `${stick.y}px`
    this.knob.style.transform = `translate(${stick.kx}px, ${stick.ky}px)`
  }
}

function must(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Missing #${id}`)
  return el
}

function wire(id: string, fn: () => void): void {
  must(id).addEventListener('click', (e) => {
    e.stopPropagation()
    fn()
  })
}
