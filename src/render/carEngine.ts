import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  ALTERNATOR_CENTER,
  AIR_CLEANER_DIAMETER,
  AIR_CLEANER_Y,
  AIR_CLEANER_Z,
  BATTERY_CENTER,
  CARB_TOP_Y,
  CONSOLE_TOP_Y,
  ENGINE_BLOCK_HEIGHT,
  ENGINE_BLOCK_LENGTH,
  ENGINE_BLOCK_WIDTH,
  ROCKER_BOTTOM_Y,
  ENGINE_CENTER,
  FAN_DIAMETER,
  FAN_Y,
  FAN_Z,
  RADIATOR_BOTTOM_Y,
  RADIATOR_HALF_WIDTH,
  RADIATOR_THICKNESS,
  RADIATOR_TOP_Y,
  RADIATOR_Z,
  SHIFTER_Z,
  TRANSMISSION_FRONT_Z,
  TRANSMISSION_REAR_Z,
  TRANSMISSION_Y,
  VALVE_COVER_TOP_Y,
} from '../car/dimensions.ts'
import type { CarMaterials } from './carMaterials.ts'
import { tagPart, type PartBuild } from './partBuild.ts'

// -------------------------------------------------------------------------------------------
// The Boss 429: a 90-degree big-block V8, crank along Z, centred on ENGINE_CENTER. Every part
// here reads from dimensions.ts so the block, heads, intake, carburettor and air cleaner stack
// without gaps, and the whole assembly stays under the hood surface (which falls linearly from
// HOOD_REAR_Y at HOOD_REAR_Z to HOOD_FRONT_Y at HOOD_FRONT_Z) except the air cleaner's lid,
// which is meant to poke up into the hood scoop.
// -------------------------------------------------------------------------------------------

/** How far each cylinder bank leans outward off vertical: a 90-degree V8. */
const BANK_ANGLE = Math.PI / 4

/** The lower crankcase is this fraction of the block's total height; the rest is the vee deck. */
const BLOCK_LOWER_FRACTION = 0.55
/** Where the valley floor sits within the vee deck's height budget, 0 = deck top, 1 = deck outer edge. */
const BLOCK_VALLEY_FRACTION = 0.35

const BLOCK_BOTTOM_Y = ENGINE_CENTER[1] - ENGINE_BLOCK_HEIGHT / 2
/** The sump hangs from the crankcase down to the sheet-metal line; any deeper and it shows
 * beneath the front valance from a low camera. */
const OIL_PAN_DEPTH = BLOCK_BOTTOM_Y - ROCKER_BOTTOM_Y
const BLOCK_LOWER_HEIGHT = ENGINE_BLOCK_HEIGHT * BLOCK_LOWER_FRACTION
const BLOCK_VEE_HEIGHT = ENGINE_BLOCK_HEIGHT - BLOCK_LOWER_HEIGHT
const BLOCK_DECK_OUTER_Y = BLOCK_BOTTOM_Y + ENGINE_BLOCK_HEIGHT
/** The valley floor between the two banks, where the intake manifold sits down into the block. */
const BLOCK_VALLEY_Y = BLOCK_BOTTOM_Y + BLOCK_LOWER_HEIGHT + BLOCK_VEE_HEIGHT * BLOCK_VALLEY_FRACTION

/** Head casting: length along Z (the bank), width across it, height off the deck. */
const HEAD_LENGTH = 26
const HEAD_WIDTH = 8
const HEAD_HEIGHT = 5
/** Valve cover, on top of the head. */
const COVER_LENGTH = 24
const COVER_WIDTH = 7
const COVER_HEIGHT = 3
const COVER_RIB_HEIGHT = 0.6
/**
 * Each bank is a head + cover stack built in its own local frame (x = outward from the block's
 * centreline, y = up off the deck, z = along the crank), then rotated by BANK_ANGLE about Z and
 * positioned so the stack's outer-top corner lands exactly on VALVE_COVER_TOP_Y — the only fixed
 * point the spec gives for the heads. Rotating (x, y) by angle a about the origin gives
 * y' = x sin(a) + y cos(a); with a = ±45 degrees sin and cos are equal, so the bank's sign cancels
 * and both banks share one group Y.
 */
const BANK_TOP_LOCAL_X = HEAD_WIDTH
const BANK_TOP_LOCAL_Y = HEAD_HEIGHT + COVER_HEIGHT + COVER_RIB_HEIGHT
const BANK_RISE = Math.SQRT1_2 * (BANK_TOP_LOCAL_X + BANK_TOP_LOCAL_Y)
const BANK_GROUP_Y = VALVE_COVER_TOP_Y - BANK_RISE

/** Intake manifold: the main dual-plane casting, then a raised plenum under the carburettor. */
const INTAKE_HEIGHT = 6
const PLENUM_HEIGHT = 3

/** Where the header collectors turn down to meet carChassis's exhaust system. */
const HEADER_OUTLET = { x: 14, y: 14, z: 48 }

interface Placement {
  position: THREE.Vector3
  rotation?: THREE.Euler
}

function makeMesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/** A tube swept along straight-line waypoints; used for hoses, wires, belts and header pipes. */
function tubeAlong(points: THREE.Vector3[], radius: number, radialSegments = 8): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points)
  return new THREE.TubeGeometry(curve, Math.max(points.length * 6, 12), radius, radialSegments, false)
}

/** A cylinder built along Y (three.js's default) rotated so its length runs along car-space Z. */
function cylinderAlongZ(radiusTop: number, radiusBottom: number, height: number, segments = 20): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments)
  geometry.rotateX(Math.PI / 2)
  return geometry
}

/** Repeats one template geometry at several placements and merges the result into a single draw call. */
function mergedFrom(template: THREE.BufferGeometry, placements: Placement[]): THREE.BufferGeometry {
  const instances = placements.map(({ position, rotation }) => {
    const instance = template.clone()
    if (rotation) {
      instance.rotateX(rotation.x)
      instance.rotateY(rotation.y)
      instance.rotateZ(rotation.z)
    }
    instance.translate(position.x, position.y, position.z)
    return instance
  })
  const merged = mergeGeometries(instances)
  template.dispose()
  instances.forEach((instance) => instance.dispose())
  if (!merged) throw new Error('carEngine: mergeGeometries returned no geometry')
  return merged
}

function buildEngineBlock(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()
  const half = ENGINE_BLOCK_WIDTH / 2

  const crankcase = makeMesh(
    new RoundedBoxGeometry(ENGINE_BLOCK_WIDTH, BLOCK_LOWER_HEIGHT, ENGINE_BLOCK_LENGTH, 1, 0.8),
    materials.castIron,
  )
  crankcase.position.set(ENGINE_CENTER[0], BLOCK_BOTTOM_Y + BLOCK_LOWER_HEIGHT / 2, ENGINE_CENTER[2])
  group.add(crankcase)

  // The vee deck: an extruded profile (valley low in the middle, each bank deck rising to the
  // outer edge) swept the length of the block.
  const deckShape = new THREE.Shape()
  deckShape.moveTo(-half, 0)
  deckShape.lineTo(-half, BLOCK_VEE_HEIGHT)
  deckShape.lineTo(0, BLOCK_VEE_HEIGHT * BLOCK_VALLEY_FRACTION)
  deckShape.lineTo(half, BLOCK_VEE_HEIGHT)
  deckShape.lineTo(half, 0)
  deckShape.closePath()
  const deckGeometry = new THREE.ExtrudeGeometry(deckShape, {
    depth: ENGINE_BLOCK_LENGTH,
    bevelEnabled: true,
    bevelThickness: 0.3,
    bevelSize: 0.3,
    bevelSegments: 1,
    curveSegments: 1,
  })
  deckGeometry.translate(
    ENGINE_CENTER[0],
    BLOCK_BOTTOM_Y + BLOCK_LOWER_HEIGHT,
    ENGINE_CENTER[2] - ENGINE_BLOCK_LENGTH / 2,
  )
  group.add(makeMesh(deckGeometry, materials.castIron))

  const oilPan = makeMesh(new RoundedBoxGeometry(16, OIL_PAN_DEPTH, 26, 1, 1), materials.steelDark)
  oilPan.position.set(ENGINE_CENTER[0], BLOCK_BOTTOM_Y - OIL_PAN_DEPTH / 2, ENGINE_CENTER[2])
  group.add(oilPan)

  const frontZ = ENGINE_CENTER[2] + ENGINE_BLOCK_LENGTH / 2
  const rearZ = ENGINE_CENTER[2] - ENGINE_BLOCK_LENGTH / 2

  const timingCover = makeMesh(new RoundedBoxGeometry(14, 12, 2, 1, 1), materials.aluminium)
  timingCover.position.set(ENGINE_CENTER[0], ENGINE_CENTER[1] - 1, frontZ + 1)
  group.add(timingCover)

  const balancer = makeMesh(cylinderAlongZ(3.5, 3.5, 2, 24), materials.steelDark)
  balancer.position.set(ENGINE_CENTER[0], ENGINE_CENTER[1] - 1, frontZ + 2.2)
  group.add(balancer)

  const waterPump = makeMesh(new RoundedBoxGeometry(8, 8, 4, 1, 0.8), materials.aluminium)
  waterPump.position.set(ENGINE_CENTER[0], ENGINE_CENTER[1] + 5, frontZ + 2)
  group.add(waterPump)

  const bellhousingFlange = makeMesh(cylinderAlongZ(9, 9, 1, 24), materials.castIron)
  bellhousingFlange.position.set(ENGINE_CENTER[0], ENGINE_CENTER[1], rearZ - 0.5)
  group.add(bellhousingFlange)

  const mountTemplate = new RoundedBoxGeometry(3, 2.5, 5, 1, 0.4)
  const mounts = mergedFrom(mountTemplate, [
    { position: new THREE.Vector3(-(half + 1.5), BLOCK_BOTTOM_Y + 2, ENGINE_CENTER[2]) },
    { position: new THREE.Vector3(half + 1.5, BLOCK_BOTTOM_Y + 2, ENGINE_CENTER[2]) },
  ])
  group.add(makeMesh(mounts, materials.steelDark))

  const freezePlugTemplate = new THREE.CylinderGeometry(1.1, 1.1, 0.4, 16)
  freezePlugTemplate.rotateZ(Math.PI / 2)
  const freezePlacements: Placement[] = []
  for (const sign of [-1, 1] as const) {
    for (const dz of [-9, 0, 9]) {
      freezePlacements.push({
        position: new THREE.Vector3(sign * (half + 0.15), BLOCK_BOTTOM_Y + BLOCK_LOWER_HEIGHT * 0.6, ENGINE_CENTER[2] + dz),
      })
    }
  }
  group.add(makeMesh(mergedFrom(freezePlugTemplate, freezePlacements), materials.castIron))

  const dipstick = makeMesh(
    tubeAlong(
      [
        new THREE.Vector3(half + 0.5, BLOCK_BOTTOM_Y + BLOCK_LOWER_HEIGHT * 0.5, ENGINE_CENTER[2] + 10),
        new THREE.Vector3(half + 4, BLOCK_DECK_OUTER_Y + 2, ENGINE_CENTER[2] + 8),
      ],
      0.4,
    ),
    materials.steelBright,
  )
  group.add(dipstick)

  return group
}

/** One head + valve cover stack, built in its own local frame before the bank tilt is applied. */
function buildBank(materials: CarMaterials, sign: 1 | -1): THREE.Group {
  const bank = new THREE.Group()

  const head = makeMesh(new RoundedBoxGeometry(HEAD_WIDTH, HEAD_HEIGHT, HEAD_LENGTH, 1, 0.6), materials.aluminium)
  head.position.set(sign * (HEAD_WIDTH / 2), HEAD_HEIGHT / 2, 0)
  bank.add(head)

  const cover = makeMesh(new RoundedBoxGeometry(COVER_WIDTH, COVER_HEIGHT, COVER_LENGTH, 1, 0.7), materials.satinBlack)
  cover.position.set(sign * (HEAD_WIDTH / 2), HEAD_HEIGHT + COVER_HEIGHT / 2, 0)
  bank.add(cover)

  const rib = makeMesh(new THREE.BoxGeometry(1.4, COVER_RIB_HEIGHT, COVER_LENGTH - 4), materials.aluminium)
  rib.position.set(sign * (HEAD_WIDTH / 2), HEAD_HEIGHT + COVER_HEIGHT + COVER_RIB_HEIGHT / 2, 0)
  bank.add(rib)

  // Spark plug wires: short hoses from the cover's outer side down toward the plugs on the block.
  for (const dz of [-9, -3, 3, 9]) {
    const top = new THREE.Vector3(sign * HEAD_WIDTH, HEAD_HEIGHT + COVER_HEIGHT * 0.6, dz)
    const bottom = new THREE.Vector3(sign * (HEAD_WIDTH + 1.5), 0.5, dz)
    bank.add(makeMesh(tubeAlong([top, bottom], 0.2, 6), materials.hose))
  }

  return bank
}

function buildCylinderHeads(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()
  for (const sign of [-1, 1] as const) {
    const bank = buildBank(materials, sign)
    bank.position.set(0, BANK_GROUP_Y, ENGINE_CENTER[2])
    bank.rotation.z = sign * BANK_ANGLE
    group.add(bank)
  }
  return group
}

function buildIntakeManifold(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()
  const baseY = BLOCK_VALLEY_Y

  const mainBox = makeMesh(new RoundedBoxGeometry(12, INTAKE_HEIGHT, 24, 1, 0.8), materials.aluminium)
  mainBox.position.set(0, baseY + INTAKE_HEIGHT / 2, ENGINE_CENTER[2])
  group.add(mainBox)

  const plenum = makeMesh(new RoundedBoxGeometry(8, PLENUM_HEIGHT, 10, 1, 0.6), materials.aluminium)
  plenum.position.set(0, baseY + INTAKE_HEIGHT + PLENUM_HEIGHT / 2, ENGINE_CENTER[2])
  group.add(plenum)

  const runnerTemplate = new THREE.CylinderGeometry(1.3, 1.6, 6, 12)
  const runnerPlacements: Placement[] = []
  for (const sign of [-1, 1] as const) {
    for (const dz of [-9, -3, 3, 9]) {
      runnerPlacements.push({
        position: new THREE.Vector3(sign * 7, baseY + INTAKE_HEIGHT * 0.6, ENGINE_CENTER[2] + dz),
        rotation: new THREE.Euler(0, 0, sign * (Math.PI / 2 - BANK_ANGLE)),
      })
    }
  }
  group.add(makeMesh(mergedFrom(runnerTemplate, runnerPlacements), materials.aluminium))

  const thermostatHousing = makeMesh(new RoundedBoxGeometry(4, 3, 4, 1, 0.6), materials.aluminium)
  thermostatHousing.position.set(0, baseY + INTAKE_HEIGHT + 1, ENGINE_CENTER[2] + 10)
  group.add(thermostatHousing)

  return group
}

function buildCarburetor(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()
  const bodyHeight = 5
  const bodyY = CARB_TOP_Y - bodyHeight / 2

  const body = makeMesh(new RoundedBoxGeometry(6, bodyHeight, 6, 1, 0.6), materials.aluminium)
  body.position.set(0, bodyY, ENGINE_CENTER[2])
  group.add(body)

  for (const dz of [-2.6, 2.6]) {
    const bowl = makeMesh(new RoundedBoxGeometry(3, 2, 2.4, 1, 0.4), materials.blackTrim)
    bowl.position.set(0, bodyY - bodyHeight / 2 - 1, ENGINE_CENTER[2] + dz)
    group.add(bowl)
  }

  const choke = makeMesh(cylinderAlongZ(1, 1, 1, 16), materials.blackTrim)
  choke.rotation.set(0, Math.PI / 2, 0)
  choke.position.set(-2, CARB_TOP_Y + 0.2, ENGINE_CENTER[2])
  group.add(choke)

  const linkage = makeMesh(new THREE.BoxGeometry(0.3, 0.3, 3), materials.steelDark)
  linkage.position.set(2.6, bodyY - 1, ENGINE_CENTER[2] + 1)
  group.add(linkage)

  return group
}

function buildAirCleaner(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()
  const radius = AIR_CLEANER_DIAMETER / 2
  const drumHeight = 3.5
  const drumBottomY = AIR_CLEANER_Y

  const housing = makeMesh(new THREE.CylinderGeometry(radius, radius, drumHeight, 32), materials.satinBlack)
  housing.position.set(0, drumBottomY + drumHeight / 2, AIR_CLEANER_Z)
  group.add(housing)

  const lidHeight = 0.6
  const lid = makeMesh(new THREE.CylinderGeometry(radius + 0.2, radius + 0.2, lidHeight, 32), materials.chrome)
  lid.position.set(0, drumBottomY + drumHeight + lidHeight / 2, AIR_CLEANER_Z)
  group.add(lid)

  const wingNutBase = makeMesh(new THREE.CylinderGeometry(0.7, 0.7, 0.6, 16), materials.chrome)
  wingNutBase.position.set(0, drumBottomY + drumHeight + lidHeight + 0.3, AIR_CLEANER_Z)
  group.add(wingNutBase)

  const wingBar = makeMesh(new THREE.BoxGeometry(2.2, 0.25, 0.5), materials.chrome)
  wingBar.position.copy(wingNutBase.position)
  wingBar.position.y += 0.35
  group.add(wingBar)

  const foamRing = makeMesh(new THREE.TorusGeometry(radius - 0.3, 0.5, 10, 32), materials.rubber)
  foamRing.position.set(0, drumBottomY + drumHeight - 0.2, AIR_CLEANER_Z)
  group.add(foamRing)

  return group
}

function buildHeaders(materials: CarMaterials, sign: 1 | -1): THREE.Group {
  const group = new THREE.Group()
  const half = ENGINE_BLOCK_WIDTH / 2
  const portY = BLOCK_DECK_OUTER_Y - 4
  const portX = sign * (half + 3)
  const collector = new THREE.Vector3(sign * (half + 5), ENGINE_CENTER[1] - 2, ENGINE_CENTER[2] - 6)
  const outlet = new THREE.Vector3(sign * HEADER_OUTLET.x, HEADER_OUTLET.y, HEADER_OUTLET.z)

  for (const dz of [-9, -3, 3, 9]) {
    const port = new THREE.Vector3(portX, portY, ENGINE_CENTER[2] + dz)
    group.add(makeMesh(tubeAlong([port, collector], 0.9, 10), materials.castIron))
  }

  const collectorBody = makeMesh(cylinderAlongZ(1.6, 1.3, 5, 16), materials.castIron)
  collectorBody.position.copy(collector)
  group.add(collectorBody)

  group.add(makeMesh(tubeAlong([collector, outlet], 1.1, 10), materials.castIron))

  return group
}

function buildRadiator(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()
  const coreHeight = RADIATOR_TOP_Y - RADIATOR_BOTTOM_Y
  const coreCenterY = (RADIATOR_TOP_Y + RADIATOR_BOTTOM_Y) / 2
  const coreWidth = RADIATOR_HALF_WIDTH * 2

  const core = makeMesh(new THREE.BoxGeometry(coreWidth, coreHeight, RADIATOR_THICKNESS), materials.radiatorCore)
  core.position.set(0, coreCenterY, RADIATOR_Z)
  group.add(core)

  const finCount = 40
  const finTemplate = new THREE.BoxGeometry(0.15, coreHeight - 1, RADIATOR_THICKNESS + 0.3)
  const finPlacements: Placement[] = []
  for (let i = 0; i < finCount; i++) {
    const x = -RADIATOR_HALF_WIDTH + (i + 0.5) * (coreWidth / finCount)
    finPlacements.push({ position: new THREE.Vector3(x, coreCenterY, RADIATOR_Z) })
  }
  group.add(makeMesh(mergedFrom(finTemplate, finPlacements), materials.aluminium))

  const tankHeight = 4
  const tankTemplate = new RoundedBoxGeometry(coreWidth + 2, tankHeight, RADIATOR_THICKNESS + 1, 1, 0.8)
  const tanks = mergedFrom(tankTemplate, [
    { position: new THREE.Vector3(0, RADIATOR_BOTTOM_Y - tankHeight / 2, RADIATOR_Z) },
    { position: new THREE.Vector3(0, RADIATOR_TOP_Y + tankHeight / 2, RADIATOR_Z) },
  ])
  group.add(makeMesh(tanks, materials.aluminium))

  const cap = makeMesh(new THREE.CylinderGeometry(1.6, 1.6, 1.2, 16), materials.chrome)
  cap.position.set(0, RADIATOR_TOP_Y + tankHeight + 0.5, RADIATOR_Z)
  group.add(cap)

  const upperHose = makeMesh(
    tubeAlong(
      [
        new THREE.Vector3(4, RADIATOR_TOP_Y + tankHeight / 2, RADIATOR_Z - RADIATOR_THICKNESS),
        new THREE.Vector3(2, RADIATOR_TOP_Y - 4, RADIATOR_Z - 8),
        new THREE.Vector3(0, BLOCK_VALLEY_Y + INTAKE_HEIGHT + 1, ENGINE_CENTER[2] + 10),
      ],
      0.9,
    ),
    materials.hose,
  )
  group.add(upperHose)

  const lowerHose = makeMesh(
    tubeAlong(
      [
        new THREE.Vector3(-4, RADIATOR_BOTTOM_Y - tankHeight / 2, RADIATOR_Z - RADIATOR_THICKNESS),
        new THREE.Vector3(-2, RADIATOR_BOTTOM_Y - 2, RADIATOR_Z - 8),
        new THREE.Vector3(0, ENGINE_CENTER[1] + 5, ENGINE_CENTER[2] + ENGINE_BLOCK_LENGTH / 2 + 2),
      ],
      0.9,
    ),
    materials.hose,
  )
  group.add(lowerHose)

  const shroud = makeMesh(new THREE.BoxGeometry(coreWidth - 2, coreHeight - 2, 1), materials.blackTrim)
  shroud.position.set(0, coreCenterY, RADIATOR_Z - RADIATOR_THICKNESS / 2 - 3)
  group.add(shroud)

  return group
}

function buildFan(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()
  const hubRadius = 2
  const clutchRadius = 2.6
  const bladeCount = 5
  const bladeLength = FAN_DIAMETER / 2 - hubRadius
  const bladePitch = 0.35

  const clutch = makeMesh(cylinderAlongZ(clutchRadius, clutchRadius, 4, 20), materials.steelDark)
  clutch.position.set(0, FAN_Y, FAN_Z)
  group.add(clutch)

  const hubZ = FAN_Z + 2.2
  const hub = makeMesh(cylinderAlongZ(hubRadius, hubRadius, 1.5, 20), materials.steelDark)
  hub.position.set(0, FAN_Y, hubZ)
  group.add(hub)

  const bladeTemplate = new THREE.BoxGeometry(bladeLength, 2.6, 0.15)
  bladeTemplate.translate(bladeLength / 2 + hubRadius, 0, 0)
  bladeTemplate.rotateX(bladePitch)
  const bladePlacements: Placement[] = []
  for (let i = 0; i < bladeCount; i++) {
    const angle = (i / bladeCount) * Math.PI * 2
    bladePlacements.push({
      position: new THREE.Vector3(0, FAN_Y, hubZ),
      rotation: new THREE.Euler(0, 0, angle),
    })
  }
  group.add(makeMesh(mergedFrom(bladeTemplate, bladePlacements), materials.steelDark))

  // Belt drive at the engine's front face: crank, water pump and alternator pulleys and the belt.
  const crankPulley = new THREE.Vector3(0, ENGINE_CENTER[1] - 1, FAN_Z + 3.6)
  const waterPumpPulley = new THREE.Vector3(0, ENGINE_CENTER[1] + 5, FAN_Z + 5)
  const alternatorPulley = new THREE.Vector3(ALTERNATOR_CENTER[0], ALTERNATOR_CENTER[1], ALTERNATOR_CENTER[2] + 3.4)

  const pulleyTemplate = new THREE.CylinderGeometry(1.6, 1.6, 1, 16)
  pulleyTemplate.rotateX(Math.PI / 2)
  const pulleys = mergedFrom(pulleyTemplate, [
    { position: crankPulley },
    { position: waterPumpPulley },
    { position: alternatorPulley },
  ])
  group.add(makeMesh(pulleys, materials.steelBright))

  const belt = makeMesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([crankPulley, waterPumpPulley, alternatorPulley], true),
      48,
      0.25,
      6,
      true,
    ),
    materials.hose,
  )
  group.add(belt)

  return group
}

function buildAlternator(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()
  const [x, y, z] = ALTERNATOR_CENTER

  const body = makeMesh(cylinderAlongZ(2.5, 2.5, 6, 20), materials.aluminium)
  body.position.set(x, y, z)
  group.add(body)

  const finTemplate = new THREE.TorusGeometry(2.5, 0.15, 6, 20)
  const finPlacements: Placement[] = []
  for (let i = -2; i <= 2; i++) {
    finPlacements.push({ position: new THREE.Vector3(x, y, z + i * 1.1) })
  }
  group.add(makeMesh(mergedFrom(finTemplate, finPlacements), materials.aluminium))

  const pulley = makeMesh(cylinderAlongZ(1.6, 1.6, 1, 16), materials.steelBright)
  pulley.position.set(x, y, z + 3.4)
  group.add(pulley)

  const bracket = makeMesh(new THREE.BoxGeometry(1.2, 1, 6), materials.steelDark)
  bracket.position.set(x + 1.6, y + 2, z)
  bracket.rotation.z = -0.3
  group.add(bracket)

  return group
}

function buildBattery(materials: CarMaterials, positiveCableMaterial: THREE.MeshStandardMaterial): THREE.Group {
  const group = new THREE.Group()
  const [x, y, z] = BATTERY_CENTER

  const box = makeMesh(new RoundedBoxGeometry(10, 8, 7, 1, 0.7), materials.blackTrim)
  box.position.set(x, y, z)
  group.add(box)

  const tray = makeMesh(new THREE.BoxGeometry(11, 1, 8), materials.steelDark)
  tray.position.set(x, y - 4.5, z)
  group.add(tray)

  const positivePost = new THREE.Vector3(x - 2, y + 4.5, z - 2)
  const negativePost = new THREE.Vector3(x + 2, y + 4.5, z - 2)
  const postTemplate = new THREE.CylinderGeometry(0.5, 0.5, 1, 12)
  const posts = mergedFrom(postTemplate, [{ position: positivePost }, { position: negativePost }])
  group.add(makeMesh(posts, materials.steelBright))

  const positiveCable = makeMesh(
    tubeAlong(
      [positivePost, new THREE.Vector3(x - 6, y, z - 6), new THREE.Vector3(-4, ENGINE_CENTER[1] + 2, ENGINE_CENTER[2] + 12)],
      0.5,
    ),
    positiveCableMaterial,
  )
  group.add(positiveCable)

  const negativeCable = makeMesh(
    tubeAlong(
      [negativePost, new THREE.Vector3(x + 4, y - 2, z - 4), new THREE.Vector3(x, ENGINE_CENTER[1] - 6, z - 10)],
      0.5,
    ),
    materials.hose,
  )
  group.add(negativeCable)

  return group
}

function buildTransmission(materials: CarMaterials, knobMaterial: THREE.MeshStandardMaterial): THREE.Group {
  const group = new THREE.Group()
  const frontZ = TRANSMISSION_FRONT_Z
  const bellLength = 6
  const caseLength = 18
  const tailLength = Math.max(frontZ - bellLength - caseLength - TRANSMISSION_REAR_Z, 4)

  const bell = makeMesh(cylinderAlongZ(9, 4, bellLength, 24), materials.castIron)
  bell.position.set(0, TRANSMISSION_Y, frontZ - bellLength / 2)
  group.add(bell)

  const caseZ = frontZ - bellLength - caseLength / 2
  const gearCase = makeMesh(new RoundedBoxGeometry(10, 8, caseLength, 1, 1), materials.castIron)
  gearCase.position.set(0, TRANSMISSION_Y, caseZ)
  group.add(gearCase)

  const tailZ = frontZ - bellLength - caseLength - tailLength / 2
  const tail = makeMesh(cylinderAlongZ(4, 2, tailLength, 20), materials.aluminium)
  tail.position.set(0, TRANSMISSION_Y, tailZ)
  group.add(tail)

  const towerHeight = 3
  const towerZ = frontZ - bellLength - caseLength * 0.35
  const towerTopY = TRANSMISSION_Y + 4 + towerHeight
  const tower = makeMesh(new RoundedBoxGeometry(3, towerHeight, 3, 1, 0.5), materials.castIron)
  tower.position.set(0, TRANSMISSION_Y + 4 + towerHeight / 2, towerZ)
  group.add(tower)

  const knobPosition = new THREE.Vector3(0, CONSOLE_TOP_Y + 6, SHIFTER_Z)
  const rod = makeMesh(tubeAlong([new THREE.Vector3(0, towerTopY, towerZ), knobPosition], 0.3, 10), materials.chrome)
  group.add(rod)

  const knob = makeMesh(new THREE.SphereGeometry(1.4, 16, 12), knobMaterial)
  knob.position.copy(knobPosition)
  group.add(knob)

  return group
}

/**
 * Builds the Boss 429 engine bay: seen from above with the hood open (or in the exploded view) it
 * reads as a big-block V8 — valve covers in a vee, the intake and carburettor between them, a
 * round air cleaner on top, the fan and belts at the front and the radiator ahead of that, the
 * transmission trailing off the back of the block.
 */
export function buildEngineBay(materials: CarMaterials): PartBuild[] {
  // The two extra materials the spec allows for this section: the battery's positive cable
  // (everything else on the cable runs is materials.hose) and the shifter's white ball knob.
  const positiveCableMaterial = new THREE.MeshStandardMaterial({ color: 0x8a1010, roughness: 0.7, metalness: 0 })
  const knobMaterial = new THREE.MeshStandardMaterial({ color: 0xf0ece4, roughness: 0.4, metalness: 0 })

  const engineBlock = buildEngineBlock(materials)
  engineBlock.name = 'engineBlock'
  tagPart(engineBlock, 'engineBlock')

  const cylinderHeads = buildCylinderHeads(materials)
  cylinderHeads.name = 'cylinderHeads'
  tagPart(cylinderHeads, 'cylinderHeads')

  const intakeManifold = buildIntakeManifold(materials)
  intakeManifold.name = 'intakeManifold'
  tagPart(intakeManifold, 'intakeManifold')

  const carburetor = buildCarburetor(materials)
  carburetor.name = 'carburetor'
  tagPart(carburetor, 'carburetor')

  const airCleaner = buildAirCleaner(materials)
  airCleaner.name = 'airCleaner'
  tagPart(airCleaner, 'airCleaner')

  const headersLeft = buildHeaders(materials, -1)
  headersLeft.name = 'headers'
  tagPart(headersLeft, 'headers')
  const headersRight = buildHeaders(materials, 1)
  headersRight.name = 'headers'
  tagPart(headersRight, 'headers')

  const radiator = buildRadiator(materials)
  radiator.name = 'radiator'
  tagPart(radiator, 'radiator')

  const fan = buildFan(materials)
  fan.name = 'fan'
  tagPart(fan, 'fan')

  const alternator = buildAlternator(materials)
  alternator.name = 'alternator'
  tagPart(alternator, 'alternator')

  const battery = buildBattery(materials, positiveCableMaterial)
  battery.name = 'battery'
  tagPart(battery, 'battery')

  const transmission = buildTransmission(materials, knobMaterial)
  transmission.name = 'transmission'
  tagPart(transmission, 'transmission')

  return [
    { id: 'engineBlock', objects: [engineBlock] },
    { id: 'cylinderHeads', objects: [cylinderHeads] },
    { id: 'intakeManifold', objects: [intakeManifold] },
    { id: 'carburetor', objects: [carburetor] },
    { id: 'airCleaner', objects: [airCleaner] },
    { id: 'headers', objects: [headersLeft, headersRight] },
    { id: 'radiator', objects: [radiator] },
    { id: 'fan', objects: [fan] },
    { id: 'alternator', objects: [alternator] },
    { id: 'battery', objects: [battery] },
    { id: 'transmission', objects: [transmission] },
  ]
}
