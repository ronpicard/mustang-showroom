import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { orbitDistanceInsideWalls } from './showroom.ts'

test('the orbit distance stops short of the wall in the camera direction and ignores the ceiling', () => {
  const target = new THREE.Vector3(0, 25, 0)
  const behindTail = orbitDistanceInsideWalls(target, new THREE.Vector3(0, 0, -1))
  assert.ok(behindTail > 300 && behindTail < 360, `stops inside the back wall, got ${behindTail}`)
  const offCentre = orbitDistanceInsideWalls(new THREE.Vector3(0, 25, -100), new THREE.Vector3(0, 0, -1))
  assert.ok(Math.abs(offCentre - (behindTail - 100)) < 1e-9, 'a target nearer the wall leaves less room')
  const diagonal = orbitDistanceInsideWalls(target, new THREE.Vector3(-1, 0, -1).normalize())
  assert.ok(diagonal > behindTail && diagonal < behindTail * Math.SQRT2 + 1e-9, 'a corner is further than a wall face')
  assert.equal(orbitDistanceInsideWalls(target, new THREE.Vector3(0, 1, 0)), Infinity, 'straight up is open')
  const outside = orbitDistanceInsideWalls(new THREE.Vector3(0, 25, -400), new THREE.Vector3(0, 0, -1))
  assert.equal(outside, 0, 'a target already past the wall allows no distance')
})
