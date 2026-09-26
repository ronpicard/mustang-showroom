import { isHingedPart, partById } from '../car/parts.ts'
import type { HingedPartId, PartId } from '../car/types.ts'
import { GROUP_LABEL } from './PartsPanel.tsx'

interface InfoPanelProps {
  selected: PartId | null
  open: Record<HingedPartId, boolean>
  onFocus: () => void
  onToggleOpen: (part: HingedPartId) => void
  onClose: () => void
}

/** The four things to try, shown when nothing is selected yet. */
const HINT_LIST: readonly string[] = [
  'Orbit and zoom to look around',
  'Drag the Explode slider to pull it apart',
  'Open the hood, doors and trunk',
  'Change the paint from the rack below',
]

/**
 * Docked on the right on desktop, a bottom sheet on phones (hidden there until a part is
 * selected — see the `.info-panel-empty` rule in `styles.css`). Shows the selected part's name,
 * group, description and specs, or a hint card when nothing is selected.
 */
export default function InfoPanel({ selected, open, onFocus, onToggleOpen, onClose }: InfoPanelProps) {
  const part = selected ? partById(selected) : null
  const hinged = part ? isHingedPart(part.id) : false

  return (
    <div className={`info-panel glass-panel${part ? '' : ' info-panel-empty'}`}>
      {part ? (
        <>
          <div className="info-panel-header">
            <span className="info-panel-group">{GROUP_LABEL[part.group]}</span>
            <h2 className="info-panel-title">{part.name}</h2>
          </div>
          <p className="info-panel-description">{part.description}</p>
          <table className="specs-table">
            <tbody>
              {part.specs.map((spec) => (
                <tr key={spec.label}>
                  <td className="specs-label">{spec.label}</td>
                  <td className="specs-value tabular">{spec.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="info-panel-actions">
            <button type="button" className="secondary-button" onClick={onFocus}>
              Focus
            </button>
            {hinged && (
              <button type="button" className="secondary-button" onClick={() => onToggleOpen(part.id as HingedPartId)}>
                {open[part.id as HingedPartId] ? 'Close' : 'Open'}
              </button>
            )}
            <button type="button" className="secondary-button" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      ) : (
        <div className="info-panel-hint">
          <h2 className="info-panel-title">Click a part of the car</h2>
          <ul className="hint-list">
            {HINT_LIST.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
