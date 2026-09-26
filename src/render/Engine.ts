/**
 * Builds the three.js scene, camera, renderer and simulation loop for the showroom canvas.
 * Everything created here (geometries, materials, textures, render targets, the renderer, the
 * composer, the DOM listeners) is disposed by `dispose()`. Mirrors the structure of
 * `roulette-royale/src/render/Engine.ts`: renderer/composer setup, quality steps that only step
 * down, a ResizeObserver, and a scene-capture environment map.
 */

import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import type { CameraPreset, HingedPartId, PaintId, PartId, Vec3 } from '../car/types.ts'
import { HINGED_PARTS } from '../car/types.ts'
import { partById } from '../car/parts.ts'
import { paintById } from '../car/paints.ts'
import { approach, clamp01, easeInOut } from '../car/explode.ts'
import {
  BUMPER_HALF_WIDTH,
  FRONT_BUMPER_Z,
  HEADLIGHT_OUTER_X,
  HEADLIGHT_OUTER_Z,
  HEADLIGHT_Y,
  OVERALL_HEIGHT,
  REAR_BUMPER_Z,
  TAILLIGHT_CENTER_X,
  TAILLIGHT_Y,
  TAILLIGHT_Z,
  TURNTABLE_HEIGHT,
} from '../car/dimensions.ts'
import type { EngineApi, EngineEvents, EngineSnapshot, ViewInsets } from './engineApi.ts'
import { createCarAssembly } from './carAssembly.ts'
import { createShowroom } from './showroom.ts'
import { CATCH_FLARE_SECONDS, STARTER_CRANK_SECONDS } from '../engineSound.ts'

// -------------------------------------------------------------------------------------------
// Renderer / post-processing look
// -------------------------------------------------------------------------------------------

const BACKGROUND_COLOR = 0x08080a
const TONE_MAPPING_EXPOSURE = 1.0
const ENVIRONMENT_INTENSITY = 0.9
/** Sigma for the environment map's PMREM blur: a soft, wide light source, not a mirror. */
const ENVIRONMENT_SIGMA = 0.02
/** MSAA samples on the post-processing target; 0 would alias every edge of the car. */
const COMPOSER_MSAA_SAMPLES = 4
const BLOOM_STRENGTH = 0.14
const BLOOM_RADIUS = 0.3
const BLOOM_THRESHOLD = 1.35

/**
 * Rendering cost steps, best first. The engine starts at the first step a device can likely
 * hold and only ever steps down, when frames stay slow, so it never flip-flops mid-session.
 */
const QUALITY_STEPS: readonly {
  pixelRatio: number
  bloom: boolean
  shadowMapSize: number
  reflections: boolean
}[] = [
  { pixelRatio: 2, bloom: true, shadowMapSize: 2048, reflections: true },
  { pixelRatio: 1.5, bloom: true, shadowMapSize: 2048, reflections: true },
  { pixelRatio: 1, bloom: true, shadowMapSize: 1024, reflections: true },
  { pixelRatio: 1, bloom: false, shadowMapSize: 1024, reflections: false },
]
/** Touch screens are dense and their GPUs are usually weaker, so they start one step down. */
const TOUCH_START_QUALITY = 1
/** A frame slower than this (about 26 fps) counts toward stepping down. */
const SLOW_FRAME_SECONDS = 1 / 38
const SLOW_FRAMES_TO_STEP_DOWN = 90
/** Frames to ignore right after a step change, so the settling frame itself is not counted. */
const QUALITY_SETTLE_FRAMES = 60
/** Frames slower than this are treated as a stall, not real simulated time. */
const MAX_FRAME_SECONDS = 1 / 20

// -------------------------------------------------------------------------------------------
// Camera
// -------------------------------------------------------------------------------------------

const CAMERA_FOV_DEGREES = 35
/** Portrait screens open the vertical field of view so the car still fits across a phone. */
const CAMERA_FOV_PORTRAIT_DEGREES = 55

function fovFor(aspect: number): number {
  return aspect < 1 ? CAMERA_FOV_PORTRAIT_DEGREES : CAMERA_FOV_DEGREES
}
const CAMERA_NEAR = 2
const CAMERA_FAR = 3000

const CONTROLS_MIN_DISTANCE = 30
const CONTROLS_MAX_DISTANCE = 520
const CONTROLS_DAMPING_FACTOR = 0.08
/** Never lets the camera dip under the floor. */
const CONTROLS_MAX_POLAR_ANGLE = 1.62
const CONTROLS_MIN_POLAR_ANGLE = 0.15
const CONTROLS_ROTATE_SPEED = 0.6
const CONTROLS_ZOOM_SPEED = 0.8

const PRESET_TWEEN_SECONDS = 0.9
/** Binary-search iterations for the camera-fit distance; each halves the search interval. */
const FIT_ITERATIONS = 24
/** `showcase`'s auto-fit distance is pulled back this much further, so the car has some air. */
const SHOWCASE_FIT_MARGIN = 1.22
const DEFAULT_FOCUS_DIRECTION: Vec3 = [-0.66, 0.4, 0.64]
const DEFAULT_FOCUS_DISTANCE_FACTOR = 2.2
/** `focusPart`'s fit and search-distance bounds: the part's bounding sphere fills about this much of the smaller free-rect dimension. */
const FOCUS_FILL_FRACTION = 0.55
const FOCUS_MIN_DISTANCE = 40
const FOCUS_MAX_DISTANCE = 400
/** The camera never dips below this height, even when focusing a low part like a wheel. */
const MIN_EYE_Y = 4

const UP_AXIS: Vec3 = [0, 1, 0]

const SHOWCASE_EYE: Vec3 = [-190, 82, 250]
const SHOWCASE_TARGET: Vec3 = [0, 22, -6]

interface PresetView {
  eye: Vec3
  target: Vec3
}

/** Fixed presets (car space); `showcase` is handled separately because it auto-fits the car. */
const PRESET_VIEWS: Record<Exclude<CameraPreset, 'showcase'>, PresetView> = {
  front: { eye: [0, 40, 300], target: [0, 24, 0] },
  rear: { eye: [0, 45, -300], target: [0, 26, 0] },
  rearThreeQuarter: { eye: [-200, 70, -230], target: [0, 24, 0] },
  side: { eye: [-330, 45, 0], target: [0, 24, 0] },
  top: { eye: [-40, 330, 10], target: [0, 10, 0] },
  engine: { eye: [-70, 105, 120], target: [0, 30, 60] },
  interior: { eye: [40, 41, 2], target: [-12, 30, 14] },
  wheel: { eye: [-110, 24, 90], target: [-29, 13, 54] },
}

/**
 * Points used to auto-fit the `showcase` preset: the 8 corners of the car's overall box, swept
 * through a full turntable revolution in 15° steps. The turntable keeps turning in `showcase`,
 * so the fit has to hold at every angle, not just the one the camera was placed at.
 */
const CAR_FIT_SWEEP_STEPS = 24
/** Showcase refits caused by inset changes this soon after boot snap rather than tween. */
const BOOT_SNAP_MS = 1500
const CAR_FIT_CORNERS: readonly Vec3[] = (() => {
  const corners: Vec3[] = []
  for (let step = 0; step < CAR_FIT_SWEEP_STEPS; step++) {
    const angle = (step / CAR_FIT_SWEEP_STEPS) * Math.PI * 2
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    for (const x of [-BUMPER_HALF_WIDTH, BUMPER_HALF_WIDTH]) {
      for (const z of [FRONT_BUMPER_Z, REAR_BUMPER_Z]) {
        const rx = x * cos + z * sin
        const rz = -x * sin + z * cos
        corners.push([rx, 0, rz], [rx, OVERALL_HEIGHT, rz])
      }
    }
  }
  return corners
})()

// -------------------------------------------------------------------------------------------
// Turntable, explode, hinges
// -------------------------------------------------------------------------------------------

const TURNTABLE_SPIN_RATE = 0.12
/** Exponential approach rate (per second) the smoothed explode amount eases toward its target. */
const EXPLODE_APPROACH_RATE = 6
/** Exponential approach rate (per second) each hinge's openness eases toward 0 or 1. */
const HINGE_APPROACH_RATE = 5

// -------------------------------------------------------------------------------------------
// Picking and highlights
// -------------------------------------------------------------------------------------------

const PICK_MAX_DRAG_PX = 6
const PICK_MAX_DURATION_MS = 400

type HighlightKind = 'hover' | 'selected'
const HIGHLIGHT_CONFIG: Record<HighlightKind, { color: number; intensity: number }> = {
  hover: { color: 0x2f5aa8, intensity: 0.15 },
  selected: { color: 0xffb35c, intensity: 0.2 },
}

// -------------------------------------------------------------------------------------------
// Headlights and taillights
// -------------------------------------------------------------------------------------------

const HEADLIGHT_COLOR = 0xfff1cc
/** Candela-scale intensity: tuned to show two pools on the floor and wall ahead of the car under
 * the engine's ACES tone mapping at exposure 1.0. Revisit alongside the showroom's own lights. */
const HEADLIGHT_INTENSITY = 9000
/** Engine-bay shake multipliers (1 = the running rattle) while cranking, at the catch, and dying on shutdown. */
const ENGINE_SHAKE_CRANK = 0.55
const ENGINE_SHAKE_CATCH = 2.6
/** The catch shudder settles over this fraction of the audio's flare. */
const ENGINE_SHAKE_SETTLE_FRACTION = 0.4
const ENGINE_SHAKE_STOP = 1.8
const ENGINE_SHAKE_STOP_SECONDS = 0.9
const HEADLIGHT_ANGLE = 0.42
const HEADLIGHT_PENUMBRA = 0.5
const HEADLIGHT_DECAY = 1.5
/** How far ahead of the lamp the aim target sits. */
const HEADLIGHT_THROW = 220
const TAILLIGHT_COLOR = 0xff2a2a
const TAILLIGHT_INTENSITY = 18
const TAILLIGHT_DECAY = 2

// -------------------------------------------------------------------------------------------
// Engine
// -------------------------------------------------------------------------------------------

/**
 * Builds and runs the whole showroom on `canvas`, reporting hover/pick/camera/sound/ready events
 * back through `events`.
 */
export function createEngine(canvas: HTMLCanvasElement, events: EngineEvents): EngineApi {
  // --- Renderer / scene ------------------------------------------------------------------------

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  const requestedQuality = new URLSearchParams(window.location.search).get('quality')
  const qualityPinned = requestedQuality === 'high' || requestedQuality === 'low'
  const touchDevice = window.matchMedia('(pointer: coarse)').matches
  let qualityStep =
    requestedQuality === 'high' ? 0
    : requestedQuality === 'low' ? QUALITY_STEPS.length - 1
    : touchDevice ? TOUCH_START_QUALITY
    : 0
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY_STEPS[qualityStep]!.pixelRatio))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(BACKGROUND_COLOR)

  const showroom = createShowroom()

  // --- Environment map: capture the showroom's own light panels, not a studio HDRI -------------

  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  const captureScene = new THREE.Scene()
  captureScene.background = new THREE.Color(BACKGROUND_COLOR)
  const captureBackdropGeometry = new THREE.SphereGeometry(2000, 16, 12)
  const captureBackdropMaterial = new THREE.MeshBasicMaterial({ color: BACKGROUND_COLOR, side: THREE.BackSide })
  const captureBackdrop = new THREE.Mesh(captureBackdropGeometry, captureBackdropMaterial)
  captureScene.add(captureBackdrop)
  captureScene.add(showroom.environmentGroup) // reparents out of showroom.group for the capture
  const environmentTarget = pmremGenerator.fromScene(captureScene, ENVIRONMENT_SIGMA)
  scene.environment = environmentTarget.texture
  scene.environmentIntensity = ENVIRONMENT_INTENSITY
  showroom.group.add(showroom.environmentGroup) // reparent back; it renders normally from here on
  captureBackdropGeometry.dispose()
  captureBackdropMaterial.dispose()
  pmremGenerator.dispose()

  scene.add(showroom.group)

  const assembly = createCarAssembly()
  assembly.group.position.set(0, TURNTABLE_HEIGHT, 0)
  showroom.turntable.add(assembly.group)
  showroom.hideFromReflections(assembly.group)

  // --- Camera and controls ---------------------------------------------------------------------

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEGREES, 1, CAMERA_NEAR, CAMERA_FAR)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = CONTROLS_DAMPING_FACTOR
  controls.enablePan = false
  controls.minDistance = CONTROLS_MIN_DISTANCE
  controls.maxDistance = CONTROLS_MAX_DISTANCE
  controls.maxPolarAngle = CONTROLS_MAX_POLAR_ANGLE
  controls.minPolarAngle = CONTROLS_MIN_POLAR_ANGLE
  controls.rotateSpeed = CONTROLS_ROTATE_SPEED
  controls.zoomSpeed = CONTROLS_ZOOM_SPEED
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }

  // --- Post-processing --------------------------------------------------------------------------

  // A multisampled target keeps the edges anti-aliased through the bloom pass (a plain composer
  // target would drop the canvas's own MSAA); half floats keep the bloom's HDR headroom.
  const composerTarget = new THREE.WebGLRenderTarget(1, 1, { samples: COMPOSER_MSAA_SAMPLES, type: THREE.HalfFloatType })
  const composer = new EffectComposer(renderer, composerTarget)
  const renderPass = new RenderPass(scene, camera)
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD)
  const outputPass = new OutputPass()
  bloomPass.enabled = QUALITY_STEPS[qualityStep]!.bloom
  composer.addPass(renderPass)
  composer.addPass(bloomPass)
  composer.addPass(outputPass)

  // --- Headlights and taillights: parented to the car, not any part, so they never explode -----

  const headlightLeft = new THREE.SpotLight(HEADLIGHT_COLOR, HEADLIGHT_INTENSITY)
  headlightLeft.angle = HEADLIGHT_ANGLE
  headlightLeft.penumbra = HEADLIGHT_PENUMBRA
  headlightLeft.decay = HEADLIGHT_DECAY
  headlightLeft.castShadow = false
  headlightLeft.visible = false
  headlightLeft.position.set(-HEADLIGHT_OUTER_X, HEADLIGHT_Y, HEADLIGHT_OUTER_Z)
  headlightLeft.target.position.set(-HEADLIGHT_OUTER_X, HEADLIGHT_Y * 0.5, HEADLIGHT_OUTER_Z + HEADLIGHT_THROW)

  const headlightRight = new THREE.SpotLight(HEADLIGHT_COLOR, HEADLIGHT_INTENSITY)
  headlightRight.angle = HEADLIGHT_ANGLE
  headlightRight.penumbra = HEADLIGHT_PENUMBRA
  headlightRight.decay = HEADLIGHT_DECAY
  headlightRight.castShadow = false
  headlightRight.visible = false
  headlightRight.position.set(HEADLIGHT_OUTER_X, HEADLIGHT_Y, HEADLIGHT_OUTER_Z)
  headlightRight.target.position.set(HEADLIGHT_OUTER_X, HEADLIGHT_Y * 0.5, HEADLIGHT_OUTER_Z + HEADLIGHT_THROW)

  const taillightLeft = new THREE.PointLight(TAILLIGHT_COLOR, TAILLIGHT_INTENSITY, 0, TAILLIGHT_DECAY)
  taillightLeft.visible = false
  taillightLeft.position.set(-TAILLIGHT_CENTER_X, TAILLIGHT_Y, TAILLIGHT_Z)

  const taillightRight = new THREE.PointLight(TAILLIGHT_COLOR, TAILLIGHT_INTENSITY, 0, TAILLIGHT_DECAY)
  taillightRight.visible = false
  taillightRight.position.set(TAILLIGHT_CENTER_X, TAILLIGHT_Y, TAILLIGHT_Z)

  assembly.group.add(
    headlightLeft,
    headlightLeft.target,
    headlightRight,
    headlightRight.target,
    taillightLeft,
    taillightRight,
  )

  // --- Highlights: cached per (material, kind), never mutating the shared car materials --------

  const highlightCache = new Map<string, THREE.Material>()
  const originalMaterials = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>()

  function highlightVariantOf(material: THREE.Material, kind: HighlightKind): THREE.Material {
    const key = `${material.uuid}:${kind}`
    const cached = highlightCache.get(key)
    if (cached) return cached
    const variant = material.clone() as THREE.MeshStandardMaterial
    const config = HIGHLIGHT_CONFIG[kind]
    variant.emissive.set(config.color)
    variant.emissiveIntensity = config.intensity
    variant.emissiveMap = null
    highlightCache.set(key, variant)
    return variant
  }

  function highlightMaterialFor(
    material: THREE.Material | THREE.Material[],
    kind: HighlightKind,
  ): THREE.Material | THREE.Material[] {
    if (Array.isArray(material)) return material.map((entry) => highlightVariantOf(entry, kind))
    return highlightVariantOf(material, kind)
  }

  function applyHighlight(id: PartId, kind: HighlightKind): void {
    assembly.forEachMesh(id, (mesh) => {
      let original = originalMaterials.get(mesh)
      if (!original) {
        original = mesh.material
        originalMaterials.set(mesh, original)
      }
      mesh.material = highlightMaterialFor(original, kind)
    })
  }

  function clearHighlight(id: PartId): void {
    assembly.forEachMesh(id, (mesh) => {
      const original = originalMaterials.get(mesh)
      if (original) mesh.material = original
    })
  }

  // --- Camera fit and preset tweening -----------------------------------------------------------

  let insets: ViewInsets = { left: 0, top: 0, right: 0, bottom: 0 }
  let aspect = 1

  const probeCamera = new THREE.PerspectiveCamera(CAMERA_FOV_DEGREES, 1, CAMERA_NEAR, CAMERA_FAR)
  const projectedScratch = new THREE.Vector3()
  const eyeScratch = new THREE.Vector3()
  const carFitCornerScratch = CAR_FIT_CORNERS.map(() => new THREE.Vector3())
  const sphereFitPointScratch = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]
  const boxScratch = new THREE.Box3()
  const sphereScratch = new THREE.Sphere()

  const controlsUpVector = new THREE.Vector3(UP_AXIS[0], UP_AXIS[1], UP_AXIS[2])

  function carToWorld(point: Vec3, target: THREE.Vector3): THREE.Vector3 {
    return target.set(point[0], point[1], point[2]).applyAxisAngle(controlsUpVector, showroom.turntable.rotation.y)
  }

  function freeFractions(): { freeX: number; freeY: number } {
    const width = canvas.clientWidth || 1
    const height = canvas.clientHeight || 1
    const freeWidth = Math.max(1, width - insets.left - insets.right)
    const freeHeight = Math.max(1, height - insets.top - insets.bottom)
    return { freeX: freeWidth / width, freeY: freeHeight / height }
  }

  function pointsFitAt(eye: THREE.Vector3, target: THREE.Vector3, points: readonly THREE.Vector3[], limitX: number, limitY: number): boolean {
    probeCamera.fov = fovFor(aspect)
    probeCamera.aspect = aspect
    probeCamera.near = CAMERA_NEAR
    probeCamera.far = CAMERA_FAR
    probeCamera.position.copy(eye)
    probeCamera.up.set(0, 1, 0)
    probeCamera.lookAt(target)
    probeCamera.updateMatrixWorld(true)
    probeCamera.updateProjectionMatrix()
    return points.every((point) => {
      projectedScratch.copy(point).project(probeCamera)
      return Math.abs(projectedScratch.x) <= limitX && Math.abs(projectedScratch.y) <= limitY
    })
  }

  /** Binary-searches the smallest distance along `direction` from `target` at which `points` all project within the limits. */
  function fitDistance(
    target: THREE.Vector3,
    direction: THREE.Vector3,
    points: readonly THREE.Vector3[],
    limitX: number,
    limitY: number,
    minDistance: number,
    maxDistance: number,
  ): number {
    function fitsAt(distance: number): boolean {
      eyeScratch.copy(direction).multiplyScalar(distance).add(target)
      return pointsFitAt(eyeScratch, target, points, limitX, limitY)
    }
    if (!fitsAt(maxDistance)) return maxDistance
    let lo = minDistance
    let hi = maxDistance
    for (let i = 0; i < FIT_ITERATIONS; i++) {
      const mid = (lo + hi) / 2
      if (fitsAt(mid)) hi = mid
      else lo = mid
    }
    return hi
  }

  function computeShowcaseView(): { eye: THREE.Vector3; target: THREE.Vector3 } {
    const target = carToWorld(SHOWCASE_TARGET, new THREE.Vector3())
    const rawEye = carToWorld(SHOWCASE_EYE, new THREE.Vector3())
    const direction = rawEye.clone().sub(target).normalize()
    CAR_FIT_CORNERS.forEach((corner, index) => carToWorld(corner, carFitCornerScratch[index]!))
    const { freeX, freeY } = freeFractions()
    const rawDistance = fitDistance(
      target,
      direction,
      carFitCornerScratch,
      freeX,
      freeY,
      CONTROLS_MIN_DISTANCE,
      CONTROLS_MAX_DISTANCE,
    )
    const distance = THREE.MathUtils.clamp(rawDistance * SHOWCASE_FIT_MARGIN, CONTROLS_MIN_DISTANCE, CONTROLS_MAX_DISTANCE)
    const eye = direction.clone().multiplyScalar(distance).add(target)
    return { eye, target }
  }

  function computePresetView(preset: Exclude<CameraPreset, 'showcase'>): { eye: THREE.Vector3; target: THREE.Vector3 } {
    const view = PRESET_VIEWS[preset]
    return { eye: carToWorld(view.eye, new THREE.Vector3()), target: carToWorld(view.target, new THREE.Vector3()) }
  }

  function computePartView(id: PartId): { eye: THREE.Vector3; target: THREE.Vector3 } {
    assembly.partBounds(id, boxScratch)
    boxScratch.getBoundingSphere(sphereScratch)
    const center = sphereScratch.center.clone()
    const info = partById(id)
    const focusDirectionCar = info.focus?.direction ?? DEFAULT_FOCUS_DIRECTION
    const direction = carToWorld(focusDirectionCar, new THREE.Vector3())
    const radius = Math.max(1, sphereScratch.radius)
    const distanceFactor = info.focus?.distanceFactor ?? DEFAULT_FOCUS_DISTANCE_FACTOR
    // The raw radius * distanceFactor reach, clamped, becomes the ceiling the fit search below is
    // allowed to pull back to: a part with a bigger distanceFactor tolerates a looser final shot.
    const maxDistance = THREE.MathUtils.clamp(radius * distanceFactor, FOCUS_MIN_DISTANCE, FOCUS_MAX_DISTANCE)

    sphereFitPointScratch[0]!.copy(center).addScaledVector(new THREE.Vector3(1, 0, 0), radius)
    sphereFitPointScratch[1]!.copy(center).addScaledVector(new THREE.Vector3(-1, 0, 0), radius)
    sphereFitPointScratch[2]!.copy(center).addScaledVector(new THREE.Vector3(0, 1, 0), radius)
    sphereFitPointScratch[3]!.copy(center).addScaledVector(new THREE.Vector3(0, -1, 0), radius)
    sphereFitPointScratch[4]!.copy(center).addScaledVector(new THREE.Vector3(0, 0, 1), radius)
    sphereFitPointScratch[5]!.copy(center).addScaledVector(new THREE.Vector3(0, 0, -1), radius)

    const { freeX, freeY } = freeFractions()
    const limitX = freeX * FOCUS_FILL_FRACTION
    const limitY = freeY * FOCUS_FILL_FRACTION
    const distance = fitDistance(
      center,
      direction,
      sphereFitPointScratch,
      limitX,
      limitY,
      FOCUS_MIN_DISTANCE,
      maxDistance,
    )
    const eye = direction.clone().multiplyScalar(distance).add(center)
    eye.y = Math.max(eye.y, MIN_EYE_Y)
    return { eye, target: center }
  }

  interface CameraTween {
    fromEye: THREE.Vector3
    toEye: THREE.Vector3
    fromTarget: THREE.Vector3
    toTarget: THREE.Vector3
    elapsed: number
    onDone: () => void
  }
  let tween: CameraTween | null = null
  let currentPreset: CameraPreset | 'custom' | 'part' = 'showcase'
  let lastAppliedPreset: CameraPreset = 'showcase'
  /** The very first placement snaps instead of tweening in from the camera's default (0,0,0). */
  let cameraPlaced = false
  const createdAt = performance.now()

  function beginTween(eye: THREE.Vector3, target: THREE.Vector3, onDone: () => void): void {
    if (!cameraPlaced) {
      cameraPlaced = true
      camera.position.copy(eye)
      controls.target.copy(target)
      camera.lookAt(target)
      controls.update()
      onDone()
      return
    }
    tween = {
      fromEye: camera.position.clone(),
      toEye: eye,
      fromTarget: controls.target.clone(),
      toTarget: target,
      elapsed: 0,
      onDone,
    }
    controls.enabled = false
  }

  // OrbitControls.update() re-derives camera.position from its own internal spherical state, so
  // driving the camera by hand during a tween must bypass it entirely (camera.lookAt instead);
  // only once the tween finishes do we hand control back and let it resync from the final pose.
  function updateTween(dt: number): void {
    if (!tween) return
    tween.elapsed += dt
    const t = clamp01(tween.elapsed / PRESET_TWEEN_SECONDS)
    const s = easeInOut(t)
    camera.position.lerpVectors(tween.fromEye, tween.toEye, s)
    controls.target.lerpVectors(tween.fromTarget, tween.toTarget, s)
    camera.lookAt(controls.target)
    if (t >= 1) {
      const done = tween.onDone
      tween = null
      controls.enabled = true
      controls.update()
      done()
    }
  }

  function applyPreset(preset: CameraPreset): void {
    tween = null
    currentPreset = preset
    lastAppliedPreset = preset
    const view = preset === 'showcase' ? computeShowcaseView() : computePresetView(preset)
    beginTween(view.eye, view.target, () => events.onCamera(preset))
  }

  function focusPart(id: PartId | null): void {
    if (id === null) {
      applyPreset(lastAppliedPreset)
      return
    }
    tween = null
    currentPreset = 'part'
    const view = computePartView(id)
    beginTween(view.eye, view.target, () => events.onCamera('part'))
  }

  controls.addEventListener('start', () => {
    if (tween) return // programmatic tweens disable controls; this guards belt-and-braces
    if (currentPreset !== 'custom') {
      currentPreset = 'custom'
      events.onCamera('custom')
    }
  })

  // --- View insets: keep the car clear of the UI ------------------------------------------------

  function applyViewOffset(): void {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (width === 0 || height === 0) return
    const freeWidth = Math.max(1, width - insets.left - insets.right)
    const freeHeight = Math.max(1, height - insets.top - insets.bottom)
    const freeCenterX = insets.left + freeWidth / 2
    const freeCenterY = insets.top + freeHeight / 2
    camera.setViewOffset(width, height, -(freeCenterX - width / 2), -(freeCenterY - height / 2), width, height)
  }

  // --- Explode, hinges, paint, lights, turntable state -------------------------------------------

  let explodeCurrent = 0
  let explodeTarget = 0
  const openTargets: Record<HingedPartId, number> = { hood: 0, doorLeft: 0, doorRight: 0, trunkLid: 0 }
  const openCurrent: Record<HingedPartId, number> = { hood: 0, doorLeft: 0, doorRight: 0, trunkLid: 0 }
  let headlightsOn = false
  let engineRunning = false
  /** `elapsedTime` when the engine last started or stopped, for the start-up and shutdown shudders. */
  /** Starts long enough ago that the engine-off shudder has already died away at boot. */
  let engineToggledAt = -ENGINE_SHAKE_STOP_SECONDS
  let turntableOn = true
  let paused = false
  let selectedId: PartId | null = null
  let hoveredId: PartId | null = null
  let elapsedTime = 0
  let readyFired = false

  function setPaint(id: PaintId): void {
    assembly.materials.setPaint(paintById(id))
  }

  function setExplode(amount: number): void {
    const clamped = clamp01(amount)
    if (explodeTarget === 0 && clamped > 0) events.onSound('explode', clamped)
    else if (explodeTarget !== 0 && clamped === 0) events.onSound('assemble', 1)
    explodeTarget = clamped
  }

  function setOpen(part: HingedPartId, open: boolean): void {
    const target = open ? 1 : 0
    if (openTargets[part] !== target) events.onSound(open ? 'latchOpen' : 'latchClose', 1)
    openTargets[part] = target
  }

  function setCameraPreset(preset: CameraPreset): void {
    applyPreset(preset)
  }

  function setSelected(id: PartId | null): void {
    if (id === selectedId) return
    const previous = selectedId
    selectedId = id
    if (previous !== null) {
      if (previous === hoveredId) applyHighlight(previous, 'hover')
      else clearHighlight(previous)
    }
    if (selectedId !== null) applyHighlight(selectedId, 'selected')
  }

  function setTurntable(on: boolean): void {
    turntableOn = on
  }

  function setHeadlights(on: boolean): void {
    if (on === headlightsOn) return
    headlightsOn = on
    assembly.materials.setLights(on)
    headlightLeft.visible = on
    headlightRight.visible = on
    taillightLeft.visible = on
    taillightRight.visible = on
    events.onSound(on ? 'lightsOn' : 'lightsOff', 1)
  }

  /**
   * How hard the engine bay shakes `sinceToggle` seconds after the last start or stop, in step
   * with the sound: a lurch while the starter cranks, a heavy shudder as it catches and flares,
   * settling to the running rattle; on shutdown a dying shudder that fades out.
   */
  function engineShakeAmount(sinceToggle: number): number {
    if (engineRunning) {
      if (sinceToggle < STARTER_CRANK_SECONDS) return ENGINE_SHAKE_CRANK
      const sinceCatch = sinceToggle - STARTER_CRANK_SECONDS
      return 1 + (ENGINE_SHAKE_CATCH - 1) * Math.exp(-sinceCatch / (CATCH_FLARE_SECONDS * ENGINE_SHAKE_SETTLE_FRACTION))
    }
    if (sinceToggle >= ENGINE_SHAKE_STOP_SECONDS) return 0
    return ENGINE_SHAKE_STOP * (1 - sinceToggle / ENGINE_SHAKE_STOP_SECONDS)
  }

  function setEngineRunning(on: boolean): void {
    if (on === engineRunning) return
    engineRunning = on
    engineToggledAt = elapsedTime
    events.onSound(on ? 'starter' : 'engineStop', 1)
  }

  function setViewInsets(next: ViewInsets): void {
    const clean = (value: number): number => (Number.isFinite(value) && value > 0 ? value : 0)
    const cleaned = { left: clean(next.left), top: clean(next.top), right: clean(next.right), bottom: clean(next.bottom) }
    const changed =
      cleaned.left !== insets.left || cleaned.top !== insets.top || cleaned.right !== insets.right || cleaned.bottom !== insets.bottom
    insets = cleaned
    applyViewOffset()
    // The showcase fit depends on the free rect, so a panel opening or closing re-fits the car
    // (a short tween); fixed presets and the user's own orbit only get the offset shift above.
    // The UI reports its first insets just after boot, when the car has already been fitted to the
    // bare viewport: that refit snaps, or the opening frames dolly in from low under the nose.
    if (changed && currentPreset === 'showcase') {
      if (performance.now() - createdAt < BOOT_SNAP_MS) cameraPlaced = false
      applyPreset('showcase')
    }
  }

  function setPausedState(next: boolean): void {
    paused = next
  }

  // --- Hover / pick raycasting: throttled to once per rendered frame -----------------------------

  const raycaster = new THREE.Raycaster()
  const ndcScratch = new THREE.Vector2()

  function pointerNdc(event: PointerEvent): THREE.Vector2 {
    const rect = canvas.getBoundingClientRect()
    const x = rect.width > 0 ? ((event.clientX - rect.left) / rect.width) * 2 - 1 : 0
    const y = rect.height > 0 ? -(((event.clientY - rect.top) / rect.height) * 2 - 1) : 0
    return ndcScratch.set(x, y)
  }

  function raycastPartAt(event: PointerEvent): PartId | null {
    raycaster.setFromCamera(pointerNdc(event), camera)
    const hits = raycaster.intersectObject(assembly.group, true)
    if (hits.length === 0) return null
    return assembly.partIdAt(hits[0]!.object)
  }

  function updateHover(id: PartId | null): void {
    if (id === hoveredId) return
    if (hoveredId !== null && hoveredId !== selectedId) clearHighlight(hoveredId)
    hoveredId = id
    if (hoveredId !== null && hoveredId !== selectedId) applyHighlight(hoveredId, 'hover')
    canvas.style.cursor = hoveredId ? 'pointer' : ''
    events.onHover(hoveredId)
  }

  let pendingHoverEvent: PointerEvent | null = null
  interface PointerDownInfo {
    x: number
    y: number
    time: number
    part: PartId | null
  }
  let downInfo: PointerDownInfo | null = null

  function handlePointerMove(event: PointerEvent): void {
    pendingHoverEvent = event
  }

  function handlePointerDown(event: PointerEvent): void {
    downInfo = { x: event.clientX, y: event.clientY, time: performance.now(), part: raycastPartAt(event) }
  }

  function handlePointerUp(event: PointerEvent): void {
    const down = downInfo
    downInfo = null
    if (!down) return
    const distance = Math.hypot(event.clientX - down.x, event.clientY - down.y)
    const duration = performance.now() - down.time
    if (distance > PICK_MAX_DRAG_PX || duration > PICK_MAX_DURATION_MS) return
    const upPart = raycastPartAt(event)
    if (upPart === down.part) events.onPick(upPart)
  }

  function handlePointerLeave(): void {
    pendingHoverEvent = null
    downInfo = null
    updateHover(null)
  }

  canvas.addEventListener('pointermove', handlePointerMove)
  canvas.addEventListener('pointerdown', handlePointerDown)
  canvas.addEventListener('pointerup', handlePointerUp)
  canvas.addEventListener('pointercancel', handlePointerLeave)
  canvas.addEventListener('pointerleave', handlePointerLeave)

  // --- Resize ------------------------------------------------------------------------------------

  function handleResize(): void {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (width === 0 || height === 0) return
    renderer.setSize(width, height, false)
    composer.setSize(width, height)
    aspect = width / height
    camera.aspect = aspect
    camera.fov = fovFor(aspect)
    camera.clearViewOffset()
    camera.updateProjectionMatrix()
    applyViewOffset()
  }

  const resizeObserver = new ResizeObserver(() => handleResize())
  resizeObserver.observe(canvas)
  handleResize()
  applyPreset('showcase')

  // --- Quality steps ------------------------------------------------------------------------------

  function applyQualityStep(): void {
    const step = QUALITY_STEPS[qualityStep]!
    const pixelRatio = Math.min(window.devicePixelRatio, step.pixelRatio)
    renderer.setPixelRatio(pixelRatio)
    composer.setPixelRatio(pixelRatio)
    bloomPass.enabled = step.bloom
    showroom.setReflections(step.reflections)
    handleResize()
  }
  applyQualityStep()

  let smoothedFrameSeconds = 0
  let slowFrames = 0
  let settleFrames = QUALITY_SETTLE_FRAMES

  function watchFrameRate(frameSeconds: number): void {
    if (qualityPinned || qualityStep >= QUALITY_STEPS.length - 1) return
    if (settleFrames > 0) {
      settleFrames--
      smoothedFrameSeconds = frameSeconds
      return
    }
    smoothedFrameSeconds += (frameSeconds - smoothedFrameSeconds) * 0.1
    slowFrames = smoothedFrameSeconds > SLOW_FRAME_SECONDS ? slowFrames + 1 : 0
    if (slowFrames < SLOW_FRAMES_TO_STEP_DOWN) return
    qualityStep++
    slowFrames = 0
    settleFrames = QUALITY_SETTLE_FRAMES
    applyQualityStep()
  }

  // --- Main loop -----------------------------------------------------------------------------

  let rafId = 0
  let lastFrameTime = 0
  let hasLastFrameTime = false

  function animate(now: number): void {
    rafId = requestAnimationFrame(animate)
    if (!hasLastFrameTime) {
      hasLastFrameTime = true
      lastFrameTime = now
      return
    }
    const frameSeconds = (now - lastFrameTime) / 1000
    const rawDt = Math.min(MAX_FRAME_SECONDS, frameSeconds)
    lastFrameTime = now
    const dt = paused ? 0 : rawDt

    if (pendingHoverEvent) {
      const event = pendingHoverEvent
      pendingHoverEvent = null
      updateHover(raycastPartAt(event))
    }

    elapsedTime += dt

    explodeCurrent = approach(explodeCurrent, explodeTarget, EXPLODE_APPROACH_RATE, dt)
    assembly.setExplode(explodeCurrent)

    for (const part of HINGED_PARTS) {
      openCurrent[part] = approach(openCurrent[part], openTargets[part], HINGE_APPROACH_RATE, dt)
      assembly.setOpenness(part, openCurrent[part])
    }

    assembly.setEngineShake(engineShakeAmount(elapsedTime - engineToggledAt), elapsedTime)

    if (turntableOn && (currentPreset === 'showcase' || currentPreset === 'custom')) {
      showroom.turntable.rotation.y += TURNTABLE_SPIN_RATE * dt
    }

    showroom.update(dt, elapsedTime)

    if (tween) updateTween(dt)
    else controls.update()

    if (!paused) watchFrameRate(frameSeconds)

    composer.render()

    if (!readyFired) {
      readyFired = true
      events.onReady()
    }
  }
  rafId = requestAnimationFrame(animate)

  // --- Public API --------------------------------------------------------------------------------

  return {
    setPaint,
    setExplode,
    setOpen,
    setCameraPreset,
    focusPart,
    setSelected,
    setTurntable,
    setHeadlights,
    setEngineRunning,
    setViewInsets,
    setPaused: setPausedState,
    resize(): void {
      handleResize()
    },
    getSnapshot(): EngineSnapshot {
      const open: Record<HingedPartId, boolean> = {
        hood: openTargets.hood > 0.5,
        doorLeft: openTargets.doorLeft > 0.5,
        doorRight: openTargets.doorRight > 0.5,
        trunkLid: openTargets.trunkLid > 0.5,
      }
      return {
        explode: explodeCurrent,
        open,
        headlights: headlightsOn,
        engineRunning,
        turntable: turntableOn,
      }
    },
    dispose(): void {
      cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointercancel', handlePointerLeave)
      canvas.removeEventListener('pointerleave', handlePointerLeave)
      canvas.style.cursor = ''

      controls.dispose()

      for (const material of highlightCache.values()) material.dispose()
      highlightCache.clear()

      assembly.dispose()
      showroom.dispose()

      renderPass.dispose()
      bloomPass.dispose()
      outputPass.dispose()
      composer.dispose()
      environmentTarget.dispose()
      renderer.dispose()
    },
  }
}
