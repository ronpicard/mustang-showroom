import type { PaintId, PaintInfo } from './types.ts'

/**
 * The paint rack. The first entry is the default: the near-black charcoal the film car wears.
 * The rest are genuine 1969 Ford colours with their paint codes.
 */
export const PAINTS: readonly PaintInfo[] = [
  {
    id: 'wickCharcoal',
    name: 'Charcoal',
    code: null,
    hex: '#2a2c30',
    metallic: 0.7,
    note: 'A deep gunmetal charcoal, the colour of the film car. Not a factory 1969 colour.',
  },
  {
    id: 'ravenBlack',
    name: 'Raven Black',
    code: 'A',
    hex: '#0b0b0d',
    metallic: 0,
    note: 'The factory black, a solid colour with a mirror-deep gloss.',
  },
  {
    id: 'wimbledonWhite',
    name: 'Wimbledon White',
    code: 'M',
    hex: '#e9e6da',
    metallic: 0,
    note: "Ford's warm white, the colour of the Boss 302 with its black hockey-stick stripes.",
  },
  {
    id: 'candyappleRed',
    name: 'Candyapple Red',
    code: 'T',
    hex: '#a8101c',
    metallic: 0.05,
    note: 'The bright, deep red of the brochures, and the most popular 1969 colour.',
  },
  {
    id: 'acapulcoBlue',
    name: 'Acapulco Blue',
    code: 'D',
    hex: '#1f3f88',
    metallic: 0.6,
    note: 'A rich medium blue metallic.',
  },
  {
    id: 'blackJade',
    name: 'Black Jade',
    code: 'C',
    hex: '#12271f',
    metallic: 0.5,
    note: 'A dark green metallic that reads almost black in the shade.',
  },
  {
    id: 'calypsoCoral',
    name: 'Calypso Coral',
    code: '1',
    hex: '#e8471f',
    metallic: 0,
    note: 'The loud orange-red of the Boss 429 press cars.',
  },
  {
    id: 'goldenGlow',
    name: 'Golden Glow',
    code: 'Y',
    hex: '#b8922e',
    metallic: 0.7,
    note: 'A warm gold metallic, at home on a Mach 1 with black stripes.',
  },
]

export const DEFAULT_PAINT: PaintId = 'wickCharcoal'

export function paintById(id: PaintId): PaintInfo {
  const paint = PAINTS.find((entry) => entry.id === id)
  if (!paint) throw new Error(`Unknown paint: ${id}`)
  return paint
}

export function isPaintId(value: unknown): value is PaintId {
  return typeof value === 'string' && PAINTS.some((paint) => paint.id === value)
}

/** The paint after `id` in the rack, wrapping at the end. */
export function nextPaint(id: PaintId): PaintId {
  const index = PAINTS.findIndex((paint) => paint.id === id)
  return PAINTS[(index + 1) % PAINTS.length]!.id
}
