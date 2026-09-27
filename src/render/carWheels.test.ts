import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { TIRE_RADIUS, WHEEL_ARCH_CENTER_Y, WHEEL_ARCH_RADIUS, WHEEL_CENTER_Y, WHEEL_CENTERS } from '../car/dimensions.ts'
import { createCarAssembly } from './carAssembly.ts'

test('the five-spoke wheels sit inside low-profile tyres that nearly fill the arches', () => {
  const assembly = createCarAssembly()
  assembly.group.updateMatrixWorld(true)
  for (const id of ['wheelFrontLeft', 'wheelRearRight'] as const) {
    const wheel = assembly.partObjects(id)[0]!
    const meshes: THREE.Mesh[] = []
    wheel.traverse((o) => { if (o instanceof THREE.Mesh) meshes.push(o) })
    const byMaterial = (m: THREE.Material) => meshes.filter((mesh) => mesh.material === m)
    assert.equal(byMaterial(assembly.materials.wheelSpoke).length, 1, `${id} needs its spoke face`)
    assert.equal(byMaterial(assembly.materials.chrome).length, 1, `${id} needs its polished lip`)
    assert.equal(meshes.length, 5, `${id} should be tyre, lettering, spokes, lip and barrel only`)
    // The polished lip and spokes stay inside the tyre's outer radius, on a short sidewall.
    const centre = new THREE.Vector3(...WHEEL_CENTERS[id])
    const lipBox = new THREE.Box3().setFromObject(byMaterial(assembly.materials.chrome)[0]!)
    const lipRadius = (lipBox.max.y - lipBox.min.y) / 2
    assert.ok(lipRadius > TIRE_RADIUS * 0.6 && lipRadius < TIRE_RADIUS, `${id} lip radius ${lipRadius.toFixed(1)} is not a 17-inch wheel inside a 26-inch tyre`)
    assert.ok(Math.abs((lipBox.max.y + lipBox.min.y) / 2 - (centre.y + assembly.group.position.y)) < 0.05, `${id} lip is off-centre`)
  }
  // The arch clears the tyre by a couple of inches at the top, not the old cavernous gap.
  const gap = WHEEL_ARCH_CENTER_Y + WHEEL_ARCH_RADIUS - (WHEEL_CENTER_Y + TIRE_RADIUS)
  assert.ok(gap > 1 && gap < 3.5, `arch gap ${gap.toFixed(2)} in`)
  assembly.dispose()
})

test('raised white letters ring the outboard sidewall of every tyre', () => {
  const assembly = createCarAssembly()
  assembly.group.updateMatrixWorld(true)
  for (const id of ['wheelFrontLeft', 'wheelFrontRight', 'wheelRearLeft', 'wheelRearRight'] as const) {
    const wheel = assembly.partObjects(id)[0]!
    const lettering = wheel.getObjectByName('tireLettering')
    assert.ok(lettering, `${id} is missing its tireLettering mesh`)
    const box = new THREE.Box3().setFromObject(lettering!)
    const centre = new THREE.Vector3(...WHEEL_CENTERS[id])
    centre.y += assembly.group.position.y
    for (const axis of ['x', 'y', 'z'] as const) {
      assert.ok(Math.abs(box.min[axis] - centre[axis]) <= TIRE_RADIUS, `${id} lettering ${axis} min falls outside the tyre's radius`)
      assert.ok(Math.abs(box.max[axis] - centre[axis]) <= TIRE_RADIUS, `${id} lettering ${axis} max falls outside the tyre's radius`)
    }
    if (id.endsWith('Left')) {
      assert.ok(box.min.x < centre.x - 2, `${id} lettering should sit outboard (toward -X) of the wheel centre`)
    } else {
      assert.ok(box.max.x > centre.x + 2, `${id} lettering should sit outboard (toward +X) of the wheel centre`)
    }
    assert.ok(box.max.x - box.min.x < 1.5, `${id} lettering x extent ${(box.max.x - box.min.x).toFixed(2)} is too wide`)
    // The band is single-sided, so its normals must face outboard or the front-face cull hides it.
    const outboard = id.endsWith('Left') ? -1 : 1
    const normals = (lettering as THREE.Mesh).geometry.getAttribute('normal')
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(lettering!.matrixWorld)
    let facingOut = 0
    for (let i = 0; i < normals.count; i++) {
      if (new THREE.Vector3().fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).x * outboard > 0) facingOut++
    }
    assert.ok(facingOut > normals.count * 0.9, `${id} lettering normals face inboard (${facingOut}/${normals.count} out)`)
  }
  assembly.dispose()
})
