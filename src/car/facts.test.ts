import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FACT_SECTIONS, VEHICLE_SUBTITLE, VEHICLE_TITLE } from './facts.ts'

test('every section has a non-empty id, title and at least one paragraph', () => {
  for (const section of FACT_SECTIONS) {
    assert.ok(section.id.trim().length > 0, 'section id is empty')
    assert.ok(section.title.trim().length > 0, `${section.id} has an empty title`)
    assert.ok(section.paragraphs.length >= 1, `${section.id} has no paragraphs`)
    for (const paragraph of section.paragraphs) {
      assert.ok(paragraph.trim().length > 0, `${section.id} has an empty paragraph`)
    }
  }
})

test('section ids are unique', () => {
  const ids = FACT_SECTIONS.map((section) => section.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('table rows, where present, have non-empty labels and values', () => {
  for (const section of FACT_SECTIONS) {
    if (!section.table) continue
    assert.ok(section.table.length >= 1, `${section.id} has an empty table`)
    for (const row of section.table) {
      assert.ok(row.label.trim().length > 0, `${section.id} has a table row with an empty label`)
      assert.ok(row.value.trim().length > 0, `${section.id} has a table row with an empty value`)
    }
  }
})

test('the vehicle title and subtitle are set', () => {
  assert.ok(VEHICLE_TITLE.trim().length > 0)
  assert.ok(VEHICLE_SUBTITLE.trim().length > 0)
})
