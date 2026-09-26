import type { PartId } from '../car/types.ts'

/**
 * How a part is drawn given the current selection and hover: the selected part lit up, the
 * hovered one tinted, and, while something is selected, everything else ghosted to a faint
 * glass so the chosen part stands out inside the car. `null` is the part's own materials.
 */
export type PartEmphasis = 'selected' | 'hover' | 'ghost' | null

export function partEmphasisFor(id: PartId, selectedId: PartId | null, hoveredId: PartId | null): PartEmphasis {
  if (id === selectedId) return 'selected'
  if (id === hoveredId) return 'hover'
  if (selectedId !== null) return 'ghost'
  return null
}
