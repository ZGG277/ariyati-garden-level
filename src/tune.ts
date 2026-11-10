/** Gameplay feel at 9 cm character scale. Distances are meters. */
export const TUNE = {
  gravity: 3.2,
  jumpV: 1.02,
  maxRun: 0.55,
  groundAccel: 18,
  /** How fast she stops on a platform when the stick is released. */
  groundFriction: 14,
  /** Steering while airborne. */
  airAccel: 8,
  /** Speed kept through a jump once the key is up. */
  airDrag: 0.45,
  coyote: 0.14,
  jumpBuffer: 0.16,
  /** A tap keeps moving this long, so one press is a step, not a single frame. */
  tapHold: 0.28,
  climbSpeed: 0.5,
  /** Horizontal reach of a vine grab, meters. */
  gripRadius: 0.08,
  stemGrab: 0.06,
  girlHeight: 0.09,
  invuln: 0.28,
}

/** Jump apex ≈ jumpV² / (2g) ≈ 0.16 m. Full-speed range ≈ 0.35 m. */
