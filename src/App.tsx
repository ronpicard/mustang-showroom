import { useEffect, useRef, useState } from 'react'
import { createAudio } from './audio.ts'
import type { ShowroomAudio } from './audio.ts'
import { partById } from './car/parts.ts'
import { nextPaint } from './car/paints.ts'
import { CAMERA_PRESETS } from './car/types.ts'
import type { CameraPreset, HingedPartId, PartId, Settings } from './car/types.ts'
import type { EngineApi, EngineEvents, ViewInsets } from './render/engineApi.ts'
import AboutPanel from './ui/AboutPanel.tsx'
import GameCanvas from './ui/GameCanvas.tsx'
import InfoPanel from './ui/InfoPanel.tsx'
import Menu from './ui/Menu.tsx'
import PartsPanel from './ui/PartsPanel.tsx'
import Toolbar from './ui/Toolbar.tsx'
import { loadSettings, safeLocalStorage, saveSettings } from './ui/storage.ts'

/** The two screens the shell can show. The engine keeps rendering behind both. */
type Mode = 'menu' | 'showroom'

/** A docked side panel narrower than this share of the window; wider counts as a bottom sheet. */
const DOCKED_PANEL_MAX_FRACTION = 0.6

const DEFAULT_OPEN: Record<HingedPartId, boolean> = {
  hood: false,
  doorLeft: false,
  doorRight: false,
  trunkLid: false,
}

/**
 * Top-level app shell. Owns the engine handle, the audio module, all showroom state (paint,
 * explode, open panels, headlights, engine, camera, selection/hover) and the menu/about/parts
 * screens. The canvas is mounted once, full-screen, behind every overlay; `Menu`, `Toolbar`,
 * `PartsPanel`, `InfoPanel` and `AboutPanel` are just panels on top of it.
 */
export default function App() {
  const [storage] = useState(() => safeLocalStorage())
  const [audio] = useState<ShowroomAudio>(() => createAudio())
  const [settings, setSettings] = useState<Settings>(() => loadSettings(storage))

  const [mode, setMode] = useState<Mode>('menu')
  const [paused, setPaused] = useState(false)
  const [api, setApi] = useState<EngineApi | null>(null)

  const [explode, setExplode] = useState(0)
  const [open, setOpen] = useState<Record<HingedPartId, boolean>>(DEFAULT_OPEN)
  const [headlights, setHeadlights] = useState(false)
  const [engineRunning, setEngineRunning] = useState(false)
  const [cameraPreset, setCameraPreset] = useState<CameraPreset | 'custom' | 'part'>('showcase')
  const [selected, setSelected] = useState<PartId | null>(null)
  const [hovered, setHovered] = useState<PartId | null>(null)
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [partsOpen, setPartsOpen] = useState(false)

  const unlockedAudioRef = useRef(false)
  const updateInsetsRef = useRef<() => void>(() => {})

  useEffect(() => () => audio.dispose(), [audio])

  // Apply the persisted settings once the engine is ready; later changes go straight through the
  // toggle handlers below instead of round-tripping through an effect.
  useEffect(() => {
    if (!api) return
    api.setPaint(settings.paint)
    api.setTurntable(settings.turntable)
    audio.setMuted(settings.muted)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api])

  // Unlock audio on the very first user gesture, as browsers require. Entering the showroom (a
  // click/Enter/Space) is itself such a gesture, so this fires at the same moment either way.
  useEffect(() => {
    function unlock() {
      if (unlockedAudioRef.current) return
      unlockedAudioRef.current = true
      audio.resume()
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [audio])

  // Freeze the clocks when the tab is hidden; the engine keeps rendering the last frame.
  useEffect(() => {
    function onVisibility() {
      const next = document.hidden
      setPaused(next)
      api?.setPaused(next)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [api])

  // Keep the car clear of whichever chrome currently covers the canvas: the top and bottom
  // toolbars, and the two docked/sheet panels. A ResizeObserver catches content changes as well
  // as viewport resizes; opening/closing a sheet or the info panel only changes a CSS transform
  // (no resize), so those state changes also poke `update()` directly, below.
  useEffect(() => {
    if (!api) return
    const engine = api
    function currentInsets(): ViewInsets {
      const insets: ViewInsets = { left: 0, top: 0, right: 0, bottom: 0 }
      const topBar = document.querySelector<HTMLElement>('.toolbar-top')
      const bottomBar = document.querySelector<HTMLElement>('.toolbar-bottom')
      const partsPanel = document.querySelector<HTMLElement>('.parts-panel')
      const infoPanel = document.querySelector<HTMLElement>('.info-panel')

      if (topBar) insets.top = topBar.offsetTop + topBar.offsetHeight
      if (bottomBar) {
        const rect = bottomBar.getBoundingClientRect()
        insets.bottom = Math.max(insets.bottom, window.innerHeight - rect.top)
      }

      for (const panel of [partsPanel, infoPanel]) {
        if (!panel) continue
        const docked = panel.offsetWidth < window.innerWidth * DOCKED_PANEL_MAX_FRACTION
        const rect = panel.getBoundingClientRect()
        if (docked) {
          if (rect.left <= 0) insets.left = Math.max(insets.left, rect.right)
          else insets.right = Math.max(insets.right, window.innerWidth - rect.left)
        } else {
          // A phone bottom sheet: closed ones sit translated below the viewport, contributing 0.
          insets.bottom = Math.max(insets.bottom, Math.max(0, window.innerHeight - rect.top))
        }
      }
      return insets
    }
    function update() {
      engine.setViewInsets(currentInsets())
    }
    updateInsetsRef.current = update
    update()
    const observer = new ResizeObserver(update)
    const watched = ['.toolbar-top', '.toolbar-bottom', '.parts-panel', '.info-panel']
      .map((selector) => document.querySelector<HTMLElement>(selector))
      .filter((el): el is HTMLElement => el !== null)
    watched.forEach((el) => observer.observe(el))
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [api, mode])

  // Sheets and the info panel animate via CSS transform, which ResizeObserver does not see;
  // re-measure once immediately and once after the transition settles.
  useEffect(() => {
    updateInsetsRef.current()
    const timer = window.setTimeout(() => updateInsetsRef.current(), 260)
    return () => window.clearTimeout(timer)
  }, [partsOpen, selected, aboutOpen])

  function handleEnterShowroom() {
    setMode('showroom')
    audio.resume()
  }

  function handleDeselect() {
    setSelected(null)
    api?.setSelected(null)
    api?.focusPart(null)
  }

  function handleSelectPart(id: PartId) {
    if (id === selected) {
      handleDeselect()
      return
    }
    setSelected(id)
    setPartsOpen(false)
    api?.focusPart(id)
    api?.setSelected(id)
  }

  function handleCameraPreset(preset: CameraPreset) {
    api?.setCameraPreset(preset)
    if (preset === 'engine') handleSetOpen('hood', true)
    if (preset === 'interior') handleSetOpen('doorRight', true)
  }

  function handleSetOpen(part: HingedPartId, value: boolean) {
    setOpen((current) => (current[part] === value ? current : { ...current, [part]: value }))
    api?.setOpen(part, value)
  }

  function handleToggleOpen(part: HingedPartId) {
    handleSetOpen(part, !open[part])
  }

  function handleToggleDoors() {
    const next = !(open.doorLeft && open.doorRight)
    handleSetOpen('doorLeft', next)
    handleSetOpen('doorRight', next)
  }

  function handleExplodeChange(value: number) {
    setExplode(value)
    api?.setExplode(value / 100)
  }

  function handleToggleExplode() {
    handleExplodeChange(explode > 0 ? 0 : 100)
  }

  function handleToggleHeadlights() {
    setHeadlights((current) => {
      const next = !current
      api?.setHeadlights(next)
      return next
    })
  }

  function handleToggleEngine() {
    setEngineRunning((current) => {
      const next = !current
      api?.setEngineRunning(next)
      audio.setEngine(next)
      return next
    })
  }

  function handleRevStart() {
    if (!engineRunning) return
    audio.setThrottle(1)
  }

  function handleRevEnd() {
    audio.setThrottle(0)
  }

  function handleToggleTurntable() {
    setSettings((current) => {
      const next: Settings = { ...current, turntable: !current.turntable }
      api?.setTurntable(next.turntable)
      saveSettings(storage, next)
      return next
    })
  }

  function handleToggleMute() {
    setSettings((current) => {
      const next: Settings = { ...current, muted: !current.muted }
      audio.setMuted(next.muted)
      saveSettings(storage, next)
      return next
    })
  }

  function handleSelectPaint(id: Settings['paint']) {
    setSettings((current) => {
      if (current.paint === id) return current
      const next: Settings = { ...current, paint: id }
      api?.setPaint(id)
      saveSettings(storage, next)
      return next
    })
  }

  function handleNextPaint() {
    setSettings((current) => {
      const next: Settings = { ...current, paint: nextPaint(current.paint) }
      api?.setPaint(next.paint)
      saveSettings(storage, next)
      return next
    })
  }

  // Every keyboard binding reads through this ref instead of closing over state directly, so the
  // listener (attached once per [mode, paused] pair) always calls the freshest handler without
  // needing every piece of state in its dependency array.
  const handlersRef = useRef({
    enter: handleEnterShowroom,
    cameraPreset: handleCameraPreset,
    toggleExplode: handleToggleExplode,
    toggleHood: () => handleToggleOpen('hood'),
    toggleDoors: handleToggleDoors,
    toggleTrunk: () => handleToggleOpen('trunkLid'),
    toggleHeadlights: handleToggleHeadlights,
    toggleEngine: handleToggleEngine,
    revStart: handleRevStart,
    revEnd: handleRevEnd,
    toggleTurntable: handleToggleTurntable,
    nextPaint: handleNextPaint,
    toggleMute: handleToggleMute,
    toggleAbout: () => setAboutOpen((current) => !current),
    escape: () => {
      if (aboutOpen) setAboutOpen(false)
      else if (selected !== null) handleDeselect()
      else setMode('menu')
    },
  })
  handlersRef.current = {
    enter: handleEnterShowroom,
    cameraPreset: handleCameraPreset,
    toggleExplode: handleToggleExplode,
    toggleHood: () => handleToggleOpen('hood'),
    toggleDoors: handleToggleDoors,
    toggleTrunk: () => handleToggleOpen('trunkLid'),
    toggleHeadlights: handleToggleHeadlights,
    toggleEngine: handleToggleEngine,
    revStart: handleRevStart,
    revEnd: handleRevEnd,
    toggleTurntable: handleToggleTurntable,
    nextPaint: handleNextPaint,
    toggleMute: handleToggleMute,
    toggleAbout: () => setAboutOpen((current) => !current),
    escape: () => {
      if (aboutOpen) setAboutOpen(false)
      else if (selected !== null) handleDeselect()
      else setMode('menu')
    },
  }

  // Keyboard bindings (showroom mode): 1-9 camera presets, E explode, H/D/T hood/doors/trunk,
  // L headlights, S start/stop engine, Space hold to rev, R turntable, P next paint, M mute,
  // ?/I about, Escape closes About, else deselects, else opens the menu. Menu mode: Enter/Space
  // enters. Ignored while an input/select has focus, or while paused.
  useEffect(() => {
    function isEditable(target: EventTarget | null): boolean {
      return target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (isEditable(e.target)) return
      if (paused) return
      if (mode === 'menu') {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
          e.preventDefault()
          handlersRef.current.enter()
        }
        return
      }
      if (e.key === ' ') {
        e.preventDefault()
        if (!e.repeat) handlersRef.current.revStart()
        return
      }
      if (e.repeat) return
      const index = Number(e.key) - 1
      if (Number.isInteger(index) && index >= 0 && index < CAMERA_PRESETS.length) {
        handlersRef.current.cameraPreset(CAMERA_PRESETS[index]!)
        return
      }
      switch (e.key) {
        case 'e':
        case 'E':
          handlersRef.current.toggleExplode()
          break
        case 'h':
        case 'H':
          handlersRef.current.toggleHood()
          break
        case 'd':
        case 'D':
          handlersRef.current.toggleDoors()
          break
        case 't':
        case 'T':
          handlersRef.current.toggleTrunk()
          break
        case 'l':
        case 'L':
          handlersRef.current.toggleHeadlights()
          break
        case 's':
        case 'S':
          handlersRef.current.toggleEngine()
          break
        case 'r':
        case 'R':
          handlersRef.current.toggleTurntable()
          break
        case 'p':
        case 'P':
          handlersRef.current.nextPaint()
          break
        case 'm':
        case 'M':
          handlersRef.current.toggleMute()
          break
        case '?':
        case 'i':
        case 'I':
          handlersRef.current.toggleAbout()
          break
        case 'Escape':
          handlersRef.current.escape()
          break
        default:
          break
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === ' ') handlersRef.current.revEnd()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [mode, paused])

  const events: EngineEvents = {
    onHover: (id) => setHovered(id),
    onPick: (id) => (id === null ? handleDeselect() : handleSelectPart(id)),
    onCamera: (preset) => setCameraPreset(preset),
    onSound: (name, intensity) => audio.play(name, intensity),
    onReady: () => {},
  }

  return (
    <div
      className="app-root"
      onPointerMove={(e) => {
        if (hovered) setPointerPos({ x: e.clientX, y: e.clientY })
      }}
    >
      <GameCanvas events={events} onReady={setApi} />

      <div className="overlay-layer">
        {mode === 'menu' && <Menu onEnter={handleEnterShowroom} />}

        {mode === 'showroom' && (
          <>
            <Toolbar
              cameraPreset={cameraPreset}
              onCameraPreset={handleCameraPreset}
              turntable={settings.turntable}
              onToggleTurntable={handleToggleTurntable}
              headlights={headlights}
              onToggleHeadlights={handleToggleHeadlights}
              engineRunning={engineRunning}
              onToggleEngine={handleToggleEngine}
              onRevStart={handleRevStart}
              onRevEnd={handleRevEnd}
              muted={settings.muted}
              onToggleMute={handleToggleMute}
              onOpenAbout={() => setAboutOpen(true)}
              onOpenMenu={() => setMode('menu')}
              paint={settings.paint}
              onSelectPaint={handleSelectPaint}
              explode={explode}
              onExplodeChange={handleExplodeChange}
              onResetExplode={() => handleExplodeChange(0)}
              open={open}
              onToggleHood={() => handleToggleOpen('hood')}
              onToggleDoors={handleToggleDoors}
              onToggleTrunk={() => handleToggleOpen('trunkLid')}
              partsOpen={partsOpen}
              onTogglePartsOpen={() => setPartsOpen((current) => !current)}
            />

            <PartsPanel
              selected={selected}
              onSelect={handleSelectPart}
              open={partsOpen}
              onClose={() => setPartsOpen(false)}
            />

            <InfoPanel
              selected={selected}
              open={open}
              onFocus={() => selected && api?.focusPart(selected)}
              onToggleOpen={handleToggleOpen}
              onClose={handleDeselect}
            />

            {hovered && pointerPos && (
              <div className="hover-chip" style={{ left: pointerPos.x + 16, top: pointerPos.y + 16 }}>
                {partById(hovered).name}
              </div>
            )}
          </>
        )}

        {aboutOpen && <AboutPanel onClose={() => setAboutOpen(false)} />}
      </div>
    </div>
  )
}
