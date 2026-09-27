import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { FRONT_AXLE_Z, REAR_AXLE_Z, ROCKER_BOTTOM_Y, ROCKER_TOP_Y, TURN_SIGNAL_X, TURN_SIGNAL_Y, WHEEL_ARCH_CENTER_Y, WHEEL_ARCH_RADIUS } from '../car/dimensions.ts'
import type { PartId } from '../car/types.ts'
import { createCarAssembly } from './carAssembly.ts'
import { stationAt } from './bodyProfile.ts'

const BODY_SIDE_PARTS: PartId[] = ['fenderLeft', 'fenderRight', 'quarterLeft', 'quarterRight']

test('the air-cleaner seal lies flat and the radiator clears the closed hood', () => {
  const assembly = createCarAssembly()
  try {
    assembly.group.updateMatrixWorld(true)
    const seal = assembly.partObjects('airCleaner')[0]!.getObjectByName('airCleanerSeal')!
    const size = new THREE.Box3().setFromObject(seal).getSize(new THREE.Vector3())
    assert.ok(size.y <= 1.01 && size.x > 12 && size.z > 12, 'the seal must lie flat around the air-cleaner housing')
    assembly.forEachMesh('radiator', (mesh) => {
      const positions = mesh.geometry.getAttribute('position')
      const p = new THREE.Vector3()
      for (let i = 0; i < positions.count; i++) {
        p.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld)
        assert.ok(p.y < stationAt(p.z).center[1], `radiator protrudes through the hood at ${p.toArray()}`)
      }
    })
    for (const id of BODY_SIDE_PARTS) {
      const liner = assembly.partObjects(id)[0]!.children[1] as THREE.Mesh
      const normals = liner.geometry.getAttribute('normal')
      const expected = id.endsWith('Left') ? -1 : 1
      assert.ok(Array.from({ length: normals.count }, (_, i) => normals.getX(i)).some((x) => x * expected > 0.9), `${id} wheelhouse must face outward`)
    }
  } finally {
    assembly.dispose()
  }
})

test('wheel opening boundary vertices follow the circular arch rather than grid steps', () => {
  const assembly = createCarAssembly()
  try {
    for (const id of BODY_SIDE_PARTS) {
      const axle = id.startsWith('fender') ? FRONT_AXLE_Z : REAR_AXLE_Z
      const panel = assembly.partObjects(id)[0]!.children[0] as THREE.Mesh
      const geometry = panel.geometry
      const positions = geometry.getAttribute('position')
      const index = geometry.getIndex()!
      const edges = new Map<string, { a: number; b: number; count: number }>()
      for (let i = 0; i < index.count; i += 3) {
        for (let j = 0; j < 3; j++) {
          const a = index.getX(i + j)
          const b = index.getX(i + (j + 1) % 3)
          const key = `${Math.min(a, b)}:${Math.max(a, b)}`
          const edge = edges.get(key)
          if (edge) edge.count++
          else edges.set(key, { a, b, count: 1 })
        }
      }
      let contourEdges = 0
      for (const { a, b, count } of edges.values()) {
        if (count !== 1) continue
        const radii = [a, b].map((v) => Math.hypot(positions.getY(v) - WHEEL_ARCH_CENTER_Y, positions.getZ(v) - axle))
        if ([a, b].some((v) => positions.getY(v) <= ROCKER_TOP_Y + 1)) continue
        // Other open edges belong to the rolled lip's duplicated seam and the lower sill.
        // The cut contour itself must contain many edges on the analytic circle, not the
        // handful of accidental intersections a cell-centre mask can produce.
        if (radii.some((r) => Math.abs(r - WHEEL_ARCH_RADIUS) >= 0.02)) continue
        contourEdges++
      }
      assert.ok(contourEdges > 40, `${id} has only ${contourEdges} curved edges around its opening`)
    }
  } finally {
    assembly.dispose()
  }
})

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

test('the engine block and sump stay above the rocker line', () => {
  const assembly = createCarAssembly()
  assembly.group.updateMatrixWorld(true)
  const box = new THREE.Box3()
  for (const object of assembly.partObjects('engineBlock')) {
    box.setFromObject(object)
    assert.ok(box.min.y >= ROCKER_BOTTOM_Y - 0.01, `engine block reaches down to y=${box.min.y.toFixed(2)}`)
  }
  assembly.dispose()
})
