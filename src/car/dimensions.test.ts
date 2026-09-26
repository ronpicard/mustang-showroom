import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ALTERNATOR_CENTER,
  BATTERY_CENTER,
  CAR_CENTER,
  COWL_FRONT_Z,
  COWL_REAR_Z,
  DOOR_FRONT_Z,
  DOOR_REAR_Z,
  ENGINE_CENTER,
  FRONT_AXLE_Z,
  FUEL_TANK_CENTER,
  HALF_WIDTH,
  HOOD_FRONT_Z,
  HOOD_REAR_Z,
  NOSE_Z,
  OVERALL_HEIGHT,
  OVERALL_LENGTH,
  QUARTER_FRONT_Z,
  REAR_AXLE_Z,
  STEERING_WHEEL_CENTER,
  TAIL_Z,
  TIRE_RADIUS,
  WHEEL_ARCH_CENTER_Y,
  WHEEL_ARCH_RADIUS,
  WHEEL_CENTER_Y,
} from './dimensions.ts'

test('TAIL_Z is the nose minus the overall length', () => {
  assert.equal(TAIL_Z, NOSE_Z - OVERALL_LENGTH)
})

test('both axles sit inside the body, between the nose and the tail', () => {
  for (const axleZ of [FRONT_AXLE_Z, REAR_AXLE_Z]) {
    assert.ok(axleZ < NOSE_Z, `axle at z=${axleZ} is not behind the nose (${NOSE_Z})`)
    assert.ok(axleZ > TAIL_Z, `axle at z=${axleZ} is not ahead of the tail (${TAIL_Z})`)
  }
})

test('the wheel arch clears the tyre', () => {
  assert.ok(
    WHEEL_ARCH_RADIUS > TIRE_RADIUS,
    `arch radius ${WHEEL_ARCH_RADIUS} does not clear the tyre radius ${TIRE_RADIUS}`,
  )
  // The arch is centred close to the wheel centre height, not offset into the sky or the ground.
  assert.ok(Math.abs(WHEEL_ARCH_CENTER_Y - WHEEL_CENTER_Y) < 2)
})

test('the hood spans a range inside nose..cowl', () => {
  assert.ok(HOOD_FRONT_Z <= NOSE_Z)
  assert.ok(HOOD_REAR_Z < HOOD_FRONT_Z)
  assert.ok(HOOD_REAR_Z >= COWL_REAR_Z)
  // The hood's rear edge is the cowl's front edge: they meet, they do not overlap or gap.
  assert.equal(HOOD_REAR_Z, COWL_FRONT_Z)
})

test('the door spans a range inside cowl..quarter', () => {
  assert.ok(DOOR_FRONT_Z <= COWL_REAR_Z)
  assert.ok(DOOR_REAR_Z > TAIL_Z)
  // The door's rear edge is the quarter panel's front edge: they meet.
  assert.equal(DOOR_REAR_Z, QUARTER_FRONT_Z)
})

test('named centres lie within the body envelope', () => {
  const centres: Record<string, readonly [number, number, number]> = {
    ENGINE_CENTER,
    BATTERY_CENTER,
    ALTERNATOR_CENTER,
    FUEL_TANK_CENTER,
    STEERING_WHEEL_CENTER,
  }
  for (const [name, [x, y, z]] of Object.entries(centres)) {
    assert.ok(Math.abs(x) <= HALF_WIDTH, `${name}'s x=${x} is outside the body's half width ${HALF_WIDTH}`)
    assert.ok(y >= 0 && y <= OVERALL_HEIGHT, `${name}'s y=${y} is outside [0, ${OVERALL_HEIGHT}]`)
    assert.ok(z <= NOSE_Z && z >= TAIL_Z, `${name}'s z=${z} is outside [${TAIL_Z}, ${NOSE_Z}]`)
  }
})

test('CAR_CENTER is the midpoint of the car', () => {
  assert.equal(CAR_CENTER[0], 0)
  assert.equal(CAR_CENTER[1], OVERALL_HEIGHT / 2)
  assert.equal(CAR_CENTER[2], (NOSE_Z + TAIL_Z) / 2)
})
