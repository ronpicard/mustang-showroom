import * as THREE from 'three'
import type { PaintInfo } from '../car/types.ts'

/**
 * Every material the car is built from, shared by all the builders so the whole car changes
 * paint together and the engine can swap in highlight variants per mesh. The showroom's
 * environment map is applied by the engine through `scene.environment`, so nothing here sets
 * `envMap` directly; `envMapIntensity` is tuned per material instead.
 *
 * Colours are sRGB hex converted by three.js's colour management (the default in 0.186).
 */

export interface CarMaterials {
  /** Body colour. `setPaint` retunes it; never replace the object, the builders hold references. */
  paint: THREE.MeshPhysicalMaterial
  /** Satin black for the black-out tail panel, hood scoop underside and Mach 1 trim. */
  satinBlack: THREE.MeshStandardMaterial
  chrome: THREE.MeshStandardMaterial
  /** Gloss black plastic and paint: grille mesh, mirror bases, wiper arms. */
  blackTrim: THREE.MeshStandardMaterial
  rubber: THREE.MeshStandardMaterial
  /** Tinted window glass. */
  glass: THREE.MeshPhysicalMaterial
  /** Clear headlight lens over the reflector. */
  headlightLens: THREE.MeshPhysicalMaterial
  /** The sealed-beam reflector and filament, lit by `setLights`. */
  headlightBulb: THREE.MeshStandardMaterial
  /** Red taillight lenses, lit by `setLights`. */
  taillightLens: THREE.MeshPhysicalMaterial
  /** Amber turn-signal lenses in the front valance. */
  amberLens: THREE.MeshPhysicalMaterial
  /** Black Comfortweave vinyl for the seats and door panels. */
  vinyl: THREE.MeshStandardMaterial
  carpet: THREE.MeshStandardMaterial
  /** The dash and console woodgrain trim. */
  woodgrain: THREE.MeshStandardMaterial
  /** Dash pad, steering wheel rim and other soft black interior plastic. */
  interiorBlack: THREE.MeshStandardMaterial
  /** Instrument faces: near-black with a faint sheen, for the gauge dials. */
  gaugeFace: THREE.MeshStandardMaterial
  castIron: THREE.MeshStandardMaterial
  aluminium: THREE.MeshStandardMaterial
  /** Dark painted steel: chassis, suspension arms, axle housing, floor pan. */
  steelDark: THREE.MeshStandardMaterial
  /** Bare bright steel: driveshaft, exhaust pipes, springs. */
  steelBright: THREE.MeshStandardMaterial
  brakeRotor: THREE.MeshStandardMaterial
  /** Radiator core: dark and fine-textured. */
  radiatorCore: THREE.MeshStandardMaterial
  /** The undercoated body underside. */
  underbody: THREE.MeshStandardMaterial
  /** Black hoses, belts and wiring. */
  hose: THREE.MeshStandardMaterial
  /** Applies a paint from the rack to `paint`. */
  setPaint(paint: PaintInfo): void
  /** Lights the headlight bulbs and taillight lenses, or puts them out. */
  setLights(on: boolean): void
  disposeAll(): void
}

const HEADLIGHT_ON_COLOR = 0xfff2d0
const HEADLIGHT_ON_INTENSITY = 6
const TAILLIGHT_ON_INTENSITY = 2.2

export function createCarMaterials(): CarMaterials {
  const paint = new THREE.MeshPhysicalMaterial({
    color: 0x2a2c30,
    metalness: 0.55,
    roughness: 0.38,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.0,
    side: THREE.DoubleSide,
  })
  const satinBlack = new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide })
  const chrome = new THREE.MeshStandardMaterial({
    color: 0xf2f4f6,
    metalness: 1,
    roughness: 0.07,
    envMapIntensity: 1.0,
  })
  const blackTrim = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.32, metalness: 0.15 })
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.92, metalness: 0 })
  // Tinted, alpha-blended glass rather than physical transmission: in a dark showroom the
  // panes read as dark glass with sharp reflections, and it stays cheap and stable from inside
  // the cabin, where transmission's blurred background pass turns the view into haze.
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x2a3438,
    metalness: 0,
    roughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    transparent: true,
    opacity: 0.42,
    envMapIntensity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const headlightLens = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.08,
    transmission: 0.9,
    thickness: 0.2,
    transparent: true,
    depthWrite: false,
    envMapIntensity: 1.3,
  })
  const headlightBulb = new THREE.MeshStandardMaterial({
    color: 0xd8dde2,
    metalness: 0.9,
    roughness: 0.25,
    emissive: HEADLIGHT_ON_COLOR,
    emissiveIntensity: 0,
  })
  const taillightLens = new THREE.MeshPhysicalMaterial({
    color: 0x9c0a12,
    metalness: 0,
    roughness: 0.2,
    transmission: 0.35,
    thickness: 0.5,
    transparent: true,
    emissive: 0xff1a1a,
    emissiveIntensity: 0,
    envMapIntensity: 1,
  })
  const amberLens = new THREE.MeshPhysicalMaterial({
    color: 0xd86a10,
    metalness: 0,
    roughness: 0.25,
    transmission: 0.3,
    thickness: 0.4,
    transparent: true,
    envMapIntensity: 1,
  })
  const vinyl = new THREE.MeshStandardMaterial({ color: 0x151416, roughness: 0.78, metalness: 0 })
  const carpet = new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 1, metalness: 0 })
  const woodgrain = new THREE.MeshStandardMaterial({ color: 0x4a2a14, roughness: 0.35, metalness: 0.05 })
  const interiorBlack = new THREE.MeshStandardMaterial({ color: 0x0f0f11, roughness: 0.7, metalness: 0 })
  const gaugeFace = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.45, metalness: 0.05 })
  const castIron = new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.72, metalness: 0.6 })
  const aluminium = new THREE.MeshStandardMaterial({ color: 0xb4b8bc, roughness: 0.45, metalness: 0.9 })
  const steelDark = new THREE.MeshStandardMaterial({ color: 0x27292c, roughness: 0.62, metalness: 0.7 })
  const steelBright = new THREE.MeshStandardMaterial({ color: 0x8c9196, roughness: 0.33, metalness: 0.95 })
  const brakeRotor = new THREE.MeshStandardMaterial({ color: 0x74787c, roughness: 0.5, metalness: 0.9 })
  const radiatorCore = new THREE.MeshStandardMaterial({ color: 0x1e2124, roughness: 0.85, metalness: 0.5 })
  const underbody = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.95, metalness: 0.1 })
  const hose = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.8, metalness: 0 })

  const all: THREE.Material[] = [
    paint,
    satinBlack,
    chrome,
    blackTrim,
    rubber,
    glass,
    headlightLens,
    headlightBulb,
    taillightLens,
    amberLens,
    vinyl,
    carpet,
    woodgrain,
    interiorBlack,
    gaugeFace,
    castIron,
    aluminium,
    steelDark,
    steelBright,
    brakeRotor,
    radiatorCore,
    underbody,
    hose,
  ]

  return {
    paint,
    satinBlack,
    chrome,
    blackTrim,
    rubber,
    glass,
    headlightLens,
    headlightBulb,
    taillightLens,
    amberLens,
    vinyl,
    carpet,
    woodgrain,
    interiorBlack,
    gaugeFace,
    castIron,
    aluminium,
    steelDark,
    steelBright,
    brakeRotor,
    radiatorCore,
    underbody,
    hose,
    setPaint(info: PaintInfo) {
      paint.color.set(info.hex)
      // Metallic paints read as metal under the clearcoat; solid colours stay dielectric with a
      // deep gloss. Roughness follows so that flake catches the light.
      paint.metalness = 0.15 + 0.55 * info.metallic
      paint.roughness = 0.3 + 0.12 * info.metallic
      paint.needsUpdate = true
    },
    setLights(on: boolean) {
      headlightBulb.emissiveIntensity = on ? HEADLIGHT_ON_INTENSITY : 0
      taillightLens.emissiveIntensity = on ? TAILLIGHT_ON_INTENSITY : 0
    },
    disposeAll() {
      all.forEach((material) => material.dispose())
    },
  }
}
