import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loopWeightsForRpm, recordedRateForRpm } from './audio.ts'

const LOOPS = [800, 1500, 2700, 4600]

test('loop weights pin to the nearest loop outside the rendered range', () => {
  assert.deepEqual(loopWeightsForRpm(300, LOOPS), [1, 0, 0, 0])
  assert.deepEqual(loopWeightsForRpm(800, LOOPS), [1, 0, 0, 0])
  assert.deepEqual(loopWeightsForRpm(6000, LOOPS), [0, 0, 0, 1])
})

test('loop weights crossfade between neighbours with equal power', () => {
  for (const rpm of [900, 1200, 1499, 2000, 3500, 4599]) {
    const weights = loopWeightsForRpm(rpm, LOOPS)
    const power = weights.reduce((sum, w) => sum + w * w, 0)
    assert.equal(Math.abs(power - 1) < 1e-9, true, `power at ${rpm}: ${power}`)
    assert.equal(weights.filter((w) => w > 0).length <= 2, true)
  }
  const [a, b] = loopWeightsForRpm(Math.sqrt(800 * 1500), LOOPS)
  assert.equal(Math.abs(a! - b!) < 1e-9, true, 'the geometric midpoint is an even blend')
})

test('the recorded loop slows in proportion below idle and caps its pitch shift at redline', () => {
  assert.equal(recordedRateForRpm(800), 1)
  assert.equal(Math.abs(recordedRateForRpm(400) - 0.5) < 1e-9, true)
  assert.equal(recordedRateForRpm(0) > 0, true)
  assert.equal(recordedRateForRpm(5400) < 2.5, true)
  assert.equal(recordedRateForRpm(3000) > 1 && recordedRateForRpm(3000) < recordedRateForRpm(5400), true)
})
