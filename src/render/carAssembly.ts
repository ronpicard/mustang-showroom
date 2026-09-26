import * as THREE from 'three'
import type { ExplodeMove, Hinge, HingedPartId, PartId } from '../car/types.ts'
import { MIRRORED_PARTS, PART_IDS, partById } from '../car/parts.ts'
import { explodeOffset, hingeAngle } from '../car/explode.ts'
import type { CarMaterials } from './carMaterials.ts'
import { createCarMaterials } from './carMaterials.ts'
import type { PartBuild, PartBuilder } from './partBuild.ts'
import { buildBody } from './carBody.ts'
import { buildTrim } from './carTrim.ts'
import { buildWheels } from './carWheels.ts'
import { buildChassis } from './carChassis.ts'
import { buildEngineBay } from './carEngine.ts'
import { buildInterior } from './carInterior.ts'

/**
 * Wires the six builders' parts into one car, in car space, with the plumbing the engine needs:
 * per-part explode offsets and hinge rotations, part lookup for picking and framing, and the
 * engine-bay shake. See the spec's "Section: assembly and engine" for the contract this follows.
 *
 * Structure per built object: `mover` (carries the explode offset) -> `pivot` (only if the part
 * is hinged; carries the hinge rotation, positioned at the hinge pivot) -> the builder's object,
 * translated back by the pivot so its rest-position world transform is unchanged. Mirrored parts
 * get one mover (and, if ever hinged, one pivot) per side.
 */
export interface CarAssembly {
  /** The whole car, in car space; add to the showroom's turntable at y = TURNTABLE_HEIGHT. */
  group: THREE.Group
  materials: CarMaterials
  /** 0..1, applies `explodeOffset` per part object (mirrored parts use 'left'/'right'). */
  setExplode(amount: number): void
  /** 0..1, rotates the part about its hinge by `hingeAngle`. */
  setOpenness(part: HingedPartId, openness: number): void
  /** The part's top-level objects, as the builder returned them. */
  partObjects(id: PartId): THREE.Object3D[]
  /** World-space bounds of the part's meshes right now (updates matrices first). */
  partBounds(id: PartId, target: THREE.Box3): THREE.Box3
  /** Walks up `userData.partId`. */
  partIdAt(object: THREE.Object3D): PartId | null
  forEachMesh(id: PartId, fn: (mesh: THREE.Mesh) => void): void
  /**
   * 0 = still; jitters the engine-bay parts by up to `ENGINE_SHAKE_AMPLITUDE` at about
   * `ENGINE_SHAKE_FREQUENCY` Hz, and spins the fan about Z at `FAN_SPIN_RATE` rad/s scaled by
   * `amount`. `elapsed` is total seconds, so the jitter and spin are deterministic in replay.
   */
  setEngineShake(amount: number, elapsed: number): void
  /** Disposes every geometry under `group` and `materials.disposeAll()`. */
  dispose(): void
}

/** The engine-bay parts that shake while the engine runs. */
const ENGINE_SHAKE_PART_IDS: readonly PartId[] = [
  'engineBlock',
  'cylinderHeads',
  'intakeManifold',
  'carburetor',
  'airCleaner',
  'headers',
  'transmission',
  'fan',
  'alternator',
]

/** Peak shake offset per axis, inches, at full engine-shake amount. */
const ENGINE_SHAKE_AMPLITUDE = 0.12
/** Roughly a big-block's idle rumble, Hz. Each axis runs at a slightly different multiple so the shake reads as a rattle, not a metronome. */
const ENGINE_SHAKE_FREQUENCY = 28
const ENGINE_SHAKE_AXIS_FREQUENCY_SCALE: readonly [number, number, number] = [1, 1.27, 0.83]
const ENGINE_SHAKE_AXIS_PHASE: readonly [number, number, number] = [0, 1.7, 3.1]
/** Desyncs each shaking part (and each side of a mirrored one) from the others. */
const ENGINE_SHAKE_PART_PHASE_STEP = 0.9
const TWO_PI = Math.PI * 2
/** The fan spins about its own axis at this many radians per second at full shake amount. */
const FAN_SPIN_RATE = 20

interface PartRuntime {
  explode: ExplodeMove
  hinge?: Hinge
  hingeAxis?: THREE.Vector3
  mirrored: boolean
  objects: THREE.Object3D[]
  movers: THREE.Group[]
  pivots: (THREE.Group | null)[]
}

/**
 * Parts without a hinge of their own that swing with a hinged part: the door glass is wound up
 * inside its door, so each side's pane rides that door's hinge. Index 0 is the left object.
 */
const HINGE_COMPANIONS: Record<HingedPartId, { id: PartId; index: number } | undefined> = {
  hood: undefined,
  trunkLid: undefined,
  doorLeft: { id: 'doorGlass', index: 0 },
  doorRight: { id: 'doorGlass', index: 1 },
}

function companionHingeFor(id: PartId, index: number): Hinge | undefined {
  for (const [hinged, companion] of Object.entries(HINGE_COMPANIONS)) {
    if (companion && companion.id === id && companion.index === index) return partById(hinged as HingedPartId).hinge
  }
  return undefined
}

function sideFor(mirrored: boolean, index: number): 'left' | 'right' | 'single' {
  if (!mirrored) return 'single'
  return index === 0 ? 'left' : 'right'
}

export function createCarAssembly(): CarAssembly {
  const materials = createCarMaterials()
  const group = new THREE.Group()
  group.name = 'car'

  const builders: readonly PartBuilder[] = [
    buildBody,
    buildTrim,
    buildWheels,
    buildChassis,
    buildEngineBay,
    buildInterior,
  ]

  const buildsById = new Map<PartId, PartBuild>()
  for (const builder of builders) {
    for (const build of builder(materials)) {
      if (buildsById.has(build.id)) {
        throw new Error(`Part "${build.id}" was built more than once`)
      }
      buildsById.set(build.id, build)
    }
  }
  for (const id of buildsById.keys()) {
    if (!PART_IDS.includes(id)) throw new Error(`Built an object for unknown part id "${id}"`)
  }

  const runtimes = new Map<PartId, PartRuntime>()
  for (const id of PART_IDS) {
    const build = buildsById.get(id)
    if (!build) throw new Error(`Part "${id}" was never built by any builder`)
    const mirrored = MIRRORED_PARTS.has(id)
    const expectedCount = mirrored ? 2 : 1
    if (build.objects.length !== expectedCount) {
      throw new Error(
        `Part "${id}" returned ${build.objects.length} object(s), expected ${expectedCount} (mirrored: ${mirrored})`,
      )
    }

    const info = partById(id)
    const hingeAxis = info.hinge
      ? new THREE.Vector3(info.hinge.axis[0], info.hinge.axis[1], info.hinge.axis[2])
      : undefined

    const movers: THREE.Group[] = []
    const pivots: (THREE.Group | null)[] = []
    build.objects.forEach((object, index) => {
      const mover = new THREE.Group()
      mover.name = `${id}#${index}:mover`
      const hinge = info.hinge ?? companionHingeFor(id, index)
      if (hinge) {
        const pivot = new THREE.Group()
        pivot.name = `${id}#${index}:pivot`
        pivot.position.set(hinge.pivot[0], hinge.pivot[1], hinge.pivot[2])
        object.position.set(
          object.position.x - hinge.pivot[0],
          object.position.y - hinge.pivot[1],
          object.position.z - hinge.pivot[2],
        )
        pivot.add(object)
        mover.add(pivot)
        pivots.push(pivot)
      } else {
        mover.add(object)
        pivots.push(null)
      }
      movers.push(mover)
      group.add(mover)
    })

    runtimes.set(id, {
      explode: info.explode,
      hinge: info.hinge,
      hingeAxis,
      mirrored,
      objects: build.objects,
      movers,
      pivots,
    })
  }

  let currentExplodeAmount = 0

  function applyExplode(runtime: PartRuntime, amount: number): void {
    runtime.movers.forEach((mover, index) => {
      const side = sideFor(runtime.mirrored, index)
      const offset = explodeOffset(runtime.explode, amount, side)
      mover.position.set(offset[0], offset[1], offset[2])
    })
  }

  function setExplode(amount: number): void {
    currentExplodeAmount = amount
    for (const runtime of runtimes.values()) applyExplode(runtime, amount)
  }

  function setOpenness(part: HingedPartId, openness: number): void {
    const runtime = runtimes.get(part)
    if (!runtime || !runtime.hinge || !runtime.hingeAxis) return
    const pivot = runtime.pivots[0]
    if (!pivot) return
    const angle = hingeAngle(runtime.hinge, openness)
    pivot.setRotationFromAxisAngle(runtime.hingeAxis, angle)
    const companion = HINGE_COMPANIONS[part]
    const companionPivot = companion ? runtimes.get(companion.id)?.pivots[companion.index] : null
    if (companionPivot) companionPivot.setRotationFromAxisAngle(runtime.hingeAxis, angle)
  }

  function partObjects(id: PartId): THREE.Object3D[] {
    const runtime = runtimes.get(id)
    return runtime ? [...runtime.objects] : []
  }

  function partBounds(id: PartId, target: THREE.Box3): THREE.Box3 {
    group.updateMatrixWorld(true)
    target.makeEmpty()
    const runtime = runtimes.get(id)
    if (!runtime) return target
    for (const object of runtime.objects) target.expandByObject(object)
    return target
  }

  function partIdAt(object: THREE.Object3D): PartId | null {
    let current: THREE.Object3D | null = object
    while (current) {
      const id = current.userData['partId'] as PartId | undefined
      if (id) return id
      current = current.parent
    }
    return null
  }

  function forEachMesh(id: PartId, fn: (mesh: THREE.Mesh) => void): void {
    const runtime = runtimes.get(id)
    if (!runtime) return
    for (const object of runtime.objects) {
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) fn(child)
      })
    }
  }

  function setEngineShake(amount: number, elapsed: number): void {
    ENGINE_SHAKE_PART_IDS.forEach((id, partIndex) => {
      const runtime = runtimes.get(id)
      if (!runtime) return
      runtime.movers.forEach((mover, index) => {
        const side = sideFor(runtime.mirrored, index)
        const base = explodeOffset(runtime.explode, currentExplodeAmount, side)
        const phase = partIndex * ENGINE_SHAKE_PART_PHASE_STEP + index * Math.PI * 0.5
        const jitter = ENGINE_SHAKE_AXIS_FREQUENCY_SCALE.map((freqScale, axis) => {
          const angle = elapsed * ENGINE_SHAKE_FREQUENCY * freqScale * TWO_PI + phase + ENGINE_SHAKE_AXIS_PHASE[axis]!
          return amount * ENGINE_SHAKE_AMPLITUDE * Math.sin(angle)
        })
        mover.position.set(base[0] + jitter[0]!, base[1] + jitter[1]!, base[2] + jitter[2]!)
      })
    })

    const fanRuntime = runtimes.get('fan')
    const fanObject = fanRuntime?.objects[0]
    if (fanObject) fanObject.rotation.z = (FAN_SPIN_RATE * amount * elapsed) % TWO_PI
  }

  function dispose(): void {
    group.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      child.geometry.dispose()
      const material = child.material
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose())
      else material.dispose()
    })
    materials.disposeAll()
    runtimes.clear()
  }

  return {
    group,
    materials,
    setExplode,
    setOpenness,
    partObjects,
    partBounds,
    partIdAt,
    forEachMesh,
    setEngineShake,
    dispose,
  }
}
