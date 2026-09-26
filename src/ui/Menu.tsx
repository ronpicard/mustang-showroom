import { useState } from 'react'

interface MenuProps {
  onEnter: () => void
}

/** What the car in the room can do, shown as three short lines under the subtitle. */
const WHAT_YOU_CAN_DO: readonly string[] = [
  'Orbit and zoom the turntable, or jump to nine fixed camera views.',
  'Open the hood, doors and trunk, and drag the slider to pull the whole car apart.',
  'Change the paint, switch on the headlights, start the engine, and click any part to read about it.',
]

/** Every binding `App.tsx` listens for in showroom mode, kept in sync with the switch there. */
const KEYBOARD_LEGEND: readonly { label: string; keys: string }[] = [
  { label: 'Camera presets', keys: '1 – 9' },
  { label: 'Toggle explode', keys: 'E' },
  { label: 'Hood', keys: 'H' },
  { label: 'Doors', keys: 'D' },
  { label: 'Trunk', keys: 'T' },
  { label: 'Headlights', keys: 'L' },
  { label: 'Start / stop engine', keys: 'S' },
  { label: 'Rev (hold, while running)', keys: 'Space' },
  { label: 'Turntable', keys: 'R' },
  { label: 'Next paint', keys: 'P' },
  { label: 'Mute', keys: 'M' },
  { label: 'About', keys: '? / I' },
  { label: 'Close / menu', keys: 'Esc' },
]

/**
 * The first screen, a docked (desktop) or bottom-sheet (phone) panel over the live, already
 * rendering scene. Enter/Space enters the showroom; entering also unlocks audio (handled by the
 * caller, since that is a page-wide gesture, not something specific to this button).
 */
export default function Menu({ onEnter }: MenuProps) {
  const [legendOpen, setLegendOpen] = useState(false)

  return (
    <div className="menu-screen">
      <div className="menu-panel glass-panel">
        <p className="menu-eyebrow">Mustang Showroom</p>
        <h1 className="menu-title">Mustang Showroom</h1>
        <p className="menu-subtitle">1969 Ford Mustang · Mach 1 SportsRoof</p>

        <ul className="menu-list">
          {WHAT_YOU_CAN_DO.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <button type="button" className="primary-button menu-enter" onClick={onEnter}>
          Enter the showroom
        </button>

        <section className="panel-section">
          <button
            type="button"
            className="panel-heading panel-heading-toggle"
            aria-expanded={legendOpen}
            onClick={() => setLegendOpen((open) => !open)}
          >
            Keyboard {legendOpen ? '−' : '+'}
          </button>
          {legendOpen && (
            <dl className="legend-list">
              {KEYBOARD_LEGEND.map((row) => (
                <div className="legend-row" key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.keys}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>
    </div>
  )
}
