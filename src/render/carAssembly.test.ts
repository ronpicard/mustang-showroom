import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { createCarAssembly } from './carAssembly.ts'
import { FAN_SPINNER_NAME } from './carEngine.ts'

const wrapDelta = (a: number, b: number): number => {
  const d = (b - a) % (Math.PI * 2)
  return d > Math.PI ? d - Math.PI * 2 : d < -Math.PI ? d + Math.PI * 2 : d
}

test('the fan turns smoothly about its own hub while the shake amount changes, and rests at zero', () => {
  const assembly = createCarAssembly()
  const fan = assembly.partObjects('fan')[0]!
  const spinner = fan.getObjectByName(FAN_SPINNER_NAME)!
  assembly.group.updateMatrixWorld(true)
  const restingCentre = new THREE.Box3().setFromObject(fan).getCenter(new THREE.Vector3())
  const restingHub = spinner.getWorldPosition(new THREE.Vector3())

  assembly.setEngineShake(0, 100)
  assembly.setEngineShake(0, 100.016)
  assert.equal(spinner.rotation.z, 0)
  let previous = spinner.rotation.z
  // A catch flare decaying towards idle over a second of frames: every step is a small forward turn.
  for (let frame = 1; frame <= 60; frame++) {
    const amount = 1 + 1.6 * Math.exp(-frame / 20)
    assembly.setEngineShake(amount, 100.016 + frame / 60)
    const step = wrapDelta(previous, spinner.rotation.z)
    assert.ok(step > 0 && step < 1, `frame ${frame}: the fan jumped by ${step.toFixed(3)} rad`)
    previous = spinner.rotation.z
  }
  // Turning the fan must not move it: it spins in place at the hub, not around the car's origin.
  assembly.setEngineShake(0, 200)
  assembly.group.updateMatrixWorld(true)
  assert.ok(spinner.getWorldPosition(new THREE.Vector3()).distanceTo(restingHub) < 1e-6, 'the hub moved while turning')
  // The pitched blades' bounding box changes shape a little as they turn; the old orbit around
  // the car's origin moved the whole part by tens of inches.
  const turnedCentre = new THREE.Box3().setFromObject(fan).getCenter(new THREE.Vector3())
  assert.ok(turnedCentre.distanceTo(restingCentre) < 1.5, `the fan drifted ${turnedCentre.distanceTo(restingCentre).toFixed(2)} in while turning`)
  assembly.dispose()
})
