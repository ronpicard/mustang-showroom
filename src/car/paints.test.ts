import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { PaintId } from './types.ts'
import { DEFAULT_PAINT, PAINTS, isPaintId, nextPaint, paintById } from './paints.ts'

test('paint ids are unique', () => {
  const ids = PAINTS.map((paint) => paint.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('every paint has a valid sRGB hex colour', () => {
  for (const paint of PAINTS) {
    assert.match(paint.hex, /^#[0-9a-fA-F]{6}$/, `${paint.id}'s hex ${paint.hex} is not a valid #rrggbb colour`)
  }
})

test('metallic is between 0 and 1 for every paint', () => {
  for (const paint of PAINTS) {
    assert.ok(paint.metallic >= 0 && paint.metallic <= 1, `${paint.id}'s metallic ${paint.metallic} is outside [0, 1]`)
  }
})

test('nextPaint cycles through every paint and wraps back to the first', () => {
  const seen: PaintId[] = []
  let id = PAINTS[0]!.id
  for (let i = 0; i < PAINTS.length; i += 1) {
    seen.push(id)
    id = nextPaint(id)
  }
  assert.deepEqual([...seen].sort(), [...PAINTS.map((paint) => paint.id)].sort())
  assert.equal(id, PAINTS[0]!.id, 'nextPaint should wrap back to the first paint')
})

test('the default paint exists in the rack', () => {
  assert.ok(isPaintId(DEFAULT_PAINT))
  assert.equal(paintById(DEFAULT_PAINT).id, DEFAULT_PAINT)
})

test('isPaintId rejects unknown values', () => {
  assert.equal(isPaintId('notAPaint'), false)
  assert.equal(isPaintId(42), false)
  assert.equal(isPaintId(undefined), false)
})

test('paintById throws for an unknown id', () => {
  assert.throws(() => paintById('notAPaint' as PaintId), /Unknown paint/)
})
