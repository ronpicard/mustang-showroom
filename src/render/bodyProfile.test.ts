import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DOOR_REAR_Z, REAR_AXLE_Z, TAIL_CORNER_RADIUS, TAIL_Z } from '../car/dimensions.ts'
import { quarterHip, sectionHalfWidth, stationAt, STATIONS } from './bodyProfile.ts'

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

test('the quarter swells into a hip over the rear wheel and the fender crowns over the headlights', () => {
  // The hip is absent at the door seam (so the door skin stays flush) and fully out behind the axle.
  assert.equal(quarterHip(DOOR_REAR_Z), 0)
  assert.ok(quarterHip(DOOR_REAR_Z - 1) < 0.05, 'the hip fades in gently behind the seam')
  const seam = stationAt(DOOR_REAR_Z)
  const hip = stationAt(REAR_AXLE_Z - 2)
  assert.ok(hip.bulge[0] > seam.bulge[0] + 0.9, `hip bulge ${hip.bulge[0]} vs seam ${seam.bulge[0]}`)
  assert.ok(hip.belt[0] > seam.belt[0] + 0.7, `hip belt ${hip.belt[0]} vs seam ${seam.belt[0]}`)
  // The swell is gone again by the tail corner.
  assert.ok(quarterHip(TAIL_Z + TAIL_CORNER_RADIUS) < 0.05, 'no hip into the tail corner')
  // The fender crease crowns over the headlights: above the straight line between the points a
  // hand behind and a hand ahead of it (the crease also rises toward the cowl overall).
  const behind = stationAt(66).crease[1]
  const ahead = stationAt(91).crease[1]
  const chord = behind + (ahead - behind) * ((80 - 66) / (91 - 66))
  assert.ok(stationAt(80).crease[1] > chord + 0.3, `crease ${stationAt(80).crease[1]} vs chord ${chord}`)
  assert.equal(stationAt(DOOR_REAR_Z).crease[1], stationAt(DOOR_REAR_Z).belt[1], 'no crease over the doors')
})
