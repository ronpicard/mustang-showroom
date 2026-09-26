import * as THREE from 'three'
import type { CarMaterials } from './carMaterials.ts'
import type { PartBuild } from './partBuild.ts'
import { tagPart } from './partBuild.ts'
import {
  CONSOLE_FRONT_Z,
  CONSOLE_REAR_Z,
  CONSOLE_TOP_Y,
  DASH_BOTTOM_Y,
  DASH_FRONT_Z,
  DASH_REAR_Z,
  DASH_TOP_Y,
  FLOOR_Y,
  FRONT_SEAT_X,
  FRONT_SEAT_Z,
  REAR_SEAT_Z,
  SEAT_BACK_TOP_Y,
  SEAT_CUSHION_Y,
  SHIFTER_Z,
  STEERING_WHEEL_CENTER,
  STEERING_WHEEL_DIAMETER,
  STEERING_WHEEL_TILT,
} from '../car/dimensions.ts'

/**
 * The cabin: dashboard, steering wheel, front buckets, rear bench and console. Seen through the
 * open driver's door by the dedicated interior camera, so this file gives real shape to the
 * twin-cowl gauges, the woodgrain, the Rim-Blow wheel and the pleated seats rather than flat
 * boxes. Positions come from `dimensions.ts`; everything sits above `FLOOR_Y` and well under
 * `ROOF_Y` (the tallest point here, the seat head restraints, tops out in the mid-40s).
 */

// -------------------------------------------------------------------------------------------
// Shared tuning: geometry smoothness and the one extra material this section is allowed
// -------------------------------------------------------------------------------------------

/** Segments around a torus's tube (its cross-section). */
const TUBE_SEGMENTS = 10
/** Segments around a torus's main ring. */
const RING_SEGMENTS = 28
/** Segments around a cylinder's circular cross-section. */
const CAP_SEGMENTS = 20

/** Off-white for gauge needles and dial markings, the only extra material this section adds. */
const NEEDLE_DIAL_COLOR = 0xe8e4d8

/** Attaches a mesh with the shadow flags every interior mesh uses (no glass or lenses in here). */
function mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

/** A rectangle with quarter-circle corners, used as the footprint for `roundedBoxGeometry`. */
function roundedRectShape(width: number, depth: number, corner: number): THREE.Shape {
  const w = width / 2
  const d = depth / 2
  const r = Math.min(corner, w, d)
  const shape = new THREE.Shape()
  shape.moveTo(-w + r, -d)
  shape.lineTo(w - r, -d)
  shape.quadraticCurveTo(w, -d, w, -d + r)
  shape.lineTo(w, d - r)
  shape.quadraticCurveTo(w, d, w - r, d)
  shape.lineTo(-w + r, d)
  shape.quadraticCurveTo(-w, d, -w, d - r)
  shape.lineTo(-w, -d + r)
  shape.quadraticCurveTo(-w, -d, -w + r, -d)
  return shape
}

/**
 * A box with rounded vertical edges and a beveled cap, built by extruding a rounded-rectangle
 * footprint (`width` x `depth`) up through `height`, so panels and cushions read as real
 * upholstered or moulded parts instead of hard boxes. Centred on the origin in all three axes.
 */
function roundedBoxGeometry(
  width: number,
  depth: number,
  height: number,
  corner: number,
  bevel: number,
): THREE.BufferGeometry {
  const shape = roundedRectShape(width, depth, corner)
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(height - bevel * 2, 0.05),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 6,
  })
  // The shape lies in the extruder's local XY plane and extrudes along local Z; roll that so the
  // extrusion axis (the box's height) becomes world Y, then recentre on the origin.
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, bevel - height / 2, 0)
  geometry.computeVertexNormals()
  return geometry
}

export function buildInterior(materials: CarMaterials): PartBuild[] {
  const needleMaterial = new THREE.MeshStandardMaterial({
    color: NEEDLE_DIAL_COLOR,
    roughness: 0.55,
    metalness: 0.1,
  })

  const dashboard = buildDashboard(materials, needleMaterial)
  dashboard.name = 'dashboard'
  tagPart(dashboard, 'dashboard')

  const steeringWheel = buildSteeringWheel(materials)
  steeringWheel.rotation.x = STEERING_WHEEL_TILT
  steeringWheel.position.set(...STEERING_WHEEL_CENTER)
  steeringWheel.name = 'steeringWheel'
  tagPart(steeringWheel, 'steeringWheel')

  const frontSeats = new THREE.Group()
  frontSeats.add(buildFrontSeatBucket(materials, -FRONT_SEAT_X, FRONT_SEAT_Z))
  frontSeats.add(buildFrontSeatBucket(materials, FRONT_SEAT_X, FRONT_SEAT_Z))
  frontSeats.name = 'frontSeats'
  tagPart(frontSeats, 'frontSeats')

  const rearSeat = buildRearSeat(materials)
  rearSeat.name = 'rearSeat'
  tagPart(rearSeat, 'rearSeat')

  const console_ = buildConsole(materials)
  console_.name = 'console'
  tagPart(console_, 'console')

  return [
    { id: 'dashboard', objects: [dashboard] },
    { id: 'steeringWheel', objects: [steeringWheel] },
    { id: 'frontSeats', objects: [frontSeats] },
    { id: 'rearSeat', objects: [rearSeat] },
    { id: 'console', objects: [console_] },
  ]
}

// -------------------------------------------------------------------------------------------
// Dashboard: padded top, twin-cowl instrument binnacle, woodgrain fascia, centre stack
// -------------------------------------------------------------------------------------------

/** Half width of the whole dashboard, per the spec's `x = ±29`. */
const DASH_HALF_WIDTH = 29
/** Thickness of the padded top skin. */
const DASH_PAD_THICKNESS = 2.2
/** Front-to-back depth of the padded top skin (it sits ahead of the lower dash). */
const DASH_PAD_DEPTH = 8
const DASH_PAD_CORNER = 1.5
const DASH_PAD_BEVEL = 0.4
/** Front-to-back depth of the lower dash panel, below the pad. */
const DASH_LOWER_DEPTH = 6
const DASH_LOWER_CORNER = 1
const DASH_LOWER_BEVEL = 0.3
/** The twin-cowl instrument binnacle spans this x range, ahead of the driver (car space). */
const BINNACLE_X_MIN = -25
const BINNACLE_X_MAX = -5
/** How far the binnacle stands proud of the lower dash, and its own depth. */
const BINNACLE_HEIGHT = 5
const BINNACLE_DEPTH = 5
/** The two main gauges (speedometer, tachometer), 5 in per the spec. */
const MAIN_GAUGE_RADIUS = 2.5
const MAIN_GAUGE_TICKS = 12
/** The two smaller gauges between them, scaled down from the main pair. */
const MINOR_GAUGE_RADIUS = MAIN_GAUGE_RADIUS * 0.55
const MINOR_GAUGE_TICKS = 8
/** The half-cylinder eyebrow hood standing proud over each main gauge. */
const GAUGE_HOOD_RADIUS = MAIN_GAUGE_RADIUS + 0.6
const GAUGE_HOOD_DEPTH = 3.5
/** Chrome bezel ring tube radius, and the gauge face's thickness. */
const GAUGE_BEZEL_TUBE = 0.22
const GAUGE_FACE_THICKNESS = 0.15
/** Needle length as a fraction of the gauge radius, its cross-section, and its resting angle. */
const NEEDLE_LENGTH_FACTOR = 0.72
const NEEDLE_WIDTH = 0.22
const NEEDLE_THICKNESS = 0.06
/** A steady-cruise reading, radians clockwise from straight up. */
const NEEDLE_ANGLE = -0.9
/** Woodgrain fascia strip across the passenger side of the dash. */
const WOODGRAIN_X_MIN = 1
const WOODGRAIN_X_MAX = DASH_HALF_WIDTH - 1
const WOODGRAIN_HEIGHT = 5
const WOODGRAIN_THICKNESS = 0.4
/** Glovebox door, inset into the woodgrain fascia. */
const GLOVEBOX_WIDTH = 13
const GLOVEBOX_HEIGHT = 8
const GLOVEBOX_FRAME = 0.5
/** Radio face, a small chrome rectangle with two knobs, toward the centre stack. */
const RADIO_WIDTH = 7
const RADIO_HEIGHT = 3
const RADIO_KNOB_RADIUS = 0.5
/** Centre stack with heater sliders, between the binnacle and the woodgrain. */
const STACK_WIDTH = 6
const STACK_HEIGHT = 8
const SLIDER_COUNT = 3
/** Chrome trim strip along the top edge of the dash pad. */
const DASH_TRIM_THICKNESS = 0.5

function buildDashboard(materials: CarMaterials, needleMaterial: THREE.MeshStandardMaterial): THREE.Group {
  const dash = new THREE.Group()

  const padCenterZ = DASH_FRONT_Z - DASH_PAD_DEPTH / 2
  const pad = mesh(
    roundedBoxGeometry(DASH_HALF_WIDTH * 2, DASH_PAD_DEPTH, DASH_PAD_THICKNESS, DASH_PAD_CORNER, DASH_PAD_BEVEL),
    materials.interiorBlack,
  )
  pad.position.set(0, DASH_TOP_Y - DASH_PAD_THICKNESS / 2, padCenterZ)
  dash.add(pad)

  const trim = mesh(
    new THREE.BoxGeometry(DASH_HALF_WIDTH * 2 - 1, DASH_TRIM_THICKNESS, DASH_TRIM_THICKNESS),
    materials.chrome,
  )
  trim.position.set(0, DASH_TOP_Y - 0.1, DASH_FRONT_Z - DASH_TRIM_THICKNESS / 2)
  dash.add(trim)

  const lowerHeight = DASH_TOP_Y - DASH_PAD_THICKNESS - DASH_BOTTOM_Y
  const lower = mesh(
    roundedBoxGeometry(DASH_HALF_WIDTH * 2, DASH_LOWER_DEPTH, lowerHeight, DASH_LOWER_CORNER, DASH_LOWER_BEVEL),
    materials.interiorBlack,
  )
  const lowerCenterZ = DASH_REAR_Z + DASH_LOWER_DEPTH / 2 - 1
  lower.position.set(0, DASH_BOTTOM_Y + lowerHeight / 2, lowerCenterZ)
  dash.add(lower)

  const binnacleWidth = BINNACLE_X_MAX - BINNACLE_X_MIN
  const binnacleCenterX = (BINNACLE_X_MIN + BINNACLE_X_MAX) / 2
  const binnacleCenterZ = lowerCenterZ - DASH_LOWER_DEPTH / 2 - BINNACLE_DEPTH / 2 + 1
  const binnacleY = DASH_BOTTOM_Y + lowerHeight + BINNACLE_HEIGHT / 2
  const binnacle = mesh(
    roundedBoxGeometry(binnacleWidth, BINNACLE_DEPTH, BINNACLE_HEIGHT, 1, 0.3),
    materials.interiorBlack,
  )
  binnacle.position.set(binnacleCenterX, binnacleY, binnacleCenterZ)
  dash.add(binnacle)

  const binnacleFaceZ = binnacleCenterZ - BINNACLE_DEPTH / 2

  const mainGaugeXs = [binnacleCenterX - binnacleWidth * 0.28, binnacleCenterX + binnacleWidth * 0.28]
  for (const gx of mainGaugeXs) {
    const gauge = buildGauge(materials, needleMaterial, MAIN_GAUGE_RADIUS, MAIN_GAUGE_TICKS)
    gauge.rotation.y = Math.PI
    gauge.position.set(gx, binnacleY, binnacleFaceZ)
    dash.add(gauge)

    const hood = mesh(buildGaugeHoodGeometry(), materials.interiorBlack)
    hood.position.set(gx, binnacleY, binnacleFaceZ - 0.4)
    dash.add(hood)
  }

  const minorGaugeXs = [binnacleCenterX - binnacleWidth * 0.06, binnacleCenterX + binnacleWidth * 0.06]
  for (const gx of minorGaugeXs) {
    const gauge = buildGauge(materials, needleMaterial, MINOR_GAUGE_RADIUS, MINOR_GAUGE_TICKS)
    gauge.rotation.y = Math.PI
    gauge.position.set(gx, binnacleY + 0.3, binnacleFaceZ)
    dash.add(gauge)
  }

  const woodgrainWidth = WOODGRAIN_X_MAX - WOODGRAIN_X_MIN
  const woodgrainCenterX = (WOODGRAIN_X_MIN + WOODGRAIN_X_MAX) / 2
  const woodgrainY = DASH_BOTTOM_Y + lowerHeight - WOODGRAIN_HEIGHT * 0.2
  const woodgrainZ = lowerCenterZ - DASH_LOWER_DEPTH / 2 + WOODGRAIN_THICKNESS / 2
  const woodgrain = mesh(
    new THREE.BoxGeometry(woodgrainWidth, WOODGRAIN_HEIGHT, WOODGRAIN_THICKNESS),
    materials.woodgrain,
  )
  woodgrain.position.set(woodgrainCenterX, woodgrainY, woodgrainZ)
  dash.add(woodgrain)

  const gloveboxX = woodgrainCenterX + woodgrainWidth * 0.22
  const gloveboxFrame = mesh(
    new THREE.BoxGeometry(GLOVEBOX_WIDTH + GLOVEBOX_FRAME * 2, GLOVEBOX_HEIGHT + GLOVEBOX_FRAME * 2, 0.15),
    materials.blackTrim,
  )
  gloveboxFrame.position.set(gloveboxX, woodgrainY - 0.2, woodgrainZ - WOODGRAIN_THICKNESS / 2 - 0.05)
  dash.add(gloveboxFrame)
  const gloveboxDoor = mesh(new THREE.BoxGeometry(GLOVEBOX_WIDTH, GLOVEBOX_HEIGHT, 0.2), materials.woodgrain)
  gloveboxDoor.position.set(gloveboxX, woodgrainY - 0.2, woodgrainZ - WOODGRAIN_THICKNESS / 2 - 0.15)
  dash.add(gloveboxDoor)

  const radioX = woodgrainCenterX - woodgrainWidth * 0.32
  const radioFace = mesh(new THREE.BoxGeometry(RADIO_WIDTH, RADIO_HEIGHT, 0.15), materials.chrome)
  radioFace.position.set(radioX, woodgrainY + 3, woodgrainZ - WOODGRAIN_THICKNESS / 2 - 0.05)
  dash.add(radioFace)
  for (const side of [-1, 1]) {
    const knob = mesh(new THREE.CylinderGeometry(RADIO_KNOB_RADIUS, RADIO_KNOB_RADIUS, 0.5, CAP_SEGMENTS), materials.blackTrim)
    knob.rotation.x = Math.PI / 2
    knob.position.set(
      radioX + side * (RADIO_WIDTH / 2 - RADIO_KNOB_RADIUS - 0.3),
      woodgrainY + 3,
      woodgrainZ - WOODGRAIN_THICKNESS / 2 - 0.3,
    )
    dash.add(knob)
  }

  const stackX = (binnacleCenterX + binnacleWidth / 2 + (woodgrainCenterX - woodgrainWidth / 2)) / 2
  const stackDepth = DASH_LOWER_DEPTH - 1
  const stack = mesh(roundedBoxGeometry(STACK_WIDTH, stackDepth, STACK_HEIGHT, 0.6, 0.2), materials.interiorBlack)
  const stackZ = lowerCenterZ - DASH_LOWER_DEPTH / 2 + stackDepth / 2
  stack.position.set(stackX, DASH_BOTTOM_Y + STACK_HEIGHT / 2 + 2, stackZ)
  dash.add(stack)
  for (let i = 0; i < SLIDER_COUNT; i += 1) {
    const sliderY = DASH_BOTTOM_Y + 4 + i * 2.4
    const sliderFaceZ = stackZ - stackDepth / 2 - 0.05
    const track = mesh(new THREE.BoxGeometry(STACK_WIDTH - 1, 0.3, 0.15), materials.blackTrim)
    track.position.set(stackX, sliderY, sliderFaceZ)
    dash.add(track)
    const knob = mesh(new THREE.BoxGeometry(0.8, 0.6, 0.4), materials.chrome)
    knob.position.set(stackX - STACK_WIDTH / 2 + 1.5 + i * 1.4, sliderY, sliderFaceZ - 0.15)
    dash.add(knob)
  }

  return dash
}

function buildGauge(
  materials: CarMaterials,
  needleMaterial: THREE.MeshStandardMaterial,
  radius: number,
  tickCount: number,
): THREE.Group {
  const gauge = new THREE.Group()

  const bezel = mesh(new THREE.TorusGeometry(radius, GAUGE_BEZEL_TUBE, TUBE_SEGMENTS, RING_SEGMENTS), materials.chrome)
  gauge.add(bezel)

  const face = mesh(
    new THREE.CylinderGeometry(radius * 0.86, radius * 0.86, GAUGE_FACE_THICKNESS, CAP_SEGMENTS),
    materials.gaugeFace,
  )
  face.rotation.x = Math.PI / 2
  face.position.z = -GAUGE_FACE_THICKNESS / 2
  gauge.add(face)

  const needleLength = radius * NEEDLE_LENGTH_FACTOR
  const needleGeometry = new THREE.BoxGeometry(NEEDLE_WIDTH, needleLength, NEEDLE_THICKNESS)
  needleGeometry.translate(0, needleLength / 2, 0)
  const needle = mesh(needleGeometry, needleMaterial)
  needle.position.z = GAUGE_FACE_THICKNESS * 0.2
  needle.rotation.z = NEEDLE_ANGLE
  gauge.add(needle)

  for (let i = 0; i < tickCount; i += 1) {
    const angle = (i / tickCount) * Math.PI * 2
    const tick = mesh(new THREE.BoxGeometry(0.6, 0.16, 0.05), needleMaterial)
    tick.position.set(Math.sin(angle) * radius * 0.74, Math.cos(angle) * radius * 0.74, GAUGE_FACE_THICKNESS * 0.2)
    tick.rotation.z = -angle
    gauge.add(tick)
  }

  return gauge
}

function buildGaugeHoodGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(
    GAUGE_HOOD_RADIUS,
    GAUGE_HOOD_RADIUS,
    GAUGE_HOOD_DEPTH,
    16,
    1,
    true,
    Math.PI * 1.15,
    Math.PI * 0.7,
  )
  geometry.rotateX(Math.PI / 2)
  geometry.computeVertexNormals()
  return geometry
}

// -------------------------------------------------------------------------------------------
// Steering wheel: Rim-Blow rim, brushed spokes, padded hub with a chrome horn-ring segment
// -------------------------------------------------------------------------------------------

/** The Rim-Blow rim's tube diameter, per the spec ("a TorusGeometry tube 1.1 in"). */
const WHEEL_RIM_TUBE = 1.1 / 2
const WHEEL_HUB_RADIUS = 2.2
const WHEEL_HUB_DEPTH = 2
const SPOKE_COUNT = 3
const SPOKE_WIDTH = 1.8
const SPOKE_THICKNESS = 0.5

function buildSteeringWheel(materials: CarMaterials): THREE.Group {
  const wheel = new THREE.Group()
  const rimRadius = STEERING_WHEEL_DIAMETER / 2

  const rim = mesh(new THREE.TorusGeometry(rimRadius, WHEEL_RIM_TUBE, TUBE_SEGMENTS, RING_SEGMENTS), materials.interiorBlack)
  wheel.add(rim)

  const hub = mesh(new THREE.CylinderGeometry(WHEEL_HUB_RADIUS, WHEEL_HUB_RADIUS, WHEEL_HUB_DEPTH, CAP_SEGMENTS), materials.interiorBlack)
  hub.rotation.x = Math.PI / 2
  wheel.add(hub)

  const hornRing = mesh(
    new THREE.TorusGeometry(WHEEL_HUB_RADIUS + 0.3, 0.15, 8, RING_SEGMENTS, Math.PI * 0.8),
    materials.chrome,
  )
  hornRing.rotation.z = Math.PI * 0.1
  hornRing.position.z = WHEEL_HUB_DEPTH * 0.3
  wheel.add(hornRing)

  for (let i = 0; i < SPOKE_COUNT; i += 1) {
    const spoke = buildSteeringSpoke(materials, rimRadius)
    spoke.rotation.z = (i / SPOKE_COUNT) * Math.PI * 2
    wheel.add(spoke)
  }

  return wheel
}

function buildSteeringSpoke(materials: CarMaterials, rimRadius: number): THREE.Group {
  const spoke = new THREE.Group()
  const length = rimRadius - WHEEL_HUB_RADIUS

  const bar = mesh(new THREE.BoxGeometry(SPOKE_WIDTH, length, SPOKE_THICKNESS), materials.aluminium)
  bar.position.y = -(WHEEL_HUB_RADIUS + length / 2)
  spoke.add(bar)

  // A shallow recessed groove suggesting the pressed slot down the spoke's centre.
  const slot = mesh(new THREE.BoxGeometry(SPOKE_WIDTH * 0.4, length * 0.55, SPOKE_THICKNESS * 0.4), materials.blackTrim)
  slot.position.set(0, -(WHEEL_HUB_RADIUS + length / 2), SPOKE_THICKNESS * 0.32)
  spoke.add(slot)

  return spoke
}

// -------------------------------------------------------------------------------------------
// Shared pleat helper: shallow recessed grooves across cushions and backrests
// -------------------------------------------------------------------------------------------

const SEAT_PLEAT_COUNT = 5
const PLEAT_GROOVE_WIDTH = 0.5
const PLEAT_GROOVE_DEPTH = 0.12

interface PleatOptions {
  /** 'z' lays grooves across a horizontal cushion (spaced front-to-back); 'y' lays them across a
   *  backrest's face (spaced bottom-to-top, `baseOffset` up from the pivot). */
  axis: 'y' | 'z'
  count: number
  center: readonly [number, number, number]
  span: number
  barLength: number
  baseOffset?: number
}

function addPleats(parent: THREE.Group, materials: CarMaterials, options: PleatOptions): void {
  const { axis, count, center, span, barLength, baseOffset = 0 } = options
  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / count - 0.5
    const groove =
      axis === 'z'
        ? mesh(new THREE.BoxGeometry(barLength, PLEAT_GROOVE_DEPTH, PLEAT_GROOVE_WIDTH), materials.interiorBlack)
        : mesh(new THREE.BoxGeometry(barLength, PLEAT_GROOVE_WIDTH, PLEAT_GROOVE_DEPTH), materials.interiorBlack)
    if (axis === 'z') groove.position.set(center[0], center[1], center[2] + t * span)
    else groove.position.set(center[0], baseOffset + t * span, center[2])
    parent.add(groove)
  }
}

// -------------------------------------------------------------------------------------------
// Front seats: pleated high-back buckets with an integral head restraint
// -------------------------------------------------------------------------------------------

const SEAT_CORNER = 1.4
const SEAT_BEVEL = 0.5
const SEAT_CUSHION_WIDTH = 18
const SEAT_CUSHION_DEPTH = 20
const SEAT_CUSHION_THICKNESS = 5
const SEAT_BACK_WIDTH = 18
const SEAT_BACK_THICKNESS = 4
/** The backrest leans back from vertical by this many radians (15°, per the spec). */
const FRONT_BACKREST_LEAN = Math.PI / 12
const SEAT_HEAD_RESTRAINT_WIDTH = 14
const SEAT_HEAD_RESTRAINT_HEIGHT = 6

function buildFrontSeatBucket(materials: CarMaterials, centerX: number, centerZ: number): THREE.Group {
  const seat = new THREE.Group()

  const cushion = mesh(
    roundedBoxGeometry(SEAT_CUSHION_WIDTH, SEAT_CUSHION_DEPTH, SEAT_CUSHION_THICKNESS, SEAT_CORNER, SEAT_BEVEL),
    materials.vinyl,
  )
  cushion.position.set(centerX, SEAT_CUSHION_Y, centerZ)
  seat.add(cushion)
  addPleats(seat, materials, {
    axis: 'z',
    count: SEAT_PLEAT_COUNT,
    center: [centerX, SEAT_CUSHION_Y + SEAT_CUSHION_THICKNESS / 2 - 0.1, centerZ],
    span: SEAT_CUSHION_DEPTH * 0.8,
    barLength: SEAT_CUSHION_WIDTH * 0.92,
  })

  for (const side of [-1, 1]) {
    const track = mesh(new THREE.BoxGeometry(1.2, 1.6, SEAT_CUSHION_DEPTH * 0.7), materials.chrome)
    track.position.set(centerX + side * SEAT_CUSHION_WIDTH * 0.3, FLOOR_Y + 0.8, centerZ)
    seat.add(track)
  }

  const inboardSign = centerX < 0 ? 1 : -1
  const buckle = mesh(new THREE.BoxGeometry(1.4, 1.8, 1), materials.chrome)
  buckle.position.set(centerX + inboardSign * (SEAT_CUSHION_WIDTH / 2 - 1.5), SEAT_CUSHION_Y + SEAT_CUSHION_THICKNESS / 2 + 1, centerZ - 2)
  seat.add(buckle)

  const backrestPivot = new THREE.Group()
  backrestPivot.position.set(centerX, SEAT_CUSHION_Y, centerZ - SEAT_CUSHION_DEPTH / 2)
  backrestPivot.rotation.x = -FRONT_BACKREST_LEAN
  seat.add(backrestPivot)

  const backHeight = (SEAT_BACK_TOP_Y - SEAT_CUSHION_Y) / Math.cos(FRONT_BACKREST_LEAN)
  const backrest = mesh(
    roundedBoxGeometry(SEAT_BACK_WIDTH, SEAT_BACK_THICKNESS, backHeight, SEAT_CORNER, SEAT_BEVEL),
    materials.vinyl,
  )
  backrest.position.set(0, backHeight / 2, 0)
  backrestPivot.add(backrest)
  addPleats(backrestPivot, materials, {
    axis: 'y',
    count: SEAT_PLEAT_COUNT,
    center: [0, 0, SEAT_BACK_THICKNESS / 2 - 0.1],
    span: backHeight * 0.7,
    barLength: SEAT_BACK_WIDTH * 0.9,
    baseOffset: backHeight * 0.4,
  })

  const restraint = mesh(
    roundedBoxGeometry(SEAT_HEAD_RESTRAINT_WIDTH, SEAT_BACK_THICKNESS + 1, SEAT_HEAD_RESTRAINT_HEIGHT, 1.6, 0.5),
    materials.vinyl,
  )
  restraint.position.set(0, backHeight + SEAT_HEAD_RESTRAINT_HEIGHT / 2 - 1, 0.3)
  backrestPivot.add(restraint)

  return seat
}

// -------------------------------------------------------------------------------------------
// Rear seat: a pleated bench with a centre armrest ridge
// -------------------------------------------------------------------------------------------

const REAR_CUSHION_WIDTH = 46
const REAR_CUSHION_DEPTH = 18
const REAR_CUSHION_THICKNESS = 5
/** The spec gives no explicit thickness for the rear backrest; matched to the front's. */
const REAR_BACK_THICKNESS = SEAT_BACK_THICKNESS
/** The rear backrest leans back by this many radians (25°, per the spec). */
const REAR_BACKREST_LEAN = (25 * Math.PI) / 180
/** The rear backrest's top edge, per the spec ("leaning back ... to y = 34"). */
const REAR_BACKREST_TOP_Y = 34
const REAR_ARMREST_WIDTH = 6
const REAR_ARMREST_HEIGHT = 3

function buildRearSeat(materials: CarMaterials): THREE.Group {
  const seat = new THREE.Group()
  const cushionY = SEAT_CUSHION_Y - 1

  const cushion = mesh(
    roundedBoxGeometry(REAR_CUSHION_WIDTH, REAR_CUSHION_DEPTH, REAR_CUSHION_THICKNESS, SEAT_CORNER, SEAT_BEVEL),
    materials.vinyl,
  )
  cushion.position.set(0, cushionY, REAR_SEAT_Z)
  seat.add(cushion)
  addPleats(seat, materials, {
    axis: 'z',
    count: SEAT_PLEAT_COUNT,
    center: [0, cushionY + REAR_CUSHION_THICKNESS / 2 - 0.1, REAR_SEAT_Z],
    span: REAR_CUSHION_DEPTH * 0.8,
    barLength: REAR_CUSHION_WIDTH * 0.94,
  })

  const backrestPivot = new THREE.Group()
  backrestPivot.position.set(0, cushionY, REAR_SEAT_Z - REAR_CUSHION_DEPTH / 2)
  backrestPivot.rotation.x = -REAR_BACKREST_LEAN
  seat.add(backrestPivot)

  const backHeight = (REAR_BACKREST_TOP_Y - cushionY) / Math.cos(REAR_BACKREST_LEAN)
  const backrest = mesh(
    roundedBoxGeometry(REAR_CUSHION_WIDTH, REAR_BACK_THICKNESS, backHeight, SEAT_CORNER, SEAT_BEVEL),
    materials.vinyl,
  )
  backrest.position.set(0, backHeight / 2, 0)
  backrestPivot.add(backrest)
  addPleats(backrestPivot, materials, {
    axis: 'y',
    count: SEAT_PLEAT_COUNT,
    center: [0, 0, REAR_BACK_THICKNESS / 2 - 0.1],
    span: backHeight * 0.7,
    barLength: REAR_CUSHION_WIDTH * 0.9,
    baseOffset: backHeight * 0.4,
  })

  const armrest = mesh(
    roundedBoxGeometry(REAR_ARMREST_WIDTH, REAR_BACK_THICKNESS + 0.6, REAR_ARMREST_HEIGHT, 0.8, 0.3),
    materials.interiorBlack,
  )
  armrest.position.set(0, cushionY + REAR_CUSHION_THICKNESS / 2 + REAR_ARMREST_HEIGHT / 2, REAR_SEAT_Z - 1)
  seat.add(armrest)

  return seat
}

// -------------------------------------------------------------------------------------------
// Console: woodgrain top, storage lid with a chrome latch, shifter boot, ashtray detail
// -------------------------------------------------------------------------------------------

/** The console body's width, per the spec ("a body 8 in wide"). */
const CONSOLE_WIDTH = 8
const CONSOLE_SHIFTER_BOOT_TOP_RADIUS = 0.6
const CONSOLE_SHIFTER_BOOT_BASE_RADIUS = 1.6
const CONSOLE_SHIFTER_BOOT_HEIGHT = 2.2

function buildConsole(materials: CarMaterials): THREE.Group {
  const console_ = new THREE.Group()
  const depth = CONSOLE_FRONT_Z - CONSOLE_REAR_Z
  const centerZ = (CONSOLE_FRONT_Z + CONSOLE_REAR_Z) / 2
  const bodyBottom = FLOOR_Y + 5
  const height = CONSOLE_TOP_Y - bodyBottom

  const body = mesh(roundedBoxGeometry(CONSOLE_WIDTH, depth, height, 0.8, 0.3), materials.interiorBlack)
  body.position.set(0, bodyBottom + height / 2, centerZ)
  console_.add(body)

  const topPlate = mesh(new THREE.BoxGeometry(CONSOLE_WIDTH - 0.6, 0.3, depth - 0.6), materials.woodgrain)
  topPlate.position.set(0, CONSOLE_TOP_Y + 0.05, centerZ)
  console_.add(topPlate)

  const lidDepth = depth * 0.4
  const lid = mesh(new THREE.BoxGeometry(CONSOLE_WIDTH - 1, 0.4, lidDepth), materials.interiorBlack)
  lid.position.set(0, CONSOLE_TOP_Y + 0.25, CONSOLE_REAR_Z + lidDepth / 2 + 1)
  console_.add(lid)
  const latch = mesh(new THREE.BoxGeometry(1.4, 0.3, 0.5), materials.chrome)
  latch.position.set(0, CONSOLE_TOP_Y + 0.5, CONSOLE_REAR_Z + 1)
  console_.add(latch)

  const boot = mesh(
    new THREE.CylinderGeometry(CONSOLE_SHIFTER_BOOT_TOP_RADIUS, CONSOLE_SHIFTER_BOOT_BASE_RADIUS, CONSOLE_SHIFTER_BOOT_HEIGHT, 16),
    materials.rubber,
  )
  boot.position.set(0, CONSOLE_TOP_Y + CONSOLE_SHIFTER_BOOT_HEIGHT / 2, SHIFTER_Z)
  console_.add(boot)

  const ashtray = mesh(new THREE.CylinderGeometry(1.1, 1, 0.3, CAP_SEGMENTS), materials.chrome)
  ashtray.position.set(0, CONSOLE_TOP_Y + 0.2, CONSOLE_FRONT_Z - 2)
  console_.add(ashtray)

  return console_
}
