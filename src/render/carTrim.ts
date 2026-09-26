import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { CarMaterials } from './carMaterials.ts'
import { tagPart, type PartBuild } from './partBuild.ts'
import {
  BODY_HALF_WIDTH,
  BUMPER_CENTER_Y,
  BUMPER_HALF_WIDTH,
  BUMPER_HEIGHT,
  BUMPER_WRAP_DEPTH,
  DOOR_HANDLE_Y,
  DOOR_HANDLE_Z,
  EXHAUST_TIP_DIAMETER,
  EXHAUST_TIP_X,
  EXHAUST_TIP_Y,
  FRONT_BUMPER_Z,
  FUEL_CAP_DIAMETER,
  FUEL_CAP_Y,
  GRILLE_BOTTOM_Y,
  GRILLE_HALF_WIDTH,
  GRILLE_TOP_Y,
  GRILLE_Z,
  HEADLIGHT_DIAMETER,
  HEADLIGHT_INNER_X,
  HEADLIGHT_INNER_Z,
  HEADLIGHT_OUTER_X,
  HEADLIGHT_OUTER_Z,
  HEADLIGHT_Y,
  HOOD_FRONT_Y,
  HOOD_FRONT_Z,
  HOOD_PIN_X,
  HOOD_PIN_Z,
  HOOD_REAR_Y,
  HOOD_REAR_Z,
  HOOD_SCOOP_FRONT_Z,
  HOOD_SCOOP_HALF_WIDTH,
  HOOD_SCOOP_HEIGHT,
  HOOD_SCOOP_REAR_Z,
  MIRROR_X,
  MIRROR_Y,
  MIRROR_Z,
  REAR_BUMPER_Z,
  SIDE_SCOOP_HEIGHT,
  SIDE_SCOOP_LENGTH,
  SIDE_SCOOP_Y,
  SIDE_SCOOP_Z,
  TAILLIGHT_BAR_GAP,
  TAILLIGHT_BAR_HEIGHT,
  TAILLIGHT_BAR_WIDTH,
  TAILLIGHT_CENTER_X,
  TAILLIGHT_Y,
  TAILLIGHT_Z,
  TAIL_Z,
  WINDSHIELD_BASE_Y,
  WINDSHIELD_BASE_Z,
} from '../car/dimensions.ts'

/**
 * The bright and black-out trim that dresses the 1969 SportsRoof: the grille, lights, bumpers,
 * the Boss 429 hood scoop and pins, the Mach 1 quarter scoops, mirrors, handles, fuel cap,
 * exhaust tips and wipers. Everything here is small, separately explodable hardware bolted or
 * clipped to the body panels built in `carBody.ts` (not read by this file).
 *
 * Chrome pieces get real detail rather than flat shiny boxes: rounded edges (`RoundedBoxGeometry`
 * or a bevelled `ExtrudeGeometry`), bezel rings, a fluted lens over the lights and a genuine
 * hexagonal honeycomb behind the grille surround.
 */

// -------------------------------------------------------------------------------------------
// Trim-only tuning constants. Everything shared across builders (position, size) lives in
// `car/dimensions.ts`; these are geometry choices local to how this file models each part.
// -------------------------------------------------------------------------------------------

/** Chrome ring around the grille opening, and how many honeycomb cells fill it (spec: ~12 x 4). */
const GRILLE_SURROUND_WIDTH = 0.8
const GRILLE_SURROUND_DEPTH = 2
const GRILLE_HEX_COLS = 12
const GRILLE_HEX_ROWS = 4
const GRILLE_HEX_DEPTH = 1.6
/** The running-horse emblem plate, offset to the driver side. */
const EMBLEM_WIDTH = 4
const EMBLEM_HEIGHT = 2
const EMBLEM_X = -12
const EMBLEM_Y = 26.5

/** Headlight bezel, reflector and lens tuning (shared by the outer and inner units). */
const HEADLIGHT_BEZEL_THICKNESS = 0.6
const HEADLIGHT_LENS_BULGE = 0.55
const HEADLIGHT_FLUTE_COUNT = 18
const HEADLIGHT_FLUTE_DEPTH = 0.05
const HEADLIGHT_BUCKET_DEPTH = 3.4
const HEADLIGHT_FILAMENT_RADIUS = 0.5

/** Taillight bezel frame and lens tuning. */
const TAILLIGHT_BEZEL_WIDTH = 0.7
const TAILLIGHT_FRAME_DEPTH = 1
const TAILLIGHT_LENS_BULGE = 0.35
const TAILLIGHT_FLUTE_COUNT = 6
const TAILLIGHT_FLUTE_DEPTH = 0.06

/** Bumper blade cross-section and its hardware. */
const BUMPER_DEPTH = 2.2
const BUMPER_CORNER_RADIUS = 1
const BUMPER_GUARD_X = 14
const BUMPER_GUARD_HEIGHT = 4
const LICENSE_PLATE_WIDTH = 12
const LICENSE_PLATE_HEIGHT = 6
const LICENSE_PLATE_FRAME_WIDTH = 0.6

/** Hood scoop shell wall thickness and how far the dark interior is inset from the mouth. */
const HOOD_SCOOP_WALL = 1
const HOOD_SCOOP_OPENING_INSET = 0.8

/** Hood pin hardware: scuff plate, post, hairpin clip and its tethered cable. */
const HOOD_PIN_PLATE_DIAMETER = 2.5
const HOOD_PIN_POST_HEIGHT = 1.4
const HOOD_PIN_POST_DIAMETER = 0.5
const HOOD_PIN_CABLE_SAG = 1.2

/** Quarter (side) scoop stand-off and how far its dark opening is inset from the blister's edge. */
const SIDE_SCOOP_PROUD = 1.2
const SIDE_SCOOP_OPENING_INSET = 0.5

/** Bullet mirror proportions. */
const MIRROR_BODY_LENGTH = 5.5
const MIRROR_BODY_RADIUS = 1.4
const MIRROR_FACE_RADIUS = 1.1
const MIRROR_STALK_LENGTH = 3
const MIRROR_STALK_RADIUS = 0.45
const MIRROR_BASE_RADIUS = 1.2

/** Door handle proportions; the lock cylinder sits this far below the handle, driver side only. */
const DOOR_HANDLE_BAR_LENGTH = 6
const DOOR_HANDLE_BAR_RADIUS = 0.35
const DOOR_HANDLE_BUTTON_RADIUS = 0.7
const DOOR_HANDLE_LOCK_DROP = 3

/** Fuel cap hardware. */
const FUEL_CAP_RIM_HEIGHT = 0.5
const FUEL_CAP_HINGE_SIZE = 0.8

/** Exhaust tip proportions: 5 in long per the spec, with a thin wall around the dark bore. */
const EXHAUST_TIP_LENGTH = 5
const EXHAUST_TIP_WALL = 0.25

/** Wiper pivots (through the cowl) and the parked span each arm sweeps from. */
const WIPER_PIVOT_LEFT_X = -14
const WIPER_PIVOT_RIGHT_X = 10
const WIPER_LEFT_SPAN: readonly [number, number] = [-24, -4]
const WIPER_RIGHT_SPAN: readonly [number, number] = [0, 20]
const WIPER_BLADE_HEIGHT = 0.9
const WIPER_BLADE_THICKNESS = 0.25

// -------------------------------------------------------------------------------------------
// Small geometry helpers shared by several parts below.
// -------------------------------------------------------------------------------------------

/** Sets the standard shadow flags for every mesh under `object` (glass and lenses pass `false`). */
function finish<T extends THREE.Object3D>(object: T, castsShadow = true): T {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = castsShadow
      child.receiveShadow = true
    }
  })
  return object
}

/** Height of the hood's outer skin at a given z: the linear fall from the cowl to the nose. */
function hoodSurfaceY(z: number): number {
  const t = (z - HOOD_REAR_Z) / (HOOD_FRONT_Z - HOOD_REAR_Z)
  return THREE.MathUtils.lerp(HOOD_REAR_Y, HOOD_FRONT_Y, THREE.MathUtils.clamp(t, 0, 1))
}

/** Draws a rounded-rectangle outline into a Shape (outer boundary) or a Path (a hole). */
function roundedRectOutline(target: THREE.Path, width: number, height: number, radius: number): void {
  const hw = width / 2
  const hh = height / 2
  const r = Math.min(radius, hw, hh)
  target.moveTo(-hw + r, -hh)
  target.lineTo(hw - r, -hh)
  target.quadraticCurveTo(hw, -hh, hw, -hh + r)
  target.lineTo(hw, hh - r)
  target.quadraticCurveTo(hw, hh, hw - r, hh)
  target.lineTo(-hw + r, hh)
  target.quadraticCurveTo(-hw, hh, -hw, hh - r)
  target.lineTo(-hw, -hh + r)
  target.quadraticCurveTo(-hw, -hh, -hw + r, -hh)
}

/** A flat rounded-rectangle ring frame (outer minus inner), bevelled and extruded: chrome bezels. */
function buildFrame(
  outerWidth: number,
  outerHeight: number,
  innerWidth: number,
  innerHeight: number,
  cornerRadius: number,
  depth: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  roundedRectOutline(shape, outerWidth, outerHeight, cornerRadius)
  const hole = new THREE.Path()
  roundedRectOutline(hole, innerWidth, innerHeight, Math.max(cornerRadius - 0.3, 0.1))
  shape.holes.push(hole)
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.15,
    bevelSize: 0.15,
    bevelSegments: 2,
    curveSegments: 10,
  })
  geometry.translate(0, 0, -depth / 2)
  return geometry
}

/** The rounded-rectangle profile used as a bumper blade's cross-section, as loft points. */
function roundedRectProfile(width: number, height: number, radius: number): THREE.Vector2[] {
  const shape = new THREE.Shape()
  roundedRectOutline(shape, width, height, radius)
  return shape.getPoints(4)
}

/** A rounded-rectangle ring at a given z used as one loft station (see `loftStations`). */
function roundedRectRing(halfWidth: number, bottom: number, top: number, radius: number): THREE.Vector2[] {
  const shape = new THREE.Shape()
  const height = top - bottom
  roundedRectOutline(shape, halfWidth * 2, height, Math.min(radius, halfWidth, height / 2))
  const midY = (top + bottom) / 2
  return shape.getPoints(4).map((p) => new THREE.Vector2(p.x, p.y + midY))
}

/**
 * Extrudes a 2D cross-section along a 3D path using a stable frame (the path's tangent crossed
 * with world up) instead of a Frenet frame, so a mostly horizontal path does not twist the
 * profile. Leaves both ends open (the bumper's wrapped ends tuck behind the fenders).
 */
function loftAlongPath(profile: readonly THREE.Vector2[], path: THREE.Curve<THREE.Vector3>, steps: number): THREE.BufferGeometry {
  const up = new THREE.Vector3(0, 1, 0)
  const positions: number[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const point = path.getPointAt(t)
    const tangent = path.getTangentAt(t).normalize()
    let binormal = new THREE.Vector3().crossVectors(tangent, up)
    if (binormal.lengthSq() < 1e-6) binormal = new THREE.Vector3(1, 0, 0)
    binormal.normalize()
    const normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize()
    for (const p of profile) {
      const vertex = point.clone().addScaledVector(binormal, p.x).addScaledVector(normal, p.y)
      positions.push(vertex.x, vertex.y, vertex.z)
    }
  }
  return ringsToGeometry(positions, profile.length, steps)
}

/** Lofts a stack of same-size rings, each at its own z, into one tapering shell (no caps). */
function loftStations(stations: readonly { z: number; ring: readonly THREE.Vector2[] }[]): THREE.BufferGeometry {
  const ringSize = stations[0]?.ring.length ?? 0
  const positions: number[] = []
  for (const station of stations) {
    for (const point of station.ring) positions.push(point.x, point.y, station.z)
  }
  return ringsToGeometry(positions, ringSize, stations.length - 1)
}

/** Shared triangulation for a stack of `steps + 1` same-size rings already flattened into `positions`. */
function ringsToGeometry(positions: number[], ringSize: number, steps: number): THREE.BufferGeometry {
  const indices: number[] = []
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < ringSize; j++) {
      const jn = (j + 1) % ringSize
      const a = i * ringSize + j
      const b = i * ringSize + jn
      const c = (i + 1) * ringSize + j
      const d = (i + 1) * ringSize + jn
      indices.push(a, c, b, b, c, d)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** A honeycomb of open hexagonal cells (hollow tubes) filling a rectangle, with round cut-outs. */
function buildHoneycomb(
  width: number,
  height: number,
  cellRadius: number,
  depth: number,
  holes: readonly { x: number; y: number; radius: number }[],
): THREE.BufferGeometry {
  const colSpacing = cellRadius * 1.5
  const rowSpacing = cellRadius * Math.sqrt(3)
  const cols = Math.ceil(width / colSpacing) + 2
  const rows = Math.ceil(height / rowSpacing) + 2
  const cells: THREE.BufferGeometry[] = []
  for (let row = 0; row < rows; row++) {
    const y = -height / 2 + row * rowSpacing
    if (y > height / 2) continue
    const xOffset = row % 2 === 0 ? 0 : colSpacing / 2
    for (let col = 0; col < cols; col++) {
      const x = -width / 2 + col * colSpacing + xOffset
      if (x < -width / 2 || x > width / 2) continue
      if (holes.some((hole) => Math.hypot(x - hole.x, y - hole.y) < hole.radius)) continue
      const cell = new THREE.CylinderGeometry(cellRadius * 0.95, cellRadius * 0.95, depth, 6, 1, true)
      cell.rotateX(Math.PI / 2)
      cell.rotateZ(Math.PI / 6)
      cell.translate(x, y, 0)
      cells.push(cell)
    }
  }
  return mergeGeometries(cells, false)
}

/** A round, slightly domed lens with fine ridges radiating from its centre (headlights). */
function buildRoundFlutedLens(radius: number, bulge: number, flutes: number, fluteDepth: number): THREE.BufferGeometry {
  const geometry = new THREE.CircleGeometry(radius, 40)
  const position = geometry.attributes.position
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    const r = Math.hypot(x, y) / radius
    const theta = Math.atan2(y, x)
    const dome = bulge * (1 - r * r)
    const ripple = fluteDepth * Math.sin(theta * flutes) * r
    position.setZ(i, dome + ripple)
  }
  geometry.computeVertexNormals()
  return geometry
}

/** A rectangular, slightly domed lens with fine horizontal or vertical ridges (taillights). */
function buildFlutedLens(
  width: number,
  height: number,
  bulge: number,
  flutes: number,
  fluteDepth: number,
  direction: 'vertical' | 'horizontal',
): THREE.BufferGeometry {
  const segments = 12
  const geometry = new THREE.PlaneGeometry(width, height, segments, segments)
  const position = geometry.attributes.position
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    const nx = x / (width / 2)
    const ny = y / (height / 2)
    const dome = bulge * (1 - nx * nx) * (1 - ny * ny)
    const rippleCoord = direction === 'vertical' ? nx : ny
    const ripple = fluteDepth * Math.sin(rippleCoord * flutes * Math.PI)
    position.setZ(i, dome + ripple)
  }
  geometry.computeVertexNormals()
  return geometry
}

// -------------------------------------------------------------------------------------------
// Grille
// -------------------------------------------------------------------------------------------

function buildGrille(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()
  const centerY = (GRILLE_TOP_Y + GRILLE_BOTTOM_Y) / 2
  const width = GRILLE_HALF_WIDTH * 2
  const height = GRILLE_TOP_Y - GRILLE_BOTTOM_Y
  const innerWidth = width - GRILLE_SURROUND_WIDTH * 2
  const innerHeight = height - GRILLE_SURROUND_WIDTH * 2

  const frame = finish(new THREE.Mesh(buildFrame(width, height, innerWidth, innerHeight, 1.5, GRILLE_SURROUND_DEPTH), materials.chrome))
  frame.position.set(0, centerY, GRILLE_Z)
  group.add(frame)

  const cellRadiusFromWidth = innerWidth / (GRILLE_HEX_COLS * 1.5)
  const cellRadiusFromHeight = innerHeight / (GRILLE_HEX_ROWS * Math.sqrt(3))
  const cellRadius = (cellRadiusFromWidth + cellRadiusFromHeight) / 2
  const holes = [
    { x: -HEADLIGHT_INNER_X, y: HEADLIGHT_Y - centerY, radius: HEADLIGHT_DIAMETER / 2 + 0.5 },
    { x: HEADLIGHT_INNER_X, y: HEADLIGHT_Y - centerY, radius: HEADLIGHT_DIAMETER / 2 + 0.5 },
  ]
  const honeycomb = finish(new THREE.Mesh(buildHoneycomb(innerWidth - 0.5, innerHeight - 0.5, cellRadius, GRILLE_HEX_DEPTH, holes), materials.blackTrim))
  honeycomb.position.set(0, centerY, GRILLE_Z - GRILLE_SURROUND_DEPTH / 2 - GRILLE_HEX_DEPTH / 2 - 0.3)
  group.add(honeycomb)

  const backing = finish(new THREE.Mesh(new THREE.PlaneGeometry(innerWidth, innerHeight), materials.blackTrim))
  backing.position.set(0, centerY, GRILLE_Z - GRILLE_SURROUND_DEPTH / 2 - GRILLE_HEX_DEPTH - 1)
  group.add(backing)

  const emblem = finish(new THREE.Mesh(new RoundedBoxGeometry(EMBLEM_WIDTH, EMBLEM_HEIGHT, 0.3, 2, 0.15), materials.chrome))
  emblem.position.set(EMBLEM_X, EMBLEM_Y, GRILLE_Z + GRILLE_SURROUND_DEPTH / 2 + 0.2)
  group.add(emblem)

  return group
}

// -------------------------------------------------------------------------------------------
// Headlights
// -------------------------------------------------------------------------------------------

/** One sealed-beam unit: chrome bezel, concave reflector, filament and a fluted lens, facing +z. */
function buildHeadlightUnit(materials: CarMaterials, hasBucket: boolean): THREE.Group {
  const group = new THREE.Group()
  const radius = HEADLIGHT_DIAMETER / 2

  const bezel = finish(new THREE.Mesh(new THREE.TorusGeometry(radius - HEADLIGHT_BEZEL_THICKNESS / 2, HEADLIGHT_BEZEL_THICKNESS / 2, 10, 24), materials.chrome))
  group.add(bezel)

  const dishProfile = [
    new THREE.Vector2(0, -HEADLIGHT_BUCKET_DEPTH * 0.4),
    new THREE.Vector2(radius * 0.3, -HEADLIGHT_BUCKET_DEPTH * 0.35),
    new THREE.Vector2(radius * 0.75, -HEADLIGHT_BUCKET_DEPTH * 0.15),
    new THREE.Vector2(radius - HEADLIGHT_BEZEL_THICKNESS, 0),
  ]
  const dishGeometry = new THREE.LatheGeometry(dishProfile, 24)
  dishGeometry.rotateX(Math.PI / 2)
  const dish = finish(new THREE.Mesh(dishGeometry, materials.chrome))
  group.add(dish)

  const filament = finish(new THREE.Mesh(new THREE.SphereGeometry(HEADLIGHT_FILAMENT_RADIUS, 10, 8), materials.headlightBulb))
  filament.position.z = -HEADLIGHT_BUCKET_DEPTH * 0.3
  group.add(filament)

  const lens = finish(new THREE.Mesh(buildRoundFlutedLens(radius - 0.1, HEADLIGHT_LENS_BULGE, HEADLIGHT_FLUTE_COUNT, HEADLIGHT_FLUTE_DEPTH), materials.headlightLens), false)
  group.add(lens)

  if (hasBucket) {
    const bucketGeometry = new THREE.CylinderGeometry(radius, radius, HEADLIGHT_BUCKET_DEPTH, 24, 1, true)
    bucketGeometry.rotateX(Math.PI / 2)
    bucketGeometry.translate(0, 0, -HEADLIGHT_BUCKET_DEPTH / 2)
    const bucket = finish(new THREE.Mesh(bucketGeometry, materials.chrome))
    group.add(bucket)

    const backCap = finish(new THREE.Mesh(new THREE.CircleGeometry(radius, 24), materials.chrome))
    backCap.rotation.y = Math.PI
    backCap.position.z = -HEADLIGHT_BUCKET_DEPTH
    group.add(backCap)
  }

  return group
}

function buildHeadlightSide(materials: CarMaterials, sign: number): THREE.Group {
  const group = new THREE.Group()

  const outer = buildHeadlightUnit(materials, true)
  outer.position.set(sign * HEADLIGHT_OUTER_X, HEADLIGHT_Y, HEADLIGHT_OUTER_Z)
  group.add(outer)

  const inner = buildHeadlightUnit(materials, false)
  inner.position.set(sign * HEADLIGHT_INNER_X, HEADLIGHT_Y, HEADLIGHT_INNER_Z)
  group.add(inner)

  return group
}

// -------------------------------------------------------------------------------------------
// Taillights
// -------------------------------------------------------------------------------------------

function buildTaillightCluster(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()
  const clusterWidth = 3 * TAILLIGHT_BAR_WIDTH + 2 * TAILLIGHT_BAR_GAP

  const frame = finish(
    new THREE.Mesh(
      buildFrame(
        clusterWidth + TAILLIGHT_BEZEL_WIDTH * 2,
        TAILLIGHT_BAR_HEIGHT + TAILLIGHT_BEZEL_WIDTH * 2,
        clusterWidth,
        TAILLIGHT_BAR_HEIGHT,
        0.6,
        TAILLIGHT_FRAME_DEPTH,
      ),
      materials.chrome,
    ),
  )
  group.add(frame)

  const backing = finish(new THREE.Mesh(new THREE.BoxGeometry(clusterWidth, TAILLIGHT_BAR_HEIGHT, 0.4), materials.blackTrim))
  backing.position.z = -0.8
  group.add(backing)

  for (let i = 0; i < 3; i++) {
    const barX = (i - 1) * (TAILLIGHT_BAR_WIDTH + TAILLIGHT_BAR_GAP)
    const lensGeometry = buildFlutedLens(
      TAILLIGHT_BAR_WIDTH - 0.3,
      TAILLIGHT_BAR_HEIGHT - 0.4,
      TAILLIGHT_LENS_BULGE,
      TAILLIGHT_FLUTE_COUNT,
      TAILLIGHT_FLUTE_DEPTH,
      'horizontal',
    )
    lensGeometry.rotateY(Math.PI)
    const lens = finish(new THREE.Mesh(lensGeometry, materials.taillightLens), false)
    lens.position.set(barX, 0, 0.3)
    group.add(lens)
  }

  return group
}

// -------------------------------------------------------------------------------------------
// Bumpers
// -------------------------------------------------------------------------------------------

function buildBumper(materials: CarMaterials, z: number, wrapSign: 1 | -1, withGuards: boolean): THREE.Group {
  const half = BUMPER_HALF_WIDTH
  const wrap = BUMPER_WRAP_DEPTH
  const y = BUMPER_CENTER_Y

  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-half, y, z + wrapSign * wrap),
    new THREE.Vector3(-half * 0.9, y, z + wrapSign * wrap * 0.15),
    new THREE.Vector3(0, y, z),
    new THREE.Vector3(half * 0.9, y, z + wrapSign * wrap * 0.15),
    new THREE.Vector3(half, y, z + wrapSign * wrap),
  ])
  const profile = roundedRectProfile(BUMPER_DEPTH, BUMPER_HEIGHT, BUMPER_CORNER_RADIUS)
  const blade = finish(new THREE.Mesh(loftAlongPath(profile, path, 48), materials.chrome))

  const group = new THREE.Group()
  group.add(blade)

  if (withGuards) {
    for (const sign of [-1, 1]) {
      const guard = finish(new THREE.Mesh(new RoundedBoxGeometry(1.6, BUMPER_GUARD_HEIGHT, BUMPER_DEPTH + 0.6, 3, 0.5), materials.chrome))
      guard.position.set(sign * BUMPER_GUARD_X, y + BUMPER_GUARD_HEIGHT / 2 - BUMPER_HEIGHT / 2, z + wrapSign * 0.2)
      group.add(guard)
    }
  }

  return group
}

function buildFrontBumper(materials: CarMaterials): THREE.Group {
  const group = buildBumper(materials, FRONT_BUMPER_Z, -1, true)

  const plateBacking = finish(new THREE.Mesh(new RoundedBoxGeometry(LICENSE_PLATE_WIDTH, LICENSE_PLATE_HEIGHT, 0.3, 2, 0.2), materials.blackTrim))
  plateBacking.position.set(0, BUMPER_CENTER_Y, FRONT_BUMPER_Z + 0.6)
  group.add(plateBacking)

  const plateFrame = finish(
    new THREE.Mesh(
      buildFrame(
        LICENSE_PLATE_WIDTH + LICENSE_PLATE_FRAME_WIDTH * 2,
        LICENSE_PLATE_HEIGHT + LICENSE_PLATE_FRAME_WIDTH * 2,
        LICENSE_PLATE_WIDTH,
        LICENSE_PLATE_HEIGHT,
        0.4,
        0.3,
      ),
      materials.chrome,
    ),
  )
  plateFrame.position.set(0, BUMPER_CENTER_Y, FRONT_BUMPER_Z + 0.45)
  group.add(plateFrame)

  return group
}

function buildRearBumper(materials: CarMaterials): THREE.Group {
  return buildBumper(materials, REAR_BUMPER_Z, 1, false)
}

// -------------------------------------------------------------------------------------------
// Hood scoop
// -------------------------------------------------------------------------------------------

function buildHoodScoop(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()
  const rearBase = hoodSurfaceY(HOOD_SCOOP_REAR_Z) - 0.5
  const frontBase = hoodSurfaceY(HOOD_SCOOP_FRONT_Z) - 0.5
  const z0 = HOOD_SCOOP_REAR_Z
  const z1 = HOOD_SCOOP_FRONT_Z
  const midA = 0.4
  const midB = 0.75
  const baseAtA = THREE.MathUtils.lerp(rearBase, frontBase, midA)
  const baseAtB = THREE.MathUtils.lerp(rearBase, frontBase, midB)

  const stations = [
    { z: z0, ring: roundedRectRing(HOOD_SCOOP_HALF_WIDTH * 0.55, rearBase, rearBase + 0.3, 0.3) },
    { z: THREE.MathUtils.lerp(z0, z1, midA), ring: roundedRectRing(HOOD_SCOOP_HALF_WIDTH * 0.85, baseAtA, baseAtA + HOOD_SCOOP_HEIGHT * 0.55, 1) },
    { z: THREE.MathUtils.lerp(z0, z1, midB), ring: roundedRectRing(HOOD_SCOOP_HALF_WIDTH * 0.97, baseAtB, baseAtB + HOOD_SCOOP_HEIGHT * 0.88, 1.2) },
    { z: z1, ring: roundedRectRing(HOOD_SCOOP_HALF_WIDTH, frontBase, frontBase + HOOD_SCOOP_HEIGHT, 1.4) },
  ]

  const shell = finish(new THREE.Mesh(loftStations(stations), materials.paint))
  group.add(shell)

  const openingHeight = HOOD_SCOOP_HEIGHT - HOOD_SCOOP_OPENING_INSET
  const openingWidth = HOOD_SCOOP_HALF_WIDTH * 2 - HOOD_SCOOP_OPENING_INSET * 2
  const interior = finish(new THREE.Mesh(new THREE.PlaneGeometry(openingWidth, openingHeight), materials.satinBlack))
  interior.position.set(0, frontBase + openingHeight / 2 + HOOD_SCOOP_OPENING_INSET / 2, z1 - HOOD_SCOOP_WALL)
  group.add(interior)

  return group
}

// -------------------------------------------------------------------------------------------
// Hood pins
// -------------------------------------------------------------------------------------------

function buildHoodPin(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()
  const baseY = hoodSurfaceY(HOOD_PIN_Z) + 0.2

  const plate = finish(new THREE.Mesh(new THREE.CylinderGeometry(HOOD_PIN_PLATE_DIAMETER / 2, HOOD_PIN_PLATE_DIAMETER / 2, 0.25, 20), materials.chrome))
  plate.position.y = baseY + 0.125
  group.add(plate)

  const postBaseY = baseY + 0.25
  const post = finish(new THREE.Mesh(new THREE.CylinderGeometry(HOOD_PIN_POST_DIAMETER / 2, HOOD_PIN_POST_DIAMETER / 2, HOOD_PIN_POST_HEIGHT, 12), materials.chrome))
  post.position.y = postBaseY + HOOD_PIN_POST_HEIGHT / 2
  group.add(post)

  const postTopY = postBaseY + HOOD_PIN_POST_HEIGHT
  const clipCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.5, postTopY, 0),
    new THREE.Vector3(0.9, postTopY + 0.6, 0.1),
    new THREE.Vector3(0.5, postTopY + 1.1, 0.2),
    new THREE.Vector3(0.1, postTopY + 0.6, 0.1),
  ])
  const clip = finish(new THREE.Mesh(new THREE.TubeGeometry(clipCurve, 24, 0.09, 8, false), materials.chrome))
  group.add(clip)

  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.9, postTopY + 0.4, 0.1),
    new THREE.Vector3(2, postTopY - HOOD_PIN_CABLE_SAG, 0.3),
    new THREE.Vector3(3.2, postTopY, 0.1),
  ])
  const cable = finish(new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 20, 0.06, 6, false), materials.blackTrim))
  group.add(cable)

  return group
}

// -------------------------------------------------------------------------------------------
// Side (quarter) scoops
// -------------------------------------------------------------------------------------------

function buildSideScoop(materials: CarMaterials, sign: number): THREE.Group {
  const group = new THREE.Group()

  const blister = finish(new THREE.Mesh(new RoundedBoxGeometry(SIDE_SCOOP_PROUD, SIDE_SCOOP_HEIGHT, SIDE_SCOOP_LENGTH, 3, 0.5), materials.paint))
  blister.position.x = sign * (SIDE_SCOOP_PROUD / 2)
  group.add(blister)

  const opening = finish(
    new THREE.Mesh(new THREE.PlaneGeometry(SIDE_SCOOP_PROUD - SIDE_SCOOP_OPENING_INSET, SIDE_SCOOP_HEIGHT - SIDE_SCOOP_OPENING_INSET), materials.blackTrim),
  )
  opening.position.set(sign * (SIDE_SCOOP_PROUD / 2), 0, SIDE_SCOOP_LENGTH / 2 - 0.15)
  group.add(opening)

  return group
}

// -------------------------------------------------------------------------------------------
// Mirrors
// -------------------------------------------------------------------------------------------

function buildMirror(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()

  const bodyProfile = [
    new THREE.Vector2(0, MIRROR_BODY_LENGTH / 2),
    new THREE.Vector2(MIRROR_BODY_RADIUS * 0.5, MIRROR_BODY_LENGTH * 0.25),
    new THREE.Vector2(MIRROR_BODY_RADIUS, -MIRROR_BODY_LENGTH * 0.1),
    new THREE.Vector2(MIRROR_BODY_RADIUS * 0.85, -MIRROR_BODY_LENGTH / 2),
  ]
  const bodyGeometry = new THREE.LatheGeometry(bodyProfile, 20)
  bodyGeometry.rotateX(Math.PI / 2)
  const body = finish(new THREE.Mesh(bodyGeometry, materials.paint))
  group.add(body)

  const face = finish(new THREE.Mesh(new THREE.CircleGeometry(MIRROR_FACE_RADIUS, 20), materials.chrome))
  face.rotation.y = Math.PI
  face.position.z = -MIRROR_BODY_LENGTH / 2 + 0.05
  group.add(face)

  const stalk = finish(new THREE.Mesh(new THREE.CylinderGeometry(MIRROR_STALK_RADIUS, MIRROR_STALK_RADIUS * 1.3, MIRROR_STALK_LENGTH, 10), materials.paint))
  stalk.rotation.x = Math.PI / 2.6
  stalk.position.set(0, -MIRROR_STALK_LENGTH / 2.4, -MIRROR_STALK_LENGTH / 3)
  group.add(stalk)

  const base = finish(new THREE.Mesh(new THREE.CylinderGeometry(MIRROR_BASE_RADIUS, MIRROR_BASE_RADIUS * 1.1, 0.5, 12), materials.paint))
  base.position.y = -MIRROR_STALK_LENGTH * 0.85
  group.add(base)

  return group
}

// -------------------------------------------------------------------------------------------
// Door handles
// -------------------------------------------------------------------------------------------

function buildDoorHandle(materials: CarMaterials, sign: number): THREE.Group {
  const group = new THREE.Group()

  const bar = finish(new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.9, DOOR_HANDLE_BAR_LENGTH, 3, DOOR_HANDLE_BAR_RADIUS), materials.chrome))
  group.add(bar)

  const button = finish(new THREE.Mesh(new THREE.CylinderGeometry(DOOR_HANDLE_BUTTON_RADIUS, DOOR_HANDLE_BUTTON_RADIUS, 0.4, 14), materials.chrome))
  button.rotation.z = Math.PI / 2
  button.position.set(-0.6, 0, 0)
  group.add(button)

  if (sign < 0) {
    const lock = finish(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 12), materials.chrome))
    lock.rotation.z = Math.PI / 2
    lock.position.set(0, -DOOR_HANDLE_LOCK_DROP, 0)
    group.add(lock)
  }

  return group
}

// -------------------------------------------------------------------------------------------
// Fuel cap
// -------------------------------------------------------------------------------------------

function buildFuelCap(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()
  const radius = FUEL_CAP_DIAMETER / 2

  const cap = finish(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.6, 24), materials.chrome))
  cap.rotation.x = Math.PI / 2
  group.add(cap)

  const rim = finish(new THREE.Mesh(new THREE.TorusGeometry(radius - 0.15, FUEL_CAP_RIM_HEIGHT / 2, 10, 24), materials.chrome))
  rim.position.z = -0.3
  group.add(rim)

  const hinge = finish(new THREE.Mesh(new RoundedBoxGeometry(FUEL_CAP_HINGE_SIZE, FUEL_CAP_HINGE_SIZE, 0.3, 2, 0.1), materials.chrome))
  hinge.position.set(0, radius - 0.1, -0.3)
  group.add(hinge)

  return group
}

// -------------------------------------------------------------------------------------------
// Exhaust tips
// -------------------------------------------------------------------------------------------

function buildExhaustTip(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()
  const radius = EXHAUST_TIP_DIAMETER / 2

  const tube = finish(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.05, EXHAUST_TIP_LENGTH, 20, 1, true), materials.chrome))
  tube.rotation.x = Math.PI / 2
  group.add(tube)

  const bore = finish(new THREE.Mesh(new THREE.CircleGeometry(radius - EXHAUST_TIP_WALL, 20), materials.blackTrim))
  bore.rotation.y = Math.PI
  bore.position.z = -EXHAUST_TIP_LENGTH / 2 + 0.02
  group.add(bore)

  return group
}

// -------------------------------------------------------------------------------------------
// Wipers
// -------------------------------------------------------------------------------------------

function buildWiperArm(materials: CarMaterials, pivotX: number, restX: number): THREE.Group {
  const group = new THREE.Group()
  const length = Math.abs(restX - pivotX)
  const direction = Math.sign(restX - pivotX)

  const armGeometry = new RoundedBoxGeometry(length, 0.4, 0.5, 2, 0.15)
  armGeometry.translate((direction * length) / 2, 0, 0)
  const arm = finish(new THREE.Mesh(armGeometry, materials.blackTrim))
  group.add(arm)

  const pivotNut = finish(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.5, 12), materials.chrome))
  pivotNut.rotation.x = Math.PI / 2
  group.add(pivotNut)

  const bladeLength = length * 0.94
  const bladeGeometry = new RoundedBoxGeometry(bladeLength, WIPER_BLADE_HEIGHT, WIPER_BLADE_THICKNESS, 2, 0.08)
  bladeGeometry.translate(direction * (length * 0.06 + bladeLength / 2), -WIPER_BLADE_HEIGHT / 2 - 0.25, 0)
  const blade = finish(new THREE.Mesh(bladeGeometry, materials.rubber))
  group.add(blade)

  return group
}

function buildWipers(materials: CarMaterials): THREE.Group {
  const group = new THREE.Group()
  const y = WINDSHIELD_BASE_Y + 0.6
  const z = WINDSHIELD_BASE_Z

  const left = buildWiperArm(materials, WIPER_PIVOT_LEFT_X, WIPER_LEFT_SPAN[0])
  left.position.set(WIPER_PIVOT_LEFT_X, y, z)
  group.add(left)

  const right = buildWiperArm(materials, WIPER_PIVOT_RIGHT_X, WIPER_RIGHT_SPAN[1])
  right.position.set(WIPER_PIVOT_RIGHT_X, y, z)
  group.add(right)

  return group
}

// -------------------------------------------------------------------------------------------
// Assembly
// -------------------------------------------------------------------------------------------

export function buildTrim(materials: CarMaterials): PartBuild[] {
  const parts: PartBuild[] = []

  const grille = tagPart(buildGrille(materials), 'grille')
  parts.push({ id: 'grille', objects: [grille] })

  const headlightLeft = tagPart(buildHeadlightSide(materials, -1), 'headlights')
  const headlightRight = tagPart(buildHeadlightSide(materials, 1), 'headlights')
  parts.push({ id: 'headlights', objects: [headlightLeft, headlightRight] })

  const taillightLeft = tagPart(buildTaillightCluster(materials), 'taillights')
  taillightLeft.position.set(-TAILLIGHT_CENTER_X, TAILLIGHT_Y, TAILLIGHT_Z)
  const taillightRight = tagPart(buildTaillightCluster(materials), 'taillights')
  taillightRight.position.set(TAILLIGHT_CENTER_X, TAILLIGHT_Y, TAILLIGHT_Z)
  parts.push({ id: 'taillights', objects: [taillightLeft, taillightRight] })

  const frontBumper = tagPart(buildFrontBumper(materials), 'frontBumper')
  parts.push({ id: 'frontBumper', objects: [frontBumper] })

  const rearBumper = tagPart(buildRearBumper(materials), 'rearBumper')
  parts.push({ id: 'rearBumper', objects: [rearBumper] })

  const hoodScoop = tagPart(buildHoodScoop(materials), 'hoodScoop')
  parts.push({ id: 'hoodScoop', objects: [hoodScoop] })

  const hoodPins = new THREE.Group()
  const hoodPinLeft = buildHoodPin(materials)
  hoodPinLeft.position.set(-HOOD_PIN_X, 0, HOOD_PIN_Z)
  const hoodPinRight = buildHoodPin(materials)
  hoodPinRight.position.set(HOOD_PIN_X, 0, HOOD_PIN_Z)
  hoodPins.add(hoodPinLeft, hoodPinRight)
  tagPart(hoodPins, 'hoodPins')
  parts.push({ id: 'hoodPins', objects: [hoodPins] })

  const sideScoopLeft = tagPart(buildSideScoop(materials, -1), 'sideScoops')
  sideScoopLeft.position.set(-BODY_HALF_WIDTH, SIDE_SCOOP_Y, SIDE_SCOOP_Z)
  const sideScoopRight = tagPart(buildSideScoop(materials, 1), 'sideScoops')
  sideScoopRight.position.set(BODY_HALF_WIDTH, SIDE_SCOOP_Y, SIDE_SCOOP_Z)
  parts.push({ id: 'sideScoops', objects: [sideScoopLeft, sideScoopRight] })

  const mirrorLeft = tagPart(buildMirror(materials), 'mirrors')
  mirrorLeft.position.set(-MIRROR_X, MIRROR_Y, MIRROR_Z)
  const mirrorRight = tagPart(buildMirror(materials), 'mirrors')
  mirrorRight.position.set(MIRROR_X, MIRROR_Y, MIRROR_Z)
  parts.push({ id: 'mirrors', objects: [mirrorLeft, mirrorRight] })

  const doorHandleLeft = tagPart(buildDoorHandle(materials, -1), 'doorHandles')
  doorHandleLeft.position.set(-(BODY_HALF_WIDTH + 0.3), DOOR_HANDLE_Y, DOOR_HANDLE_Z)
  const doorHandleRight = tagPart(buildDoorHandle(materials, 1), 'doorHandles')
  doorHandleRight.position.set(BODY_HALF_WIDTH + 0.3, DOOR_HANDLE_Y, DOOR_HANDLE_Z)
  parts.push({ id: 'doorHandles', objects: [doorHandleLeft, doorHandleRight] })

  const fuelCap = tagPart(buildFuelCap(materials), 'fuelCap')
  fuelCap.position.set(0, FUEL_CAP_Y, TAIL_Z + 0.9)
  parts.push({ id: 'fuelCap', objects: [fuelCap] })

  const exhaustTips = new THREE.Group()
  const exhaustTipLeft = buildExhaustTip(materials)
  exhaustTipLeft.position.set(-EXHAUST_TIP_X, EXHAUST_TIP_Y, TAIL_Z + 2.5)
  const exhaustTipRight = buildExhaustTip(materials)
  exhaustTipRight.position.set(EXHAUST_TIP_X, EXHAUST_TIP_Y, TAIL_Z + 2.5)
  exhaustTips.add(exhaustTipLeft, exhaustTipRight)
  tagPart(exhaustTips, 'exhaustTips')
  parts.push({ id: 'exhaustTips', objects: [exhaustTips] })

  const wipers = tagPart(buildWipers(materials), 'wipers')
  parts.push({ id: 'wipers', objects: [wipers] })

  return parts
}
