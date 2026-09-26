import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { CarMaterials } from './carMaterials.ts'
import { tagPart, type PartBuild } from './partBuild.ts'
import type { PartId } from '../car/types.ts'
import {
  AXLE_TUBE_DIAMETER,
  COWL_Y,
  DIFFERENTIAL_DIAMETER,
  DOOR_FRONT_Z,
  DOOR_REAR_Z,
  DRIVESHAFT_DIAMETER,
  DRIVESHAFT_Y,
  EXHAUST_PIPE_X,
  EXHAUST_PIPE_Y,
  EXHAUST_TIP_X,
  EXHAUST_TIP_Y,
  FIREWALL_Z,
  FLOOR_Y,
  FRONT_AXLE_Z,
  FUEL_CAP_Y,
  FUEL_TANK_CENTER,
  FUEL_TANK_SIZE,
  LEAF_SPRING_FRONT_Z,
  LEAF_SPRING_REAR_Z,
  LEAF_SPRING_X,
  LEAF_SPRING_Y,
  MUFFLER_DIAMETER,
  MUFFLER_LENGTH,
  MUFFLER_Z,
  RADIATOR_BOTTOM_Y,
  RADIATOR_HALF_WIDTH,
  RADIATOR_TOP_Y,
  RADIATOR_Z,
  REAR_AXLE_Z,
  REAR_SEAT_Z,
  ROCKER_BOTTOM_Y,
  ROCKER_HALF_WIDTH,
  ROCKER_TOP_Y,
  SHOCK_TOWER_TOP_Y,
  SHOCK_TOWER_X,
  SHOCK_TOWER_Z,
  STEERING_WHEEL_CENTER,
  STEERING_WHEEL_TILT,
  TAIL_Z,
  TRANSMISSION_REAR_Z,
  TRUNK_FRONT_Z,
  WHEEL_CENTER_X_FRONT,
  WHEEL_CENTER_X_REAR,
  WHEEL_CENTER_Y,
} from '../car/dimensions.ts'

/**
 * The unibody skeleton, driveline and running gear: everything that stays behind when the body
 * panels explode away. Every position here comes from `src/car/dimensions.ts`; the numbers below
 * are the chassis file's own tuning knobs for shapes the spec describes but does not dimension.
 */

// -------------------------------------------------------------------------------------------
// Floor pan
// -------------------------------------------------------------------------------------------

/** Transmission tunnel cross-section: half-cylinder width and height, inches. */
const TUNNEL_WIDTH = 12
const TUNNEL_HEIGHT = 7
/** Arc segments used to sweep the tunnel's half-round cross-section. */
const TUNNEL_SEGMENTS = 16
/** The trunk floor sits this far above the cabin floor, over the fuel tank and spare. */
const TRUNK_FLOOR_RISE = 2
/** The trunk floor runs this far past the tail for the valance lip to tuck under. */
const TRUNK_FLOOR_REAR_MARGIN = 4
/** Trunk floor half width, narrower than the cabin floor once it clears the quarter panels. */
const TRUNK_FLOOR_HALF_WIDTH = 28
/** Firewall plate: half width and thickness, inches. */
const FIREWALL_HALF_WIDTH = 30
const FIREWALL_THICKNESS = 1
/** The firewall stops one inch below the cowl so the cowl panel (carBody) laps over it. */
const FIREWALL_TOP_MARGIN = 1
/** Rocker panel box: depth (outward from the sill) and a hair of clearance above the ground. */
const ROCKER_DEPTH = 3
/** Front and rear frame rail cross-section (width x height), inches. */
const FRAME_RAIL_WIDTH = 3
const FRAME_RAIL_HEIGHT = 4
const FRAME_RAIL_X = 16
const FRAME_RAIL_BOTTOM_Y = 10
const FRAME_RAIL_TOP_Y = 14
/** The radiator support sits this far ahead of the radiator core itself. */
const RADIATOR_SUPPORT_Z = RADIATOR_Z + 3
const RADIATOR_SUPPORT_BAR_THICKNESS = 2
const RADIATOR_SUPPORT_DEPTH = 3
/** Shock tower diameter and the inner fender panel's thickness running forward from it. */
const SHOCK_TOWER_DIAMETER = 9
const SHOCK_TOWER_BOTTOM_Y = 12
const INNER_FENDER_THICKNESS = 1
/** Rear frame rails run from the rear seat back to the tail, under the leaf spring mounts. */
const REAR_FRAME_RAIL_X = LEAF_SPRING_X

// -------------------------------------------------------------------------------------------
// Front suspension
// -------------------------------------------------------------------------------------------

/** Coil spring: diameter, free height and turn count (spec: "5 in diameter, 10 in tall, 6 turns"). */
const COIL_SPRING_DIAMETER = 5
const COIL_SPRING_HEIGHT = 10
const COIL_SPRING_TURNS = 6
const COIL_SPRING_WIRE_RADIUS = 0.55
/** Coil spring sits inside the tower, based this high above the lower arm. */
const COIL_SPRING_BASE_Y = 18
/** How many tube segments to lay down per full turn of the coil. */
const COIL_SEGMENTS_PER_TURN = 10
/** Shock absorber body: radius, and how far it extends above/below the spring. */
const SHOCK_ABSORBER_RADIUS = 0.7
const SHOCK_ABSORBER_BOTTOM_Y = 15.5
const SHOCK_ABSORBER_TOP_Y = 30.5
/** Control arm inner pivots, fore/aft spread either side of the axle line. */
const ARM_PIVOT_SPREAD_Z = 6
/** Upper arm: inner pivot height (down from the tower top) and ball joint height at the spindle. */
const UPPER_ARM_INNER_Y = SHOCK_TOWER_TOP_Y - 3
const UPPER_BALL_JOINT_Y = WHEEL_CENTER_Y + 5
/** Lower arm: inner pivot height (on the frame rail) and ball joint height at the spindle. */
const LOWER_ARM_INNER_Y = FRAME_RAIL_BOTTOM_Y - 1
const LOWER_BALL_JOINT_Y = WHEEL_CENTER_Y - 4
/** Ball joints sit this far inboard of the wheel centre line. */
const BALL_JOINT_INSET_X = 2
/** Control arm tube radius. */
const CONTROL_ARM_RADIUS = 1
/** Spindle hub: radius and length, and how far inboard of the wheel centre it sits. */
const SPINDLE_HUB_RADIUS = 3.2
const SPINDLE_HUB_LENGTH = 3
const SPINDLE_INSET_X = 2.5
/** Strut rod: from the lower ball joint forward to the frame rail. */
const STRUT_ROD_RADIUS = 0.7
const STRUT_ROD_FRAME_Z = FRONT_AXLE_Z + 20
/** Anti-roll bar: height, how far ahead of the front axle, half span and end-link drop. */
const ANTI_ROLL_Y = 11
const ANTI_ROLL_Z = FRONT_AXLE_Z + 8
const ANTI_ROLL_HALF_SPAN = 25
const ANTI_ROLL_RADIUS = 0.65
const ANTI_ROLL_END_LINK_DROP = 2

// -------------------------------------------------------------------------------------------
// Steering
// -------------------------------------------------------------------------------------------

const STEERING_BOX_POSITION: readonly [number, number, number] = [-16, 14, 50]
const STEERING_BOX_SIZE: readonly [number, number, number] = [4, 5, 5]
const CENTER_LINK_Y = 10.5
const CENTER_LINK_Z = FRONT_AXLE_Z - 6
const IDLER_ARM_X = 16
const LINK_RADIUS = 0.65
const STEERING_COLUMN_DIAMETER = 1.5

// -------------------------------------------------------------------------------------------
// Rear axle
// -------------------------------------------------------------------------------------------

/** The pumpkin is drawn as a squashed sphere: how much it stretches fore/aft and flattens vertically. */
const DIFFERENTIAL_STRETCH_Z = 1.35
const DIFFERENTIAL_FLATTEN_Y = 0.85
/** The bolt ring on the front (pinion side) face of the pumpkin. */
const BOLT_RING_DIAMETER = DIFFERENTIAL_DIAMETER * 0.7
const BOLT_RING_THICKNESS = 0.9
/** Axle tubes run out from the pumpkin to just inboard of the wheel. */
const AXLE_TUBE_INSET = 6
/** Spring perches sit on top of the axle tubes at the leaf spring mounting points. */
const SPRING_PERCH_SIZE: readonly [number, number, number] = [4.5, 1.8, 3.5]
/** Pinion snout and U-joint yoke, forward of the pumpkin. */
const PINION_SNOUT_LENGTH = 6
const PINION_SNOUT_DIAMETER = 4
const YOKE_LENGTH = 2.5
const YOKE_DIAMETER = 3.4

// -------------------------------------------------------------------------------------------
// Leaf springs
// -------------------------------------------------------------------------------------------

const LEAF_COUNT = 4
const LEAF_WIDTH = 2.5
const LEAF_THICKNESS = 0.35
const LEAF_SAG = 2
/** Each leaf below the top one is a little shorter, the way a real stack tapers. */
const LEAF_LENGTH_STEP = 6
const HANGER_SIZE: readonly [number, number, number] = [2, 3, 1.5]
const SHACKLE_SIZE: readonly [number, number, number] = [1.8, 3, 1.4]
const U_BOLT_PLATE_SIZE: readonly [number, number, number] = [5, 1, 4]
const REAR_SHOCK_LENGTH = 14
const REAR_SHOCK_RADIUS = 0.9
/** Staggered shocks: the driver's shock sits ahead of the axle, the passenger's behind. */
const REAR_SHOCK_STAGGER_Z = 8

// -------------------------------------------------------------------------------------------
// Driveshaft
// -------------------------------------------------------------------------------------------

const U_JOINT_RADIUS = 1.6
const U_JOINT_LENGTH = 2.6
/** The driveshaft's rear U-joint sits just ahead of the pinion snout. */
const DRIVESHAFT_REAR_Z = REAR_AXLE_Z - 6

// -------------------------------------------------------------------------------------------
// Exhaust system
// -------------------------------------------------------------------------------------------

/** Header collector outlets, matching where `carEngine.ts` ends its headers. */
const HEADER_OUTLET_X = 14
const HEADER_OUTLET_Y = 14
const HEADER_OUTLET_Z = 48
const EXHAUST_PIPE_DIAMETER = 2.25
/** The pipe bends in and down to running height by this Z, then runs straight to the muffler. */
const EXHAUST_BEND_Z = 20
const MUFFLER_FLATTEN_Y = 0.82
/** Tailpipes rise over the axle and end just behind the chrome tips built in `carTrim.ts`. */
const TAILPIPE_END_Z = TAIL_Z + 3
const EXHAUST_HANGER_SIZE: readonly [number, number, number] = [1.6, 1, 1.2]

// -------------------------------------------------------------------------------------------
// Fuel tank
// -------------------------------------------------------------------------------------------

const FUEL_TANK_CORNER_RADIUS = 1.2
const FILLER_NECK_RADIUS = 0.6
const SENDER_PLATE_RADIUS = 2.2
const SENDER_PLATE_THICKNESS = 0.3

type P3 = readonly [number, number, number]

function toVector3(point: P3): THREE.Vector3 {
  return new THREE.Vector3(point[0], point[1], point[2])
}

function finishMesh(mesh: THREE.Mesh): THREE.Mesh {
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function boxMesh(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  radius = Math.min(width, height, depth) * 0.18,
): THREE.Mesh {
  const clampedRadius = Math.max(0.02, Math.min(radius, width / 2 - 0.05, height / 2 - 0.05, depth / 2 - 0.05))
  const geometry = new RoundedBoxGeometry(width, height, depth, 2, clampedRadius)
  return finishMesh(new THREE.Mesh(geometry, material))
}

/** A cylinder whose axis runs from `a` to `b`, radius `radius`. */
function cylinderBetween(a: P3, b: P3, radius: number, material: THREE.Material, segments = 12): THREE.Mesh {
  const start = toVector3(a)
  const end = toVector3(b)
  const axis = new THREE.Vector3().subVectors(end, start)
  const length = axis.length()
  const geometry = new THREE.CylinderGeometry(radius, radius, length, segments)
  const mesh = finishMesh(new THREE.Mesh(geometry, material))
  mesh.position.copy(start).addScaledVector(axis, 0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize())
  return mesh
}

/** A tube lofted along a smooth Catmull-Rom path through `points`. */
function tubeAlong(
  points: readonly P3[],
  radius: number,
  material: THREE.Material,
  segments = 24,
  radialSegments = 8,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map(toVector3))
  const geometry = new THREE.TubeGeometry(curve, segments, radius, radialSegments, false)
  return finishMesh(new THREE.Mesh(geometry, material))
}

/** A coil spring: a helix of `turns` full turns, `diameter` wide and `height` tall, centred on `base`. */
function coilSpring(base: P3, diameter: number, height: number, turns: number, wireRadius: number, material: THREE.Material): THREE.Mesh {
  const radius = diameter / 2
  const steps = Math.round(turns * COIL_SEGMENTS_PER_TURN)
  const points: THREE.Vector3[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const angle = t * turns * Math.PI * 2
    points.push(
      new THREE.Vector3(base[0] + radius * Math.cos(angle), base[1] + t * height, base[2] + radius * Math.sin(angle)),
    )
  }
  const curve = new THREE.CatmullRomCurve3(points)
  const geometry = new THREE.TubeGeometry(curve, steps, wireRadius, 6, false)
  return finishMesh(new THREE.Mesh(geometry, material))
}

/**
 * The transmission tunnel's half-round bulge, swept along Z: a semicircular arc (apex up, base at
 * y = 0) of `radius`, `length` long, with flat half-disc caps at each end so it reads as a solid
 * hump rather than a paper shell when seen from the open cabin.
 */
function tunnelGeometry(radius: number, length: number, segments: number): THREE.BufferGeometry {
  const half = length / 2
  const positions: number[] = []
  const ring = (z: number) => {
    for (let i = 0; i <= segments; i++) {
      const angle = (Math.PI * i) / segments
      positions.push(-radius * Math.cos(angle), radius * Math.sin(angle), z)
    }
  }
  ring(-half)
  ring(half)
  const ringCount = segments + 1
  const indices: number[] = []
  for (let i = 0; i < segments; i++) {
    const bottomA = i
    const topA = ringCount + i
    const bottomB = i + 1
    const topB = ringCount + i + 1
    indices.push(bottomA, topA, bottomB, topA, topB, bottomB)
  }
  const bottomCenter = positions.length / 3
  positions.push(0, 0, -half)
  for (let i = 0; i < segments; i++) indices.push(bottomCenter, i, i + 1)
  const topCenter = positions.length / 3
  positions.push(0, 0, half)
  for (let i = 0; i < segments; i++) indices.push(topCenter, ringCount + i + 1, ringCount + i)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

// -------------------------------------------------------------------------------------------
// Floor pan
// -------------------------------------------------------------------------------------------

function buildFloorPan(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()

  const cabinFrontZ = FIREWALL_Z
  const cabinRearZ = TRUNK_FRONT_Z - 6
  const cabinLength = cabinFrontZ - cabinRearZ
  const floor = boxMesh(ROCKER_HALF_WIDTH * 2, 1, cabinLength, materials.underbody, 0.2)
  floor.position.set(0, FLOOR_Y - 0.5, (cabinFrontZ + cabinRearZ) / 2)
  group.add(floor)
  // A thin carpet skin on top of the same span reads as the trimmed cabin floor from inside.
  const carpetTop = boxMesh(ROCKER_HALF_WIDTH * 2 - 1, 0.3, cabinLength - 1, materials.carpet, 0.1)
  carpetTop.position.set(0, FLOOR_Y + 0.15, (cabinFrontZ + cabinRearZ) / 2)
  group.add(carpetTop)

  const tunnelLength = FIREWALL_Z - REAR_SEAT_Z
  const tunnel = finishMesh(
    new THREE.Mesh(tunnelGeometry(TUNNEL_WIDTH / 2, tunnelLength, TUNNEL_SEGMENTS), materials.underbody),
  )
  tunnel.scale.y = TUNNEL_HEIGHT / (TUNNEL_WIDTH / 2)
  tunnel.position.set(0, FLOOR_Y, (FIREWALL_Z + REAR_SEAT_Z) / 2)
  group.add(tunnel)

  const trunkFrontZ = TRUNK_FRONT_Z - 6
  const trunkRearZ = TAIL_Z + TRUNK_FLOOR_REAR_MARGIN
  const trunkFloor = boxMesh(TRUNK_FLOOR_HALF_WIDTH * 2, 1, trunkFrontZ - trunkRearZ, materials.underbody, 0.2)
  trunkFloor.position.set(0, FLOOR_Y + TRUNK_FLOOR_RISE - 0.5, (trunkFrontZ + trunkRearZ) / 2)
  group.add(trunkFloor)
  const trunkCarpet = boxMesh(TRUNK_FLOOR_HALF_WIDTH * 2 - 1, 0.3, trunkFrontZ - trunkRearZ - 1, materials.carpet, 0.1)
  trunkCarpet.position.set(0, FLOOR_Y + TRUNK_FLOOR_RISE + 0.15, (trunkFrontZ + trunkRearZ) / 2)
  group.add(trunkCarpet)

  const firewallHeight = COWL_Y - FIREWALL_TOP_MARGIN - FLOOR_Y
  const firewall = boxMesh(FIREWALL_HALF_WIDTH * 2, firewallHeight, FIREWALL_THICKNESS, materials.steelDark, 0.15)
  firewall.position.set(0, FLOOR_Y + firewallHeight / 2, FIREWALL_Z)
  group.add(firewall)

  const rockerHeight = ROCKER_TOP_Y - ROCKER_BOTTOM_Y
  const rockerLength = DOOR_FRONT_Z - DOOR_REAR_Z
  const rockerCenterY = (ROCKER_TOP_Y + ROCKER_BOTTOM_Y) / 2
  const rockerCenterZ = (DOOR_FRONT_Z + DOOR_REAR_Z) / 2
  for (const side of [-1, 1]) {
    const rocker = boxMesh(ROCKER_DEPTH, rockerHeight, rockerLength, materials.paint, 0.3)
    rocker.position.set(side * ROCKER_HALF_WIDTH, rockerCenterY, rockerCenterZ)
    group.add(rocker)
  }

  const frameRailLength = RADIATOR_SUPPORT_Z - FIREWALL_Z
  const frameRailCenterY = (FRAME_RAIL_BOTTOM_Y + FRAME_RAIL_TOP_Y) / 2
  const frameRailCenterZ = (FIREWALL_Z + RADIATOR_SUPPORT_Z) / 2
  for (const side of [-1, 1]) {
    const rail = boxMesh(FRAME_RAIL_WIDTH, FRAME_RAIL_HEIGHT, frameRailLength, materials.steelDark, 0.25)
    rail.position.set(side * FRAME_RAIL_X, frameRailCenterY, frameRailCenterZ)
    group.add(rail)
  }

  const rearRailLength = REAR_SEAT_Z - TAIL_Z
  const rearRailCenterZ = (REAR_SEAT_Z + TAIL_Z) / 2
  for (const side of [-1, 1]) {
    const rail = boxMesh(FRAME_RAIL_WIDTH, FRAME_RAIL_HEIGHT, rearRailLength, materials.steelDark, 0.25)
    rail.position.set(side * REAR_FRAME_RAIL_X, frameRailCenterY, rearRailCenterZ)
    group.add(rail)
  }

  const shockTowerRadius = SHOCK_TOWER_DIAMETER / 2
  const shockTowerHeight = SHOCK_TOWER_TOP_Y - SHOCK_TOWER_BOTTOM_Y
  for (const side of [-1, 1]) {
    const thetaStart = side > 0 ? 0 : Math.PI
    const towerGeometry = new THREE.CylinderGeometry(
      shockTowerRadius,
      shockTowerRadius,
      shockTowerHeight,
      16,
      1,
      true,
      thetaStart,
      Math.PI,
    )
    const tower = finishMesh(new THREE.Mesh(towerGeometry, materials.steelDark))
    tower.position.set(side * SHOCK_TOWER_X, SHOCK_TOWER_BOTTOM_Y + shockTowerHeight / 2, SHOCK_TOWER_Z)
    group.add(tower)

    const innerFenderLength = RADIATOR_Z - SHOCK_TOWER_Z
    const innerFenderHeight = SHOCK_TOWER_TOP_Y - FRAME_RAIL_TOP_Y
    const innerFender = boxMesh(
      INNER_FENDER_THICKNESS,
      innerFenderHeight,
      innerFenderLength,
      materials.steelDark,
      0.1,
    )
    innerFender.position.set(
      side * SHOCK_TOWER_X,
      FRAME_RAIL_TOP_Y + innerFenderHeight / 2,
      (SHOCK_TOWER_Z + RADIATOR_Z) / 2,
    )
    group.add(innerFender)
  }

  const radiatorOpeningHeight = RADIATOR_TOP_Y - RADIATOR_BOTTOM_Y
  const radiatorSupportTop = boxMesh(
    RADIATOR_HALF_WIDTH * 2 + RADIATOR_SUPPORT_BAR_THICKNESS * 2,
    RADIATOR_SUPPORT_BAR_THICKNESS,
    RADIATOR_SUPPORT_DEPTH,
    materials.steelDark,
    0.15,
  )
  radiatorSupportTop.position.set(0, RADIATOR_TOP_Y + RADIATOR_SUPPORT_BAR_THICKNESS / 2, RADIATOR_SUPPORT_Z)
  group.add(radiatorSupportTop)
  const radiatorSupportBottom = radiatorSupportTop.clone()
  radiatorSupportBottom.position.y = RADIATOR_BOTTOM_Y - RADIATOR_SUPPORT_BAR_THICKNESS / 2
  group.add(radiatorSupportBottom)
  for (const side of [-1, 1]) {
    const post = boxMesh(
      RADIATOR_SUPPORT_BAR_THICKNESS,
      radiatorOpeningHeight + RADIATOR_SUPPORT_BAR_THICKNESS * 2,
      RADIATOR_SUPPORT_DEPTH,
      materials.steelDark,
      0.15,
    )
    post.position.set(side * (RADIATOR_HALF_WIDTH + RADIATOR_SUPPORT_BAR_THICKNESS / 2), (RADIATOR_TOP_Y + RADIATOR_BOTTOM_Y) / 2, RADIATOR_SUPPORT_Z)
    group.add(post)
  }

  return group
}

// -------------------------------------------------------------------------------------------
// Front suspension
// -------------------------------------------------------------------------------------------

function buildFrontSuspension(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()

  for (const side of [-1, 1]) {
    const wheelX = side * WHEEL_CENTER_X_FRONT
    const spindle: P3 = [wheelX - side * SPINDLE_INSET_X, WHEEL_CENTER_Y, FRONT_AXLE_Z]

    const upperInnerFront: P3 = [side * SHOCK_TOWER_X, UPPER_ARM_INNER_Y, SHOCK_TOWER_Z - ARM_PIVOT_SPREAD_Z]
    const upperInnerRear: P3 = [side * SHOCK_TOWER_X, UPPER_ARM_INNER_Y, SHOCK_TOWER_Z + ARM_PIVOT_SPREAD_Z]
    const upperBallJoint: P3 = [wheelX - side * BALL_JOINT_INSET_X, UPPER_BALL_JOINT_Y, FRONT_AXLE_Z]
    group.add(cylinderBetween(upperInnerFront, upperBallJoint, CONTROL_ARM_RADIUS, materials.steelDark))
    group.add(cylinderBetween(upperInnerRear, upperBallJoint, CONTROL_ARM_RADIUS, materials.steelDark))

    const lowerInnerFront: P3 = [side * FRAME_RAIL_X, LOWER_ARM_INNER_Y, FRONT_AXLE_Z - ARM_PIVOT_SPREAD_Z]
    const lowerInnerRear: P3 = [side * FRAME_RAIL_X, LOWER_ARM_INNER_Y, FRONT_AXLE_Z + ARM_PIVOT_SPREAD_Z]
    const lowerBallJoint: P3 = [wheelX - side * BALL_JOINT_INSET_X, LOWER_BALL_JOINT_Y, FRONT_AXLE_Z]
    group.add(cylinderBetween(lowerInnerFront, lowerBallJoint, CONTROL_ARM_RADIUS * 1.15, materials.steelDark))
    group.add(cylinderBetween(lowerInnerRear, lowerBallJoint, CONTROL_ARM_RADIUS * 1.15, materials.steelDark))

    const springBase: P3 = [side * SHOCK_TOWER_X, COIL_SPRING_BASE_Y, SHOCK_TOWER_Z]
    group.add(coilSpring(springBase, COIL_SPRING_DIAMETER, COIL_SPRING_HEIGHT, COIL_SPRING_TURNS, COIL_SPRING_WIRE_RADIUS, materials.steelBright))
    group.add(
      cylinderBetween(
        [side * SHOCK_TOWER_X, SHOCK_ABSORBER_BOTTOM_Y, SHOCK_TOWER_Z],
        [side * SHOCK_TOWER_X, SHOCK_ABSORBER_TOP_Y, SHOCK_TOWER_Z],
        SHOCK_ABSORBER_RADIUS,
        materials.steelDark,
      ),
    )

    const hub = cylinderBetween(
      [wheelX - side * (SPINDLE_INSET_X + SPINDLE_HUB_LENGTH), WHEEL_CENTER_Y, FRONT_AXLE_Z],
      [wheelX - side * SPINDLE_INSET_X, WHEEL_CENTER_Y, FRONT_AXLE_Z],
      SPINDLE_HUB_RADIUS,
      materials.steelDark,
      16,
    )
    group.add(hub)
    group.add(cylinderBetween(upperBallJoint, spindle, CONTROL_ARM_RADIUS * 0.8, materials.steelDark))
    group.add(cylinderBetween(lowerBallJoint, spindle, CONTROL_ARM_RADIUS * 0.8, materials.steelDark))

    group.add(
      cylinderBetween(lowerBallJoint, [side * FRAME_RAIL_X, LOWER_ARM_INNER_Y + 1, STRUT_ROD_FRAME_Z], STRUT_ROD_RADIUS, materials.steelDark),
    )
  }

  const barPoints: P3[] = [
    [-ANTI_ROLL_HALF_SPAN, ANTI_ROLL_Y, ANTI_ROLL_Z - ANTI_ROLL_END_LINK_DROP],
    [-ANTI_ROLL_HALF_SPAN, ANTI_ROLL_Y, ANTI_ROLL_Z],
    [ANTI_ROLL_HALF_SPAN, ANTI_ROLL_Y, ANTI_ROLL_Z],
    [ANTI_ROLL_HALF_SPAN, ANTI_ROLL_Y, ANTI_ROLL_Z - ANTI_ROLL_END_LINK_DROP],
  ]
  group.add(tubeAlong(barPoints, ANTI_ROLL_RADIUS, materials.steelDark, 20, 8))

  return group
}

// -------------------------------------------------------------------------------------------
// Steering
// -------------------------------------------------------------------------------------------

function buildSteering(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()

  const box = boxMesh(STEERING_BOX_SIZE[0], STEERING_BOX_SIZE[1], STEERING_BOX_SIZE[2], materials.steelDark, 0.4)
  box.position.set(...STEERING_BOX_POSITION)
  group.add(box)

  const pitmanEnd: P3 = [STEERING_BOX_POSITION[0] + 3, CENTER_LINK_Y, CENTER_LINK_Z]
  group.add(cylinderBetween(STEERING_BOX_POSITION, pitmanEnd, LINK_RADIUS, materials.steelDark))

  const idlerBase: P3 = [IDLER_ARM_X, STEERING_BOX_POSITION[1], STEERING_BOX_POSITION[2]]
  const idlerEnd: P3 = [IDLER_ARM_X - 3, CENTER_LINK_Y, CENTER_LINK_Z]
  const idlerPivot = boxMesh(1.5, 1.5, 1.5, materials.steelDark, 0.3)
  idlerPivot.position.set(...idlerBase)
  group.add(idlerPivot)
  group.add(cylinderBetween(idlerBase, idlerEnd, LINK_RADIUS, materials.steelDark))

  group.add(cylinderBetween(pitmanEnd, idlerEnd, LINK_RADIUS, materials.steelBright))

  for (const side of [-1, 1]) {
    const knuckleArm: P3 = [side * (WHEEL_CENTER_X_FRONT - 4), CENTER_LINK_Y, FRONT_AXLE_Z - 4]
    const linkEnd = side < 0 ? pitmanEnd : idlerEnd
    group.add(cylinderBetween(linkEnd, knuckleArm, LINK_RADIUS, materials.steelBright))
  }

  const columnTop = toVector3(STEERING_WHEEL_CENTER)
  const tilt = new THREE.Vector3(0, Math.cos(STEERING_WHEEL_TILT), Math.sin(STEERING_WHEEL_TILT))
  const columnHubEnd: P3 = [columnTop.x, columnTop.y - tilt.y * 4, columnTop.z - tilt.z * 4]
  group.add(cylinderBetween(STEERING_BOX_POSITION, columnHubEnd, STEERING_COLUMN_DIAMETER / 2, materials.steelDark, 12))

  return group
}

// -------------------------------------------------------------------------------------------
// Rear axle
// -------------------------------------------------------------------------------------------

function buildRearAxle(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()
  const center: P3 = [0, WHEEL_CENTER_Y, REAR_AXLE_Z]

  const pumpkinGeometry = new THREE.SphereGeometry(DIFFERENTIAL_DIAMETER / 2, 20, 14)
  pumpkinGeometry.scale(1, DIFFERENTIAL_FLATTEN_Y, DIFFERENTIAL_STRETCH_Z)
  const pumpkin = finishMesh(new THREE.Mesh(pumpkinGeometry, materials.castIron))
  pumpkin.position.set(...center)
  group.add(pumpkin)

  const boltRingRadius = BOLT_RING_DIAMETER / 2
  const boltRing = finishMesh(
    new THREE.Mesh(new THREE.TorusGeometry(boltRingRadius, BOLT_RING_THICKNESS / 2, 8, 20), materials.castIron),
  )
  boltRing.position.set(0, WHEEL_CENTER_Y, REAR_AXLE_Z + PINION_SNOUT_LENGTH * 0.4)
  group.add(boltRing)

  const snoutEnd: P3 = [0, WHEEL_CENTER_Y, REAR_AXLE_Z + PINION_SNOUT_LENGTH]
  group.add(cylinderBetween(center, snoutEnd, PINION_SNOUT_DIAMETER / 2, materials.castIron, 14))
  const yokeEnd: P3 = [0, WHEEL_CENTER_Y, REAR_AXLE_Z + PINION_SNOUT_LENGTH + YOKE_LENGTH]
  group.add(cylinderBetween(snoutEnd, yokeEnd, YOKE_DIAMETER / 2, materials.steelBright, 14))

  for (const side of [-1, 1]) {
    const tubeEnd: P3 = [side * (WHEEL_CENTER_X_REAR - AXLE_TUBE_INSET), WHEEL_CENTER_Y, REAR_AXLE_Z]
    group.add(cylinderBetween(center, tubeEnd, AXLE_TUBE_DIAMETER / 2, materials.steelDark, 14))

    const perch = boxMesh(SPRING_PERCH_SIZE[0], SPRING_PERCH_SIZE[1], SPRING_PERCH_SIZE[2], materials.steelDark, 0.2)
    perch.position.set(side * LEAF_SPRING_X, WHEEL_CENTER_Y + AXLE_TUBE_DIAMETER / 2 + SPRING_PERCH_SIZE[1] / 2, REAR_AXLE_Z)
    group.add(perch)
  }

  return group
}

// -------------------------------------------------------------------------------------------
// Leaf springs
// -------------------------------------------------------------------------------------------

function buildLeafSprings(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()
  const midZ = (LEAF_SPRING_FRONT_Z + LEAF_SPRING_REAR_Z) / 2

  for (const side of [-1, 1]) {
    for (let leaf = 0; leaf < LEAF_COUNT; leaf++) {
      const shrink = leaf * LEAF_LENGTH_STEP
      const frontZ = LEAF_SPRING_FRONT_Z - shrink * 0.3
      const rearZ = LEAF_SPRING_REAR_Z + shrink * 0.3
      const baseY = LEAF_SPRING_Y - leaf * (LEAF_THICKNESS + 0.05)
      const points: P3[] = [
        [side * LEAF_SPRING_X, baseY, frontZ],
        [side * LEAF_SPRING_X, baseY - LEAF_SAG, midZ],
        [side * LEAF_SPRING_X, baseY, rearZ],
      ]
      const leafMesh = tubeAlong(points, LEAF_WIDTH / 2, materials.steelBright, 16, 6)
      leafMesh.scale.y = LEAF_THICKNESS / (LEAF_WIDTH / 2)
      group.add(leafMesh)
    }

    const hanger = boxMesh(HANGER_SIZE[0], HANGER_SIZE[1], HANGER_SIZE[2], materials.steelDark, 0.2)
    hanger.position.set(side * LEAF_SPRING_X, LEAF_SPRING_Y + HANGER_SIZE[1] / 2, LEAF_SPRING_FRONT_Z)
    group.add(hanger)

    const shackle = boxMesh(SHACKLE_SIZE[0], SHACKLE_SIZE[1], SHACKLE_SIZE[2], materials.steelDark, 0.2)
    shackle.position.set(side * LEAF_SPRING_X, LEAF_SPRING_Y + SHACKLE_SIZE[1] / 2 - 1, LEAF_SPRING_REAR_Z)
    group.add(shackle)

    const uBolt = boxMesh(U_BOLT_PLATE_SIZE[0], U_BOLT_PLATE_SIZE[1], U_BOLT_PLATE_SIZE[2], materials.steelDark, 0.15)
    uBolt.position.set(side * LEAF_SPRING_X, LEAF_SPRING_Y - LEAF_SAG * 0.6, REAR_AXLE_Z)
    group.add(uBolt)

    const shockZ = REAR_AXLE_Z + (side < 0 ? -REAR_SHOCK_STAGGER_Z : REAR_SHOCK_STAGGER_Z)
    group.add(
      cylinderBetween(
        [side * LEAF_SPRING_X, LEAF_SPRING_Y, shockZ],
        [side * LEAF_SPRING_X, LEAF_SPRING_Y + REAR_SHOCK_LENGTH, shockZ],
        REAR_SHOCK_RADIUS,
        materials.steelDark,
      ),
    )
  }

  return group
}

// -------------------------------------------------------------------------------------------
// Driveshaft
// -------------------------------------------------------------------------------------------

function buildDriveshaft(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()
  const front: P3 = [0, DRIVESHAFT_Y, TRANSMISSION_REAR_Z]
  const rear: P3 = [0, DRIVESHAFT_Y, DRIVESHAFT_REAR_Z]
  group.add(cylinderBetween(front, rear, DRIVESHAFT_DIAMETER / 2, materials.steelBright, 14))

  for (const point of [front, rear]) {
    const cross = boxMesh(U_JOINT_LENGTH, U_JOINT_LENGTH, U_JOINT_LENGTH, materials.steelDark, 0.15)
    cross.position.set(...point)
    group.add(cross)
    const yoke = finishMesh(
      new THREE.Mesh(new THREE.CylinderGeometry(U_JOINT_RADIUS, U_JOINT_RADIUS, U_JOINT_LENGTH * 1.4, 12), materials.steelDark),
    )
    yoke.rotation.z = Math.PI / 2
    yoke.position.set(...point)
    group.add(yoke)
  }

  return group
}

// -------------------------------------------------------------------------------------------
// Exhaust system
// -------------------------------------------------------------------------------------------

function buildExhaustSystem(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()
  const mufflerFrontZ = MUFFLER_Z + MUFFLER_LENGTH / 2
  const mufflerRearZ = MUFFLER_Z - MUFFLER_LENGTH / 2

  for (const side of [-1, 1]) {
    const outlet: P3 = [side * HEADER_OUTLET_X, HEADER_OUTLET_Y, HEADER_OUTLET_Z]
    const bend: P3 = [side * EXHAUST_PIPE_X, EXHAUST_PIPE_Y, EXHAUST_BEND_Z]
    const mufflerFront: P3 = [side * EXHAUST_PIPE_X, EXHAUST_PIPE_Y, mufflerFrontZ]
    group.add(tubeAlong([outlet, bend, mufflerFront], EXHAUST_PIPE_DIAMETER / 2, materials.steelDark, 20, 8))

    const muffler = finishMesh(
      new THREE.Mesh(new THREE.CylinderGeometry(MUFFLER_DIAMETER / 2, MUFFLER_DIAMETER / 2, MUFFLER_LENGTH, 16), materials.steelBright),
    )
    muffler.scale.z = MUFFLER_FLATTEN_Y
    muffler.rotation.x = Math.PI / 2
    muffler.position.set(side * EXHAUST_PIPE_X, EXHAUST_PIPE_Y, MUFFLER_Z)
    group.add(muffler)

    const mufflerRear: P3 = [side * EXHAUST_PIPE_X, EXHAUST_PIPE_Y, mufflerRearZ]
    const overAxle: P3 = [side * EXHAUST_PIPE_X, EXHAUST_PIPE_Y - 0.5, REAR_AXLE_Z - 4]
    const tailEnd: P3 = [side * EXHAUST_TIP_X, EXHAUST_TIP_Y, TAILPIPE_END_Z]
    group.add(tubeAlong([mufflerRear, overAxle, tailEnd], EXHAUST_PIPE_DIAMETER / 2, materials.steelDark, 20, 8))

    for (const z of [mufflerFrontZ + 4, mufflerRearZ - 6]) {
      const hanger = boxMesh(EXHAUST_HANGER_SIZE[0], EXHAUST_HANGER_SIZE[1], EXHAUST_HANGER_SIZE[2], materials.rubber, 0.15)
      hanger.position.set(side * EXHAUST_PIPE_X, EXHAUST_PIPE_Y + MUFFLER_DIAMETER / 2, z)
      group.add(hanger)
    }
  }

  return group
}

// -------------------------------------------------------------------------------------------
// Fuel tank
// -------------------------------------------------------------------------------------------

function buildFuelTank(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()

  const tank = boxMesh(FUEL_TANK_SIZE[0], FUEL_TANK_SIZE[1], FUEL_TANK_SIZE[2], materials.steelDark, FUEL_TANK_CORNER_RADIUS)
  tank.position.set(...FUEL_TANK_CENTER)
  group.add(tank)

  const neckStart: P3 = [0, FUEL_TANK_CENTER[1] + FUEL_TANK_SIZE[1] / 2, FUEL_TANK_CENTER[2] - FUEL_TANK_SIZE[2] / 2 + 2]
  const neckEnd: P3 = [0, FUEL_CAP_Y, TAIL_Z + 2]
  group.add(tubeAlong([neckStart, neckEnd], FILLER_NECK_RADIUS, materials.steelDark, 10, 8))

  const senderPlate = finishMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(SENDER_PLATE_RADIUS, SENDER_PLATE_RADIUS, SENDER_PLATE_THICKNESS, 16), materials.steelBright),
  )
  senderPlate.position.set(0, FUEL_TANK_CENTER[1] + FUEL_TANK_SIZE[1] / 2 + SENDER_PLATE_THICKNESS / 2, FUEL_TANK_CENTER[2])
  group.add(senderPlate)

  return group
}

// -------------------------------------------------------------------------------------------
// Assembly
// -------------------------------------------------------------------------------------------

function finish(id: PartId, group: THREE.Group): PartBuild {
  group.name = id
  tagPart(group, id)
  return { id, objects: [group] }
}

export function buildChassis(materials: CarMaterials): PartBuild[] {
  return [
    finish('floorPan', buildFloorPan(materials)),
    finish('frontSuspension', buildFrontSuspension(materials)),
    finish('steering', buildSteering(materials)),
    finish('rearAxle', buildRearAxle(materials)),
    finish('leafSprings', buildLeafSprings(materials)),
    finish('driveshaft', buildDriveshaft(materials)),
    finish('exhaustSystem', buildExhaustSystem(materials)),
    finish('fuelTank', buildFuelTank(materials)),
  ]
}
