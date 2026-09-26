import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { PartId } from '../car/types.ts'
import {
  BELT_Y,
  BODY_HALF_WIDTH,
  COWL_REAR_Z,
  COWL_Y,
  DECK_Y,
  DOOR_FRONT_Z,
  DOOR_REAR_Z,
  EXHAUST_TIP_X,
  EXHAUST_TIP_Y,
  FRONT_AXLE_Z,
  FUEL_CAP_DIAMETER,
  FUEL_CAP_Y,
  GRILLE_BOTTOM_Y,
  GRILLE_HALF_WIDTH,
  HEADLIGHT_DIAMETER,
  HEADLIGHT_OUTER_X,
  HEADLIGHT_OUTER_Z,
  HEADLIGHT_Y,
  HOOD_FRONT_Y,
  HOOD_FRONT_Z,
  HOOD_HALF_WIDTH_REAR,
  HOOD_REAR_Z,
  NOSE_Z,
  QUARTER_GLASS_FRONT_Z,
  QUARTER_GLASS_REAR_Z,
  QUARTER_GLASS_TOP_Y,
  REAR_AXLE_Z,
  REAR_GLASS_BASE_HALF_WIDTH,
  REAR_GLASS_BASE_Z,
  ROCKER_BOTTOM_Y,
  ROCKER_TOP_Y,
  ROOF_FRONT_Z,
  ROOF_HALF_WIDTH,
  ROOF_REAR_Z,
  TAIL_BOTTOM_Y,
  TAIL_HALF_WIDTH,
  TAIL_TOP_Y,
  TAIL_Z,
  TAILLIGHT_CENTER_X,
  TAILLIGHT_Y,
  TRUNK_FRONT_Z,
  TRUNK_REAR_Z,
  TURN_SIGNAL_X,
  TURN_SIGNAL_Y,
  VALANCE_BOTTOM_Y,
  WHEEL_ARCH_CENTER_Y,
  WHEEL_ARCH_RADIUS,
  WINDSHIELD_BASE_HALF_WIDTH,
  WINDSHIELD_BASE_Y,
  WINDSHIELD_BASE_Z,
  WINDSHIELD_TOP_HALF_WIDTH,
  WINDSHIELD_TOP_Y,
  WINDSHIELD_TOP_Z,
} from '../car/dimensions.ts'
import { greenhouseAt, loft, sectionHalfWidth, stationAt } from './bodyProfile.ts'
import type { Station } from './bodyProfile.ts'
import type { CarMaterials } from './carMaterials.ts'
import { tagPart } from './partBuild.ts'
import type { PartBuild } from './partBuild.ts'

/**
 * The 1969 SportsRoof shell: 13 body panels plus the windshield, rear glass and the mirrored
 * door/quarter glass — 17 `PartBuild`s in all. Every curved surface is a loft over
 * `bodyProfile.ts`'s stations, smooth-shaded; the only hard edges are the fender crease and the
 * belt line, which stay sharp because the panels either side of them are separate
 * `THREE.BufferGeometry`s merged into one mesh (`computeVertexNormals` never sees across the
 * join — see `bodyProfile.ts`'s doc comment). `paint`, `satinBlack` and `glass` are all
 * double-sided (see `carMaterials.ts`), so triangle winding only matters for the few meshes built
 * from front-face-only materials: the underbody wheelhouses, the door trim panel and the chrome
 * mouldings (built as tubes, which are winding-safe by construction).
 */

/** +1 builds the passenger (right, +X) side, -1 the driver (left, -X) side. */
type Side = 1 | -1

// -------------------------------------------------------------------------------------------
// Tuning constants (every other number below is derived from `dimensions.ts` or one of these).
// -------------------------------------------------------------------------------------------

/** Every panel's outline is inset this far from the true seam, so a dark gap line shows. */
const PANEL_GAP = 0.25
/** The inward-turned return lip at an open panel edge, so it reads as folded steel, not paper. */
const FLANGE_DEPTH = 0.5
/** Hood, trunk and roof inner skins sit this far below their outer skin. */
const INNER_SKIN_DROP = 0.7
/** Width of the chrome moulding strip around each glass pane. */
const MOULDING_WIDTH = 0.6
/** Width of the chrome drip rail along the roof edge. */
const DRIP_RAIL_WIDTH = 0.5
/** Radius of the rolled lip around each wheel arch opening. */
const ARCH_LIP_TUBE_RADIUS = 0.6
/** Turn-signal lamps in the front valance: lens proud of the panel (which curves away by up to 0.4 in
 * across the lamp), backing recessed behind it. */
/** The cut-out is masked per grid cell, so the bezel is wide enough to hide its stepped edge. */
const TURN_SIGNAL_HOLE_RADIUS = 1.6
const TURN_SIGNAL_LENS_STANDOFF = 0.5
const TURN_SIGNAL_BACKING_INSET = 1
const TURN_SIGNAL_BEZEL_WIDTH = 1.6

// -------------------------------------------------------------------------------------------
// Small shared helpers
// -------------------------------------------------------------------------------------------

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

function glassMesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material)
  m.castShadow = false
  m.receiveShadow = true
  return m
}

function dropped(row: readonly THREE.Vector3[], axis: 'x' | 'y' | 'z', amount: number): THREE.Vector3[] {
  return row.map((p) => {
    const q = p.clone()
    q[axis] -= amount
    return q
  })
}

/**
 * The one grid-to-mesh primitive `loft` (in `bodyProfile.ts`) doesn't cover: a quad-strip grid
 * with an optional hole (used for the wheel arches and the valance/tail-panel cut-outs). A cell
 * is dropped when `isHole` is true at its centre.
 */
function gridGeometry(
  rows: readonly (readonly THREE.Vector3[])[],
  flipWinding: boolean,
  isHole?: (p: THREE.Vector3) => boolean,
): THREE.BufferGeometry {
  const rowCount = rows.length
  const colCount = rows[0].length
  const positions = new Float32Array(rowCount * colCount * 3)
  const uvs = new Float32Array(rowCount * colCount * 2)
  for (let i = 0; i < rowCount; i++) {
    for (let j = 0; j < colCount; j++) {
      const p = rows[i][j]
      const k = i * colCount + j
      positions[k * 3] = p.x
      positions[k * 3 + 1] = p.y
      positions[k * 3 + 2] = p.z
      uvs[k * 2] = j / Math.max(1, colCount - 1)
      uvs[k * 2 + 1] = i / Math.max(1, rowCount - 1)
    }
  }
  const indices: number[] = []
  const mid = new THREE.Vector3()
  for (let i = 0; i < rowCount - 1; i++) {
    for (let j = 0; j < colCount - 1; j++) {
      if (isHole) {
        mid.copy(rows[i][j]).add(rows[i][j + 1]).add(rows[i + 1][j]).add(rows[i + 1][j + 1]).multiplyScalar(0.25)
        if (isHole(mid)) continue
      }
      const a = i * colCount + j
      const b = a + 1
      const c = a + colCount
      const d = c + 1
      if (flipWinding) indices.push(a, c, b, b, c, d)
      else indices.push(a, b, c, b, d, c)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** A flat rectangle at constant x, rows over z (descending) and columns over y (ascending). */
function flatRect(x: number, zFrom: number, zTo: number, yFrom: number, yTo: number, zSeg: number, ySeg: number): THREE.Vector3[][] {
  const rows: THREE.Vector3[][] = []
  for (let i = 0; i <= zSeg; i++) {
    const z = zFrom + (zTo - zFrom) * (i / zSeg)
    const row: THREE.Vector3[] = []
    for (let j = 0; j <= ySeg; j++) {
      row.push(new THREE.Vector3(x, yFrom + (yTo - yFrom) * (j / ySeg), z))
    }
    rows.push(row)
  }
  return rows
}

/**
 * Rows for a side surface (fender, door or quarter) between `zFrom` and `zTo` (descending),
 * sampled from `yLow(station)` to `yHigh(station)` at each z. `sectionHalfWidth` gives the
 * outward half-width, signed by `side`.
 */
function buildProfileRows(
  zFrom: number,
  zTo: number,
  zSeg: number,
  ySeg: number,
  side: Side,
  yLow: (s: Station) => number,
  yHigh: (s: Station) => number,
  includeCrease: boolean,
): THREE.Vector3[][] {
  const rows: THREE.Vector3[][] = []
  for (let i = 0; i <= zSeg; i++) {
    const z = zFrom + (zTo - zFrom) * (i / zSeg)
    const s = stationAt(z)
    const y0 = yLow(s)
    const y1 = yHigh(s)
    const row: THREE.Vector3[] = []
    for (let j = 0; j <= ySeg; j++) {
      const y = y0 + (y1 - y0) * (j / ySeg)
      row.push(new THREE.Vector3(sectionHalfWidth(s, y, includeCrease) * side, y, z))
    }
    rows.push(row)
  }
  return rows
}

/** One row of a top surface (hood/cowl/trunk/roof): the crease-to-centre-to-crease crown. */
function crownRow(halfWidth: number, creaseY: number, centerY: number, z: number, xSeg: number): THREE.Vector3[] {
  const row: THREE.Vector3[] = []
  for (let j = 0; j <= xSeg; j++) {
    const u = (j / xSeg) * 2 - 1
    row.push(new THREE.Vector3(halfWidth * u, creaseY + (centerY - creaseY) * (1 - u * u), z))
  }
  return row
}

/** Top-surface rows between `zFrom` and `zTo` (descending), the crease inset by `insetX`. */
function topRows(zFrom: number, zTo: number, zSeg: number, xSeg: number, insetX: number): THREE.Vector3[][] {
  const rows: THREE.Vector3[][] = []
  for (let i = 0; i <= zSeg; i++) {
    const z = zFrom + (zTo - zFrom) * (i / zSeg)
    const s = stationAt(z)
    rows.push(crownRow(s.crease[0] - insetX, s.crease[1], s.center[1], z, xSeg))
  }
  return rows
}

function insideCircleZY(p: THREE.Vector3, c: { z: number; y: number; r: number }): boolean {
  const a = p.z - c.z
  const b = p.y - c.y
  return a * a + b * b < c.r * c.r
}

function insideCircleXY(p: THREE.Vector3, c: { x: number; y: number; r: number }): boolean {
  const a = p.x - c.x
  const b = p.y - c.y
  return a * a + b * b < c.r * c.r
}

function insideEllipseXY(p: THREE.Vector3, e: { x: number; y: number; rx: number; ry: number }): boolean {
  const dx = (p.x - e.x) / e.rx
  const dy = (p.y - e.y) / e.ry
  return dx * dx + dy * dy < 1
}

function circlePatch(x: number, y: number, z: number, r: number, facing: 1 | -1): THREE.BufferGeometry {
  const geo = new THREE.CircleGeometry(r, 20)
  if (facing === -1) geo.rotateY(Math.PI)
  geo.translate(x, y, z)
  return geo
}

function ellipsePatch(x: number, y: number, z: number, rx: number, ry: number, facing: 1 | -1): THREE.BufferGeometry {
  const geo = new THREE.CircleGeometry(1, 24)
  geo.scale(rx, ry, 1)
  if (facing === -1) geo.rotateY(Math.PI)
  geo.translate(x, y, z)
  return geo
}

/** The closed boundary loop of a grid, walked clockwise from the first row. */
function perimeterLoop(rows: readonly (readonly THREE.Vector3[])[]): THREE.Vector3[] {
  const colCount = rows[0].length
  const loop: THREE.Vector3[] = []
  for (let j = 0; j < colCount; j++) loop.push(rows[0][j])
  for (let i = 1; i < rows.length; i++) loop.push(rows[i][colCount - 1])
  for (let j = colCount - 2; j >= 0; j--) loop.push(rows[rows.length - 1][j])
  for (let i = rows.length - 2; i > 0; i--) loop.push(rows[i][0])
  return loop
}

/** A thin chrome frame following a glass pane's outline. */
function boundaryMoulding(rows: readonly (readonly THREE.Vector3[])[]): THREE.BufferGeometry {
  const loop = perimeterLoop(rows)
  const curve = new THREE.CatmullRomCurve3(loop, true)
  return new THREE.TubeGeometry(curve, Math.max(24, loop.length), MOULDING_WIDTH / 2, 6, true)
}

/**
 * A flat, arch-shaped patch of dark inner-fender panel behind the wheel opening. Built as a
 * masked grid (not `THREE.CircleGeometry`) because the arch's full circle — centre
 * `WHEEL_ARCH_CENTER_Y`, radius `WHEEL_ARCH_RADIUS` — dips below the ground on this car. It stops
 * at the rocker's bottom edge like the real inner fender: any lower and it hangs beneath the
 * sill as a dark wall that shows ahead of and behind the tyre from a low camera, flickering in
 * and out as the turntable turns its single face toward and away from the viewer.
 */
function wheelhouseGeometry(side: Side, axleZ: number, panelX: number): THREE.BufferGeometry {
  const r = WHEEL_ARCH_RADIUS + 1.5
  const ZSEG = 16
  const YSEG = 16
  const yLow = Math.max(ROCKER_BOTTOM_Y, WHEEL_ARCH_CENTER_Y - r)
  const yHigh = WHEEL_ARCH_CENTER_Y + r
  const rows: THREE.Vector3[][] = []
  for (let i = 0; i <= ZSEG; i++) {
    const z = axleZ - r + 2 * r * (i / ZSEG)
    const row: THREE.Vector3[] = []
    for (let j = 0; j <= YSEG; j++) {
      row.push(new THREE.Vector3((panelX - 3) * side, yLow + (yHigh - yLow) * (j / YSEG), z))
    }
    rows.push(row)
  }
  return gridGeometry(rows, side === 1, (p) => !insideCircleZY(p, { z: axleZ, y: WHEEL_ARCH_CENTER_Y, r }))
}

/** The rolled lip around a wheel arch, plus the dark wheelhouse patch behind it. */
function archLipAndWheelhouse(side: Side, axleZ: number): { lipGeom: THREE.BufferGeometry; wheelhouseGeom: THREE.BufferGeometry } {
  const panelX = sectionHalfWidth(stationAt(axleZ), WHEEL_ARCH_CENTER_Y, false)
  const cos = THREE.MathUtils.clamp((ROCKER_TOP_Y - WHEEL_ARCH_CENTER_Y) / WHEEL_ARCH_RADIUS, -1, 1)
  const halfAngle = Math.acos(cos)
  const lip = new THREE.TorusGeometry(WHEEL_ARCH_RADIUS, ARCH_LIP_TUBE_RADIUS, 10, 28, halfAngle * 2)
  lip.rotateY(Math.PI / 2)
  lip.rotateX(Math.PI / 2 - halfAngle)
  lip.translate(panelX * side, WHEEL_ARCH_CENTER_Y, axleZ)

  return { lipGeom: lip, wheelhouseGeom: wheelhouseGeometry(side, axleZ, panelX) }
}

/** The chrome bucket that closes the fender's outer headlight socket (the sealed-beam and lens
 * are built by `carTrim.ts`; this is only the body's socket ring). */
function headlightBucket(materials: CarMaterials, side: Side): THREE.Mesh {
  const r = HEADLIGHT_DIAMETER / 2 + 0.4
  const geo = new THREE.CylinderGeometry(r, r, 2, 20, 1, true)
  geo.rotateZ(Math.PI / 2)
  geo.translate(HEADLIGHT_OUTER_X * side, HEADLIGHT_Y, HEADLIGHT_OUTER_Z)
  return mesh(geo, materials.chrome)
}

// -------------------------------------------------------------------------------------------
// Hood, cowl, trunk lid — top surfaces over the crease-to-centre crown.
// -------------------------------------------------------------------------------------------

function buildHood(materials: CarMaterials): PartBuild {
  const ZSEG = 30
  const XSEG = 22
  const zFrom = HOOD_FRONT_Z - PANEL_GAP
  const zTo = HOOD_REAR_Z + PANEL_GAP
  const outerRows = topRows(zFrom, zTo, ZSEG, XSEG, PANEL_GAP)
  const edges = [outerRows[0], outerRows[outerRows.length - 1], outerRows.map((r) => r[0]), outerRows.map((r) => r[r.length - 1])]
  const flanges = edges.map((edge) => loft([edge, dropped(edge, 'y', FLANGE_DEPTH)]))
  const outerMesh = mesh(mergeGeometries([loft(outerRows), ...flanges]), materials.paint)

  const innerRows = topRows(zFrom + 1.5, zTo - 1.5, 12, 10, PANEL_GAP + 1.5).map((row) => dropped(row, 'y', INNER_SKIN_DROP))
  const ribLength = Math.abs(zFrom - zTo) - 6
  const ribs = [-8, 0, 8].map((x) => {
    const geo = new THREE.BoxGeometry(2, 1.4, ribLength)
    geo.translate(x, HOOD_FRONT_Y - INNER_SKIN_DROP - 1.2, (zFrom + zTo) / 2)
    return geo
  })
  const innerMesh = mesh(mergeGeometries([loft(innerRows, true), ...ribs]), materials.satinBlack)

  const g = new THREE.Group()
  g.add(outerMesh, innerMesh)
  g.name = 'hood'
  tagPart(g, 'hood')
  return { id: 'hood', objects: [g] }
}

function buildCowl(materials: CarMaterials): PartBuild {
  const ZSEG = 6
  const XSEG = 12
  const zFront = HOOD_REAR_Z - PANEL_GAP
  const zRear = COWL_REAR_Z + PANEL_GAP
  const halfWidthFront = HOOD_HALF_WIDTH_REAR - PANEL_GAP
  const halfWidthRear = WINDSHIELD_BASE_HALF_WIDTH - PANEL_GAP
  const rows: THREE.Vector3[][] = []
  for (let i = 0; i <= ZSEG; i++) {
    const t = i / ZSEG
    const z = zFront + (zRear - zFront) * t
    const halfWidth = halfWidthFront + (halfWidthRear - halfWidthFront) * t
    rows.push(crownRow(halfWidth, COWL_Y, COWL_Y + 0.4, z, XSEG))
  }
  const g = new THREE.Group()
  g.add(mesh(loft(rows), materials.paint))
  g.name = 'cowl'
  tagPart(g, 'cowl')
  return { id: 'cowl', objects: [g] }
}

function buildTrunkLid(materials: CarMaterials): PartBuild {
  const ZSEG = 22
  const XSEG = 22
  const TRUNK_CREASE_INSET = 0.5 // the spec's own inset: x = ±(crease.x − 0.5)
  const zFrom = TRUNK_FRONT_Z - PANEL_GAP
  const zTo = TRUNK_REAR_Z + PANEL_GAP
  const outerRows = topRows(zFrom, zTo, ZSEG, XSEG, TRUNK_CREASE_INSET)
  const frontEdge = outerRows[0]
  const rearEdge = outerRows[outerRows.length - 1]
  const flanges = [frontEdge, rearEdge].map((edge) => loft([edge, dropped(edge, 'y', FLANGE_DEPTH)]))
  const outerMesh = mesh(mergeGeometries([loft(outerRows), ...flanges]), materials.paint)

  const innerRows = topRows(zFrom + 1, zTo - 1, 10, 10, TRUNK_CREASE_INSET + 1).map((row) => dropped(row, 'y', INNER_SKIN_DROP))
  const ribLength = Math.abs(zFrom - zTo) - 4
  const ribs = [-6, 0, 6].map((x) => {
    const geo = new THREE.BoxGeometry(1.6, 1.2, ribLength)
    geo.translate(x, DECK_Y - INNER_SKIN_DROP - 1, (zFrom + zTo) / 2)
    return geo
  })
  const innerMesh = mesh(mergeGeometries([loft(innerRows, true), ...ribs]), materials.satinBlack)

  const g = new THREE.Group()
  g.add(outerMesh, innerMesh)
  g.name = 'trunkLid'
  tagPart(g, 'trunkLid')
  return { id: 'trunkLid', objects: [g] }
}

// -------------------------------------------------------------------------------------------
// Roof: the fastback's unbroken line, the A-pillars and the C-pillar/sail panels.
// -------------------------------------------------------------------------------------------

function aPillar(materials: CarMaterials, side: Side): THREE.Mesh {
  const base = new THREE.Vector3(WINDSHIELD_BASE_HALF_WIDTH * side, WINDSHIELD_BASE_Y, WINDSHIELD_BASE_Z)
  const top = new THREE.Vector3(WINDSHIELD_TOP_HALF_WIDTH * side, WINDSHIELD_TOP_Y, WINDSHIELD_TOP_Z)
  const curve = new THREE.CatmullRomCurve3([base, top])
  return mesh(new THREE.TubeGeometry(curve, 8, 1.25, 8, false), materials.paint)
}

/** Fills from the quarter's belt line up to the roof edge, framing the rear glass. */
function sailPanelGeometry(side: Side): THREE.BufferGeometry {
  const ZSEG = 14
  const YSEG = 5
  const zFrom = DOOR_REAR_Z
  const zTo = REAR_GLASS_BASE_Z
  const rows: THREE.Vector3[][] = []
  for (let i = 0; i <= ZSEG; i++) {
    const z = zFrom + (zTo - zFrom) * (i / ZSEG)
    const s = stationAt(z)
    const gh = greenhouseAt(z)
    const row: THREE.Vector3[] = []
    for (let j = 0; j <= YSEG; j++) {
      const t = j / YSEG
      row.push(new THREE.Vector3((s.belt[0] + (gh.top[0] - s.belt[0]) * t) * side, s.belt[1] + (gh.top[1] - s.belt[1]) * t, z))
    }
    rows.push(row)
  }
  return loft(rows, side === 1)
}

function dripRailGeometry(rows: readonly (readonly THREE.Vector3[])[]): THREE.BufferGeometry {
  const rightCurve = new THREE.CatmullRomCurve3(rows.map((r) => r[r[0] ? r.length - 1 : 0]))
  const leftCurve = new THREE.CatmullRomCurve3(rows.map((r) => r[0]))
  return mergeGeometries([
    new THREE.TubeGeometry(rightCurve, 24, DRIP_RAIL_WIDTH / 2, 6, false),
    new THREE.TubeGeometry(leftCurve, 24, DRIP_RAIL_WIDTH / 2, 6, false),
  ])
}

function buildRoof(materials: CarMaterials): PartBuild {
  const ZSEG = 30
  const XSEG = 22
  const rows: THREE.Vector3[][] = []
  for (let i = 0; i <= ZSEG; i++) {
    const z = ROOF_FRONT_Z + (ROOF_REAR_Z - ROOF_FRONT_Z) * (i / ZSEG)
    const gh = greenhouseAt(z)
    rows.push(crownRow(gh.top[0], gh.top[1], gh.top[1] + 0.5, z, XSEG))
  }
  const paintGeom = mergeGeometries([loft(rows), sailPanelGeometry(1), sailPanelGeometry(-1)])
  const outerMesh = mesh(paintGeom, materials.paint)
  const dripRailMesh = mesh(dripRailGeometry(rows), materials.chrome)
  const innerRows = rows.map((row) => dropped(row.map((p) => new THREE.Vector3(p.x * 0.96, p.y, p.z)), 'y', INNER_SKIN_DROP))
  const headlinerMesh = mesh(loft(innerRows, true), materials.interiorBlack)

  const g = new THREE.Group()
  g.add(outerMesh, aPillar(materials, 1), aPillar(materials, -1), dripRailMesh, headlinerMesh)
  g.name = 'roof'
  tagPart(g, 'roof')
  return { id: 'roof', objects: [g] }
}

// -------------------------------------------------------------------------------------------
// Fenders, doors, quarters — the side surfaces, arches and shoulders.
// -------------------------------------------------------------------------------------------

function buildFenderSide(materials: CarMaterials, side: Side, id: PartId): PartBuild {
  const ZSEG = 44
  const YSEG = 28
  const SHOULDER_YSEG = 9
  const zFrom = NOSE_Z - PANEL_GAP
  const zTo = DOOR_FRONT_Z + PANEL_GAP
  const arch = { z: FRONT_AXLE_Z, y: WHEEL_ARCH_CENTER_Y, r: WHEEL_ARCH_RADIUS }

  const sideRows = buildProfileRows(zFrom, zTo, ZSEG, YSEG, side, (s) => s.rockerTop[1], (s) => s.belt[1], false)
  const sideGeom = gridGeometry(sideRows, side === 1, (p) => insideCircleZY(p, arch))
  const shoulderRows = buildProfileRows(zFrom, zTo, ZSEG, SHOULDER_YSEG, side, (s) => s.belt[1], (s) => s.crease[1], true)
  const shoulderGeom = gridGeometry(shoulderRows, side === 1)

  const rearEdge = sideRows[sideRows.length - 1].concat(shoulderRows[shoulderRows.length - 1].slice(1))
  const rearFlange = loft([rearEdge, dropped(rearEdge, 'z', side * 0 + FLANGE_DEPTH)])

  const { lipGeom, wheelhouseGeom } = archLipAndWheelhouse(side, FRONT_AXLE_Z)
  const paintGeom = mergeGeometries([sideGeom, shoulderGeom, rearFlange, lipGeom])

  const g = new THREE.Group()
  g.add(mesh(paintGeom, materials.paint), mesh(wheelhouseGeom, materials.underbody), headlightBucket(materials, side))
  g.name = id
  tagPart(g, id)
  return { id, objects: [g] }
}

function buildDoorSide(materials: CarMaterials, side: Side, id: PartId): PartBuild {
  const ZSEG = 38
  const YSEG = 27
  const zFrom = DOOR_FRONT_Z - PANEL_GAP
  const zTo = DOOR_REAR_Z + PANEL_GAP
  const rows = buildProfileRows(zFrom, zTo, ZSEG, YSEG, side, (s) => s.rockerTop[1], (s) => s.belt[1], false)
  const outerGeom = gridGeometry(rows, side === 1)

  const frontEdge = rows[0]
  const rearEdge = rows[rows.length - 1]
  const topEdge = rows.map((r) => r[r.length - 1])
  const flanges = [
    loft([frontEdge, dropped(frontEdge, 'z', -FLANGE_DEPTH)]),
    loft([rearEdge, dropped(rearEdge, 'z', FLANGE_DEPTH)]),
    loft([topEdge, dropped(topEdge, 'y', FLANGE_DEPTH)]),
  ]
  const paintGeom = mergeGeometries([outerGeom, ...flanges])

  const innerX = (BODY_HALF_WIDTH - 1.5) * side
  const innerRows = flatRect(innerX, zFrom + 3, zTo - 3, ROCKER_TOP_Y + 2, BELT_Y - 1, 8, 6)
  const innerGeom = gridGeometry(innerRows, side !== 1)
  const armrest = new THREE.BoxGeometry(1.5, 3, 10)
  armrest.translate(innerX - side * 0.8, BELT_Y - 8, (zFrom + zTo) / 2)
  const knob = new THREE.CylinderGeometry(0.6, 0.6, 1.5, 10)
  knob.rotateZ(Math.PI / 2)
  knob.translate(innerX - side * 1, BELT_Y - 4, zFrom - 6)
  const vinylGeom = mergeGeometries([innerGeom, armrest, knob])

  const g = new THREE.Group()
  g.add(mesh(paintGeom, materials.paint), mesh(vinylGeom, materials.vinyl))
  g.name = id
  tagPart(g, id)
  return { id, objects: [g] }
}

function buildQuarterSide(materials: CarMaterials, side: Side, id: PartId): PartBuild {
  const ZSEG = 56
  const YSEG = 30
  const DECK_YSEG = 11
  const DECK_ZSEG = 24
  const zFrom = DOOR_REAR_Z - PANEL_GAP
  const zTo = TAIL_Z
  const arch = { z: REAR_AXLE_Z, y: WHEEL_ARCH_CENTER_Y, r: WHEEL_ARCH_RADIUS }

  const sideRows = buildProfileRows(zFrom, zTo, ZSEG, YSEG, side, (s) => s.rockerTop[1], (s) => s.belt[1], false)
  const sideGeom = gridGeometry(sideRows, side === 1, (p) => insideCircleZY(p, arch))
  const deckRows = buildProfileRows(REAR_GLASS_BASE_Z, zTo, DECK_ZSEG, DECK_YSEG, side, (s) => s.belt[1], (s) => s.crease[1], true)
  const deckGeom = gridGeometry(deckRows, side === 1)

  const frontEdge = sideRows[0]
  const frontFlange = loft([frontEdge, dropped(frontEdge, 'z', -FLANGE_DEPTH)])

  const { lipGeom, wheelhouseGeom } = archLipAndWheelhouse(side, REAR_AXLE_Z)
  const paintGeom = mergeGeometries([sideGeom, deckGeom, frontFlange, lipGeom])

  const g = new THREE.Group()
  g.add(mesh(paintGeom, materials.paint), mesh(wheelhouseGeom, materials.underbody))
  g.name = id
  tagPart(g, id)
  return { id, objects: [g] }
}

const buildFenderLeft = (materials: CarMaterials): PartBuild => buildFenderSide(materials, -1, 'fenderLeft')
const buildFenderRight = (materials: CarMaterials): PartBuild => buildFenderSide(materials, 1, 'fenderRight')
const buildDoorLeft = (materials: CarMaterials): PartBuild => buildDoorSide(materials, -1, 'doorLeft')
const buildDoorRight = (materials: CarMaterials): PartBuild => buildDoorSide(materials, 1, 'doorRight')
const buildQuarterLeft = (materials: CarMaterials): PartBuild => buildQuarterSide(materials, -1, 'quarterLeft')
const buildQuarterRight = (materials: CarMaterials): PartBuild => buildQuarterSide(materials, 1, 'quarterRight')

// -------------------------------------------------------------------------------------------
// Rear panel, front valance, rear valance.
// -------------------------------------------------------------------------------------------

function buildRearPanel(materials: CarMaterials): PartBuild {
  const XSEG = 22
  const YSEG = 12
  const z = TAIL_Z + 1.2
  const halfWidth = TAIL_HALF_WIDTH - 1
  const rows: THREE.Vector3[][] = []
  for (let i = 0; i <= YSEG; i++) {
    const y = TAIL_BOTTOM_Y + (TAIL_TOP_Y - TAIL_BOTTOM_Y) * (i / YSEG)
    const row: THREE.Vector3[] = []
    for (let j = 0; j <= XSEG; j++) {
      row.push(new THREE.Vector3(halfWidth * ((j / XSEG) * 2 - 1), y, z))
    }
    rows.push(row)
  }
  const tailA = { x: TAILLIGHT_CENTER_X, y: TAILLIGHT_Y, rx: 6.5, ry: 5.2 }
  const tailB = { x: -TAILLIGHT_CENTER_X, y: TAILLIGHT_Y, rx: 6.5, ry: 5.2 }
  const fuelR = FUEL_CAP_DIAMETER / 2 + 0.3
  const outerGeom = gridGeometry(
    rows,
    false,
    (p) => insideEllipseXY(p, tailA) || insideEllipseXY(p, tailB) || insideCircleXY(p, { x: 0, y: FUEL_CAP_Y, r: fuelR }),
  )
  const backing = mergeGeometries([
    ellipsePatch(tailA.x, tailA.y, z - 0.6, tailA.rx, tailA.ry, -1),
    ellipsePatch(tailB.x, tailB.y, z - 0.6, tailB.rx, tailB.ry, -1),
    circlePatch(0, FUEL_CAP_Y, z - 0.4, fuelR, -1),
  ])
  const g = new THREE.Group()
  g.add(mesh(outerGeom, materials.paint), mesh(backing, materials.satinBlack))
  g.name = 'rearPanel'
  tagPart(g, 'rearPanel')
  return { id: 'rearPanel', objects: [g] }
}

function buildFrontValance(materials: CarMaterials): PartBuild {
  const XSEG = 24
  const YSEG = 10
  const yLow = VALANCE_BOTTOM_Y
  const yHigh = GRILLE_BOTTOM_Y - PANEL_GAP
  const halfWidth = GRILLE_HALF_WIDTH + 8
  const rows: THREE.Vector3[][] = []
  for (let i = 0; i <= YSEG; i++) {
    const y = yLow + (yHigh - yLow) * (i / YSEG)
    const row: THREE.Vector3[] = []
    for (let j = 0; j <= XSEG; j++) {
      const u = (j / XSEG) * 2 - 1
      row.push(new THREE.Vector3(halfWidth * u, y, NOSE_Z + PANEL_GAP - 2.4 * u * u))
    }
    rows.push(row)
  }
  const holeR = TURN_SIGNAL_HOLE_RADIUS
  const geom = gridGeometry(
    rows,
    false,
    (p) =>
      insideCircleXY(p, { x: TURN_SIGNAL_X, y: TURN_SIGNAL_Y, r: holeR }) ||
      insideCircleXY(p, { x: -TURN_SIGNAL_X, y: TURN_SIGNAL_Y, r: holeR }),
  )
  // The turn signals that fill the cut-outs: a chrome bezel, an amber lens and a satin-black
  // backing behind it, so the lens reads as a lamp instead of a window onto the suspension.
  const uSignal = TURN_SIGNAL_X / halfWidth
  const zSignal = NOSE_Z + PANEL_GAP - 2.4 * uSignal * uSignal
  const signalParts: THREE.BufferGeometry[] = []
  const backingParts: THREE.BufferGeometry[] = []
  const bezelParts: THREE.BufferGeometry[] = []
  for (const side of [1, -1] as const) {
    const x = TURN_SIGNAL_X * side
    signalParts.push(circlePatch(x, TURN_SIGNAL_Y, zSignal + TURN_SIGNAL_LENS_STANDOFF, holeR + 0.7, 1))
    backingParts.push(circlePatch(x, TURN_SIGNAL_Y, zSignal - TURN_SIGNAL_BACKING_INSET, holeR + 1.8, 1))
    const bezel = new THREE.RingGeometry(holeR + 0.6, holeR + TURN_SIGNAL_BEZEL_WIDTH, 24)
    bezel.translate(x, TURN_SIGNAL_Y, zSignal + TURN_SIGNAL_LENS_STANDOFF + 0.05)
    bezelParts.push(bezel)
  }
  const g = new THREE.Group()
  g.add(
    mesh(geom, materials.paint),
    mesh(mergeGeometries(backingParts), materials.satinBlack),
    mesh(mergeGeometries(bezelParts), materials.chrome),
    mesh(mergeGeometries(signalParts), materials.amberLens),
  )
  g.name = 'frontValance'
  tagPart(g, 'frontValance')
  return { id: 'frontValance', objects: [g] }
}

function buildRearValance(materials: CarMaterials): PartBuild {
  const XSEG = 22
  const YSEG = 10
  const yLow = ROCKER_TOP_Y - 3.5 // rocker bottom is not exported for the valance; close enough
  const yHigh = TAIL_BOTTOM_Y - PANEL_GAP
  const halfWidth = TAIL_HALF_WIDTH - 1
  const rows: THREE.Vector3[][] = []
  for (let i = 0; i <= YSEG; i++) {
    const y = yLow + (yHigh - yLow) * (i / YSEG)
    const row: THREE.Vector3[] = []
    for (let j = 0; j <= XSEG; j++) {
      const u = (j / XSEG) * 2 - 1
      row.push(new THREE.Vector3(halfWidth * u, y, TAIL_Z - PANEL_GAP + 2 * u * u))
    }
    rows.push(row)
  }
  const holeR = 1.6
  const geom = gridGeometry(
    rows,
    false,
    (p) =>
      insideCircleXY(p, { x: EXHAUST_TIP_X, y: EXHAUST_TIP_Y, r: holeR }) ||
      insideCircleXY(p, { x: -EXHAUST_TIP_X, y: EXHAUST_TIP_Y, r: holeR }),
  )
  const g = new THREE.Group()
  g.add(mesh(geom, materials.paint))
  g.name = 'rearValance'
  tagPart(g, 'rearValance')
  return { id: 'rearValance', objects: [g] }
}

// -------------------------------------------------------------------------------------------
// Glass: windshield, rear glass (both symmetric) and the mirrored door/quarter glass.
// -------------------------------------------------------------------------------------------

function buildWindshield(materials: CarMaterials): PartBuild {
  const ROWSEG = 12
  const COLSEG = 18
  const rows: THREE.Vector3[][] = []
  for (let i = 0; i <= ROWSEG; i++) {
    const t = i / ROWSEG
    const z = WINDSHIELD_BASE_Z + (WINDSHIELD_TOP_Z - WINDSHIELD_BASE_Z) * t
    const y = WINDSHIELD_BASE_Y + (WINDSHIELD_TOP_Y - WINDSHIELD_BASE_Y) * t
    const halfWidth = WINDSHIELD_BASE_HALF_WIDTH + (WINDSHIELD_TOP_HALF_WIDTH - WINDSHIELD_BASE_HALF_WIDTH) * t
    const bulge = 2 * Math.sin(Math.PI * t)
    const row: THREE.Vector3[] = []
    for (let j = 0; j <= COLSEG; j++) {
      const u = (j / COLSEG) * 2 - 1
      row.push(new THREE.Vector3(halfWidth * u, y, z + bulge * (1 - u * u)))
    }
    rows.push(row)
  }
  const g = new THREE.Group()
  g.add(glassMesh(loft(rows), materials.glass), mesh(boundaryMoulding(rows), materials.chrome))
  g.name = 'windshield'
  tagPart(g, 'windshield')
  return { id: 'windshield', objects: [g] }
}

function buildRearGlass(materials: CarMaterials): PartBuild {
  const ROWSEG = 12
  const COLSEG = 18
  const topHalf = ROOF_HALF_WIDTH - 1
  const rows: THREE.Vector3[][] = []
  for (let i = 0; i <= ROWSEG; i++) {
    const t = i / ROWSEG
    const z = ROOF_REAR_Z + (REAR_GLASS_BASE_Z - ROOF_REAR_Z) * t
    const y = 49.3 + (DECK_Y + 0.5 - 49.3) * t
    const halfWidth = topHalf + (REAR_GLASS_BASE_HALF_WIDTH - topHalf) * t
    const row: THREE.Vector3[] = []
    for (let j = 0; j <= COLSEG; j++) {
      row.push(new THREE.Vector3(halfWidth * ((j / COLSEG) * 2 - 1), y, z))
    }
    rows.push(row)
  }
  const g = new THREE.Group()
  g.add(glassMesh(loft(rows), materials.glass), mesh(boundaryMoulding(rows), materials.chrome))
  g.name = 'rearGlass'
  tagPart(g, 'rearGlass')
  return { id: 'rearGlass', objects: [g] }
}

function buildDoorGlassSide(materials: CarMaterials, side: Side): THREE.Group {
  const ROWSEG = 18
  const COLSEG = 10
  const zFrom = DOOR_FRONT_Z + 3
  const zTo = DOOR_REAR_Z + 1
  const rows: THREE.Vector3[][] = []
  for (let i = 0; i <= ROWSEG; i++) {
    const z = zFrom + (zTo - zFrom) * (i / ROWSEG)
    const s = stationAt(z)
    const gh = greenhouseAt(z)
    const yLow = s.belt[1]
    const yHigh = gh.top[1]
    // Tumblehome: the pane leans in from just inside the belt line to just inside the roof edge.
    const xLow = s.belt[0] - 0.4
    const xHigh = gh.top[0] - 0.6
    const row: THREE.Vector3[] = []
    for (let j = 0; j <= COLSEG; j++) {
      const t = j / COLSEG
      row.push(new THREE.Vector3((xLow + (xHigh - xLow) * t) * side, yLow + (yHigh - yLow) * t, z))
    }
    rows.push(row)
  }
  const g = new THREE.Group()
  g.add(glassMesh(loft(rows, side === 1), materials.glass), mesh(boundaryMoulding(rows), materials.chrome))
  g.name = 'doorGlass'
  tagPart(g, 'doorGlass')
  return g
}

function buildQuarterGlassSide(materials: CarMaterials, side: Side): THREE.Group {
  const ROWSEG = 12
  const COLSEG = 8
  const zFrom = QUARTER_GLASS_FRONT_Z
  const zTo = QUARTER_GLASS_REAR_Z
  const rows: THREE.Vector3[][] = []
  for (let i = 0; i <= ROWSEG; i++) {
    const z = zFrom + (zTo - zFrom) * (i / ROWSEG)
    const s = stationAt(z)
    const gh = greenhouseAt(z)
    const yLow = s.belt[1]
    const yHigh = Math.min(QUARTER_GLASS_TOP_Y, gh.top[1])
    // Same tumblehome plane as the sail panel it sits in, held a touch proud of it.
    const row: THREE.Vector3[] = []
    for (let j = 0; j <= COLSEG; j++) {
      const y = yLow + (yHigh - yLow) * (j / COLSEG)
      const tFull = (y - s.belt[1]) / (gh.top[1] - s.belt[1])
      const x = s.belt[0] + (gh.top[0] - s.belt[0]) * tFull + 0.5
      row.push(new THREE.Vector3(x * side, y, z))
    }
    rows.push(row)
  }
  const g = new THREE.Group()
  g.add(glassMesh(loft(rows, side === 1), materials.glass), mesh(boundaryMoulding(rows), materials.chrome))
  g.name = 'quarterGlass'
  tagPart(g, 'quarterGlass')
  return g
}

const buildDoorGlass = (materials: CarMaterials): PartBuild => ({
  id: 'doorGlass',
  objects: [buildDoorGlassSide(materials, -1), buildDoorGlassSide(materials, 1)],
})

const buildQuarterGlass = (materials: CarMaterials): PartBuild => ({
  id: 'quarterGlass',
  objects: [buildQuarterGlassSide(materials, -1), buildQuarterGlassSide(materials, 1)],
})

// -------------------------------------------------------------------------------------------

/** Builds all 17 body parts: 13 panels plus the windshield, rear glass and mirrored door and
 * quarter glass. Every mesh is tagged with `tagPart` and positioned in car space, rest/closed. */
export function buildBody(materials: CarMaterials): PartBuild[] {
  return [
    buildHood(materials),
    buildRoof(materials),
    buildCowl(materials),
    buildFenderLeft(materials),
    buildFenderRight(materials),
    buildDoorLeft(materials),
    buildDoorRight(materials),
    buildQuarterLeft(materials),
    buildQuarterRight(materials),
    buildTrunkLid(materials),
    buildRearPanel(materials),
    buildFrontValance(materials),
    buildRearValance(materials),
    buildWindshield(materials),
    buildRearGlass(materials),
    buildDoorGlass(materials),
    buildQuarterGlass(materials),
  ]
}
