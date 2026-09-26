import { useState } from 'react'
import { FACT_SECTIONS, VEHICLE_SUBTITLE, VEHICLE_TITLE } from '../car/facts.ts'

interface AboutPanelProps {
  onClose: () => void
}

/** Every binding `App.tsx` listens for, kept in sync with the switch there. */
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
  { label: 'Close', keys: 'Esc' },
]

const CONTROLS_SECTION_ID = 'controls'

/**
 * A large centred modal reading `FACT_SECTIONS`: a section nav on the left on desktop, a
 * scrollable column of paragraphs and an optional spec table on the right. Closes on the
 * backdrop click, the × button, or Escape (handled by `App.tsx`, which owns the key listener).
 */
export default function AboutPanel({ onClose }: AboutPanelProps) {
  const [activeId, setActiveId] = useState(FACT_SECTIONS[0]!.id)
  const active = FACT_SECTIONS.find((section) => section.id === activeId) ?? FACT_SECTIONS[0]!
  const showingControls = activeId === CONTROLS_SECTION_ID

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="about-panel glass-panel"
        role="dialog"
        aria-modal="true"
        aria-label="About the car"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="about-header">
          <div>
            <h2 className="about-title">{VEHICLE_TITLE}</h2>
            <p className="about-subtitle">{VEHICLE_SUBTITLE}</p>
          </div>
          <button type="button" className="icon-button about-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="about-body">
          <nav className="about-nav" aria-label="Sections">
            {FACT_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`about-nav-item${section.id === activeId ? ' about-nav-item-active' : ''}`}
                aria-pressed={section.id === activeId}
                onClick={() => setActiveId(section.id)}
              >
                {section.title}
              </button>
            ))}
            <button
              type="button"
              className={`about-nav-item${showingControls ? ' about-nav-item-active' : ''}`}
              aria-pressed={showingControls}
              onClick={() => setActiveId(CONTROLS_SECTION_ID)}
            >
              Controls
            </button>
          </nav>

          {showingControls ? (
            <div className="about-content">
              <h3 className="about-content-title">Controls</h3>
              <p className="about-paragraph">
                Drag to orbit and scroll or pinch to zoom. Click any part of the car to read about it. On a
                keyboard:
              </p>
              <dl className="legend-list">
                {KEYBOARD_LEGEND.map((row) => (
                  <div className="legend-row" key={row.label}>
                    <dt>{row.label}</dt>
                    <dd className="tabular">{row.keys}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
          <div className="about-content">
            <h3 className="about-content-title">{active.title}</h3>
            {active.paragraphs.map((paragraph, index) => (
              <p className="about-paragraph" key={index}>
                {paragraph}
              </p>
            ))}
            {active.table && (
              <table className="specs-table about-table">
                <tbody>
                  {active.table.map((row) => (
                    <tr key={row.label}>
                      <td className="specs-label">{row.label}</td>
                      <td className="specs-value tabular">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  )
}
