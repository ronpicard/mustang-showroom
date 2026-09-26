/**
 * Shared vocabulary for the whole app: the parts of the car, how they group, explode and hinge,
 * the paint colours, and the camera presets. Everything under `src/car/` is framework-free (no
 * DOM, no three.js) so it can be unit tested in Node.
 *
 * Coordinate frame, used everywhere a position appears (car space):
 *   +Y up, ground at y = 0
 *   +Z toward the front of the car (the nose), −Z toward the tail
 *   +X toward the passenger's side (the car's right); the driver sits at −X
 *   origin on the ground, on the centreline, midway between the axles
 * Units are inches, matching the sibling projects.
 */

export type Vec3 = readonly [number, number, number]

/** How the parts list and the info panel group the catalogue. Listed in display order. */
export type PartGroup = 'body' | 'exterior' | 'glass' | 'wheels' | 'chassis' | 'engine' | 'interior'

export const PART_GROUPS: readonly PartGroup[] = [
  'body',
  'exterior',
  'glass',
  'wheels',
  'chassis',
  'engine',
  'interior',
]

export type PartId =
  // body panels
  | 'hood'
  | 'roof'
  | 'cowl'
  | 'fenderLeft'
  | 'fenderRight'
  | 'doorLeft'
  | 'doorRight'
  | 'quarterLeft'
  | 'quarterRight'
  | 'trunkLid'
  | 'rearPanel'
  | 'frontValance'
  | 'rearValance'
  // exterior trim
  | 'grille'
  | 'headlights'
  | 'taillights'
  | 'frontBumper'
  | 'rearBumper'
  | 'hoodScoop'
  | 'hoodPins'
  | 'sideScoops'
  | 'mirrors'
  | 'doorHandles'
  | 'fuelCap'
  | 'exhaustTips'
  | 'wipers'
  // glass
  | 'windshield'
  | 'rearGlass'
  | 'doorGlass'
  | 'quarterGlass'
  // wheels
  | 'wheelFrontLeft'
  | 'wheelFrontRight'
  | 'wheelRearLeft'
  | 'wheelRearRight'
  | 'frontBrakes'
  | 'rearBrakes'
  // chassis
  | 'floorPan'
  | 'frontSuspension'
  | 'steering'
  | 'rearAxle'
  | 'leafSprings'
  | 'driveshaft'
  | 'exhaustSystem'
  | 'fuelTank'
  // engine bay
  | 'engineBlock'
  | 'cylinderHeads'
  | 'intakeManifold'
  | 'carburetor'
  | 'airCleaner'
  | 'headers'
  | 'radiator'
  | 'fan'
  | 'alternator'
  | 'battery'
  | 'transmission'
  // interior
  | 'dashboard'
  | 'steeringWheel'
  | 'frontSeats'
  | 'rearSeat'
  | 'console'

/** The parts that swing open on a hinge. */
export type HingedPartId = 'hood' | 'doorLeft' | 'doorRight' | 'trunkLid'

export const HINGED_PARTS: readonly HingedPartId[] = ['hood', 'doorLeft', 'doorRight', 'trunkLid']

/** A hinge: the part rotates about `axis` through `pivot` (car space) by `openAngle` radians when open. */
export interface Hinge {
  pivot: Vec3
  /** Unit vector in car space. Positive rotation follows the right-hand rule about it. */
  axis: Vec3
  /** Signed, radians. */
  openAngle: number
}

/** How a part moves in the exploded view: `distance` inches along unit `direction` at full explode. */
export interface ExplodeMove {
  direction: Vec3
  distance: number
  /**
   * 0 to 1. Parts with a lower order start moving first; the assembly staggers each part's
   * motion within the overall explode amount (see `src/car/explode.ts`).
   */
  order: number
}

export interface PartSpec {
  label: string
  value: string
}

export interface PartInfo {
  id: PartId
  name: string
  group: PartGroup
  /** Two to four sentences: what it is, what it does, what is notable on the 1969 car. */
  description: string
  specs: readonly PartSpec[]
  explode: ExplodeMove
  hinge?: Hinge
  /**
   * Where the camera's focus shot looks from, as a unit direction from the part's centre in car
   * space, and how many part-radii back it stands. Defaults to a front three-quarter view.
   */
  focus?: { direction: Vec3; distanceFactor?: number }
}

export type PaintId =
  | 'wickCharcoal'
  | 'ravenBlack'
  | 'wimbledonWhite'
  | 'candyappleRed'
  | 'acapulcoBlue'
  | 'blackJade'
  | 'calypsoCoral'
  | 'goldenGlow'

export interface PaintInfo {
  id: PaintId
  name: string
  /** Ford paint code where one exists (the charcoal is the film car's custom colour). */
  code: string | null
  /** sRGB hex, e.g. '#2b2d30'. */
  hex: string
  /** 0 = solid colour, 1 = full metallic flake. Drives the paint material's look. */
  metallic: number
  note: string
}

/**
 * Where the camera stands. 'showcase' is the default slow orbit around the turntable; the rest
 * are fixed views. Selecting a part frames it instead (see `EngineApi.focusPart`).
 */
export type CameraPreset =
  | 'showcase'
  | 'front'
  | 'rear'
  | 'side'
  | 'top'
  | 'engine'
  | 'interior'
  | 'wheel'
  | 'rearThreeQuarter'

export const CAMERA_PRESETS: readonly CameraPreset[] = [
  'showcase',
  'front',
  'rearThreeQuarter',
  'side',
  'rear',
  'top',
  'engine',
  'interior',
  'wheel',
]

/** One-shot and continuous sounds the shell synthesises. */
export type SoundName =
  | 'click'
  | 'latchOpen'
  | 'latchClose'
  | 'explode'
  | 'assemble'
  | 'starter'
  | 'engineStop'
  | 'lightsOn'
  | 'lightsOff'

/** Settings the shell keeps in localStorage between visits. */
export interface Settings {
  paint: PaintId
  muted: boolean
  turntable: boolean
}
