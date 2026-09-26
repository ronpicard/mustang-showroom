import assert from 'node:assert/strict'
import { test } from 'node:test'
import { partEmphasisFor } from './partEmphasis.ts'

test('with nothing selected only the hovered part is emphasised', () => {
  assert.equal(partEmphasisFor('hood', null, null), null)
  assert.equal(partEmphasisFor('hood', null, 'hood'), 'hover')
  assert.equal(partEmphasisFor('roof', null, 'hood'), null)
})

test('with a selection the rest of the car is ghosted, except a hovered part', () => {
  assert.equal(partEmphasisFor('hood', 'hood', null), 'selected')
  assert.equal(partEmphasisFor('roof', 'hood', null), 'ghost')
  assert.equal(partEmphasisFor('roof', 'hood', 'roof'), 'hover')
  assert.equal(partEmphasisFor('hood', 'hood', 'hood'), 'selected')
})
