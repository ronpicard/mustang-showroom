import { useState } from 'react'
import { FACT_SECTIONS, VEHICLE_SUBTITLE, VEHICLE_TITLE } from '../car/facts.ts'

interface AboutPanelProps {
  onClose: () => void
}

/**
 * A large centred modal reading `FACT_SECTIONS`: a section nav on the left on desktop, a
 * scrollable column of paragraphs and an optional spec table on the right. Closes on the
 * backdrop click, the × button, or Escape (handled by `App.tsx`, which owns the key listener).
 */
export default function AboutPanel({ onClose }: AboutPanelProps) {
  const [activeId, setActiveId] = useState(FACT_SECTIONS[0]!.id)
  const active = FACT_SECTIONS.find((section) => section.id === activeId) ?? FACT_SECTIONS[0]!

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
          </nav>

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
        </div>
      </div>
    </div>
  )
}
