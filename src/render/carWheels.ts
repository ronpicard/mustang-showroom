import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import {
  FRONT_DISC_DIAMETER,
  REAR_DRUM_DIAMETER,
  RIM_DIAMETER,
  RIM_WIDTH,
  TIRE_RADIUS,
  TIRE_WIDTH,
  WHEEL_CENTERS,
} from '../car/dimensions.ts'
import type { CarMaterials } from './carMaterials.ts'
import { tagPart, type PartBuild } from './partBuild.ts'

/**
 * The Magnum 500 wheel and F60-15 tyre, plus the disc/drum brakes behind them, at the four
 * `WHEEL_CENTERS`. Every part is authored in a local frame where Y is the wheel's spin axis
 * (matching the revolve axis `THREE.LatheGeometry`/`THREE.CylinderGeometry` use natively) and X/Z
 * are the radial plane, then rotated so the spin axis lies along car space's X. Rotating by
 * +90 deg about Z sends local +Y (which we build as the outboard/visible face) to world -X, the
 * correct outward direction for the driver's (left) side; -90 deg sends it to world +X for the
 * passenger's (right) side. Local Z is untouched by a Z rotation, so it always lands on world Z
 * (the rolling direction), and local X (radius) always lands on world Y (up), which is what lets
 * one "top" / "rear" convention describe the brake caliper on both sides (see `topSign` below).
 */

// -------------------------------------------------------------------------------------------
// Shared tuning
// -------------------------------------------------------------------------------------------

/** Radial segments for every lathed part; the wheel camera looks at these up close. */
const LATHE_SEGMENTS = 48
/** Radial segments for the smaller brake lathes, which sit further from the wheel camera's focus. */
const BRAKE_LATHE_SEGMENTS = 32

const RIM_RADIUS = RIM_DIAMETER / 2
const HALF_TIRE_WIDTH = TIRE_WIDTH / 2
const HALF_RIM_WIDTH = RIM_WIDTH / 2

// -------------------------------------------------------------------------------------------
// Tyre
// -------------------------------------------------------------------------------------------

/**
 * How far each tread block stands proud of the tyre's carcass. The ground contact point is
 * `TIRE_RADIUS` (matching `WHEEL_CENTER_Y` in `dimensions.ts`), so the carcass under the blocks
 * has to sit this far inside it, or the blocks would poke through y = 0 at the bottom of the wheel.
 */
const TREAD_BLOCK_HEIGHT = 0.4
/** Radius of the tread carcass, under the raised blocks; `TIRE_RADIUS` is the loaded (contact) radius. */
const TREAD_BASE_RADIUS = TIRE_RADIUS - TREAD_BLOCK_HEIGHT

/** Where the bead meets the rim; a hair proud of `RIM_RADIUS` so the tyre reads as seated on it. */
const TIRE_BEAD_RADIUS = RIM_RADIUS + 0.3
/** Radius of the sidewall's widest bulge, between the bead and the shoulder. */
const TIRE_SIDEWALL_RADIUS = TIRE_RADIUS - 1
/** Radius where the rounded shoulder gives way to the flat tread carcass. */
const TIRE_SHOULDER_RADIUS = TREAD_BASE_RADIUS - 0.05
/** Axial half-width of the flat tread band, centred on the tyre. */
const TIRE_TREAD_HALF_WIDTH = 1.5
/** Axial half-width of the sidewall bulge station. */
const TIRE_SIDEWALL_HALF_WIDTH = HALF_TIRE_WIDTH - 1.6
/** Axial half-width of the shoulder station. */
const TIRE_SHOULDER_HALF_WIDTH = HALF_TIRE_WIDTH - 2.3
/** How far the two circumferential grooves cut into the tread carcass. */
const GROOVE_DEPTH = 0.3
/** Axial half-width of each groove notch. */
const GROOVE_HALF_WIDTH = 0.3
/** Axial offset of each groove's centre from the tyre's midline (one groove each side). */
const GROOVE_CENTER_OFFSET = 0.85

/** How many raised tread blocks run around the tyre's circumference (60-80 per the brief). */
const TREAD_BLOCK_COUNT = 72
/** Tread blocks sit on the centre rib, between the two grooves; this is that rib's clear width. */
const TREAD_BLOCK_AXIAL_LENGTH = 1
/** Fraction of each block's circumferential slot it actually fills, leaving a groove between blocks. */
const TREAD_BLOCK_FILL = 0.72

/** How many raised white-letter blocks run around the outer sidewall. */
const LETTER_COUNT = 8
/** Axial station of the letter band, on the sidewall bulge of the outboard (local +Y) face. */
const LETTER_AXIAL_Y = TIRE_SIDEWALL_HALF_WIDTH
/** Radius the letter band sits at, matching the sidewall bulge it's raised from. */
const LETTER_RADIUS = TIRE_SIDEWALL_RADIUS
const LETTER_TANGENTIAL_WIDTH = 2.6
const LETTER_AXIAL_LENGTH = 1.1
const LETTER_HEIGHT = 0.15
/** The one extra material the brief allows: a slightly lighter grey for the raised sidewall lettering. */
const WHITE_LETTER_COLOR = 0xd8d4c8
const WHITE_LETTER_ROUGHNESS = 0.9

// -------------------------------------------------------------------------------------------
// Magnum 500 rim
// -------------------------------------------------------------------------------------------

/** The chrome lip's outer, tyre-facing edge; the rim's full axial half-width. */
const RIM_LIP_OUTER_Y = HALF_RIM_WIDTH
/** The black centre dish sits this far axially inboard of the lip's outer face. */
const RIM_DISH_DEPTH = 2.5
const RIM_DISH_Y = RIM_LIP_OUTER_Y - RIM_DISH_DEPTH
/** Radius of the plain inboard barrel, a touch inside the tyre bead. */
const RIM_BARREL_RADIUS = RIM_RADIUS - 1
/** The barrel's inboard-most edge, the rim's full axial half-width on the inboard side. */
const RIM_BARREL_INNER_Y = -HALF_RIM_WIDTH
/** Where the centre dish meets the chrome lip. */
const RIM_DISH_OUTER_RADIUS = RIM_RADIUS - 1
/** Where the spokes and cap meet the dish; the hub's visible radius. */
const HUB_RADIUS = 3

const SPOKE_COUNT = 5
const SPOKE_ANGLE_STEP = (Math.PI * 2) / SPOKE_COUNT
/** Spokes run from the hub out to just under the chrome lip. */
const SPOKE_OUTER_RADIUS = RIM_RADIUS - 0.3
const SPOKE_SEGMENTS = 3
const SPOKE_HUB_WIDTH = 1.2
/** Spokes fan out wider toward the lip, per the Magnum 500's five-spoke face. */
const SPOKE_RIM_WIDTH = 2.4
const SPOKE_PROUD_HEIGHT = 1.2
const SPOKE_ROUND_RADIUS = 0.25

const CENTER_CAP_RADIUS = 2.5
const CENTER_CAP_Y = RIM_DISH_Y + 1.6

const LUG_NUT_COUNT = 5
const LUG_NUT_RING_RADIUS = HUB_RADIUS + 0.9
const LUG_NUT_RADIUS = 0.55
const LUG_NUT_LENGTH = 1

// -------------------------------------------------------------------------------------------
// Brakes
// -------------------------------------------------------------------------------------------

/** Both brake assemblies sit this far axially inboard of the wheel's inner (inboard) tyre face. */
const BRAKE_INBOARD_OFFSET = 1.5

const FRONT_DISC_RADIUS = FRONT_DISC_DIAMETER / 2
const FRONT_DISC_THICKNESS = 0.5
/** Axial gap between the rotor's two disc faces, filled by the ventilation vanes. */
const FRONT_DISC_VANE_GAP = 0.9
const FRONT_DISC_VANE_COUNT = 40
const FRONT_DISC_VANE_RADIAL_LENGTH = FRONT_DISC_RADIUS * 0.55
const FRONT_DISC_VANE_TANGENTIAL_WIDTH = 0.5
const FRONT_DISC_VANE_INNER_RADIUS = FRONT_DISC_RADIUS - FRONT_DISC_VANE_RADIAL_LENGTH

/** Caliper box: length along the radial axis, height along the axial axis, width tangentially. */
const CALIPER_RADIAL_LENGTH = 4
const CALIPER_AXIAL_HEIGHT = FRONT_DISC_VANE_GAP + FRONT_DISC_THICKNESS * 2 + 1
const CALIPER_TANGENTIAL_WIDTH = 2.2
/** How far out (radially) and back (axially, toward the tail) the caliper sits on the rotor. */
const CALIPER_RADIAL_OFFSET = FRONT_DISC_RADIUS - 1.2
const CALIPER_REAR_OFFSET = FRONT_DISC_RADIUS * 0.6

const HUB_BRAKE_RADIUS = 3
const HUB_BRAKE_LENGTH = 2
const STUD_COUNT = 5
const STUD_RADIUS = 0.35
const STUD_LENGTH = 1.8
const STUD_RING_RADIUS = HUB_BRAKE_RADIUS + 1.2

const REAR_DRUM_RADIUS = REAR_DRUM_DIAMETER / 2
const REAR_DRUM_AXIAL_WIDTH = 3.5
const REAR_FLANGE_RADIUS = 3
const REAR_BACKING_PLATE_RADIUS = REAR_DRUM_RADIUS + 0.3

// -------------------------------------------------------------------------------------------
// Small helpers
// -------------------------------------------------------------------------------------------

/**
 * A box template positioned at `radius` and rotated to angle `i / count` around the local Y
 * (spin) axis — used for tread blocks, sidewall letters and rotor vanes alike. `width` is
 * tangential (circumferential), `height` is axial, `depth` is radial (the box's outer face sits
 * at `radius + depth / 2`).
 */
function ringOfBoxes(
  count: number,
  width: number,
  height: number,
  depth: number,
  radius: number,
  axialY: number,
): THREE.BufferGeometry[] {
  const boxes: THREE.BufferGeometry[] = []
  for (let i = 0; i < count; i += 1) {
    const box = new THREE.BoxGeometry(width, height, depth)
    box.translate(0, axialY, radius + depth / 2)
    box.rotateY((i / count) * Math.PI * 2)
    boxes.push(box)
  }
  return boxes
}

/** Rotates a mesh's local Y (spin) axis onto car space's X, outward toward the correct side. */
function orientForSide(object: THREE.Object3D, mirrored: boolean): void {
  object.rotation.z = mirrored ? Math.PI / 2 : -Math.PI / 2
}

function finishMesh(mesh: THREE.Mesh): THREE.Mesh {
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/**
 * `mergeGeometries` requires every input to agree on whether it's indexed (`RoundedBoxGeometry`
 * isn't; the three primitives are), so every geometry going into a merge is normalised through
 * this first.
 */
function forMerge(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry[] {
  return geometries.map((geometry) => (geometry.index ? geometry.toNonIndexed() : geometry))
}

// -------------------------------------------------------------------------------------------
// Tyre geometry
// -------------------------------------------------------------------------------------------

function buildTireProfile(): THREE.Vector2[] {
  const treadNear = TIRE_TREAD_HALF_WIDTH
  const grooveOuter = GROOVE_CENTER_OFFSET + GROOVE_HALF_WIDTH
  const grooveInner = GROOVE_CENTER_OFFSET - GROOVE_HALF_WIDTH
  return [
    new THREE.Vector2(RIM_RADIUS, -HALF_TIRE_WIDTH),
    new THREE.Vector2(TIRE_BEAD_RADIUS, -HALF_TIRE_WIDTH + 0.3),
    new THREE.Vector2(TIRE_SIDEWALL_RADIUS, -TIRE_SIDEWALL_HALF_WIDTH),
    new THREE.Vector2(TIRE_SHOULDER_RADIUS, -TIRE_SHOULDER_HALF_WIDTH),
    new THREE.Vector2(TREAD_BASE_RADIUS, -treadNear),
    new THREE.Vector2(TREAD_BASE_RADIUS, -grooveOuter),
    new THREE.Vector2(TREAD_BASE_RADIUS - GROOVE_DEPTH, -GROOVE_CENTER_OFFSET),
    new THREE.Vector2(TREAD_BASE_RADIUS, -grooveInner),
    new THREE.Vector2(TREAD_BASE_RADIUS, grooveInner),
    new THREE.Vector2(TREAD_BASE_RADIUS - GROOVE_DEPTH, GROOVE_CENTER_OFFSET),
    new THREE.Vector2(TREAD_BASE_RADIUS, grooveOuter),
    new THREE.Vector2(TREAD_BASE_RADIUS, treadNear),
    new THREE.Vector2(TIRE_SHOULDER_RADIUS, TIRE_SHOULDER_HALF_WIDTH),
    new THREE.Vector2(TIRE_SIDEWALL_RADIUS, TIRE_SIDEWALL_HALF_WIDTH),
    new THREE.Vector2(TIRE_BEAD_RADIUS, HALF_TIRE_WIDTH - 0.3),
    new THREE.Vector2(RIM_RADIUS, HALF_TIRE_WIDTH),
  ]
}

/** The tyre body: lathed sidewalls and grooved tread, plus the raised tread blocks, one mesh. */
function buildTireGeometry(): THREE.BufferGeometry {
  const body = new THREE.LatheGeometry(buildTireProfile(), LATHE_SEGMENTS)
  const blockSlot = (Math.PI * 2 * TREAD_BASE_RADIUS) / TREAD_BLOCK_COUNT
  const blocks = ringOfBoxes(
    TREAD_BLOCK_COUNT,
    blockSlot * TREAD_BLOCK_FILL,
    TREAD_BLOCK_AXIAL_LENGTH,
    TREAD_BLOCK_HEIGHT,
    TREAD_BASE_RADIUS,
    0,
  )
  return mergeGeometries(forMerge([body, ...blocks]))
}

/** The raised white-letter blocks on the outboard sidewall, one mesh in its own material. */
function buildLetterGeometry(): THREE.BufferGeometry {
  const blocks = ringOfBoxes(
    LETTER_COUNT,
    LETTER_TANGENTIAL_WIDTH,
    LETTER_AXIAL_LENGTH,
    LETTER_HEIGHT,
    LETTER_RADIUS,
    LETTER_AXIAL_Y,
  )
  return mergeGeometries(forMerge(blocks))
}

// -------------------------------------------------------------------------------------------
// Rim geometry
// -------------------------------------------------------------------------------------------

/** Chrome: the outer lip (with its rolled bead), the five spokes, the centre cap and the lug nuts. */
function buildChromeGeometry(): THREE.BufferGeometry {
  const lip = new THREE.LatheGeometry(
    [
      new THREE.Vector2(RIM_DISH_OUTER_RADIUS, RIM_DISH_Y + 0.5),
      new THREE.Vector2(RIM_RADIUS - 0.5, RIM_DISH_Y + 1),
      new THREE.Vector2(RIM_RADIUS, RIM_DISH_Y + 1.5),
      new THREE.Vector2(RIM_RADIUS + 0.2, RIM_LIP_OUTER_Y - 0.5),
      new THREE.Vector2(RIM_RADIUS - 0.1, RIM_LIP_OUTER_Y),
    ],
    LATHE_SEGMENTS,
  )

  const spokeSegmentLength = (SPOKE_OUTER_RADIUS - HUB_RADIUS) / SPOKE_SEGMENTS
  const spokeParts: THREE.BufferGeometry[] = []
  for (let segment = 0; segment < SPOKE_SEGMENTS; segment += 1) {
    const t = (segment + 0.5) / SPOKE_SEGMENTS
    const width = THREE.MathUtils.lerp(SPOKE_HUB_WIDTH, SPOKE_RIM_WIDTH, t)
    const box = new RoundedBoxGeometry(spokeSegmentLength, SPOKE_PROUD_HEIGHT, width, 1, SPOKE_ROUND_RADIUS)
    box.translate(HUB_RADIUS + (segment + 0.5) * spokeSegmentLength, RIM_DISH_Y + SPOKE_PROUD_HEIGHT / 2, 0)
    spokeParts.push(box)
  }
  const oneSpoke = mergeGeometries(forMerge(spokeParts))
  const spokes: THREE.BufferGeometry[] = []
  for (let i = 0; i < SPOKE_COUNT; i += 1) {
    const spoke = oneSpoke.clone()
    spoke.rotateY(i * SPOKE_ANGLE_STEP)
    spokes.push(spoke)
  }

  const cap = new THREE.SphereGeometry(CENTER_CAP_RADIUS, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)
  cap.translate(0, CENTER_CAP_Y, 0)

  const lugNuts: THREE.BufferGeometry[] = []
  for (let i = 0; i < LUG_NUT_COUNT; i += 1) {
    const angle = i * SPOKE_ANGLE_STEP + SPOKE_ANGLE_STEP / 2
    const lug = new THREE.CylinderGeometry(LUG_NUT_RADIUS, LUG_NUT_RADIUS, LUG_NUT_LENGTH, 6)
    lug.translate(
      LUG_NUT_RING_RADIUS * Math.cos(angle),
      CENTER_CAP_Y - CENTER_CAP_RADIUS * 0.3,
      LUG_NUT_RING_RADIUS * Math.sin(angle),
    )
    lugNuts.push(lug)
  }

  return mergeGeometries(forMerge([lip, ...spokes, cap, ...lugNuts]))
}

/** The black-painted centre dish, recessed behind the chrome lip. */
function buildDishGeometry(): THREE.BufferGeometry {
  return new THREE.LatheGeometry(
    [
      new THREE.Vector2(HUB_RADIUS, RIM_DISH_Y),
      new THREE.Vector2(HUB_RADIUS + 0.6, RIM_DISH_Y + 0.35),
      new THREE.Vector2(RIM_DISH_OUTER_RADIUS, RIM_DISH_Y + 0.5),
    ],
    LATHE_SEGMENTS,
  )
}

/** The plain inboard barrel, hidden behind the tyre's inboard sidewall. */
function buildBarrelGeometry(): THREE.BufferGeometry {
  const height = RIM_DISH_Y - RIM_BARREL_INNER_Y
  const barrel = new THREE.CylinderGeometry(RIM_BARREL_RADIUS, RIM_BARREL_RADIUS, height, 32)
  barrel.translate(0, (RIM_DISH_Y + RIM_BARREL_INNER_Y) / 2, 0)
  return barrel
}

// -------------------------------------------------------------------------------------------
// Wheel assembly
// -------------------------------------------------------------------------------------------

function buildWheel(
  materials: CarMaterials,
  whiteLetter: THREE.MeshStandardMaterial,
  mirrored: boolean,
  center: readonly [number, number, number],
  id: string,
): THREE.Group {
  const group = new THREE.Group()
  group.name = id

  const tire = finishMesh(new THREE.Mesh(buildTireGeometry(), materials.rubber))
  const letters = finishMesh(new THREE.Mesh(buildLetterGeometry(), whiteLetter))
  const chrome = finishMesh(new THREE.Mesh(buildChromeGeometry(), materials.chrome))
  const dish = finishMesh(new THREE.Mesh(buildDishGeometry(), materials.blackTrim))
  const barrel = finishMesh(new THREE.Mesh(buildBarrelGeometry(), materials.steelDark))
  group.add(tire, letters, chrome, dish, barrel)

  orientForSide(group, mirrored)
  group.position.set(center[0], center[1], center[2])
  return group
}

// -------------------------------------------------------------------------------------------
// Front disc brakes
// -------------------------------------------------------------------------------------------

function buildFrontDiscGeometry(): THREE.BufferGeometry {
  const outerFace = new THREE.CylinderGeometry(FRONT_DISC_RADIUS, FRONT_DISC_RADIUS, FRONT_DISC_THICKNESS, 40)
  outerFace.translate(0, FRONT_DISC_VANE_GAP / 2 + FRONT_DISC_THICKNESS / 2, 0)
  const innerFace = new THREE.CylinderGeometry(FRONT_DISC_RADIUS, FRONT_DISC_RADIUS, FRONT_DISC_THICKNESS, 40)
  innerFace.translate(0, -FRONT_DISC_VANE_GAP / 2 - FRONT_DISC_THICKNESS / 2, 0)
  const vanes = ringOfBoxes(
    FRONT_DISC_VANE_COUNT,
    FRONT_DISC_VANE_TANGENTIAL_WIDTH,
    FRONT_DISC_VANE_GAP,
    FRONT_DISC_VANE_RADIAL_LENGTH,
    FRONT_DISC_VANE_INNER_RADIUS,
    0,
  )
  return mergeGeometries(forMerge([outerFace, innerFace, ...vanes]))
}

function buildFrontBrakeHardwareGeometry(mirrored: boolean): THREE.BufferGeometry {
  // Local +X lands on world +Y (up) for a mirrored (left-side) assembly, and -X lands on +Y for
  // the right side (see the file header) — this picks the sign that puts the caliper on top.
  const topSign = mirrored ? 1 : -1

  const caliper = new THREE.BoxGeometry(CALIPER_RADIAL_LENGTH, CALIPER_AXIAL_HEIGHT, CALIPER_TANGENTIAL_WIDTH)
  caliper.translate(topSign * CALIPER_RADIAL_OFFSET, 0, -CALIPER_REAR_OFFSET)

  const hub = new THREE.CylinderGeometry(HUB_BRAKE_RADIUS, HUB_BRAKE_RADIUS, HUB_BRAKE_LENGTH, 24)

  const studs: THREE.BufferGeometry[] = []
  for (let i = 0; i < STUD_COUNT; i += 1) {
    const angle = i * ((Math.PI * 2) / STUD_COUNT)
    const stud = new THREE.CylinderGeometry(STUD_RADIUS, STUD_RADIUS, STUD_LENGTH, 8)
    stud.translate(
      STUD_RING_RADIUS * Math.cos(angle),
      HUB_BRAKE_LENGTH / 2 + STUD_LENGTH / 2,
      STUD_RING_RADIUS * Math.sin(angle),
    )
    studs.push(stud)
  }

  return mergeGeometries(forMerge([caliper, hub, ...studs]))
}

function buildFrontBrake(
  materials: CarMaterials,
  mirrored: boolean,
  wheelCenter: readonly [number, number, number],
): THREE.Group {
  const group = new THREE.Group()
  group.name = 'frontBrakes'

  const rotor = finishMesh(new THREE.Mesh(buildFrontDiscGeometry(), materials.brakeRotor))
  const hardware = finishMesh(new THREE.Mesh(buildFrontBrakeHardwareGeometry(mirrored), materials.steelDark))
  group.add(rotor, hardware)

  orientForSide(group, mirrored)
  const inboardX = wheelCenter[0] - Math.sign(wheelCenter[0]) * (HALF_TIRE_WIDTH + BRAKE_INBOARD_OFFSET)
  group.position.set(inboardX, wheelCenter[1], wheelCenter[2])
  return group
}

// -------------------------------------------------------------------------------------------
// Rear drum brakes
// -------------------------------------------------------------------------------------------

function buildRearDrumGeometry(): THREE.BufferGeometry {
  const halfWidth = REAR_DRUM_AXIAL_WIDTH / 2
  return new THREE.LatheGeometry(
    [
      new THREE.Vector2(REAR_FLANGE_RADIUS, -halfWidth - 0.5),
      new THREE.Vector2(REAR_FLANGE_RADIUS, -halfWidth - 0.3),
      new THREE.Vector2(REAR_BACKING_PLATE_RADIUS, -halfWidth - 0.1),
      new THREE.Vector2(REAR_BACKING_PLATE_RADIUS, -halfWidth),
      new THREE.Vector2(REAR_DRUM_RADIUS, -halfWidth + 0.3),
      new THREE.Vector2(REAR_DRUM_RADIUS, halfWidth),
    ],
    BRAKE_LATHE_SEGMENTS,
  )
}

function buildRearBrake(
  materials: CarMaterials,
  mirrored: boolean,
  wheelCenter: readonly [number, number, number],
): THREE.Group {
  const group = new THREE.Group()
  group.name = 'rearBrakes'

  const drum = finishMesh(new THREE.Mesh(buildRearDrumGeometry(), materials.steelDark))
  group.add(drum)

  orientForSide(group, mirrored)
  const inboardX = wheelCenter[0] - Math.sign(wheelCenter[0]) * (HALF_TIRE_WIDTH + BRAKE_INBOARD_OFFSET)
  group.position.set(inboardX, wheelCenter[1], wheelCenter[2])
  return group
}

// -------------------------------------------------------------------------------------------
// Public entry point
// -------------------------------------------------------------------------------------------

export function buildWheels(materials: CarMaterials): PartBuild[] {
  const whiteLetter = new THREE.MeshStandardMaterial({
    color: WHITE_LETTER_COLOR,
    roughness: WHITE_LETTER_ROUGHNESS,
  })

  const wheelFrontLeft = buildWheel(
    materials,
    whiteLetter,
    true,
    WHEEL_CENTERS.wheelFrontLeft,
    'wheelFrontLeft',
  )
  const wheelFrontRight = buildWheel(
    materials,
    whiteLetter,
    false,
    WHEEL_CENTERS.wheelFrontRight,
    'wheelFrontRight',
  )
  const wheelRearLeft = buildWheel(
    materials,
    whiteLetter,
    true,
    WHEEL_CENTERS.wheelRearLeft,
    'wheelRearLeft',
  )
  const wheelRearRight = buildWheel(
    materials,
    whiteLetter,
    false,
    WHEEL_CENTERS.wheelRearRight,
    'wheelRearRight',
  )

  const frontBrakeLeft = buildFrontBrake(materials, true, WHEEL_CENTERS.wheelFrontLeft)
  const frontBrakeRight = buildFrontBrake(materials, false, WHEEL_CENTERS.wheelFrontRight)
  const rearBrakeLeft = buildRearBrake(materials, true, WHEEL_CENTERS.wheelRearLeft)
  const rearBrakeRight = buildRearBrake(materials, false, WHEEL_CENTERS.wheelRearRight)

  return [
    { id: 'wheelFrontLeft', objects: [tagPart(wheelFrontLeft, 'wheelFrontLeft')] },
    { id: 'wheelFrontRight', objects: [tagPart(wheelFrontRight, 'wheelFrontRight')] },
    { id: 'wheelRearLeft', objects: [tagPart(wheelRearLeft, 'wheelRearLeft')] },
    { id: 'wheelRearRight', objects: [tagPart(wheelRearRight, 'wheelRearRight')] },
    {
      id: 'frontBrakes',
      objects: [tagPart(frontBrakeLeft, 'frontBrakes'), tagPart(frontBrakeRight, 'frontBrakes')],
    },
    {
      id: 'rearBrakes',
      objects: [tagPart(rearBrakeLeft, 'rearBrakes'), tagPart(rearBrakeRight, 'rearBrakes')],
    },
  ]
}
