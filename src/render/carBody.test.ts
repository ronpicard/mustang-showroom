import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { FRONT_AXLE_Z, HOOD_PIN_X, SIDE_STRIPE_BOTTOM_Y, SIDE_STRIPE_FRONT_Z, SIDE_STRIPE_REAR_Z, SIDE_STRIPE_TOP_Y, HOOD_PIN_Z, HOOD_SCOOP_REAR_Z, REAR_AXLE_Z, TAIL_CORNER_RADIUS, TAIL_HALF_WIDTH, TAIL_PANEL_FACE_Z, TAIL_PANEL_HALF_WIDTH, TAIL_Z, ROCKER_BOTTOM_Y, ROCKER_TOP_Y, TURN_SIGNAL_X, TURN_SIGNAL_Y, WHEEL_ARCH_CENTER_Y, WHEEL_ARCH_RADIUS } from '../car/dimensions.ts'
import type { PartId } from '../car/types.ts'
import { createCarAssembly } from './carAssembly.ts'
import { stationAt } from './bodyProfile.ts'

const BODY_SIDE_PARTS: PartId[] = ['fenderLeft', 'fenderRight', 'quarterLeft', 'quarterRight']

test('black rally stripes stay attached to the hood, roof and trunk panels', () => {
  const assembly = createCarAssembly()
  try {
    for (const id of ['hood', 'roof', 'trunkLid'] as const) {
      const panel = assembly.partObjects(id)[0]!
      const stripes = panel.getObjectByName('rallyStripes')!
      assert.ok(stripes, `${id} needs its rally stripes`)
      assert.equal(stripes.children.length, 2)
      for (const child of stripes.children) {
        const stripe = child as THREE.Mesh
        assert.equal(stripe.material, assembly.materials.satinBlack)
        assert.equal(stripe.userData.partId, id)
        const box = new THREE.Box3().setFromObject(stripe)
        assert.ok(Math.abs(box.getSize(new THREE.Vector3()).x - 9) < 0.01)
      }
    }
    assembly.group.updateMatrixWorld(true)
    const stripe = assembly.partObjects('hood')[0]!.getObjectByName('rallyStripes')!.children[0]
    const before = stripe.matrixWorld.clone()
    assembly.setOpenness('hood', 1)
    assembly.group.updateMatrixWorld(true)
    assert.ok(!stripe.matrixWorld.equals(before), 'hood stripes must move with the opening hood')
    assert.equal(stripe.userData.partId, 'hood')
  } finally {
    assembly.dispose()
  }
})

test('film-inspired scoop and spoilers remain compact and part of the inspection model', () => {
  const assembly = createCarAssembly()
  try {
    assembly.group.updateMatrixWorld(true)
    const scoop = assembly.partObjects('hoodScoop')[0]!
    const size = new THREE.Box3().setFromObject(scoop).getSize(new THREE.Vector3())
    assert.ok(size.x < 18 && size.z < 27 && size.y < 5, `oversized scoop: ${size.toArray()}`)
    assert.equal((scoop.children[0] as THREE.Mesh).material, assembly.materials.satinBlack)
    // The scoop is rooted in the hood crown and stands a domed 3 to 4 inches proud of it at the mouth.
    const scoopBox = new THREE.Box3().setFromObject(scoop)
    const mouthCrownY = stationAt(scoopBox.max.z).center[1]
    assert.ok(Math.abs(scoopBox.min.z - HOOD_SCOOP_REAR_Z) < 0.5)
    assert.ok(scoopBox.min.y < mouthCrownY && scoopBox.min.y > mouthCrownY - 1.5, `scoop floats: ${scoopBox.min.y} vs ${mouthCrownY}`)
    assert.ok(scoopBox.max.y - mouthCrownY > 3 && scoopBox.max.y - mouthCrownY < 4.5, `scoop height: ${scoopBox.max.y - mouthCrownY}`)
    // Hood pins rest on the crowned skin at their own x rather than at the centreline height.
    for (const pin of assembly.partObjects('hoodPins')[0]!.children) {
      const pinBox = new THREE.Box3().setFromObject(pin)
      const station = stationAt(HOOD_PIN_Z)
      const u = HOOD_PIN_X / station.crease[0]
      const skinY = station.crease[1] + (station.center[1] - station.crease[1]) * (1 - u * u)
      assert.ok(Math.abs(pinBox.min.y - skinY) < 0.2, `hood pin floats: ${pinBox.min.y} vs ${skinY}`)
    }
    for (const [id, name] of [['frontValance', 'chinSpoiler'], ['trunkLid', 'rearSpoiler']] as const) {
      const spoiler = assembly.partObjects(id)[0]!.getObjectByName(name)!
      assert.ok(spoiler)
      assert.equal(spoiler.userData.partId, id)
      assert.ok(new THREE.Box3().setFromObject(spoiler).min.y > 0)
    }
  } finally {
    assembly.dispose()
  }
})

test('the rear quarter windows are not backed by opaque roof bodywork', () => {
  const assembly = createCarAssembly()
  try {
    assembly.group.updateMatrixWorld(true)
    const ray = new THREE.Raycaster(new THREE.Vector3(-80, 39, -32), new THREE.Vector3(1, 0, 0), 0, 79)
    assert.equal(ray.intersectObjects(assembly.partObjects('roof'), true).length, 0)
  } finally {
    assembly.dispose()
  }
})

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

test('the tail rounds into a recessed panel whose lights face the viewer', () => {
  // The quarters tuck in through the corner radius so the tail panel sits between rounded ends.
  const tail = stationAt(TAIL_Z)
  assert.ok(Math.abs(tail.belt[0] - (TAIL_HALF_WIDTH - TAIL_CORNER_RADIUS)) < 0.8, `tail width ${tail.belt[0]}`)
  assert.ok(tail.crease[0] < tail.belt[0], 'the deck shoulder must stay inside the rounded corner')
  assert.ok(stationAt(TAIL_Z + TAIL_CORNER_RADIUS + 1).belt[0] > TAIL_HALF_WIDTH - 1, 'full width ahead of the corner')

  const assembly = createCarAssembly()
  try {
    assembly.group.updateMatrixWorld(true)
    const panel = assembly.partObjects('rearPanel')[0]!
    const panelBox = new THREE.Box3().setFromObject(panel)
    assert.ok(panelBox.max.x <= TAIL_PANEL_HALF_WIDTH && panelBox.min.z >= TAIL_Z, `panel box ${panelBox.min.toArray()} ${panelBox.max.toArray()}`)
    // Its centre is recessed to the face depth; its edges roll out to the lip behind it.
    const position = (panel.children[0] as THREE.Mesh).geometry.getAttribute('position')
    let centreZ = Number.NaN
    let best = Infinity
    for (let i = 0; i < position.count; i++) {
      const score = Math.abs(position.getX(i)) + Math.abs(position.getY(i) - 30)
      if (score < best) {
        best = score
        centreZ = position.getZ(i)
      }
    }
    assert.ok(Math.abs(centreZ - TAIL_PANEL_FACE_Z) < 0.05, `centre z ${centreZ}`)
    assert.ok(panelBox.min.z < TAIL_PANEL_FACE_Z - 2, 'the lip sits behind the face')

    for (const cluster of assembly.partObjects('taillights')) {
      const box = new THREE.Box3().setFromObject(cluster)
      assert.ok(box.max.x < TAIL_PANEL_HALF_WIDTH - 1 && box.min.x > -TAIL_PANEL_HALF_WIDTH + 1, 'cluster within the panel')
      const lenses = cluster.children.filter((c) => (c as THREE.Mesh).material === assembly.materials.taillightLens)
      assert.equal(lenses.length, 3)
      const lensZ = Math.min(...lenses.map((lens) => new THREE.Box3().setFromObject(lens).min.z))
      // Nothing opaque in the cluster may sit behind (rearward of, -z) the lens faces except the bezels around them.
      for (const child of cluster.children) {
        if (lenses.includes(child)) continue
        const childBox = new THREE.Box3().setFromObject(child)
        const overlapsLens = childBox.min.x < lenses[0]!.position.x + 1 && childBox.max.x > lenses[0]!.position.x - 1 && Math.abs(childBox.min.y - childBox.max.y) < 9.5
        const isSolid = (child as THREE.Mesh).geometry.type === 'BoxGeometry'
        if (isSolid && overlapsLens) assert.ok(childBox.min.z > lensZ, 'a solid backing must not hide the lenses')
      }
    }
  } finally {
    assembly.dispose()
  }
})

test('a satin-black side stripe runs low along the fender, door and quarter between the wheel openings', () => {
  const assembly = createCarAssembly()
  try {
    assembly.group.updateMatrixWorld(true)
    const box = new THREE.Box3()
    let front = -Infinity
    let rear = Infinity
    for (const id of ['fenderLeft', 'doorLeft', 'quarterLeft'] as const) {
      const stripe = assembly.partObjects(id)[0]!.getObjectByName('sideStripe') as THREE.Mesh | undefined
      assert.ok(stripe, `${id} needs its side stripe`)
      assert.equal(stripe.material, assembly.materials.satinBlack)
      assert.equal(stripe.userData.partId, id)
      box.setFromObject(stripe)
      assert.ok(box.min.y > SIDE_STRIPE_BOTTOM_Y - 0.01 && box.max.y < SIDE_STRIPE_TOP_Y + 0.01, `${id}: stripe band y ${box.min.y}..${box.max.y}`)
      const skin = stationAt((box.min.z + box.max.z) / 2)
      assert.ok(box.max.x < -skin.rockerTop[0] + 0.5, `${id}: the stripe lies on the lower skin, not proud of it (x ${box.max.x})`)
      front = Math.max(front, box.max.z)
      rear = Math.min(rear, box.min.z)
    }
    assert.ok(Math.abs(front - SIDE_STRIPE_FRONT_Z) < 0.01 && Math.abs(rear - SIDE_STRIPE_REAR_Z) < 0.01, `stripe spans z ${rear}..${front}`)
  } finally {
    assembly.dispose()
  }
})

test('the rocker sill runs from arch to arch on the body profile, not as a box under the door alone', () => {
  const assembly = createCarAssembly()
  try {
    assembly.group.updateMatrixWorld(true)
    const rockers: THREE.Mesh[] = []
    for (const object of assembly.partObjects('floorPan')) {
      object.traverse((child) => {
        if (child.name === 'rocker') rockers.push(child as THREE.Mesh)
      })
    }
    assert.equal(rockers.length, 2)
    const box = new THREE.Box3()
    for (const rocker of rockers) {
      box.setFromObject(rocker)
      assert.ok(box.max.z >= FRONT_AXLE_Z - WHEEL_ARCH_RADIUS - 0.01, `rocker must reach the front arch, ends at z=${box.max.z}`)
      assert.ok(box.min.z <= REAR_AXLE_Z + WHEEL_ARCH_RADIUS + 0.01, `rocker must reach the rear arch, starts at z=${box.min.z}`)
      assert.ok(box.min.y >= ROCKER_BOTTOM_Y - 0.01 && box.max.y <= ROCKER_TOP_Y + 0.5, `rocker band y ${box.min.y}..${box.max.y}`)
      const outer = Math.max(Math.abs(box.min.x), Math.abs(box.max.x))
      assert.ok(Math.abs(outer - stationAt(0).rockerTop[0]) < 0.05, `rocker face flush with the sill line, got ${outer}`)
    }
  } finally {
    assembly.dispose()
  }
})
