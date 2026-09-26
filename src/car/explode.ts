import type { ExplodeMove, Hinge, Vec3 } from './types.ts'

/**
 * The maths of the exploded view and the hinges: pure functions of the catalogue data and an
 * amount from 0 to 1, so the assembly only has to apply the results.
 */

/**
 * Each part moves over a window of the overall explode amount that starts at
 * `order * EXPLODE_STAGGER` and lasts `1 - EXPLODE_STAGGER`, so the outer panels (low order)
 * are well on their way before the engine and chassis (high order) begin to drop.
 */
export const EXPLODE_STAGGER = 0.45

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/** Smoothstep: zero slope at both ends. */
export function easeInOut(t: number): number {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

/** How far along its own move a part is, 0 to 1, for an overall explode `amount`. */
export function partProgress(order: number, amount: number): number {
  const start = clamp01(order) * EXPLODE_STAGGER
  const span = 1 - EXPLODE_STAGGER
  return easeInOut((clamp01(amount) - start) / span)
}

/**
 * The offset (inches, car space) a part carries at explode `amount`. `side` flips the X component
 * for the left-hand object of a mirrored part, so both sides move outward.
 */
export function explodeOffset(move: ExplodeMove, amount: number, side: 'left' | 'right' | 'single' = 'single'): Vec3 {
  const progress = partProgress(move.order, amount)
  const distance = move.distance * progress
  const sx = side === 'left' ? -1 : 1
  return [move.direction[0] * distance * sx, move.direction[1] * distance, move.direction[2] * distance]
}

/** The signed hinge angle, radians, for an openness from 0 (closed) to 1 (open), eased. */
export function hingeAngle(hinge: Hinge, openness: number): number {
  return hinge.openAngle * easeInOut(openness)
}

/**
 * Steps `current` toward `target` with an exponential ease: `rate` per second, over `dt` seconds.
 * Frame-rate independent, and snaps when within `epsilon`.
 */
export function approach(current: number, target: number, rate: number, dt: number, epsilon = 1e-4): number {
  const next = target + (current - target) * Math.exp(-rate * dt)
  return Math.abs(next - target) < epsilon ? target : next
}
