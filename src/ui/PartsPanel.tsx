import { partsInGroup } from '../car/parts.ts'
import { PART_GROUPS } from '../car/types.ts'
import type { PartGroup, PartId } from '../car/types.ts'

interface PartsPanelProps {
  selected: PartId | null
  onSelect: (id: PartId) => void
  /** Phone bottom sheet open state; ignored by the desktop docked layout. */
  open: boolean
  onClose: () => void
}

/** Display labels for `PartGroup`, shared with `InfoPanel.tsx`. */
export const GROUP_LABEL: Record<PartGroup, string> = {
  body: 'Body',
  exterior: 'Exterior trim',
  glass: 'Glass',
  wheels: 'Wheels',
  chassis: 'Chassis',
  engine: 'Engine bay',
  interior: 'Interior',
}

/**
 * The catalogue, docked on the left on desktop and a bottom sheet (opened by the toolbar's
 * "Parts" button) on phones. Every part in `PARTS`, grouped and headed by `PartGroup`; clicking a
 * row selects and focuses that part in the 3D scene (`App.tsx` owns the actual selection state).
 */
export default function PartsPanel({ selected, onSelect, open, onClose }: PartsPanelProps) {
  return (
    <div className={`parts-panel glass-panel${open ? ' parts-panel-open' : ''}`}>
      <div className="parts-panel-header">
        <h2 className="parts-panel-title">Parts</h2>
        <button type="button" className="icon-button phone-only" aria-label="Close parts list" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="parts-panel-body">
        {PART_GROUPS.map((group) => (
          <section key={group} className="parts-group">
            <h3 className="parts-group-heading">{GROUP_LABEL[group]}</h3>
            {partsInGroup(group).map((part) => (
              <button
                key={part.id}
                type="button"
                className={`parts-row${selected === part.id ? ' parts-row-selected' : ''}`}
                aria-pressed={selected === part.id}
                onClick={() => onSelect(part.id)}
              >
                {part.name}
              </button>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
