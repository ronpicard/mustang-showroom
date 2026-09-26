/**
 * The dark, polished showroom the car stands in: a reflective epoxy floor, a turntable with an
 * LED ring, charcoal slatted walls with a backlit sign and LED strips, a ceiling carrying two long
 * softbox panels and six recessed can lights, a hemisphere/ambient fill, and a handful of props.
 * Everything here is code-built from three.js primitives and procedural `CanvasTexture`s - no
 * models, no image files.
 *
 * Unlike `roulette-royale`'s room (which is lit entirely by its engine), this room owns its own
 * lights - the six can-light `SpotLight`s, the hemisphere fill and the ambient fill are all created
 * and returned here, inside `group` - because the showroom's fixtures are shaped by this file, not
 * the engine. `Engine.ts` only adds the headlight/taillight lamps the car itself switches on, and
 * reads `environmentGroup`'s fixtures into the car's PMREM environment map (see that group's doc
 * comment below).
 *
 * World frame: inches, +Y up, floor at Y = 0, matching car space (`src/car/dimensions.ts`). The
 * turntable's centre is the world origin, so the car sits directly in car space when the turntable
 * is unrotated.
 */

import * as THREE from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CAR_CENTER, TURNTABLE_HEIGHT, TURNTABLE_RADIUS } from '../car/dimensions.ts'

export interface Showroom {
  /** Everything in the room. */
  group: THREE.Group
  /** Put the car in here; its origin is the turntable's centre at floor level, and the top of the
   * platform is at `TURNTABLE_HEIGHT`. The engine rotates this group for the turntable spin. */
  turntable: THREE.Group
  /** Long light panels and fixtures that must be present when the engine captures the environment
   * map. A child of `group`, rendered normally; the engine may temporarily reparent it into a
   * capture scene and must put it back afterward. */
  environmentGroup: THREE.Group
  /** Swaps the Reflector floor for a plain dark floor (low quality). */
  setReflections(on: boolean): void
  /**
   * Leaves `object` out of the floor's mirror pass. The car sits on the platform, so its only
   * visible reflection would be its bright chrome edges scribbled across the floor beyond the
   * turntable's rim, which reads as a glitch that turns with the turntable.
   */
  hideFromReflections(object: THREE.Object3D): void
  /** Subtle animation: nothing moves much; pulses the marquee slightly. */
  update(dt: number, elapsed: number): void
  dispose(): void
}

interface Disposable {
  dispose(): void
}

function disposeAll(items: readonly Disposable[]): void {
  for (const item of items) item.dispose()
}

// -------------------------------------------------------------------------------------------
// Palette
// -------------------------------------------------------------------------------------------

const WALL_COLOR = 0x141517
const CEILING_COLOR = 0x0c0c0e
const TURNTABLE_TOP_COLOR = 0x141416
const TURNTABLE_EDGE_COLOR = 0xa0a4a8
const LED_COLOR = 0xdfe8ff
const SIGNAGE_COLOR = 0xfff4e0
const STRIP_COLOR = 0xcfe0ff
const CAN_LIGHT_COLOR = 0xffe9c8
const SOFTBOX_COLOR = 0xffffff
const CHROME_COLOR = 0xd8dde2
const GLASS_SHOWCASE_COLOR = 0x0a0d12
const TOOL_CABINET_COLOR = 0x8a1418
const LOUNGE_COLOR = 0x101012
const TABLE_TOP_COLOR = 0x1b1b1e
const PLACARD_COLOR = 0x18181a
const TIRE_RUBBER_COLOR = 0x1b1b1c
const TIRE_HUB_COLOR = 0xc7cbcf

// -------------------------------------------------------------------------------------------
// Room shell sizes (inches). The back wall is at −Z (behind the tail, carrying the signage); the
// side walls run along X; the +Z wall is behind the showcase camera and stays plain.
// -------------------------------------------------------------------------------------------

/** The room is a 60 ft square. */
const ROOM_SIZE = 720
const ROOM_HALF = ROOM_SIZE / 2
const WALL_HEIGHT = 180
const CEILING_Y = WALL_HEIGHT

const FLOOR_TEXTURE_SIZE = 1024
/** One epoxy tile seam, inches. */
const FLOOR_TILE_SIZE = 24
/** Tiles baked into one copy of the canvas texture before it repeats across the floor. */
const FLOOR_TEXTURE_TILES = 6
const FLOOR_TEXTURE_REPEAT = ROOM_SIZE / (FLOOR_TEXTURE_TILES * FLOOR_TILE_SIZE)

/** Overlay plane sits this far above the Reflector so the two never z-fight. */
const FLOOR_OVERLAY_LIFT = 0.05
const FLOOR_OVERLAY_OPACITY_REFLECTIVE = 0.86
const FLOOR_OVERLAY_OPACITY_FLAT = 1
const FLOOR_OVERLAY_ROUGHNESS_REFLECTIVE = 0.55
const FLOOR_OVERLAY_ROUGHNESS_FLAT = 0.3
const FLOOR_OVERLAY_METALNESS_REFLECTIVE = 0.1
const FLOOR_OVERLAY_METALNESS_FLAT = 0.4

/** Wall slats: back-wall relief, alternating in and out by this depth every panel. */
const SLAT_WIDTH = 48
const SLAT_STEP_DEPTH = 0.4
const SLAT_COUNT = ROOM_SIZE / SLAT_WIDTH

/** The backlit signage panel above the slats. */
const SIGNAGE_WIDTH = 300
const SIGNAGE_HEIGHT = 24
const SIGNAGE_Y = 120
const SIGNAGE_INTENSITY = 3
/** How far the marquee's glow breathes, and how fast (`update`'s subtle animation). */
const SIGNAGE_PULSE_AMPLITUDE = 0.12
const SIGNAGE_PULSE_SPEED = 0.6

/** LED strips flanking the signage, along the back and side walls. */
const STRIP_WIDTH = 2
const STRIP_HEIGHT = 100
const STRIP_Y_CENTER = (20 + 120) / 2
const STRIP_SPACING = 48
const STRIP_COUNT = 12
const STRIP_INTENSITY = 2

/** Chrome-framed showcase glass on each side wall (optional per spec; kept small and cheap). */
const SHOWCASE_WIDTH = 60
const SHOWCASE_HEIGHT = 80
const SHOWCASE_Y = 60
const SHOWCASE_Z = 60
const SHOWCASE_FRAME_THICKNESS = 2

/** Ceiling softbox panels: long, soft, tilted toward the car so they streak along the paint. */
const SOFTBOX_LENGTH = 240
const SOFTBOX_WIDTH = 30
const SOFTBOX_Y = 150
const SOFTBOX_X = 70
const SOFTBOX_TILT = THREE.MathUtils.degToRad(12)
const SOFTBOX_INTENSITY = 1.4
const SOFTBOX_FRAME_THICKNESS = 2

/** Six recessed can lights in a ring above the turntable. */
const CAN_LIGHT_COUNT = 6
const CAN_LIGHT_RING_RADIUS = 150
const CAN_LIGHT_DIAMETER = 10
const CAN_LIGHT_DISC_INTENSITY = 2.5
/**
 * three 0.186 keeps physically-based lighting on at all times, so `SpotLight.intensity` is in
 * candela. At ~150 in throw with `decay = 1.4` and the engine's ACES exposure of 1.0, 2500 cd
 * reads as a bright but not blown-out pool; pick this as the starting point and let the engine
 * author retune once the car materials are in.
 */
const CAN_LIGHT_SPOT_INTENSITY = 2500
const CAN_LIGHT_SPOT_DECAY = 1.4
const CAN_LIGHT_SPOT_ANGLE = 0.55
const CAN_LIGHT_SPOT_PENUMBRA = 0.6
const CAN_LIGHT_SHADOW_MAP_SIZE = 2048
const CAN_LIGHT_SHADOW_BIAS = -0.0003
const CAN_LIGHT_SHADOW_NORMAL_BIAS = 0.02
/** Ring indices (of `CAN_LIGHT_COUNT`, starting at +Z and going clockwise) that cast shadows: one
 * from the front-left, one from the rear-right, so the car reads shadows from two directions. */
const CAN_LIGHT_SHADOW_INDICES: ReadonlySet<number> = new Set([2, 5])
/**
 * The car's own lighting rig: three tight spots on the turntable (a key from the front quarter,
 * a fill from the other side, a rim from behind) so the car stays bright while the room around
 * it stays dark. Positions are offsets from the car's centre, on the ceiling.
 */
const CAR_SPOT_COLOR = 0xfff6e6
const CAR_SPOTS: readonly { x: number; z: number; intensity: number }[] = [
  { x: -130, z: 150, intensity: 16000 },
  { x: 160, z: -30, intensity: 9500 },
  { x: -20, z: -190, intensity: 10000 },
]
const CAR_SPOT_DECAY = 1.4
const CAR_SPOT_ANGLE = 0.5
const CAR_SPOT_PENUMBRA = 0.55

const HEMI_SKY_COLOR = 0x3a3d44
const HEMI_GROUND_COLOR = 0x0a0a0c
const HEMI_INTENSITY = 0.35
const AMBIENT_COLOR = 0xffffff
const AMBIENT_INTENSITY = 0.08

const TURNTABLE_SEGMENTS = 72
/** The brushed edge ring's radial thickness. */
const TURNTABLE_EDGE_WIDTH = 2
const TURNTABLE_EDGE_HEIGHT = 0.6
/** The recessed LED ring sits just inside the platform's edge, mounted to the floor (static). */
const CONTACT_SHADOW_LENGTH = 205
const CONTACT_SHADOW_WIDTH = 92
const CONTACT_SHADOW_OPACITY = 0.7
const CONTACT_SHADOW_LIFT = 0.35
const CONTACT_SHADOW_TEXTURE_SIZE = 256

const LED_RING_RADIUS = TURNTABLE_RADIUS - 3
const LED_RING_TUBE_RADIUS = 0.4
const LED_RING_INTENSITY = 2.5

// -------------------------------------------------------------------------------------------
// Small deterministic helpers (local copies: this project has no shared texture module).
// -------------------------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable for showroom texture')
  return { canvas, ctx }
}

function finishColorTexture(canvas: HTMLCanvasElement, repeat: number): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeat, repeat)
  texture.needsUpdate = true
  return texture
}

/** Faint large mottling plus a fine grid of tile seams, both at very low contrast. */
/** A black ellipse fading to transparent at the edges, stretched over the car's footprint. */
function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = CONTACT_SHADOW_TEXTURE_SIZE
  canvas.height = CONTACT_SHADOW_TEXTURE_SIZE
  const context = canvas.getContext('2d')!
  const half = CONTACT_SHADOW_TEXTURE_SIZE / 2
  const gradient = context.createRadialGradient(half, half, half * 0.15, half, half, half)
  gradient.addColorStop(0, 'rgba(0, 0, 0, 1)')
  gradient.addColorStop(0.45, 'rgba(0, 0, 0, 0.75)')
  gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.2)')
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, CONTACT_SHADOW_TEXTURE_SIZE, CONTACT_SHADOW_TEXTURE_SIZE)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const FLOOR_TEXTURE_SEED = 0x9f00d
const FLOOR_BASE_COLOR = '#101013'
const FLOOR_MOTTLE_LIGHT = 'rgba(148, 152, 160, 0.05)'
const FLOOR_MOTTLE_DARK = 'rgba(0, 0, 0, 0.05)'
const FLOOR_SEAM_COLOR = 'rgba(180, 184, 190, 0.06)'

function makeFloorTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(FLOOR_TEXTURE_SIZE)
  const rand = mulberry32(FLOOR_TEXTURE_SEED)
  ctx.fillStyle = FLOOR_BASE_COLOR
  ctx.fillRect(0, 0, FLOOR_TEXTURE_SIZE, FLOOR_TEXTURE_SIZE)

  // Large soft mottling blotches, well bigger than a single tile, at 6% contrast.
  for (let i = 0; i < 22; i++) {
    const x = rand() * FLOOR_TEXTURE_SIZE
    const y = rand() * FLOOR_TEXTURE_SIZE
    const r = FLOOR_TEXTURE_SIZE * (0.12 + rand() * 0.22)
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
    gradient.addColorStop(0, rand() > 0.5 ? FLOOR_MOTTLE_LIGHT : FLOOR_MOTTLE_DARK)
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Fine tile-seam grid: FLOOR_TEXTURE_TILES squares across this copy of the texture.
  const tilePx = FLOOR_TEXTURE_SIZE / FLOOR_TEXTURE_TILES
  ctx.strokeStyle = FLOOR_SEAM_COLOR
  ctx.lineWidth = 1
  for (let i = 0; i <= FLOOR_TEXTURE_TILES; i++) {
    const p = Math.round(i * tilePx) + 0.5
    ctx.beginPath()
    ctx.moveTo(p, 0)
    ctx.lineTo(p, FLOOR_TEXTURE_SIZE)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, p)
    ctx.lineTo(FLOOR_TEXTURE_SIZE, p)
    ctx.stroke()
  }

  return finishColorTexture(canvas, FLOOR_TEXTURE_REPEAT)
}

// -------------------------------------------------------------------------------------------
// Floor: a Reflector plus a translucent, textured overlay that softens and tints the reflection.
// -------------------------------------------------------------------------------------------

interface FloorBuild {
  group: THREE.Group
  setReflections(on: boolean): void
  hideFromReflections(object: THREE.Object3D): void
  dispose(): void
}

function buildFloor(): FloorBuild {
  const group = new THREE.Group()
  group.name = 'floor'

  const reflectorGeometry = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE)
  const reflector = new Reflector(reflectorGeometry, {
    textureWidth: 1024,
    textureHeight: 1024,
    color: 0x303030,
    clipBias: 0.003,
  })
  reflector.rotation.x = -Math.PI / 2
  reflector.position.y = 0
  // The Reflector renders the scene from its mirrored camera inside its own onBeforeRender;
  // hiding these objects around that call keeps them out of the mirror only. The main pass has
  // already collected its render list by then, so they still draw normally.
  const hiddenFromReflection: THREE.Object3D[] = []
  const renderReflection = reflector.onBeforeRender
  reflector.onBeforeRender = function (this: THREE.Mesh, ...args: Parameters<THREE.Mesh['onBeforeRender']>) {
    const shown = hiddenFromReflection.filter((object) => object.visible)
    for (const object of shown) object.visible = false
    try {
      renderReflection.apply(this, args)
    } finally {
      for (const object of shown) object.visible = true
    }
  }

  const overlayGeometry = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE)
  const floorTexture = makeFloorTexture()
  const overlayMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b0b0d,
    map: floorTexture,
    transparent: true,
    opacity: FLOOR_OVERLAY_OPACITY_REFLECTIVE,
    roughness: FLOOR_OVERLAY_ROUGHNESS_REFLECTIVE,
    metalness: FLOOR_OVERLAY_METALNESS_REFLECTIVE,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })
  const overlay = new THREE.Mesh(overlayGeometry, overlayMaterial)
  overlay.rotation.x = -Math.PI / 2
  overlay.position.y = FLOOR_OVERLAY_LIFT
  overlay.receiveShadow = true

  group.add(reflector, overlay)

  function setReflections(on: boolean): void {
    reflector.visible = on
    overlayMaterial.opacity = on ? FLOOR_OVERLAY_OPACITY_REFLECTIVE : FLOOR_OVERLAY_OPACITY_FLAT
    overlayMaterial.roughness = on ? FLOOR_OVERLAY_ROUGHNESS_REFLECTIVE : FLOOR_OVERLAY_ROUGHNESS_FLAT
    overlayMaterial.metalness = on ? FLOOR_OVERLAY_METALNESS_REFLECTIVE : FLOOR_OVERLAY_METALNESS_FLAT
    overlayMaterial.needsUpdate = true
  }

  return {
    group,
    setReflections,
    hideFromReflections(object: THREE.Object3D) {
      if (!hiddenFromReflection.includes(object)) hiddenFromReflection.push(object)
    },
    dispose() {
      reflectorGeometry.dispose()
      reflector.dispose()
      overlayGeometry.dispose()
      overlayMaterial.dispose()
      floorTexture.dispose()
    },
  }
}

// -------------------------------------------------------------------------------------------
// Turntable: the rotating platform (added to `showroom.turntable`) plus the static LED ring
// (added directly to `group`, so it does not spin with the platform).
// -------------------------------------------------------------------------------------------

interface TurntableBuild {
  turntable: THREE.Group
  ledRing: THREE.Mesh
  dispose(): void
}

function buildTurntable(): TurntableBuild {
  const turntable = new THREE.Group()
  turntable.name = 'turntable'

  const platformMaterial = new THREE.MeshStandardMaterial({
    color: TURNTABLE_TOP_COLOR,
    roughness: 0.5,
    metalness: 0.3,
  })
  const platformGeometry = new THREE.CylinderGeometry(
    TURNTABLE_RADIUS,
    TURNTABLE_RADIUS,
    TURNTABLE_HEIGHT,
    TURNTABLE_SEGMENTS,
  )
  const platform = new THREE.Mesh(platformGeometry, platformMaterial)
  platform.position.y = TURNTABLE_HEIGHT / 2
  platform.receiveShadow = true
  platform.castShadow = true

  // The brushed-steel edge ring: a flat annulus laid on the platform's top face at the rim, plus
  // a thin cylindrical lip so the rim reads as a raised band from the side.
  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: TURNTABLE_EDGE_COLOR,
    roughness: 0.35,
    metalness: 1,
  })
  const edgeTopGeometry = new THREE.RingGeometry(
    TURNTABLE_RADIUS - TURNTABLE_EDGE_WIDTH,
    TURNTABLE_RADIUS,
    TURNTABLE_SEGMENTS,
  )
  const edgeTop = new THREE.Mesh(edgeTopGeometry, edgeMaterial)
  edgeTop.rotation.x = -Math.PI / 2
  edgeTop.position.y = TURNTABLE_HEIGHT + 0.01
  edgeTop.receiveShadow = true
  const edgeLipGeometry = new THREE.CylinderGeometry(
    TURNTABLE_RADIUS,
    TURNTABLE_RADIUS,
    TURNTABLE_EDGE_HEIGHT,
    TURNTABLE_SEGMENTS,
    1,
    true,
  )
  const edgeLip = new THREE.Mesh(edgeLipGeometry, edgeMaterial)
  edgeLip.position.y = TURNTABLE_HEIGHT - TURNTABLE_EDGE_HEIGHT / 2
  edgeLip.receiveShadow = true

  turntable.add(platform, edgeTop, edgeLip)

  // A soft contact shadow under the car's footprint: the spot shadows ground the car from two
  // directions, and this radial gradient darkens the platform directly beneath it the way the
  // occluded floor under a real car reads, whatever angle the lights come from.
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(CONTACT_SHADOW_LENGTH, CONTACT_SHADOW_WIDTH),
    new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      opacity: CONTACT_SHADOW_OPACITY,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  )
  contactShadow.rotation.x = -Math.PI / 2
  contactShadow.position.set(CAR_CENTER[0], TURNTABLE_HEIGHT + CONTACT_SHADOW_LIFT, CAR_CENTER[2])
  contactShadow.renderOrder = 1
  turntable.add(contactShadow)

  const ledMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a0a0c,
    emissive: LED_COLOR,
    emissiveIntensity: LED_RING_INTENSITY,
    roughness: 0.4,
    metalness: 0,
  })
  const ledGeometry = new THREE.TorusGeometry(LED_RING_RADIUS, LED_RING_TUBE_RADIUS, 6, 48)
  const ledRing = new THREE.Mesh(ledGeometry, ledMaterial)
  ledRing.rotation.x = Math.PI / 2
  ledRing.position.y = LED_RING_TUBE_RADIUS
  ledRing.name = 'turntableLedRing'

  return {
    turntable,
    ledRing,
    dispose() {
      platformGeometry.dispose()
      platformMaterial.dispose()
      edgeTopGeometry.dispose()
      edgeLipGeometry.dispose()
      edgeMaterial.dispose()
      ledGeometry.dispose()
      ledMaterial.dispose()
    },
  }
}

// -------------------------------------------------------------------------------------------
// Walls: charcoal slatted back wall with a backlit sign and LED strips, plain side and front
// walls, and a small chrome-framed showcase on each side.
// -------------------------------------------------------------------------------------------

interface WallsBuild {
  group: THREE.Group
  signageMaterial: THREE.MeshStandardMaterial
  environmentObjects: THREE.Object3D[]
  dispose(): void
}

function buildSlatGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < SLAT_COUNT; i++) {
    const depth = i % 2 === 0 ? SLAT_STEP_DEPTH : -SLAT_STEP_DEPTH
    const box = new THREE.BoxGeometry(SLAT_WIDTH, WALL_HEIGHT, SLAT_STEP_DEPTH * 2)
    box.translate(-ROOM_HALF + SLAT_WIDTH * (i + 0.5), WALL_HEIGHT / 2, depth)
    parts.push(box)
  }
  const merged = mergeGeometries(parts, false)
  for (const part of parts) part.dispose()
  return merged
}

function buildWalls(): WallsBuild {
  const group = new THREE.Group()
  group.name = 'walls'
  const disposables: Disposable[] = []
  const environmentObjects: THREE.Object3D[] = []

  const plainWallMaterial = new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.85 })
  disposables.push(plainWallMaterial)

  // Back wall (−Z): slatted relief plus the signage and LED strips.
  const backWallGeometry = new THREE.PlaneGeometry(ROOM_SIZE, WALL_HEIGHT)
  const backWall = new THREE.Mesh(backWallGeometry, plainWallMaterial)
  backWall.position.set(0, WALL_HEIGHT / 2, -ROOM_HALF)
  backWall.receiveShadow = true
  disposables.push(backWallGeometry)

  const slatGeometry = buildSlatGeometry()
  const slatMaterial = new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.85 })
  const slats = new THREE.Mesh(slatGeometry, slatMaterial)
  slats.position.z = -ROOM_HALF
  slats.receiveShadow = true
  disposables.push(slatGeometry, slatMaterial)

  // Side walls (±X), plain.
  const sideWallGeometry = new THREE.PlaneGeometry(ROOM_SIZE, WALL_HEIGHT)
  disposables.push(sideWallGeometry)
  const leftWall = new THREE.Mesh(sideWallGeometry, plainWallMaterial)
  leftWall.position.set(-ROOM_HALF, WALL_HEIGHT / 2, 0)
  leftWall.rotation.y = Math.PI / 2
  leftWall.receiveShadow = true
  const rightWall = new THREE.Mesh(sideWallGeometry, plainWallMaterial)
  rightWall.position.set(ROOM_HALF, WALL_HEIGHT / 2, 0)
  rightWall.rotation.y = -Math.PI / 2
  rightWall.receiveShadow = true

  // Front wall (+Z), behind the showcase camera: plain.
  const frontWallGeometry = new THREE.PlaneGeometry(ROOM_SIZE, WALL_HEIGHT)
  const frontWall = new THREE.Mesh(frontWallGeometry, plainWallMaterial)
  frontWall.position.set(0, WALL_HEIGHT / 2, ROOM_HALF)
  frontWall.rotation.y = Math.PI
  frontWall.receiveShadow = true
  disposables.push(frontWallGeometry)

  // Backlit signage panel, a shallow box so it reads with a hint of depth.
  const signageGeometry = new THREE.BoxGeometry(SIGNAGE_WIDTH, SIGNAGE_HEIGHT, 1)
  const signageMaterial = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: SIGNAGE_COLOR,
    emissiveIntensity: SIGNAGE_INTENSITY,
  })
  const signage = new THREE.Mesh(signageGeometry, signageMaterial)
  signage.position.set(0, SIGNAGE_Y, -ROOM_HALF + 1)
  disposables.push(signageGeometry, signageMaterial)
  environmentObjects.push(signage)

  // LED strips: distributed along the back wall and the front halves of the side walls, spaced
  // STRIP_SPACING apart, split evenly across the three runs.
  const stripGeometry = new THREE.PlaneGeometry(STRIP_WIDTH, STRIP_HEIGHT)
  const stripMaterial = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: STRIP_COLOR,
    emissiveIntensity: STRIP_INTENSITY,
    side: THREE.DoubleSide,
  })
  disposables.push(stripGeometry, stripMaterial)
  const stripsPerWall = Math.ceil(STRIP_COUNT / 3)
  const strips = new THREE.Group()
  strips.name = 'ledStrips'
  for (let i = 0; i < stripsPerWall; i++) {
    const offset = (i - (stripsPerWall - 1) / 2) * STRIP_SPACING
    const back = new THREE.Mesh(stripGeometry, stripMaterial)
    back.position.set(offset, STRIP_Y_CENTER, -ROOM_HALF + 0.6)
    strips.add(back)
    const left = new THREE.Mesh(stripGeometry, stripMaterial)
    left.position.set(-ROOM_HALF + 0.6, STRIP_Y_CENTER, -ROOM_HALF + SLAT_WIDTH + offset)
    left.rotation.y = Math.PI / 2
    strips.add(left)
    const right = new THREE.Mesh(stripGeometry, stripMaterial)
    right.position.set(ROOM_HALF - 0.6, STRIP_Y_CENTER, -ROOM_HALF + SLAT_WIDTH + offset)
    right.rotation.y = -Math.PI / 2
    strips.add(right)
  }
  environmentObjects.push(strips)

  // Small chrome-framed dark-glass showcases on each side wall.
  const showcaseGlassGeometry = new THREE.PlaneGeometry(SHOWCASE_WIDTH, SHOWCASE_HEIGHT)
  const showcaseGlassMaterial = new THREE.MeshStandardMaterial({
    color: GLASS_SHOWCASE_COLOR,
    roughness: 0.15,
    metalness: 0.2,
  })
  const showcaseFrameGeometry = buildFrameGeometry(SHOWCASE_WIDTH, SHOWCASE_HEIGHT, SHOWCASE_FRAME_THICKNESS)
  const showcaseFrameMaterial = new THREE.MeshStandardMaterial({
    color: CHROME_COLOR,
    roughness: 0.15,
    metalness: 1,
  })
  disposables.push(showcaseGlassGeometry, showcaseGlassMaterial, showcaseFrameGeometry, showcaseFrameMaterial)
  const showcases = new THREE.Group()
  showcases.name = 'showcases'
  for (const side of [-1, 1]) {
    const glass = new THREE.Mesh(showcaseGlassGeometry, showcaseGlassMaterial)
    const frame = new THREE.Mesh(showcaseFrameGeometry, showcaseFrameMaterial)
    const x = side * (ROOM_HALF - 0.6)
    glass.position.set(x, SHOWCASE_Y, SHOWCASE_Z)
    frame.position.copy(glass.position)
    glass.rotation.y = frame.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2
    glass.receiveShadow = true
    showcases.add(glass, frame)
  }

  group.add(backWall, slats, leftWall, rightWall, frontWall, signage, strips, showcases)

  return {
    group,
    signageMaterial,
    environmentObjects,
    dispose() {
      disposeAll(disposables)
    },
  }
}

/** A thin rectangular picture-frame outline, built from four merged boxes. */
function buildFrameGeometry(width: number, height: number, thickness: number): THREE.BufferGeometry {
  const depth = 1
  const parts = [
    new THREE.BoxGeometry(width + thickness * 2, thickness, depth).translate(0, height / 2 + thickness / 2, 0),
    new THREE.BoxGeometry(width + thickness * 2, thickness, depth).translate(0, -height / 2 - thickness / 2, 0),
    new THREE.BoxGeometry(thickness, height, depth).translate(-width / 2 - thickness / 2, 0, 0),
    new THREE.BoxGeometry(thickness, height, depth).translate(width / 2 + thickness / 2, 0, 0),
  ]
  const merged = mergeGeometries(parts, false)
  for (const part of parts) part.dispose()
  return merged
}

// -------------------------------------------------------------------------------------------
// Ceiling: dark plane, two long softbox panels (environment group) and six can lights with spots.
// -------------------------------------------------------------------------------------------

interface CeilingBuild {
  group: THREE.Group
  environmentObjects: THREE.Object3D[]
  spotLights: THREE.SpotLight[]
  dispose(): void
}

function buildCeiling(): CeilingBuild {
  const group = new THREE.Group()
  group.name = 'ceiling'
  const disposables: Disposable[] = []
  const environmentObjects: THREE.Object3D[] = []
  const spotLights: THREE.SpotLight[] = []

  const ceilingGeometry = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE)
  const ceilingMaterial = new THREE.MeshStandardMaterial({ color: CEILING_COLOR, roughness: 0.9 })
  const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial)
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = CEILING_Y
  disposables.push(ceilingGeometry, ceilingMaterial)

  // Two long softboxes running along Z (the car's length), tilted toward the turntable.
  const softboxGeometry = new THREE.PlaneGeometry(SOFTBOX_WIDTH, SOFTBOX_LENGTH)
  const softboxMaterial = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: SOFTBOX_COLOR,
    emissiveIntensity: SOFTBOX_INTENSITY,
    // Front side only (facing down): the top preset looks down from above the ceiling, and a
    // double-sided panel would fill that view with its back face.
  })
  const softboxFrameGeometry = buildFrameGeometry(SOFTBOX_WIDTH, SOFTBOX_LENGTH, SOFTBOX_FRAME_THICKNESS)
  const softboxFrameMaterial = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6 })
  disposables.push(softboxGeometry, softboxMaterial, softboxFrameGeometry, softboxFrameMaterial)
  const softboxes = new THREE.Group()
  softboxes.name = 'softboxes'
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(softboxGeometry, softboxMaterial)
    const frame = new THREE.Mesh(softboxFrameGeometry, softboxFrameMaterial)
    panel.position.set(side * SOFTBOX_X, SOFTBOX_Y, CAR_CENTER[2])
    panel.rotation.x = Math.PI / 2
    panel.rotation.z = side * SOFTBOX_TILT
    frame.position.copy(panel.position)
    frame.rotation.copy(panel.rotation)
    softboxes.add(panel, frame)
  }
  environmentObjects.push(softboxes)

  // Six recessed can lights in a ring, each an emissive disc plus a SpotLight; two cast shadows.
  const canDiscGeometry = new THREE.CircleGeometry(CAN_LIGHT_DIAMETER / 2, 20)
  const canDiscMaterial = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: CAN_LIGHT_COLOR,
    emissiveIntensity: CAN_LIGHT_DISC_INTENSITY,
  })
  const canHousingGeometry = new THREE.CylinderGeometry(
    CAN_LIGHT_DIAMETER / 2 + 0.8,
    CAN_LIGHT_DIAMETER / 2 + 0.8,
    2,
    20,
    1,
    true,
  )
  const canHousingMaterial = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.7, side: THREE.DoubleSide })
  disposables.push(canDiscGeometry, canDiscMaterial, canHousingGeometry, canHousingMaterial)
  const canLights = new THREE.Group()
  canLights.name = 'canLights'
  const aimTarget = new THREE.Vector3(CAR_CENTER[0], CAR_CENTER[1], CAR_CENTER[2])
  for (let i = 0; i < CAN_LIGHT_COUNT; i++) {
    const angle = (i / CAN_LIGHT_COUNT) * Math.PI * 2
    const x = Math.sin(angle) * CAN_LIGHT_RING_RADIUS
    const z = Math.cos(angle) * CAN_LIGHT_RING_RADIUS

    const disc = new THREE.Mesh(canDiscGeometry, canDiscMaterial)
    disc.rotation.x = Math.PI / 2
    disc.position.set(x, CEILING_Y - 1, z)
    const housing = new THREE.Mesh(canHousingGeometry, canHousingMaterial)
    housing.position.set(x, CEILING_Y - 1, z)
    canLights.add(disc, housing)

    const spot = new THREE.SpotLight(0xfff2df, CAN_LIGHT_SPOT_INTENSITY)
    spot.position.set(x, CEILING_Y - 1, z)
    spot.target.position.copy(aimTarget)
    spot.decay = CAN_LIGHT_SPOT_DECAY
    spot.angle = CAN_LIGHT_SPOT_ANGLE
    spot.penumbra = CAN_LIGHT_SPOT_PENUMBRA
    if (CAN_LIGHT_SHADOW_INDICES.has(i)) {
      spot.castShadow = true
      spot.shadow.mapSize.setScalar(CAN_LIGHT_SHADOW_MAP_SIZE)
      spot.shadow.bias = CAN_LIGHT_SHADOW_BIAS
      spot.shadow.normalBias = CAN_LIGHT_SHADOW_NORMAL_BIAS
    }
    canLights.add(spot, spot.target)
    spotLights.push(spot)
  }
  environmentObjects.push(canLights)

  const carSpots = new THREE.Group()
  carSpots.name = 'carSpots'
  for (const { x, z, intensity } of CAR_SPOTS) {
    const spot = new THREE.SpotLight(CAR_SPOT_COLOR, intensity)
    spot.position.set(CAR_CENTER[0] + x, CEILING_Y - 1, CAR_CENTER[2] + z)
    spot.target.position.copy(aimTarget)
    spot.decay = CAR_SPOT_DECAY
    spot.angle = CAR_SPOT_ANGLE
    spot.penumbra = CAR_SPOT_PENUMBRA
    carSpots.add(spot, spot.target)
    spotLights.push(spot)
  }
  environmentObjects.push(carSpots)

  group.add(ceiling, softboxes, canLights, carSpots)

  return { group, environmentObjects, spotLights, dispose: () => disposeAll(disposables) }
}

// -------------------------------------------------------------------------------------------
// Props: a few tasteful set pieces around the room.
// -------------------------------------------------------------------------------------------

interface PropsBuild {
  group: THREE.Group
  dispose(): void
}

const DISPLAY_STAND_POSITION: readonly [number, number, number] = [-160, 0, 140]
const TOOL_CABINET_POSITION: readonly [number, number, number] = [330, 0, -60]
const LOUNGE_POSITION: readonly [number, number, number] = [-320, 0, 40]
const TIRE_RACK_POSITION: readonly [number, number, number] = [200, 0, -340]

function buildDisplayStand(): { group: THREE.Group; disposables: Disposable[] } {
  const group = new THREE.Group()
  const postHeight = 40
  const postMaterial = new THREE.MeshStandardMaterial({ color: CHROME_COLOR, roughness: 0.2, metalness: 1 })
  const postGeometry = new THREE.CylinderGeometry(1.2, 1.2, postHeight, 12)
  const post = new THREE.Mesh(postGeometry, postMaterial)
  post.position.y = postHeight / 2
  post.castShadow = true
  post.receiveShadow = true

  const plateWidth = 30
  const plateHeight = 20
  const plateMaterial = new THREE.MeshStandardMaterial({ color: PLACARD_COLOR, roughness: 0.5, metalness: 0.2 })
  const plateGeometry = new THREE.BoxGeometry(plateWidth, plateHeight, 0.6)
  const plate = new THREE.Mesh(plateGeometry, plateMaterial)
  plate.position.y = postHeight + plateHeight / 2 - 2
  plate.rotation.x = THREE.MathUtils.degToRad(-20)
  plate.castShadow = true
  plate.receiveShadow = true

  const frameMaterial = new THREE.MeshStandardMaterial({ color: CHROME_COLOR, roughness: 0.15, metalness: 1 })
  const frameGeometry = buildFrameGeometry(plateWidth, plateHeight, 0.8)
  const frame = new THREE.Mesh(frameGeometry, frameMaterial)
  frame.position.copy(plate.position)
  frame.rotation.copy(plate.rotation)

  group.add(post, plate, frame)
  return {
    group,
    disposables: [postGeometry, postMaterial, plateGeometry, plateMaterial, frameGeometry, frameMaterial],
  }
}

function buildToolCabinet(): { group: THREE.Group; disposables: Disposable[] } {
  const group = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({ color: TOOL_CABINET_COLOR, roughness: 0.28, metalness: 0.4 })
  const lowerGeometry = new THREE.BoxGeometry(30, 24, 18)
  const lower = new THREE.Mesh(lowerGeometry, material)
  lower.position.y = 12
  const upperGeometry = new THREE.BoxGeometry(26, 16, 16)
  const upper = new THREE.Mesh(upperGeometry, material)
  upper.position.y = 24 + 8
  const handleMaterial = new THREE.MeshStandardMaterial({ color: CHROME_COLOR, roughness: 0.2, metalness: 1 })
  const handleGeometry = new THREE.BoxGeometry(14, 1, 1)
  const lowerHandle = new THREE.Mesh(handleGeometry, handleMaterial)
  lowerHandle.position.set(0, 12, 9.2)
  const upperHandle = new THREE.Mesh(handleGeometry, handleMaterial)
  upperHandle.position.set(0, 32, 8.2)
  for (const mesh of [lower, upper, lowerHandle, upperHandle]) {
    mesh.castShadow = true
    mesh.receiveShadow = true
  }
  group.add(lower, upper, lowerHandle, upperHandle)
  return { group, disposables: [lowerGeometry, upperGeometry, handleGeometry, material, handleMaterial] }
}

function buildLoungeSet(): { group: THREE.Group; disposables: Disposable[] } {
  const group = new THREE.Group()
  const chairMaterial = new THREE.MeshStandardMaterial({ color: LOUNGE_COLOR, roughness: 0.35, metalness: 0.1 })
  const seatGeometry = new THREE.BoxGeometry(24, 6, 24)
  const backGeometry = new THREE.BoxGeometry(24, 22, 6)
  const armGeometry = new THREE.BoxGeometry(4, 10, 24)
  const disposables: Disposable[] = [seatGeometry, backGeometry, armGeometry, chairMaterial]

  for (const side of [-1, 1]) {
    const chair = new THREE.Group()
    const seat = new THREE.Mesh(seatGeometry, chairMaterial)
    seat.position.y = 9
    const back = new THREE.Mesh(backGeometry, chairMaterial)
    back.position.set(0, 20, -9)
    const armLeft = new THREE.Mesh(armGeometry, chairMaterial)
    armLeft.position.set(-11, 14, 0)
    const armRight = new THREE.Mesh(armGeometry, chairMaterial)
    armRight.position.set(11, 14, 0)
    for (const mesh of [seat, back, armLeft, armRight]) {
      mesh.castShadow = true
      mesh.receiveShadow = true
    }
    chair.add(seat, back, armLeft, armRight)
    chair.position.set(0, 0, side * 18)
    group.add(chair)
  }

  const tableTopMaterial = new THREE.MeshStandardMaterial({ color: TABLE_TOP_COLOR, roughness: 0.3, metalness: 0.3 })
  const tableTopGeometry = new THREE.CylinderGeometry(10, 10, 1.5, 24)
  const tableTop = new THREE.Mesh(tableTopGeometry, tableTopMaterial)
  tableTop.position.set(26, 16, 0)
  const tableLegGeometry = new THREE.CylinderGeometry(1.5, 1.5, 15.25, 12)
  const tableLeg = new THREE.Mesh(tableLegGeometry, tableTopMaterial)
  tableLeg.position.set(26, 8, 0)
  tableTop.castShadow = tableLeg.castShadow = true
  tableTop.receiveShadow = tableLeg.receiveShadow = true
  disposables.push(tableTopGeometry, tableLegGeometry, tableTopMaterial)
  group.add(tableTop, tableLeg)

  return { group, disposables }
}

function buildTireRack(): { group: THREE.Group; disposables: Disposable[] } {
  const group = new THREE.Group()
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2c2f, roughness: 0.6, metalness: 0.6 })
  const uprightGeometry = new THREE.BoxGeometry(2, 30, 2)
  const railGeometry = new THREE.BoxGeometry(60, 2, 2)
  const disposables: Disposable[] = [uprightGeometry, railGeometry, frameMaterial]
  for (const x of [-29, 29]) {
    const upright = new THREE.Mesh(uprightGeometry, frameMaterial)
    upright.position.set(x, 15, 0)
    upright.castShadow = upright.receiveShadow = true
    group.add(upright)
  }
  const rail = new THREE.Mesh(railGeometry, frameMaterial)
  rail.position.set(0, 26, 0)
  rail.receiveShadow = true
  group.add(rail)

  const tireMaterial = new THREE.MeshStandardMaterial({ color: TIRE_RUBBER_COLOR, roughness: 0.85 })
  const hubMaterial = new THREE.MeshStandardMaterial({ color: TIRE_HUB_COLOR, roughness: 0.25, metalness: 1 })
  const tireGeometry = new THREE.TorusGeometry(9, 3.2, 6, 16)
  const hubGeometry = new THREE.CircleGeometry(4.5, 12)
  disposables.push(tireGeometry, hubGeometry, tireMaterial, hubMaterial)
  for (let i = 0; i < 4; i++) {
    const tire = new THREE.Mesh(tireGeometry, tireMaterial)
    const hub = new THREE.Mesh(hubGeometry, hubMaterial)
    const x = -18 + i * 12
    tire.position.set(x, 12, 4)
    hub.position.set(x, 12, 4)
    tire.castShadow = tire.receiveShadow = true
    hub.receiveShadow = true
    group.add(tire, hub)
  }

  return { group, disposables }
}

function buildProps(): PropsBuild {
  const group = new THREE.Group()
  group.name = 'props'
  const disposables: Disposable[] = []

  const stand = buildDisplayStand()
  stand.group.position.set(...DISPLAY_STAND_POSITION)
  const cabinet = buildToolCabinet()
  cabinet.group.position.set(...TOOL_CABINET_POSITION)
  cabinet.group.rotation.y = -Math.PI / 2
  const lounge = buildLoungeSet()
  lounge.group.position.set(...LOUNGE_POSITION)
  lounge.group.rotation.y = Math.PI / 2
  const tireRack = buildTireRack()
  tireRack.group.position.set(...TIRE_RACK_POSITION)

  disposables.push(...stand.disposables, ...cabinet.disposables, ...lounge.disposables, ...tireRack.disposables)
  group.add(stand.group, cabinet.group, lounge.group, tireRack.group)

  return { group, dispose: () => disposeAll(disposables) }
}

// -------------------------------------------------------------------------------------------
// Assembly
// -------------------------------------------------------------------------------------------

export function createShowroom(): Showroom {
  const group = new THREE.Group()
  group.name = 'showroom'

  const floor = buildFloor()
  const turntableBuild = buildTurntable()
  const walls = buildWalls()
  const ceiling = buildCeiling()
  const props = buildProps()

  // `Object3D.add` reparents: the signage, LED strips, softboxes and can-light ring were built (and
  // positioned) as children of `walls.group` / `ceiling.group` above, but belong in the capturable
  // `environmentGroup`, so moving them here is enough - three.js detaches each from its old parent.
  const environmentGroup = new THREE.Group()
  environmentGroup.name = 'showroomEnvironment'
  environmentGroup.add(...walls.environmentObjects, ...ceiling.environmentObjects)

  const hemiLight = new THREE.HemisphereLight(HEMI_SKY_COLOR, HEMI_GROUND_COLOR, HEMI_INTENSITY)
  const ambientLight = new THREE.AmbientLight(AMBIENT_COLOR, AMBIENT_INTENSITY)

  group.add(
    floor.group,
    turntableBuild.turntable,
    turntableBuild.ledRing,
    walls.group,
    ceiling.group,
    props.group,
    environmentGroup,
    hemiLight,
    ambientLight,
  )

  let elapsedTotal = 0

  return {
    group,
    turntable: turntableBuild.turntable,
    environmentGroup,
    setReflections(on: boolean): void {
      floor.setReflections(on)
    },
    hideFromReflections(object: THREE.Object3D) {
      floor.hideFromReflections(object)
    },
    update(dt: number, elapsed: number): void {
      elapsedTotal = elapsed
      const pulse = 1 + SIGNAGE_PULSE_AMPLITUDE * Math.sin(elapsedTotal * SIGNAGE_PULSE_SPEED)
      walls.signageMaterial.emissiveIntensity = SIGNAGE_INTENSITY * pulse
      void dt
    },
    dispose(): void {
      floor.dispose()
      turntableBuild.dispose()
      walls.dispose()
      ceiling.dispose()
      props.dispose()
      // THREE.Light (and its subclasses used here - HemisphereLight, AmbientLight, SpotLight) own
      // no GPU resources of their own to release; removing them from `group` is enough.
    },
  }
}
