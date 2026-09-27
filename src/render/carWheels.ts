import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
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
 * The polished five-spoke wheels and low-profile tyres, plus the disc/drum brakes behind them, at
 * the four `WHEEL_CENTERS`. Every part is authored in a local frame where Y is the wheel's spin axis
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
const LATHE_SEGMENTS = 72
/** Radial segments for the smaller brake lathes, which sit further from the wheel camera's focus. */
const BRAKE_LATHE_SEGMENTS = 32

const RIM_RADIUS = RIM_DIAMETER / 2
const HALF_TIRE_WIDTH = TIRE_WIDTH / 2
const HALF_RIM_WIDTH = RIM_WIDTH / 2

// -------------------------------------------------------------------------------------------
// Tyre
// -------------------------------------------------------------------------------------------

/** The shallow raised ribs stay inside the loaded tyre radius, including their outer corners. */
const TREAD_BLOCK_HEIGHT = 0.07
const TREAD_BASE_RADIUS = TIRE_RADIUS - 0.12

/** Where the bead meets the rim; a hair proud of `RIM_RADIUS` so the tyre reads as seated on it. */
const TIRE_BEAD_RADIUS = RIM_RADIUS + 0.3
const TIRE_TREAD_HALF_WIDTH = 3.1
const GROOVE_DEPTH = 0.1
const GROOVE_HALF_WIDTH = 0.12
const GROOVE_CENTER_OFFSET = 0.72
const TREAD_BLOCK_COUNT = 56
const TREAD_BLOCK_AXIAL_LENGTH = 0.8
const TREAD_BLOCK_FILL = 0.68

// -------------------------------------------------------------------------------------------
// Polished five-spoke rim
// -------------------------------------------------------------------------------------------

/** The chrome lip's outer, tyre-facing edge; the rim's full axial half-width. */
const RIM_LIP_OUTER_Y = HALF_RIM_WIDTH
/** The gunmetal centre dish sits this far axially inboard of the lip's outer face. */
const RIM_DISH_DEPTH = 3.7
const RIM_DISH_Y = RIM_LIP_OUTER_Y - RIM_DISH_DEPTH
/** Radius of the plain inboard barrel, a touch inside the tyre bead. */
const RIM_BARREL_RADIUS = RIM_RADIUS - 1
/** The barrel's inboard-most edge, the rim's full axial half-width on the inboard side. */
const RIM_BARREL_INNER_Y = -HALF_RIM_WIDTH
/** Where the centre dish meets the chrome lip's inner edge. */
const RIM_DISH_OUTER_RADIUS = RIM_RADIUS - 2.0
/** Where the spokes and cap meet the dish; the hub's visible radius. */
const HUB_RADIUS = 2.2

const SPOKE_COUNT = 5
const SPOKE_ANGLE_STEP = (Math.PI * 2) / SPOKE_COUNT
/** Spokes run from the hub out to the lip's inner edge, where they meet it. */
const SPOKE_OUTER_RADIUS = RIM_DISH_OUTER_RADIUS
const SPOKE_HUB_WIDTH = 2.6
/** Spokes fan out wider toward the lip, in the Torq Thrust's straight-sided five-spoke style. */
const SPOKE_RIM_WIDTH = 3.4
const SPOKE_PROUD_HEIGHT = 1.1
const SPOKE_ROUND_RADIUS = 0.2

const CENTER_CAP_RADIUS = 1.3
const CENTER_CAP_Y = RIM_DISH_Y + 1.6

const LUG_NUT_COUNT = 5
const LUG_NUT_RING_RADIUS = HUB_RADIUS + 0.35
const LUG_NUT_RADIUS = 0.35
const LUG_NUT_LENGTH = 0.65

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
 * (spin) axis — used for tread blocks and rotor vanes. `width` is
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
 * `mergeGeometries` requires every input to agree on whether it's indexed (`ExtrudeGeometry`
 * isn't; the three primitives are), so every geometry going into a merge is normalised through
 * this first.
 */
function forMerge(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry[] {
  return geometries.map((geometry) => (geometry.index ? geometry.toNonIndexed() : geometry))
}

// -------------------------------------------------------------------------------------------
// Tyre geometry
// -------------------------------------------------------------------------------------------

/**
 * Radius / axial stations from the bead across the rounded outboard sidewall to the tread,
 * generated from a normalised t in [0, 1] running from the bead (`TIRE_BEAD_RADIUS`) to the
 * tread base (`TREAD_BASE_RADIUS`). The low-profile sidewall bulges out to the tyre's full
 * half-width by t = 0.5, then eases into the tread's (narrower) half-width over the last 30%
 * of t with a smooth, quarter-ellipse-like shoulder.
 */
const SIDEWALL_STATION_COUNT = 12
const SIDEWALL_SHOULDER_START = 0.7

/** One sidewall station (radius, axial half-width) at normalised t from the bead to the tread. */
function sidewallStation(t: number): THREE.Vector2 {
  const bulgeHalfWidth = HALF_TIRE_WIDTH - 0.9
  const radius = THREE.MathUtils.lerp(TIRE_BEAD_RADIUS, TREAD_BASE_RADIUS, t)
  let halfWidth: number
  if (t <= 0.5) {
    // Smoothstep from the bead up to the tyre's full bulge.
    const bulgeT = t / 0.5
    const eased = bulgeT * bulgeT * (3 - 2 * bulgeT)
    halfWidth = THREE.MathUtils.lerp(bulgeHalfWidth, HALF_TIRE_WIDTH, eased)
  } else if (t <= SIDEWALL_SHOULDER_START) {
    halfWidth = HALF_TIRE_WIDTH
  } else {
    // Quarter-ellipse shoulder rounding the bulge into the tread's half-width.
    const shoulderT = (t - SIDEWALL_SHOULDER_START) / (1 - SIDEWALL_SHOULDER_START)
    const angle = shoulderT * (Math.PI / 2)
    halfWidth = TIRE_TREAD_HALF_WIDTH + (HALF_TIRE_WIDTH - TIRE_TREAD_HALF_WIDTH) * Math.cos(angle)
  }
  return new THREE.Vector2(radius, halfWidth)
}

function buildOutboardSidewall(): THREE.Vector2[] {
  return Array.from({ length: SIDEWALL_STATION_COUNT }, (_, i) => sidewallStation(i / (SIDEWALL_STATION_COUNT - 1)))
}

const OUTBOARD_SIDEWALL = buildOutboardSidewall()

function buildTireProfile(): THREE.Vector2[] {
  const grooveOuter = GROOVE_CENTER_OFFSET + GROOVE_HALF_WIDTH
  const grooveInner = GROOVE_CENTER_OFFSET - GROOVE_HALF_WIDTH
  return [
    ...OUTBOARD_SIDEWALL.map((station) => new THREE.Vector2(station.x, -station.y)),
    new THREE.Vector2(TREAD_BASE_RADIUS, -grooveOuter),
    new THREE.Vector2(TREAD_BASE_RADIUS - GROOVE_DEPTH, -GROOVE_CENTER_OFFSET),
    new THREE.Vector2(TREAD_BASE_RADIUS, -grooveInner),
    new THREE.Vector2(TREAD_BASE_RADIUS, grooveInner),
    new THREE.Vector2(TREAD_BASE_RADIUS - GROOVE_DEPTH, GROOVE_CENTER_OFFSET),
    new THREE.Vector2(TREAD_BASE_RADIUS, grooveOuter),
    ...[...OUTBOARD_SIDEWALL].reverse(),
  ]
}

/** The tyre body: lathed sidewalls and grooved tread, plus the raised tread blocks, one mesh. */
function buildTireGeometry(): THREE.BufferGeometry {
  const body = new THREE.LatheGeometry(buildTireProfile(), LATHE_SEGMENTS)
  const blockSlot = (Math.PI * 2 * TREAD_BASE_RADIUS) / TREAD_BLOCK_COUNT
  const firstRow = ringOfBoxes(
    TREAD_BLOCK_COUNT,
    blockSlot * TREAD_BLOCK_FILL,
    TREAD_BLOCK_AXIAL_LENGTH,
    TREAD_BLOCK_HEIGHT,
    TREAD_BASE_RADIUS,
    -1.48,
  )
  const secondRow = ringOfBoxes(
    TREAD_BLOCK_COUNT,
    blockSlot * TREAD_BLOCK_FILL,
    TREAD_BLOCK_AXIAL_LENGTH,
    TREAD_BLOCK_HEIGHT,
    TREAD_BASE_RADIUS,
    1.48,
  )
  for (const block of secondRow) block.rotateY(Math.PI / TREAD_BLOCK_COUNT)
  return mergeGeometries(forMerge([body, ...firstRow, ...secondRow]))
}

/** Where along `buildOutboardSidewall`'s t range the raised-letter band sits. */
const TIRE_LETTER_T_START = 0.22
const TIRE_LETTER_T_END = 0.58
const TIRE_LETTER_STATION_COUNT = 8
/** How far the lettering band's half-width is pushed past the sidewall surface, so it reads
 * as raised rather than flush. */
const TIRE_LETTER_PROUD_OFFSET = 0.06

/** The sidewall stations over just the letter band's t range, pushed proud of the rubber. They are
 * unnegated, like `buildTireProfile`'s outboard half, so the band sits on the outboard face, and
 * run tread-to-bead like that half so the lathe's normals face out (bead-to-tread is back-face
 * culled and the band vanishes). */
function buildTireLetterStations(): THREE.Vector2[] {
  return Array.from({ length: TIRE_LETTER_STATION_COUNT }, (_, i) => {
    const t = TIRE_LETTER_T_END - (TIRE_LETTER_T_END - TIRE_LETTER_T_START) * (i / (TIRE_LETTER_STATION_COUNT - 1))
    const station = sidewallStation(t)
    return new THREE.Vector2(station.x, station.y + TIRE_LETTER_PROUD_OFFSET)
  })
}

/** The raised "RADIAL G/T" lettering band, lathed as a thin ring proud of the outboard sidewall. */
function buildTireLetterGeometry(): THREE.BufferGeometry {
  return new THREE.LatheGeometry(buildTireLetterStations(), LATHE_SEGMENTS)
}

// -------------------------------------------------------------------------------------------
// Rim geometry
// -------------------------------------------------------------------------------------------

/** Chrome: the polished outer lip (with its rolled bead), the centre cap and the lug nuts. */
function buildChromeGeometry(): THREE.BufferGeometry {
  const lip = new THREE.LatheGeometry(
    [
      new THREE.Vector2(RIM_RADIUS - 2.0, RIM_LIP_OUTER_Y - 1.6),
      new THREE.Vector2(RIM_RADIUS - 1.3, RIM_LIP_OUTER_Y - 1.2),
      new THREE.Vector2(RIM_RADIUS - 0.5, RIM_LIP_OUTER_Y - 0.6),
      new THREE.Vector2(RIM_RADIUS, RIM_LIP_OUTER_Y - 0.25),
      new THREE.Vector2(RIM_RADIUS - 0.15, RIM_LIP_OUTER_Y),
    ],
    LATHE_SEGMENTS,
  )

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

  return mergeGeometries(forMerge([lip, cap, ...lugNuts]))
}

/** Gunmetal: the recessed centre dish and the five straight, tapered Torq Thrust-style spokes. */
function buildSpokesGeometry(): THREE.BufferGeometry {
  const dish = new THREE.LatheGeometry(
    [
      new THREE.Vector2(HUB_RADIUS, RIM_DISH_Y),
      new THREE.Vector2(HUB_RADIUS + 0.6, RIM_DISH_Y + 0.35),
      new THREE.Vector2(RIM_DISH_OUTER_RADIUS, RIM_DISH_Y + 0.5),
    ],
    LATHE_SEGMENTS,
  )

  const outline = new THREE.Shape()
  outline.moveTo(HUB_RADIUS - 0.2, -SPOKE_HUB_WIDTH / 2)
  outline.lineTo(SPOKE_OUTER_RADIUS, -SPOKE_RIM_WIDTH / 2)
  outline.lineTo(SPOKE_OUTER_RADIUS, SPOKE_RIM_WIDTH / 2)
  outline.lineTo(HUB_RADIUS - 0.2, SPOKE_HUB_WIDTH / 2)
  outline.closePath()
  const oneSpoke = new THREE.ExtrudeGeometry(outline, {
    depth: SPOKE_PROUD_HEIGHT, bevelEnabled: true, bevelThickness: SPOKE_ROUND_RADIUS,
    bevelSize: SPOKE_ROUND_RADIUS, bevelSegments: 3, steps: 1,
  })
  oneSpoke.rotateX(-Math.PI / 2)
  oneSpoke.translate(0, RIM_DISH_Y + 0.4, 0)
  const spokes: THREE.BufferGeometry[] = []
  for (let i = 0; i < SPOKE_COUNT; i += 1) {
    const spoke = oneSpoke.clone()
    spoke.rotateY(i * SPOKE_ANGLE_STEP)
    spokes.push(spoke)
  }

  return mergeGeometries(forMerge([dish, ...spokes]))
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
  mirrored: boolean,
  center: readonly [number, number, number],
  id: string,
): THREE.Group {
  const group = new THREE.Group()
  group.name = id

  const tire = finishMesh(new THREE.Mesh(buildTireGeometry(), materials.rubber))
  const lettering = finishMesh(new THREE.Mesh(buildTireLetterGeometry(), materials.tireLetter))
  lettering.name = 'tireLettering'
  lettering.castShadow = false
  const chrome = finishMesh(new THREE.Mesh(buildChromeGeometry(), materials.chrome))
  const spokes = finishMesh(new THREE.Mesh(buildSpokesGeometry(), materials.wheelSpoke))
  const barrel = finishMesh(new THREE.Mesh(buildBarrelGeometry(), materials.steelDark))
  group.add(tire, lettering, chrome, spokes, barrel)

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
  const wheelFrontLeft = buildWheel(
    materials,
    true,
    WHEEL_CENTERS.wheelFrontLeft,
    'wheelFrontLeft',
  )
  const wheelFrontRight = buildWheel(
    materials,
    false,
    WHEEL_CENTERS.wheelFrontRight,
    'wheelFrontRight',
  )
  const wheelRearLeft = buildWheel(
    materials,
    true,
    WHEEL_CENTERS.wheelRearLeft,
    'wheelRearLeft',
  )
  const wheelRearRight = buildWheel(
    materials,
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
