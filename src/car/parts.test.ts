import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PART_GROUPS } from './types.ts'
import type { PartId } from './types.ts'
import { HINGED_PARTS } from './types.ts'
import { MIRRORED_PARTS, PART_IDS, PARTS, isHingedPart, partById, partsInGroup } from './parts.ts'

/**
 * The full catalogue, hand-written, in the order `types.ts` declares `PartId`. This is the
 * independent source of truth the test checks `PART_IDS` against, rather than deriving the list
 * from the module under test.
 */
const ALL_PART_IDS: readonly PartId[] = [
  // body panels
  'hood',
  'roof',
  'cowl',
  'fenderLeft',
  'fenderRight',
  'doorLeft',
  'doorRight',
  'quarterLeft',
  'quarterRight',
  'trunkLid',
  'rearPanel',
  'frontValance',
  'rearValance',
  // exterior trim
  'grille',
  'headlights',
  'taillights',
  'frontBumper',
  'rearBumper',
  'hoodScoop',
  'hoodPins',
  'sideScoops',
  'mirrors',
  'doorHandles',
  'fuelCap',
  'exhaustTips',
  'wipers',
  // glass
  'windshield',
  'rearGlass',
  'doorGlass',
  'quarterGlass',
  // wheels
  'wheelFrontLeft',
  'wheelFrontRight',
  'wheelRearLeft',
  'wheelRearRight',
  'frontBrakes',
  'rearBrakes',
  // chassis
  'floorPan',
  'frontSuspension',
  'steering',
  'rearAxle',
  'leafSprings',
  'driveshaft',
  'exhaustSystem',
  'fuelTank',
  // engine bay
  'engineBlock',
  'cylinderHeads',
  'intakeManifold',
  'carburetor',
  'airCleaner',
  'headers',
  'radiator',
  'fan',
  'alternator',
  'battery',
  'transmission',
  // interior
  'dashboard',
  'steeringWheel',
  'frontSeats',
  'rearSeat',
  'console',
]

function sentenceCount(text: string): number {
  return text.split(/(?<=[.!?])\s+(?=[A-Z(])/).filter((sentence) => sentence.trim().length > 0).length
}

test('PART_IDS is unique and covers every part in the hand-written catalogue', () => {
  assert.equal(new Set(PART_IDS).size, PART_IDS.length, 'PART_IDS must not contain duplicates')
  assert.equal(PART_IDS.length, ALL_PART_IDS.length)
  assert.deepEqual([...PART_IDS].sort(), [...ALL_PART_IDS].sort())
})

test('every part groups into one of PART_GROUPS', () => {
  const groupsUsed = new Set(PARTS.map((part) => part.group))
  for (const group of groupsUsed) {
    assert.ok(PART_GROUPS.includes(group), `${group} is not a declared PartGroup`)
  }
  // Every declared group is actually used by at least one part.
  for (const group of PART_GROUPS) {
    assert.ok(groupsUsed.has(group), `no part uses group ${group}`)
  }
})

test('every part has a non-empty name, a description of at least two sentences, and at least one spec', () => {
  for (const part of PARTS) {
    assert.ok(part.name.trim().length > 0, `${part.id} has an empty name`)
    assert.ok(
      sentenceCount(part.description) >= 2,
      `${part.id}'s description has fewer than two sentences: ${JSON.stringify(part.description)}`,
    )
    assert.ok(part.specs.length >= 1, `${part.id} has no specs`)
  }
})

test('explode directions are unit vectors and distances are between 8 and 80 inches', () => {
  for (const part of PARTS) {
    const [x, y, z] = part.explode.direction
    const length = Math.hypot(x, y, z)
    assert.ok(Math.abs(length - 1) < 1e-6, `${part.id}'s explode direction is not unit length (${length})`)
    assert.ok(
      part.explode.distance >= 8 && part.explode.distance <= 80,
      `${part.id}'s explode distance ${part.explode.distance} is outside [8, 80]`,
    )
  }
})

test('explode orders are between 0 and 1', () => {
  for (const part of PARTS) {
    assert.ok(
      part.explode.order >= 0 && part.explode.order <= 1,
      `${part.id}'s explode order ${part.explode.order} is outside [0, 1]`,
    )
  }
})

test('hinged parts are exactly HINGED_PARTS, each with a unit axis', () => {
  const hingedIds = PARTS.filter((part) => part.hinge !== undefined).map((part) => part.id)
  assert.deepEqual([...hingedIds].sort(), [...HINGED_PARTS].sort())
  for (const id of HINGED_PARTS) {
    assert.ok(isHingedPart(id))
    const hinge = partById(id).hinge!
    const length = Math.hypot(...hinge.axis)
    assert.ok(Math.abs(length - 1) < 1e-6, `${id}'s hinge axis is not unit length (${length})`)
  }
})

test('non-hinged parts report isHingedPart(false)', () => {
  for (const part of PARTS) {
    if (!HINGED_PARTS.includes(part.id as (typeof HINGED_PARTS)[number])) {
      assert.equal(isHingedPart(part.id), false, `${part.id} should not be hinged`)
    }
  }
})

test('MIRRORED_PARTS is a subset of the part ids', () => {
  for (const id of MIRRORED_PARTS) {
    assert.ok(PART_IDS.includes(id), `${id} in MIRRORED_PARTS is not a known part id`)
  }
})

test('partById returns the part and throws for an unknown id', () => {
  for (const id of PART_IDS) {
    assert.equal(partById(id).id, id)
  }
  assert.throws(() => partById('notAPart' as PartId), /Unknown part/)
})

test('partsInGroup partitions the catalogue: every part appears in exactly one group', () => {
  const seen = new Set<PartId>()
  let total = 0
  for (const group of PART_GROUPS) {
    for (const part of partsInGroup(group)) {
      assert.equal(part.group, group, `${part.id} returned by partsInGroup(${group}) has group ${part.group}`)
      assert.ok(!seen.has(part.id), `${part.id} appears in more than one group`)
      seen.add(part.id)
      total += 1
    }
  }
  assert.equal(total, PARTS.length)
  assert.deepEqual([...seen].sort(), [...PART_IDS].sort())
})
