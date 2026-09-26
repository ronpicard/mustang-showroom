import type { CameraPreset, HingedPartId, PaintId, PartId, SoundName } from '../car/types.ts'

/** Screen space covered by UI, in CSS pixels, measured in from each edge of the canvas. */
export interface ViewInsets {
  left: number
  top: number
  right: number
  bottom: number
}

/** Callbacks from the 3D engine to the React shell. All are invoked on the main thread. */
export interface EngineEvents {
  /** The part under the pointer changed. `null` when the pointer leaves the car. */
  onHover(id: PartId | null): void
  /** The user clicked (or tapped) a part, or clicked empty space (`null`). The shell decides what is selected. */
  onPick(id: PartId | null): void
  /**
   * The camera left a preset because the user dragged or zoomed ('custom'), or a preset finished
   * being applied. The shell mirrors this in the camera buttons.
   */
  onCamera(preset: CameraPreset | 'custom' | 'part'): void
  /** A one-shot sound. `intensity` runs 0 to 1. */
  onSound(name: SoundName, intensity: number): void
  /** The showroom finished building and the first frame is up. */
  onReady(): void
}

/** The engine's animated state, as the shell needs it for the HUD. */
export interface EngineSnapshot {
  /** Current explode amount, 0 (assembled) to 1, after smoothing. */
  explode: number
  /** Which hinged parts are open. */
  open: Record<HingedPartId, boolean>
  headlights: boolean
  engineRunning: boolean
  turntable: boolean
}

export interface EngineApi {
  /** Repaints every body-colour surface. */
  setPaint(id: PaintId): void
  /** Target explode amount, 0 to 1. The engine eases toward it. */
  setExplode(amount: number): void
  /** Swings a hinged part open or closed. */
  setOpen(part: HingedPartId, open: boolean): void
  /** Moves the camera to a preset. 'showcase' also resumes the slow orbit. */
  setCameraPreset(preset: CameraPreset): void
  /** Frames a part, or returns to the last preset for `null`. */
  focusPart(id: PartId | null): void
  /** Highlights a part persistently (the selected part), or clears it for `null`. */
  setSelected(id: PartId | null): void
  /** Turns the turntable (and the car on it) slowly. */
  setTurntable(on: boolean): void
  setHeadlights(on: boolean): void
  /** The engine shakes on its mounts and the exhaust tips shimmer; the shell plays the sound. */
  setEngineRunning(on: boolean): void
  /** Keeps the car clear of the part of the canvas the UI covers. */
  setViewInsets(insets: ViewInsets): void
  /** Freezes the clocks. The scene keeps rendering. */
  setPaused(paused: boolean): void
  /** Re-reads the canvas size. The engine also observes its canvas, so this is rarely needed. */
  resize(): void
  getSnapshot(): EngineSnapshot
  dispose(): void
}
