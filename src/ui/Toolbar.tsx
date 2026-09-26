import { PAINTS } from '../car/paints.ts'
import { CAMERA_PRESETS } from '../car/types.ts'
import type { CameraPreset, HingedPartId, PaintId } from '../car/types.ts'

interface ToolbarProps {
  cameraPreset: CameraPreset | 'custom' | 'part'
  onCameraPreset: (preset: CameraPreset) => void
  turntable: boolean
  onToggleTurntable: () => void
  headlights: boolean
  onToggleHeadlights: () => void
  engineRunning: boolean
  onToggleEngine: () => void
  onRevStart: () => void
  onRevEnd: () => void
  muted: boolean
  onToggleMute: () => void
  onOpenAbout: () => void
  onOpenMenu: () => void
  paint: PaintId
  onSelectPaint: (id: PaintId) => void
  explode: number
  onExplodeChange: (value: number) => void
  onResetExplode: () => void
  open: Record<HingedPartId, boolean>
  onToggleHood: () => void
  onToggleDoors: () => void
  onToggleTrunk: () => void
  partsOpen: boolean
  onTogglePartsOpen: () => void
}

/** Labels for the camera preset buttons and the phone `<select>`, in `CAMERA_PRESETS` order. */
const CAMERA_LABEL: Record<CameraPreset, string> = {
  showcase: 'Showcase',
  front: 'Front',
  rearThreeQuarter: 'Rear ¾',
  side: 'Side',
  rear: 'Rear',
  top: 'Top',
  engine: 'Engine',
  interior: 'Interior',
  wheel: 'Wheel',
}

function isCameraPreset(value: string): value is CameraPreset {
  return (CAMERA_PRESETS as readonly string[]).includes(value)
}

/**
 * The top bar (title, camera presets, toggle icons) and the bottom bar (paint rack, explode
 * slider, hood/doors/trunk toggles, the phone-only "Parts" button and, while the engine is
 * running, the hold-to-rev button) — both full width, both measured by `App.tsx`'s
 * `ResizeObserver` so the engine keeps the car clear of them.
 */
export default function Toolbar({
  cameraPreset,
  onCameraPreset,
  turntable,
  onToggleTurntable,
  headlights,
  onToggleHeadlights,
  engineRunning,
  onToggleEngine,
  onRevStart,
  onRevEnd,
  muted,
  onToggleMute,
  onOpenAbout,
  onOpenMenu,
  paint,
  onSelectPaint,
  explode,
  onExplodeChange,
  onResetExplode,
  open,
  onToggleHood,
  onToggleDoors,
  onToggleTrunk,
  partsOpen,
  onTogglePartsOpen,
}: ToolbarProps) {
  const selectValue = cameraPreset === 'custom' || cameraPreset === 'part' ? '' : cameraPreset

  return (
    <>
      <div className="toolbar-top glass-panel">
        <div className="toolbar-title">
          <span className="toolbar-title-mark">Mustang Showroom</span>
        </div>

        <div className="camera-buttons" role="radiogroup" aria-label="Camera">
          {CAMERA_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`camera-button${cameraPreset === preset ? ' camera-button-active' : ''}`}
              role="radio"
              aria-checked={cameraPreset === preset}
              onClick={() => onCameraPreset(preset)}
            >
              {CAMERA_LABEL[preset]}
            </button>
          ))}
        </div>

        <select
          className="camera-select"
          aria-label="Camera"
          value={selectValue}
          onChange={(event) => {
            const value = event.target.value
            if (isCameraPreset(value)) onCameraPreset(value)
          }}
        >
          {selectValue === '' && (
            <option value="" disabled>
              {cameraPreset === 'custom' ? 'Custom' : 'Part'}
            </option>
          )}
          {CAMERA_PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {CAMERA_LABEL[preset]}
            </option>
          ))}
        </select>

        <div className="toolbar-actions">
          <button
            type="button"
            className="icon-button"
            aria-label="Turntable"
            aria-pressed={turntable}
            onClick={onToggleTurntable}
          >
            <span className="icon-button-caption">Turntable</span>
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Headlights"
            aria-pressed={headlights}
            onClick={onToggleHeadlights}
          >
            <span className="icon-button-caption">Headlights</span>
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={engineRunning ? 'Stop engine' : 'Start engine'}
            aria-pressed={engineRunning}
            onClick={onToggleEngine}
          >
            <span className="icon-button-caption">{engineRunning ? 'Running' : 'Engine'}</span>
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={muted ? 'Unmute' : 'Mute'}
            aria-pressed={muted}
            onClick={onToggleMute}
          >
            <span className="icon-button-caption">{muted ? 'Muted' : 'Sound'}</span>
          </button>
          <button type="button" className="icon-button" aria-label="About" onClick={onOpenAbout}>
            <span className="icon-button-caption">About</span>
          </button>
          <button type="button" className="icon-button" aria-label="Menu" onClick={onOpenMenu}>
            <span className="icon-button-caption">Menu</span>
          </button>
        </div>
      </div>

      <div className="toolbar-bottom glass-panel">
        <div className="paint-swatches" role="radiogroup" aria-label="Paint">
          {PAINTS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`paint-swatch${paint === entry.id ? ' paint-swatch-selected' : ''}`}
              role="radio"
              aria-checked={paint === entry.id}
              aria-label={entry.name}
              title={entry.name}
              onClick={() => onSelectPaint(entry.id)}
            >
              <span className="paint-swatch-dot" style={{ backgroundColor: entry.hex }} />
              {paint === entry.id && <span className="paint-swatch-label">{entry.name}</span>}
            </button>
          ))}
        </div>

        <div className="explode-control">
          <label htmlFor="explode-range">Explode</label>
          <input
            id="explode-range"
            type="range"
            min={0}
            max={100}
            value={explode}
            onChange={(event) => onExplodeChange(Number(event.target.value))}
          />
          <button type="button" className="secondary-button" onClick={onResetExplode}>
            Reset
          </button>
        </div>

        <div className="panel-toggles">
          <button type="button" className="secondary-button" aria-pressed={open.hood} onClick={onToggleHood}>
            Hood
          </button>
          <button
            type="button"
            className="secondary-button"
            aria-pressed={open.doorLeft && open.doorRight}
            onClick={onToggleDoors}
          >
            Doors
          </button>
          <button type="button" className="secondary-button" aria-pressed={open.trunkLid} onClick={onToggleTrunk}>
            Trunk
          </button>
        </div>

        {engineRunning && (
          <button
            type="button"
            className="rev-button"
            onPointerDown={onRevStart}
            onPointerUp={onRevEnd}
            onPointerLeave={onRevEnd}
            onPointerCancel={onRevEnd}
          >
            Rev
          </button>
        )}

        <button
          type="button"
          className="parts-toggle phone-only"
          aria-pressed={partsOpen}
          onClick={onTogglePartsOpen}
        >
          Parts
        </button>
      </div>
    </>
  )
}
