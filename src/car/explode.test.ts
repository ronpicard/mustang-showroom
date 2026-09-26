import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ExplodeMove, Hinge } from './types.ts'
import { EXPLODE_STAGGER, approach, easeInOut, explodeOffset, hingeAngle, partProgress } from './explode.ts'

const MOVE: ExplodeMove = { direction: [0.6, 0.8, 0], distance: 40, order: 0 }

test('explodeOffset is zero at amount 0', () => {
  for (const side of ['single', 'left', 'right'] as const) {
    const offset = explodeOffset(MOVE, 0, side)
    // Compare with the `===` operator rather than assert's Object.is-based strict equal: a
    // flipped-sign zero (`-0`) is still zero for this purpose.
    assert.ok(offset[0] === 0 && offset[1] === 0 && offset[2] === 0, `expected [0, 0, 0], got ${offset}`)
  }
})

test('explodeOffset equals direction * distance at amount 1', () => {
  const offset = explodeOffset(MOVE, 1)
  assert.ok(Math.abs(offset[0] - MOVE.direction[0] * MOVE.distance) < 1e-9)
  assert.ok(Math.abs(offset[1] - MOVE.direction[1] * MOVE.distance) < 1e-9)
  assert.ok(Math.abs(offset[2] - MOVE.direction[2] * MOVE.distance) < 1e-9)
})

test('explodeOffset is monotone in amount', () => {
  let previousMagnitude = 0
  for (let amount = 0; amount <= 1 + 1e-9; amount += 0.05) {
    const offset = explodeOffset(MOVE, amount)
    const magnitude = Math.hypot(...offset)
    assert.ok(magnitude >= previousMagnitude - 1e-9, `magnitude decreased at amount ${amount}`)
    previousMagnitude = magnitude
  }
})

test("side 'left' flips only the X component", () => {
  const single = explodeOffset(MOVE, 1, 'single')
  const right = explodeOffset(MOVE, 1, 'right')
  const left = explodeOffset(MOVE, 1, 'left')
  assert.deepEqual(right, single)
  assert.equal(left[0], -single[0])
  assert.equal(left[1], single[1])
  assert.equal(left[2], single[2])
})

test('hingeAngle is 0 when closed and openAngle when fully open', () => {
  const hinge: Hinge = { pivot: [0, 0, 0], axis: [1, 0, 0], openAngle: -0.8 }
  // `=== 0` rather than assert.equal: closed multiplies openAngle by 0, which can yield `-0`.
  assert.ok(hingeAngle(hinge, 0) === 0)
  assert.equal(hingeAngle(hinge, 1), hinge.openAngle)
})

test('hingeAngle is monotone with easeInOut in between', () => {
  const hinge: Hinge = { pivot: [0, 0, 0], axis: [0, 1, 0], openAngle: 1.0 }
  assert.equal(hingeAngle(hinge, 0.5), hinge.openAngle * easeInOut(0.5))
})

test('approach converges toward the target and snaps once close enough', () => {
  let current = 0
  const target = 1
  for (let i = 0; i < 500; i += 1) {
    current = approach(current, target, 6, 1 / 60)
  }
  assert.equal(current, target, 'approach should have snapped to the target after many steps')
})

test('approach moves toward the target each step without overshooting', () => {
  let current = 0
  const target = 1
  for (let i = 0; i < 10; i += 1) {
    const next = approach(current, target, 6, 1 / 60)
    assert.ok(next > current && next <= target, `approach should move up monotonically toward the target`)
    current = next
  }
})

test('partProgress respects the stagger: a part with order 1 has not started just before its window opens', () => {
  assert.equal(partProgress(1, EXPLODE_STAGGER - 0.01), 0)
})

test('partProgress reaches 1 for every order once amount reaches 1', () => {
  for (const order of [0, 0.25, 0.5, 0.75, 1]) {
    assert.equal(partProgress(order, 1), 1)
  }
})

test('partProgress is 0 at amount 0 for every order', () => {
  for (const order of [0, 0.25, 0.5, 0.75, 1]) {
    assert.equal(partProgress(order, 0), 0)
  }
})
