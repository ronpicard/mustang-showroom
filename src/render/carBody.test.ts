import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { ROCKER_BOTTOM_Y } from '../car/dimensions.ts'
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
