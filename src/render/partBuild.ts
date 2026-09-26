import type * as THREE from 'three'
import type { PartId } from '../car/types.ts'
import type { CarMaterials } from './carMaterials.ts'

/**
 * What every builder under `src/render/car*.ts` returns for one catalogue part.
 *
 * Each object is positioned in car space (see `src/car/types.ts`: inches, +Y up, +Z nose,
 * +X passenger side, origin on the ground between the axles) with its own transform already
 * applied, so the assembly can add it straight to the car group. A part listed in
 * `MIRRORED_PARTS` returns two objects, the left-hand one first (x < 0), each built as a
 * separate object so it can explode outward on its own side. Every other part returns one.
 *
 * Objects must not share geometry or materials with another part in a way that would make a
 * per-part highlight leak: materials come from `CarMaterials` and are swapped per mesh by the
 * engine, which is fine, but a mesh must never be a child of two parts.
 */
export interface PartBuild {
  id: PartId
  objects: THREE.Object3D[]
}

/** Every builder has this shape so the assembly can call them uniformly. */
export type PartBuilder = (materials: CarMaterials) => PartBuild[]

/** Tags every mesh under `object` with the part id, so the engine's raycaster can find the part from a hit. */
export function tagPart(object: THREE.Object3D, id: PartId): THREE.Object3D {
  object.traverse((child) => {
    child.userData.partId = id
  })
  return object
}
