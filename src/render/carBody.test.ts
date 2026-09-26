import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { ROCKER_BOTTOM_Y, TURN_SIGNAL_X, TURN_SIGNAL_Y } from '../car/dimensions.ts'
import type { PartId } from '../car/types.ts'
import { createCarAssembly } from './carAssembly.ts'

const BODY_SIDE_PARTS: PartId[] = ['fenderLeft', 'fenderRight', 'quarterLeft', 'quarterRight']

test('no fender or quarter panel geometry hangs below the rocker line', () => {
  const assembly = createCarAssembly()
  assembly.group.updateMatrixWorld(true)
  const box = new THREE.Box3()
  for (const id of BODY_SIDE_PARTS) {
    for (const object of assembly.partObjects(id)) {
      object.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return
        box.setFromObject(child)
        assert.ok(
          box.min.y >= ROCKER_BOTTOM_Y - 0.01,
          `${id}: a mesh reaches down to y=${box.min.y.toFixed(2)}, below the rocker bottom ${ROCKER_BOTTOM_Y}`,
        )
      })
    }
  }
  assembly.dispose()
})

test('the front valance carries a turn-signal lens over each cut-out', () => {
  const assembly = createCarAssembly()
  assembly.group.updateMatrixWorld(true)
  const box = new THREE.Box3()
  const lensBoxes: THREE.Box3[] = []
  for (const object of assembly.partObjects('frontValance')) {
    object.traverse((child) => {
      const m = child as THREE.Mesh
      if (m.isMesh && m.material === assembly.materials.amberLens) lensBoxes.push(box.setFromObject(m).clone())
    })
  }
  assert.equal(lensBoxes.length, 1)
  for (const x of [TURN_SIGNAL_X, -TURN_SIGNAL_X]) {
    assert.ok(lensBoxes[0]!.containsPoint(new THREE.Vector3(x, TURN_SIGNAL_Y, lensBoxes[0]!.max.z)), `no lens over the cut-out at x=${x}`)
  }
  assembly.dispose()
})
