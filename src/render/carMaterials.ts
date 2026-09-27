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
  /** Gunmetal grey wheel spokes and dish, machined rather than chromed. */
  wheelSpoke: THREE.MeshStandardMaterial
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
  /** Raised white-letter tyre sidewall lettering band, wrapping once around the tyre. */
  tireLetter: THREE.MeshStandardMaterial
  /** Applies a paint from the rack to `paint`. */
  setPaint(paint: PaintInfo): void
  /** Lights the headlight bulbs and taillight lenses, or puts them out. */
  setLights(on: boolean): void
  disposeAll(): void
}

const HEADLIGHT_ON_COLOR = 0xfff2d0
const HEADLIGHT_ON_INTENSITY = 6
const TAILLIGHT_ON_INTENSITY = 2.2

const TEXTURE_SIZE = 64

function seededNoise(x: number, y: number, seed: number): number {
  let value = Math.imul(x + seed, 0x1f123bb5) ^ Math.imul(y + seed, 0x5f356495)
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff
}

function makeSurfaceTexture(
  pixel: (x: number, y: number) => [number, number, number],
  repeatX: number,
  repeatY: number,
  colorSpace: THREE.ColorSpace = THREE.NoColorSpace,
): THREE.DataTexture {
  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4)
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const [red, green, blue] = pixel(x, y)
      const offset = (y * TEXTURE_SIZE + x) * 4
      data[offset] = red
      data[offset + 1] = green
      data[offset + 2] = blue
      data[offset + 3] = 255
    }
  }
  const texture = new THREE.DataTexture(data, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.colorSpace = colorSpace
  texture.needsUpdate = true
  return texture
}

function makeMicrotexture(seed: number, base: number, variation: number, repeats: number): THREE.DataTexture {
  return makeSurfaceTexture((x, y) => {
    const value = Math.round(255 * (base + (seededNoise(x, y, seed) - 0.5) * variation))
    return [value, value, value]
  }, repeats, repeats)
}

const TIRE_LETTER_TEXTURE_WIDTH = 2048
const TIRE_LETTER_TEXTURE_HEIGHT = 128
const TIRE_LETTER_TEXT = 'RADIAL G/T'

/**
 * The "RADIAL G/T" raised-white-letter strip that wraps once around the tyre's outboard
 * shoulder: drawn twice across the strip's width (so it reads twice per revolution) with a
 * small dot marking the gap between each repeat, white on a transparent background so the
 * rubber shows through everywhere else. `document` is unavailable under the Node test runner
 * (see `audio.ts`'s guard for the same condition), so this returns `null` there and the
 * material falls back to a flat colour with no map.
 */
function makeTireLetterTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = TIRE_LETTER_TEXTURE_WIDTH
  canvas.height = TIRE_LETTER_TEXTURE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 96px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(TIRE_LETTER_TEXT, canvas.width * 0.25, canvas.height / 2)
  ctx.fillText(TIRE_LETTER_TEXT, canvas.width * 0.75, canvas.height / 2)
  // Small dots mark the gaps between the two repeats, at the strip's seam and its midpoint.
  for (const x of [0, canvas.width / 2]) {
    ctx.beginPath()
    ctx.arc(x, canvas.height / 2, 6, 0, Math.PI * 2)
    ctx.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

export function createCarMaterials(): CarMaterials {
  const paintMicrotexture = makeMicrotexture(11, 0.97, 0.035, 4)
  const rubberMicrotexture = makeMicrotexture(23, 0.91, 0.12, 6)
  const castMicrotexture = makeMicrotexture(37, 0.91, 0.11, 5)
  const vinylMicrotexture = makeMicrotexture(41, 0.94, 0.08, 6)
  const carpetMicrotexture = makeMicrotexture(53, 0.91, 0.13, 8)
  const woodgrainMap = makeSurfaceTexture((x, y) => {
    const across = x / TEXTURE_SIZE
    const along = y / TEXTURE_SIZE
    const wave = across * 7 + 0.13 * Math.sin(along * Math.PI * 2)
      + 0.045 * Math.sin(along * Math.PI * 4)
    const grain = Math.sin(wave * Math.PI * 2) * 0.5
      + Math.sin(wave * Math.PI * 6) * 0.16
      + (seededNoise(x, y, 67) - 0.5) * 0.08
    return [Math.round(112 + 30 * grain), Math.round(65 + 19 * grain), Math.round(34 + 10 * grain)]
  }, 2, 1, THREE.SRGBColorSpace)
  const textures: THREE.Texture[] = [paintMicrotexture, rubberMicrotexture, castMicrotexture, vinylMicrotexture, carpetMicrotexture, woodgrainMap]

  const paint = new THREE.MeshPhysicalMaterial({
    color: 0x2a2c30,
    metalness: 0.05,
    roughness: 0.26,
    roughnessMap: paintMicrotexture,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.0,
    side: THREE.DoubleSide,
  })
  const satinBlack = new THREE.MeshStandardMaterial({ color: 0x050507, roughness: 0.75, metalness: 0.05, side: THREE.DoubleSide })
  const chrome = new THREE.MeshStandardMaterial({
    color: 0xf2f4f6,
    metalness: 1,
    roughness: 0.16,
    envMapIntensity: 1.0,
  })
  const blackTrim = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.32, metalness: 0.15 })
  const rubber = new THREE.MeshStandardMaterial({
    color: 0x141416, roughness: 0.92, roughnessMap: rubberMicrotexture,
    bumpMap: rubberMicrotexture, bumpScale: 0.025, metalness: 0,
  })
  // Tinted, alpha-blended glass rather than physical transmission: in a dark showroom the
  // panes read as dark glass with sharp reflections, and it stays cheap and stable from inside
  // the cabin, where transmission's blurred background pass turns the view into haze.
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x283a34,
    metalness: 0,
    roughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    transparent: true,
    opacity: 0.3,
    envMapIntensity: 0.9,
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
  const vinyl = new THREE.MeshStandardMaterial({
    color: 0x151416, roughness: 0.78, roughnessMap: vinylMicrotexture,
    bumpMap: vinylMicrotexture, bumpScale: 0.012, metalness: 0,
  })
  const carpet = new THREE.MeshStandardMaterial({
    color: 0x111113, roughness: 1, roughnessMap: carpetMicrotexture,
    bumpMap: carpetMicrotexture, bumpScale: 0.035, metalness: 0,
  })
  const woodgrain = new THREE.MeshStandardMaterial({ color: 0xffffff, map: woodgrainMap, roughness: 0.35, metalness: 0.05 })
  const interiorBlack = new THREE.MeshStandardMaterial({ color: 0x0f0f11, roughness: 0.7, metalness: 0 })
  const gaugeFace = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.45, metalness: 0.05 })
  const castIron = new THREE.MeshStandardMaterial({
    color: 0x3a3d40, roughness: 0.72, roughnessMap: castMicrotexture,
    bumpMap: castMicrotexture, bumpScale: 0.02, metalness: 0.6,
  })
  const aluminium = new THREE.MeshStandardMaterial({ color: 0xb4b8bc, roughness: 0.45, metalness: 0.9 })
  const wheelSpoke = new THREE.MeshStandardMaterial({ color: 0x8e9296, metalness: 0.7, roughness: 0.38, envMapIntensity: 1.0 })
  const steelDark = new THREE.MeshStandardMaterial({ color: 0x27292c, roughness: 0.62, metalness: 0.7 })
  const steelBright = new THREE.MeshStandardMaterial({ color: 0x8c9196, roughness: 0.33, metalness: 0.95 })
  const brakeRotor = new THREE.MeshStandardMaterial({ color: 0x74787c, roughness: 0.5, metalness: 0.9 })
  const radiatorCore = new THREE.MeshStandardMaterial({ color: 0x1e2124, roughness: 0.85, metalness: 0.5 })
  const underbody = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.95, metalness: 0.1 })
  const hose = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.8, metalness: 0 })
  const tireLetterTexture = makeTireLetterTexture()
  const tireLetter = new THREE.MeshStandardMaterial({
    color: 0xe9e6dc,
    roughness: 0.9,
    metalness: 0,
    transparent: true,
    alphaTest: 0.5,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })
  if (tireLetterTexture) {
    tireLetter.map = tireLetterTexture
    textures.push(tireLetterTexture)
  }

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
    wheelSpoke,
    steelDark,
    steelBright,
    brakeRotor,
    radiatorCore,
    underbody,
    hose,
    tireLetter,
  ]
  let disposed = false

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
    wheelSpoke,
    steelDark,
    steelBright,
    brakeRotor,
    radiatorCore,
    underbody,
    hose,
    tireLetter,
    setPaint(info: PaintInfo) {
      paint.color.set(info.hex)
      // Keep both solid and metallic finishes deep and glossy beneath the clearcoat.
      const metallic = THREE.MathUtils.clamp(info.metallic, 0, 1)
      paint.metalness = 0.05 + 0.75 * metallic
      paint.roughness = 0.26 + 0.02 * metallic
      paint.needsUpdate = true
    },
    setLights(on: boolean) {
      headlightBulb.emissiveIntensity = on ? HEADLIGHT_ON_INTENSITY : 0
      taillightLens.emissiveIntensity = on ? TAILLIGHT_ON_INTENSITY : 0
    },
    disposeAll() {
      if (disposed) return
      disposed = true
      all.forEach((material) => material.dispose())
      textures.forEach((texture) => texture.dispose())
    },
  }
}
