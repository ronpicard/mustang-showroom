import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sectionHalfWidth, stationAt, STATIONS } from './bodyProfile.ts'

test('body sections curve smoothly through the sidewall bulge without overshooting', () => {
  for (const z of [54, 0, -54]) {
    const s = stationAt(z)
    const y = s.bulge[1]
    const step = 0.001
    const leftSlope = (sectionHalfWidth(s, y, false) - sectionHalfWidth(s, y - step, false)) / step
    const rightSlope = (sectionHalfWidth(s, y + step, false) - sectionHalfWidth(s, y, false)) / step
    assert.ok(Math.abs(leftSlope - rightSlope) < 0.001, `hard sidewall crease at z=${z}`)
    const max = Math.max(s.rockerTop[0], s.bulge[0], s.belt[0])
    for (let height = s.rockerTop[1]; height < s.belt[1]; height += 0.1) {
      assert.ok(sectionHalfWidth(s, height, false) <= max + 1e-6)
    }
  }
})

test('longitudinal panels have continuous tangents at the interior stations', () => {
  const step = 0.001
  for (const s of STATIONS.slice(1, -1)) {
    for (const key of ['belt', 'bulge', 'crease', 'center'] as const) {
      for (const axis of [0, 1]) {
        const middle = stationAt(s.z)[key][axis]
        const a = (middle - stationAt(s.z - step)[key][axis]) / step
        const b = (stationAt(s.z + step)[key][axis] - middle) / step
        assert.ok(Math.abs(a - b) < 0.005, `${key} tangent jumps at z=${s.z}`)
      }
    }
  }
})
