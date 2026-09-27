import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { TAIL_Z } from '../car/dimensions.ts'
import { createCarAssembly } from './carAssembly.ts'

test('chrome MUSTANG and MACH 1 badges sit on the tail panel, fenders and quarters', () => {
  const assembly = createCarAssembly()
  assembly.group.updateMatrixWorld(true)
  const badges = assembly.partObjects('badges')[0]!

  const meshes: THREE.Mesh[] = []
  badges.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object)
  })
  assert.ok(meshes.length > 0, 'badges part has no meshes')
  for (const mesh of meshes) {
    assert.equal(mesh.material, assembly.materials.chrome, 'every badge letter should be chrome')
  }

  // Five locations: the tail panel word, a fender word each side, a quarter word each side.
  assert.equal(badges.children.length, 5, 'expected one tail group, two fender groups and two quarter groups')

  let tailCount = 0
  let fenderCount = 0
  let quarterCount = 0
  for (const child of badges.children) {
    const box = new THREE.Box3().setFromObject(child)
    const centerZ = (box.min.z + box.max.z) / 2
    const maxAbsX = Math.max(Math.abs(box.min.x), Math.abs(box.max.x))
    if (box.max.z < TAIL_Z + 4) {
      tailCount += 1
    } else if (maxAbsX > 30 && centerZ >= 18 && centerZ <= 38) {
      fenderCount += 1
    } else if (maxAbsX > 30 && centerZ >= -84 && centerZ <= -68) {
      quarterCount += 1
    }
  }
  assert.equal(tailCount, 1, 'expected exactly one badge group behind the tail')
  assert.equal(fenderCount, 2, 'expected exactly two fender badge groups')
  assert.equal(quarterCount, 2, 'expected exactly two quarter badge groups')

  assembly.dispose()
})

test('the rear window slats stand just above the fastback glass', () => {
  const assembly = createCarAssembly()
  assembly.group.updateMatrixWorld(true)
  const rearLouvers = assembly.partObjects('rearLouvers')[0]!

  const meshes: THREE.Mesh[] = []
  rearLouvers.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object)
  })
  assert.ok(meshes.length > 0, 'rearLouvers part has no meshes')

  const box = new THREE.Box3().setFromObject(rearLouvers)
  assert.ok(box.min.z >= -61 && box.max.z <= -25, `louvers z range [${box.min.z.toFixed(1)}, ${box.max.z.toFixed(1)}] outside [-61, -25]`)
  assert.ok(box.min.y >= 40 && box.max.y <= 52, `louvers y range [${box.min.y.toFixed(1)}, ${box.max.y.toFixed(1)}] outside [40, 52]`)
  const maxAbsX = Math.max(Math.abs(box.min.x), Math.abs(box.max.x))
  assert.ok(maxAbsX <= 25, `louvers half-width ${maxAbsX.toFixed(1)} exceeds 25`)

  assembly.dispose()
})
