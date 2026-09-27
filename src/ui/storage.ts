import { DEFAULT_PAINT, isPaintId } from '../car/paints.ts'
import type { Settings } from '../car/types.ts'

/**
 * localStorage access for the shell: the paint choice and mute toggle, persisted as one JSON
 * blob under `mustang-showroom.settings` (an older blob may also carry a `turntable` flag, now
 * ignored: the turntable always starts on). Every access is wrapped in try/catch (private
 * mode, quota errors and disabled storage all throw) so the rest of the app never has to guard a
 * call. Values are validated field by field so a corrupted or foreign blob never reaches the
 * engine — this module must not touch `window` at import time (only inside `safeLocalStorage`'s
 * body) so `storage.test.ts` can run under plain `node:test`, without a DOM.
 */

const SETTINGS_KEY = 'mustang-showroom.settings'

export const DEFAULT_SETTINGS: Settings = {
  paint: DEFAULT_PAINT,
  muted: false,
}

/** Probes localStorage once and hands back either the real Storage or null. */
export function safeLocalStorage(): Storage | null {
  try {
    const probeKey = '__mustang_showroom_probe__'
    window.localStorage.setItem(probeKey, '1')
    window.localStorage.removeItem(probeKey)
    return window.localStorage
  } catch {
    return null
  }
}

export function loadSettings(storage: Storage | null): Settings {
  if (!storage) return { ...DEFAULT_SETTINGS }
  try {
    const raw = storage.getItem(SETTINGS_KEY)
    if (raw === null) return { ...DEFAULT_SETTINGS }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_SETTINGS }
    const record = parsed as Record<string, unknown>
    return {
      paint: isPaintId(record.paint) ? record.paint : DEFAULT_SETTINGS.paint,
      muted: typeof record.muted === 'boolean' ? record.muted : DEFAULT_SETTINGS.muted,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(storage: Storage | null, settings: Settings): void {
  if (!storage) return
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Quota exceeded or storage disabled mid-session: the settings just won't persist.
  }
}
