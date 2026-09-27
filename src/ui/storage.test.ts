import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './storage.ts'

const SETTINGS_KEY = 'mustang-showroom.settings'

/** A minimal in-memory `Storage`, so these tests run under plain `node:test` with no DOM. */
class FakeStorage implements Storage {
  #map = new Map<string, string>()

  get length(): number {
    return this.#map.size
  }

  clear(): void {
    this.#map.clear()
  }

  getItem(key: string): string | null {
    return this.#map.has(key) ? this.#map.get(key)! : null
  }

  key(index: number): string | null {
    return Array.from(this.#map.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.#map.delete(key)
  }

  setItem(key: string, value: string): void {
    this.#map.set(key, value)
  }
}

test('loadSettings returns defaults with a null storage', () => {
  assert.deepEqual(loadSettings(null), DEFAULT_SETTINGS)
})

test('loadSettings returns defaults when nothing is stored', () => {
  assert.deepEqual(loadSettings(new FakeStorage()), DEFAULT_SETTINGS)
})

test('loadSettings returns defaults for garbage JSON', () => {
  const storage = new FakeStorage()
  storage.setItem(SETTINGS_KEY, '{not json')
  assert.deepEqual(loadSettings(storage), DEFAULT_SETTINGS)
})

test('loadSettings returns defaults for a non-object value', () => {
  const storage = new FakeStorage()
  storage.setItem(SETTINGS_KEY, '"just a string"')
  assert.deepEqual(loadSettings(storage), DEFAULT_SETTINGS)
})

test('loadSettings keeps a fully valid settings object', () => {
  const storage = new FakeStorage()
  const settings = { paint: 'candyappleRed' as const, muted: true }
  saveSettings(storage, settings)
  assert.deepEqual(loadSettings(storage), settings)
})

test('loadSettings drops the turntable flag an older blob may carry, so the turntable always starts on', () => {
  const storage = new FakeStorage()
  storage.setItem(SETTINGS_KEY, JSON.stringify({ paint: 'candyappleRed', muted: false, turntable: false }))
  assert.deepEqual(loadSettings(storage), { paint: 'candyappleRed', muted: false })
})

test('loadSettings falls back to the default paint for an unknown id', () => {
  const storage = new FakeStorage()
  storage.setItem(SETTINGS_KEY, JSON.stringify({ paint: 'not-a-real-paint', muted: true }))
  const settings = loadSettings(storage)
  assert.equal(settings.paint, DEFAULT_SETTINGS.paint)
  assert.equal(settings.muted, true)
})

test('loadSettings coerces a non-boolean muted to the default', () => {
  const storage = new FakeStorage()
  storage.setItem(SETTINGS_KEY, JSON.stringify({ paint: 'ravenBlack', muted: 'yes' }))
  const settings = loadSettings(storage)
  assert.equal(settings.paint, 'ravenBlack')
  assert.equal(settings.muted, DEFAULT_SETTINGS.muted)
})

test('saveSettings is a no-op with a null storage', () => {
  assert.doesNotThrow(() => saveSettings(null, DEFAULT_SETTINGS))
})
