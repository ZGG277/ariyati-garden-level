export class Sfx {
  private ctx: AudioContext | null = null
  muted = false

  private ac(): AudioContext | null {
    if (this.muted) return null
    if (!this.ctx) {
      const Ctor = window.AudioContext
      if (!Ctor) return null
      this.ctx = new Ctor()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  unlock(): void {
    this.ac()
  }

  toggle(): boolean {
    this.muted = !this.muted
    if (!this.muted) this.unlock()
    return this.muted
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0): void {
    const ctx = this.ac()
    if (!ctx) return
    const t0 = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  jump(): void {
    this.tone(560, 0.09, 'sine', 0.05)
    this.tone(780, 0.1, 'sine', 0.03, 0.03)
  }

  land(): void {
    this.tone(180, 0.07, 'triangle', 0.04)
  }

  grab(): void {
    this.tone(420, 0.06, 'sine', 0.035)
    this.tone(640, 0.08, 'sine', 0.02, 0.02)
  }

  fail(): void {
    this.tone(320, 0.12, 'sine', 0.04)
    this.tone(210, 0.16, 'triangle', 0.035, 0.06)
  }

  win(): void {
    this.tone(520, 0.12, 'sine', 0.05)
    this.tone(660, 0.14, 'sine', 0.045, 0.08)
    this.tone(784, 0.22, 'sine', 0.04, 0.16)
  }
}
