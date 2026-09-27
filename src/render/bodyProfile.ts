import * as THREE from 'three'
import {
  BELT_Y,
  BODY_HALF_WIDTH,
  DECK_Y,
  DOOR_FRONT_Z,
  DOOR_REAR_Z,
  FENDER_CREASE_FRONT_Y,
  FENDER_CREASE_REAR_Y,
  HOOD_FRONT_Y,
  HOOD_REAR_Y,
  HOOD_HALF_WIDTH_FRONT,
  HOOD_HALF_WIDTH_REAR,
  HOOD_REAR_Z,
  NOSE_HALF_WIDTH,
  NOSE_TOP_Y,
  NOSE_Z,
  QUARTER_GLASS_REAR_Z,
  REAR_GLASS_BASE_HALF_WIDTH,
  REAR_GLASS_BASE_Z,
  ROCKER_BOTTOM_Y,
  ROCKER_HALF_WIDTH,
  ROCKER_TOP_Y,
  ROOF_HALF_WIDTH,
  ROOF_PEAK_Z,
  ROOF_REAR_Z,
  ROOF_Y,
  TAIL_BOTTOM_Y,
  TAIL_CORNER_RADIUS,
  TAIL_HALF_WIDTH,
  TAIL_TOP_Y,
  TAIL_Z,
  WINDSHIELD_BASE_HALF_WIDTH,
  WINDSHIELD_BASE_Y,
  WINDSHIELD_BASE_Z,
  WINDSHIELD_TOP_HALF_WIDTH,
  WINDSHIELD_TOP_Y,
  WINDSHIELD_TOP_Z,
} from '../car/dimensions.ts'

/**
 * The body's cross-section stations and the greenhouse (roof/glass) silhouette, sampled nose to
 * tail, plus the `loft` primitive every panel in `carBody.ts` is built from. Framework-light: the
 * only three.js used is `Vector3`/`BufferGeometry` to hand the panel builder real geometry.
 *
 * A `Station` is the RIGHT half of one cross-section, ordered bottom to top. `carBody.ts` mirrors
 * it for the left side and interpolates the outward half-width at an arbitrary y by walking the
 * four (or five, with the fender/quarter crease) named points in y order — see
 * `sectionHalfWidth`. Two lofts sharing a boundary row/column but built as separate
 * `THREE.BufferGeometry`s (each smooth-shaded on its own) meet with a hard edge for free, because
 * `computeVertexNormals` never sees across the join. That is how the fender crease and the belt
 * line stay sharp while everything else reads smooth.
 */
export interface Station {
  z: number
  /** Half-width and height of each named point of the RIGHT half section, ordered bottom to top. */
  rockerBottom: readonly [number, number]
  rockerTop: readonly [number, number]
  bulge: readonly [number, number]
  belt: readonly [number, number]
  crease: readonly [number, number]
  center: readonly [number, number]
}

/** The glass foot (at the belt or the deck) and the roof edge, at one z, for the greenhouse. */
export interface GreenhouseStation {
  z: number
  base: readonly [number, number]
  top: readonly [number, number]
}

function mixPt(a: readonly [number, number], b: readonly [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

/** Shape-preserving cubic: continuous tangents without overshooting a panel's anchors. */
function curvedSample(points: readonly (readonly [number, number])[], x: number): number {
  if (x <= points[0][0]) return points[0][1]
  if (x >= points[points.length - 1][0]) return points[points.length - 1][1]
  const slope = (i: number) => (points[i + 1][1] - points[i][1]) / (points[i + 1][0] - points[i][0])
  const tangent = (i: number) => {
    if (i === 0) return slope(0)
    if (i === points.length - 1) return slope(i - 1)
    const a = slope(i - 1)
    const b = slope(i)
    if (a * b <= 0) return 0
    const left = points[i][0] - points[i - 1][0]
    const right = points[i + 1][0] - points[i][0]
    return 3 * (left + right) / ((2 * right + left) / a + (right + 2 * left) / b)
  }
  const i = points.findIndex((p, j) => j < points.length - 1 && x >= p[0] && x <= points[j + 1][0])
  const [x0, y0] = points[i]
  const [x1, y1] = points[i + 1]
  const h = x1 - x0
  const t = (x - x0) / h
  const t2 = t * t
  const t3 = t2 * t
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * tangent(i)
    + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * tangent(i + 1)
}

/** Fraction of the way from z = zA to z = zB (both descending) that `z` sits at, clamped to [0, 1]. */
function zT(z: number, zA: number, zB: number): number {
  const t = (zA - z) / (zA - zB)
  return t < 0 ? 0 : t > 1 ? 1 : t
}

function mixStation(a: Station, b: Station, t: number, z: number): Station {
  return {
    z,
    rockerBottom: mixPt(a.rockerBottom, b.rockerBottom, t),
    rockerTop: mixPt(a.rockerTop, b.rockerTop, t),
    bulge: mixPt(a.bulge, b.bulge, t),
    belt: mixPt(a.belt, b.belt, t),
    crease: mixPt(a.crease, b.crease, t),
    center: mixPt(a.center, b.center, t),
  }
}

// -------------------------------------------------------------------------------------------
// Anchor stations, taken straight from the spec's numbers.
// -------------------------------------------------------------------------------------------

/** The nose tip: fenders wrap the outer headlight buckets here. */
const NOSE: Station = {
  z: NOSE_Z,
  center: [0, HOOD_FRONT_Y],
  crease: [HOOD_HALF_WIDTH_FRONT, FENDER_CREASE_FRONT_Y],
  belt: [NOSE_HALF_WIDTH + 1.2, NOSE_TOP_Y],
  bulge: [NOSE_HALF_WIDTH + 1.2, 24],
  rockerTop: [NOSE_HALF_WIDTH - 1, 14],
  rockerBottom: [NOSE_HALF_WIDTH - 2, ROCKER_BOTTOM_Y + 1],
}

/** The cowl: the hood's rear edge and the root of the fender crease. */
const COWL: Station = {
  z: HOOD_REAR_Z,
  center: [0, HOOD_REAR_Y],
  crease: [HOOD_HALF_WIDTH_REAR, FENDER_CREASE_REAR_Y],
  belt: [BODY_HALF_WIDTH - 0.5, 34],
  bulge: [BODY_HALF_WIDTH, 25],
  rockerTop: [ROCKER_HALF_WIDTH, ROCKER_TOP_Y],
  rockerBottom: [ROCKER_HALF_WIDTH - 0.5, ROCKER_BOTTOM_Y],
}

/** Door front (the A-pillar base). No crease/shoulder over the doors, so crease = belt. */
const DOOR_FRONT: Station = {
  z: DOOR_FRONT_Z,
  belt: [BODY_HALF_WIDTH, BELT_Y],
  crease: [BODY_HALF_WIDTH, BELT_Y],
  bulge: [BODY_HALF_WIDTH, 25.5],
  rockerTop: [ROCKER_HALF_WIDTH, ROCKER_TOP_Y],
  rockerBottom: [ROCKER_HALF_WIDTH - 0.5, ROCKER_BOTTOM_Y],
  center: [0, BELT_Y + 1],
}

/** Door rear / quarter front: a hair of upward sweep in the belt has already begun. */
const DOOR_REAR_BELT_LIFT = 0.6
const DOOR_REAR: Station = {
  z: DOOR_REAR_Z,
  belt: [BODY_HALF_WIDTH, BELT_Y + DOOR_REAR_BELT_LIFT],
  crease: [BODY_HALF_WIDTH, BELT_Y + DOOR_REAR_BELT_LIFT],
  bulge: [BODY_HALF_WIDTH, 25.5],
  rockerTop: [ROCKER_HALF_WIDTH, ROCKER_TOP_Y],
  rockerBottom: [ROCKER_HALF_WIDTH - 0.5, ROCKER_BOTTOM_Y],
  center: [0, BELT_Y + 1],
}

// -------------------------------------------------------------------------------------------
// The 1969 kick-up: belt height and body half-width behind the door, computed rather than
// hand-interpolated so the three published break points (door, z = -70, tail) line up exactly.
// -------------------------------------------------------------------------------------------

/** Belt height has risen to this many inches by z = -70 (the kick-up's main bend). */
const QUARTER_KICK_Z = -70
const QUARTER_KICK_BELT_Y = 37
/** Belt height at the very tail — the 1969 quarter's highest point. */
const TAIL_BELT_Y = 38.5
/** The body sides taper from `BODY_HALF_WIDTH` to `TAIL_HALF_WIDTH` starting here. */
const TAPER_START_Z = QUARTER_KICK_Z
/** The crease (now the trunk's shoulder) at the rear glass base, widening toward the tail. */
const DECK_CREASE_HALF_WIDTH_NEAR = 28
const DECK_CREASE_HALF_WIDTH_FAR = 30

function quarterBeltY(z: number): number {
  if (z >= DOOR_REAR_Z) return BELT_Y + DOOR_REAR_BELT_LIFT
  if (z >= QUARTER_KICK_Z) {
    return BELT_Y + DOOR_REAR_BELT_LIFT + (QUARTER_KICK_BELT_Y - (BELT_Y + DOOR_REAR_BELT_LIFT)) * zT(z, DOOR_REAR_Z, QUARTER_KICK_Z)
  }
  return QUARTER_KICK_BELT_Y + (TAIL_BELT_Y - QUARTER_KICK_BELT_Y) * zT(z, QUARTER_KICK_Z, TAIL_Z)
}

/** How far the side tucks inward at `z` as the tail corner rounds (a quarter circle in plan). */
function tailCornerTuck(z: number): number {
  const ahead = z - TAIL_Z
  if (ahead >= TAIL_CORNER_RADIUS) return 0
  return TAIL_CORNER_RADIUS - Math.sqrt(Math.max(0, TAIL_CORNER_RADIUS ** 2 - (TAIL_CORNER_RADIUS - ahead) ** 2))
}

function quarterHalfWidth(z: number): number {
  if (z >= TAPER_START_Z) return BODY_HALF_WIDTH
  return BODY_HALF_WIDTH + (TAIL_HALF_WIDTH - BODY_HALF_WIDTH) * zT(z, TAPER_START_Z, TAIL_Z) - tailCornerTuck(z)
}

/** Where the lower body stops being quarter-panel sheet metal and becomes rear-valance height,
 * over the last few inches before the tail (the "last 4 in round down into the rear panel"). */
const TAIL_ROUND_START_Z = TAIL_Z + 8

function quarterRockerTopY(z: number): number {
  if (z >= TAIL_ROUND_START_Z) return ROCKER_TOP_Y
  return ROCKER_TOP_Y + (TAIL_BOTTOM_Y - ROCKER_TOP_Y) * zT(z, TAIL_ROUND_START_Z, TAIL_Z)
}

function quarterDeckTop(z: number): { center: readonly [number, number]; crease: readonly [number, number] } {
  if (z > REAR_GLASS_BASE_Z) {
    // No top surface here — the trunk lid and rear glass own it. Keep the Station well-formed.
    return { center: [0, quarterBeltY(z) + 1], crease: [quarterHalfWidth(z), quarterBeltY(z)] }
  }
  const t = zT(z, REAR_GLASS_BASE_Z, TAIL_Z)
  return {
    center: [0, DECK_Y + (TAIL_TOP_Y - DECK_Y) * t],
    crease: [
      DECK_CREASE_HALF_WIDTH_NEAR + (DECK_CREASE_HALF_WIDTH_FAR - DECK_CREASE_HALF_WIDTH_NEAR) * t - tailCornerTuck(z),
      DECK_Y - 0.3 + (TAIL_TOP_Y - 0.3 - (DECK_Y - 0.3)) * t,
    ],
  }
}

function quarterStation(z: number): Station {
  const halfWidth = quarterHalfWidth(z)
  const beltY = quarterBeltY(z)
  const { center, crease } = quarterDeckTop(z)
  const rockerTopY = quarterRockerTopY(z)
  const scale = halfWidth / BODY_HALF_WIDTH
  return {
    z,
    rockerBottom: [(ROCKER_HALF_WIDTH - 0.5) * scale, ROCKER_BOTTOM_Y],
    rockerTop: [ROCKER_HALF_WIDTH * scale, rockerTopY],
    bulge: [halfWidth, 25.5 + (26 - 25.5) * zT(z, DOOR_REAR_Z, QUARTER_KICK_Z)],
    belt: [halfWidth, beltY],
    crease,
    center,
  }
}

// -------------------------------------------------------------------------------------------
// STATIONS: nose to tail. The hood and door spans are smoothly blended between their anchors;
// the quarter span is computed directly (see above) so the kick-up and taper stay exact at the
// published break points.
// -------------------------------------------------------------------------------------------

/** Extra mid-hood samples so the crown's fall from the cowl to the nose reads as a smooth curve. */
const HOOD_MID_1_Z = 84
const HOOD_MID_2_Z = 68
const HOOD_MID_3_Z = 48
const DOOR_MID_Z = (DOOR_FRONT_Z + DOOR_REAR_Z) / 2
const QUARTER_SCOOP_Z = -45
/**
 * Stations through the rounded tail corner, so the sampled contour follows its arc. The last one
 * stays 1.6 in ahead of the tail: any closer and the arc's near-vertical run bends the sampled
 * curve harder than the panels' tangent continuity allows.
 */
const TAIL_CORNER_STATION_Z = [TAIL_CORNER_RADIUS, 3.5, 1.6].map((ahead) => TAIL_Z + ahead)

export const STATIONS: readonly Station[] = [
  NOSE,
  mixStation(NOSE, COWL, zT(HOOD_MID_1_Z, NOSE.z, COWL.z), HOOD_MID_1_Z),
  mixStation(NOSE, COWL, zT(HOOD_MID_2_Z, NOSE.z, COWL.z), HOOD_MID_2_Z),
  mixStation(NOSE, COWL, zT(HOOD_MID_3_Z, NOSE.z, COWL.z), HOOD_MID_3_Z),
  COWL,
  DOOR_FRONT,
  mixStation(DOOR_FRONT, DOOR_REAR, 0.5, DOOR_MID_Z),
  DOOR_REAR,
  quarterStation(QUARTER_SCOOP_Z),
  quarterStation(REAR_GLASS_BASE_Z),
  quarterStation(QUARTER_KICK_Z),
  quarterStation((QUARTER_KICK_Z + TAIL_CORNER_STATION_Z[0]) / 2),
  ...TAIL_CORNER_STATION_Z.map((z) => quarterStation(z)),
  quarterStation(TAIL_Z),
]

/** Smooth longitudinal contours, preserving hood heights and shared panel attachment seams. */
export function stationAt(z: number): Station {
  const stations = STATIONS
  if (z >= stations[0].z) return stations[0]
  const last = stations[stations.length - 1]
  if (z <= last.z) return last
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i]
    const b = stations[i + 1]
    if (z <= a.z && z >= b.z) {
      const result = mixStation(a, b, zT(z, a.z, b.z), z)
      for (const key of ['rockerBottom', 'rockerTop', 'bulge', 'belt', 'crease', 'center'] as const) {
        result[key] = [0, 1].map((axis) => curvedSample(stations.map((s) => [-s.z, s[key][axis]] as const), -z)) as [number, number]
      }
      // The broad upper shoulders tuck into the doors while the lower skin stays full.
      const haunch = Math.exp(-(((z - 54) / 25) ** 2)) + Math.exp(-(((z + 54) / 22) ** 2))
      result.belt = [result.belt[0] - 0.65 * haunch, result.belt[1]]
      return result
    }
  }
  return last
}

/**
 * The outward half-width at an arbitrary height `y` for one station, found by walking the named
 * points (bottom to top) with a smooth, non-overshooting curve.
 * `includeCrease` adds the fender/quarter shoulder point above the belt; doors omit it.
 */
export function sectionHalfWidth(station: Station, y: number, includeCrease: boolean): number {
  const points: (readonly [number, number])[] = [station.rockerBottom, station.rockerTop, station.bulge, station.belt]
  if (includeCrease) points.push(station.crease)
  const byY = [...points].sort((a, b) => a[1] - b[1]).filter((p, i, sorted) => i === 0 || p[1] > sorted[i - 1][1])
  return curvedSample(byY.map(([x, height]) => [height, x]), y)
}

// -------------------------------------------------------------------------------------------
// GREENHOUSE: the roof/glass silhouette, base (belt or deck) and top (roof edge) at each z.
// -------------------------------------------------------------------------------------------

/** Door glass runs a little ahead of the door panel itself, onto the base of the A-pillar. */
const DOOR_GLASS_FRONT_Z = DOOR_FRONT_Z + 3
const WINDSHIELD_BASE_PT: readonly [number, number] = [WINDSHIELD_BASE_HALF_WIDTH, WINDSHIELD_BASE_Y]
const WINDSHIELD_TOP_PT: readonly [number, number] = [WINDSHIELD_TOP_HALF_WIDTH, WINDSHIELD_TOP_Y]
const ROOF_CROWN_PT: readonly [number, number] = [ROOF_HALF_WIDTH, ROOF_Y]
const REAR_GLASS_TOP_PT: readonly [number, number] = [ROOF_HALF_WIDTH - 1, 49.3]
const REAR_GLASS_BASE_PT: readonly [number, number] = [REAR_GLASS_BASE_HALF_WIDTH, DECK_Y + 0.5]

const GREENHOUSE_KEYFRAMES: readonly { z: number; top: readonly [number, number] }[] = [
  { z: DOOR_GLASS_FRONT_Z, top: mixPt(WINDSHIELD_BASE_PT, WINDSHIELD_TOP_PT, zT(DOOR_GLASS_FRONT_Z, WINDSHIELD_BASE_Z, WINDSHIELD_TOP_Z)) },
  { z: WINDSHIELD_BASE_Z, top: WINDSHIELD_BASE_PT },
  { z: WINDSHIELD_TOP_Z, top: WINDSHIELD_TOP_PT },
  { z: ROOF_PEAK_Z, top: ROOF_CROWN_PT },
  { z: ROOF_REAR_Z, top: REAR_GLASS_TOP_PT },
  { z: QUARTER_GLASS_REAR_Z, top: mixPt(REAR_GLASS_TOP_PT, REAR_GLASS_BASE_PT, zT(QUARTER_GLASS_REAR_Z, ROOF_REAR_Z, REAR_GLASS_BASE_Z)) },
  { z: REAR_GLASS_BASE_Z, top: REAR_GLASS_BASE_PT },
]

export const GREENHOUSE: readonly GreenhouseStation[] = GREENHOUSE_KEYFRAMES.map(
  ({ z, top }): GreenhouseStation => ({
    z,
    base: [quarterHalfWidth(z), quarterBeltY(z)],
    top,
  }),
)

export function greenhouseAt(z: number): GreenhouseStation {
  const stations = GREENHOUSE
  if (z >= stations[0].z) return stations[0]
  const last = stations[stations.length - 1]
  if (z <= last.z) return last
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i]
    const b = stations[i + 1]
    if (z <= a.z && z >= b.z) {
      const t = zT(z, a.z, b.z)
      return { z, base: mixPt(a.base, b.base, t), top: mixPt(a.top, b.top, t) }
    }
  }
  return last
}

// -------------------------------------------------------------------------------------------
// loft: the one primitive every panel is built from.
// -------------------------------------------------------------------------------------------

/**
 * Builds a smooth-shaded quad-strip surface from a grid of points: `rows[i][j]` is the vertex at
 * the i-th cross-section and the j-th point across it. Every row must have the same length.
 * `flipWinding` reverses triangle winding (and so the face normal) for a grid whose natural
 * winding faces the wrong way. Two lofts that share a boundary but are built as separate calls
 * meet with a hard (unwelded) edge, which is how the fender crease and belt line stay sharp.
 */
export function loft(rows: readonly (readonly THREE.Vector3[])[], flipWinding = false): THREE.BufferGeometry {
  const rowCount = rows.length
  const colCount = rows[0]?.length ?? 0
  const positions = new Float32Array(rowCount * colCount * 3)
  const uvs = new Float32Array(rowCount * colCount * 2)
  for (let i = 0; i < rowCount; i++) {
    const row = rows[i]
    for (let j = 0; j < colCount; j++) {
      const p = row[j]
      const k = i * colCount + j
      positions[k * 3] = p.x
      positions[k * 3 + 1] = p.y
      positions[k * 3 + 2] = p.z
      uvs[k * 2] = j / Math.max(1, colCount - 1)
      uvs[k * 2 + 1] = i / Math.max(1, rowCount - 1)
    }
  }
  const indices: number[] = []
  for (let i = 0; i < rowCount - 1; i++) {
    for (let j = 0; j < colCount - 1; j++) {
      const a = i * colCount + j
      const b = a + 1
      const c = a + colCount
      const d = c + 1
      if (flipWinding) {
        indices.push(a, c, b, b, c, d)
      } else {
        indices.push(a, b, c, b, d, c)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
