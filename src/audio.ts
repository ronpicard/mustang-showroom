/**
 * Synthesised Mustang Showroom sound effects and the V8, entirely Web Audio, no asset files.
 * The engine plays pre-rendered loops from `engineSound.ts` at a few fixed speeds, crossfaded
 * and pitch-shifted to follow an rpm model that the start (solenoid, crank, catch, flare), the
 * throttle and the shutdown all drive.
 */

import type { SoundName } from './car/types.ts'
import {
  CATCH_FLARE_RPM,
  CATCH_FLARE_SECONDS,
  IDLE_RPM,
  LOOP_RPMS,
  REDLINE_RPM,
  STARTER_CRANK_SECONDS,
  generateEngineLoop,
  generateSolenoidClunk,
  generateStarterLoop,
} from './engineSound.ts'

export interface ShowroomAudio {
  play(name: SoundName, intensity?: number): void
  /** Starts (solenoid, starter crank, catch and flare, then idle) or stops (rpm falls away with a couple of pops) the engine. */
  setEngine(running: boolean): void
  /** 0 idle .. 1 full throttle; the engine note rises and gets louder. Eases. */
  setThrottle(amount: number): void
  setMuted(muted: boolean): void
  /** Call from a user gesture to unlock the AudioContext. */
  resume(): void
  dispose(): void
}

const MASTER_GAIN = 0.5
const MUTE_RAMP_SECONDS = 0.03
const NOISE_BUFFER_SECONDS = 1
/** No voice re-triggers faster than this, so a burst of identical events doesn't clip together. */
const MIN_VOICE_INTERVAL_S = 0.025

// --- One-shot voice tuning --------------------------------------------------------------------

const CLICK_NOISE_FREQ_HZ = 4000
const CLICK_NOISE_Q = 6
const CLICK_NOISE_DURATION_S = 0.002
const CLICK_NOISE_PEAK = 0.05
const CLICK_TONE_FREQ_HZ = 1800
const CLICK_TONE_DURATION_S = 0.04
const CLICK_TONE_PEAK = 0.05

const LATCH_CLACK_FREQ_HZ = 900
const LATCH_CLACK_Q = 4
const LATCH_CLACK_DURATION_S = 0.03
const LATCH_CLACK_PEAK = 0.12
/** The "boing": a decaying 120 Hz fundamental plus its octave partial. */
const LATCH_BOING_FREQ_HZ = 120
const LATCH_BOING_DURATION_S = 0.3
const LATCH_BOING_PEAK = 0.08

const LATCH_THUNK_FREQ_HZ = 60
const LATCH_THUNK_DURATION_S = 0.12
const LATCH_THUNK_PEAK = 0.14
const LATCH_CLOSE_NOISE_FREQ_HZ = 700
const LATCH_CLOSE_NOISE_Q = 2.5
const LATCH_CLOSE_NOISE_DURATION_S = 0.05
const LATCH_CLOSE_RING_FREQ_HZ = 2200
const LATCH_CLOSE_RING_Q = 8
const LATCH_CLOSE_RING_DURATION_S = 0.15

/** The explode/assemble whoosh sweeps the bandpass centre between these two frequencies. */
const EXPLODE_SWEEP_LOW_HZ = 300
const EXPLODE_SWEEP_HIGH_HZ = 2400
const EXPLODE_SWEEP_Q = 0.9
const EXPLODE_DURATION_S = 0.8
const EXPLODE_PEAK = 0.22
const ASSEMBLE_DURATION_S = 0.6
const ASSEMBLE_PEAK = 0.18
const ASSEMBLE_CLICK_DURATION_S = 0.01
const ASSEMBLE_CLICK_PEAK = 0.08

const RELAY_NOISE_FREQ_HZ = 3500
const RELAY_NOISE_Q = 6
const RELAY_NOISE_DURATION_S = 0.002
const RELAY_NOISE_PEAK = 0.05
const RELAY_PING_FREQ_HZ = 3000
const RELAY_PING_DURATION_S = 0.03
const RELAY_PING_PEAK = 0.05
/** `lightsOff` plays the same relay click a touch lower and quieter. */
const RELAY_OFF_LEVEL = 0.75

// --- Exhaust pop, shared by the starter's catch and the engine's shutdown ---------------------

const POP_NOISE_MIN_FREQ_HZ = 150
const POP_NOISE_FREQ_SPREAD_HZ = 250
const POP_NOISE_Q = 2.2
const POP_NOISE_DURATION_S = 0.05
const POP_THUMP_MIN_FREQ_HZ = 70
const POP_THUMP_FREQ_SPREAD_HZ = 40
const POP_THUMP_DURATION_S = 0.08
const POP_THUMP_END_FREQ_HZ = 40

// --- The V8 ----------------------------------------------------------------------------------

/** The engine's level at idle and at redline, before the master gain. */
const ENGINE_IDLE_LEVEL = 0.16
const ENGINE_REDLINE_LEVEL = 0.34
/** A gentle lowpass over the whole engine: the showroom's walls take the top off. */
const ENGINE_LOWPASS_HZ = 3400
const ENGINE_LOWPASS_Q = 0.6
const ENGINE_COMPRESSOR_THRESHOLD_DB = -18
const ENGINE_COMPRESSOR_RATIO = 4
/** How quickly the rpm chases the throttle (seconds to close about 63% of the gap), rising and falling. */
const RPM_RISE_TIME_CONSTANT_S = 0.3
const RPM_FALL_TIME_CONSTANT_S = 0.65
/** Throttle maps to rpm with this curve, so the first bit of pedal does little and the last a lot. */
const THROTTLE_CURVE = 1.4
/** The lumpy cam's idle lope: an rpm wobble that fades out above idle. */
const LOPE_RPM = 30
const LOPE_HZ = 3.3
const LOPE_FADE_RPM = 1600
/** The rpm follower's update rate and the automation smoothing applied to each of its steps. */
const ENGINE_TICK_MS = 25
const ENGINE_TICK_SMOOTHING_S = 0.045
/** The catch: the crank speed the engine fires from, how fast the flare rises, and its pops. */
const CATCH_START_RPM = 260
const CATCH_RISE_S = 0.3
const CATCH_FLARE_DECAY_S = 0.45
const CATCH_SWELL_S = 0.14
const CATCH_POP_COUNT = 3
const CATCH_POP_PEAK = 0.15
/** Shutdown: the rpm falls at this rate until the engine stalls, shuddering as it goes. */
const STOP_RPM_FALL_PER_SECOND = 1250
const STOP_STALL_RPM = 220
const STOP_SHUDDER_RPM = 70
const STOP_SHUDDER_HZ = 6
const STOP_POP_COUNT = 2
const STOP_POP_PEAK = 0.18
/** The starter: its level, how it labours up to speed, and the zing as it disengages at the catch. */
const STARTER_LEVEL = 0.26
const STARTER_ATTACK_S = 0.05
const STARTER_SPIN_UP_S = 0.45
const STARTER_START_RATE = 0.8
const STARTER_RELEASE_S = 0.18
const STARTER_DISENGAGE_RATE = 1.35
const SOLENOID_LEVEL = 0.4

type AudioContextConstructor = typeof AudioContext
type ToneExtras = { type?: OscillatorType; endFreq?: number; attack?: number }
type Voice = (context: AudioContext, out: GainNode, buffer: AudioBuffer, now: number, intensity: number) => void

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

// A short envelope: near-silent, ramp up to `peak`, ramp back down, both exponential.
function scheduleEnvelope(gain: GainNode, now: number, attack: number, peak: number, duration: number): void {
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
}

// Plays one enveloped oscillator (optionally sweeping to `endFreq`) and cleans itself up.
function playTone(
  context: AudioContext, out: AudioNode, now: number,
  freq: number, duration: number, peak: number, extras: ToneExtras = {},
): void {
  const osc = context.createOscillator()
  osc.type = extras.type ?? 'sine'
  osc.frequency.setValueAtTime(freq, now)
  if (extras.endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, extras.endFreq), now + duration)
  }
  const gain = context.createGain()
  scheduleEnvelope(gain, now, extras.attack ?? 0.006, peak, duration)
  osc.connect(gain)
  gain.connect(out)
  osc.onended = () => {
    osc.disconnect()
    gain.disconnect()
  }
  osc.start(now)
  osc.stop(now + duration + 0.02)
}

/** Plays one enveloped, band-passed slice of the shared noise buffer and cleans itself up. */
function playNoiseBurst(
  context: AudioContext, out: AudioNode, buffer: AudioBuffer, now: number,
  freq: number, q: number, duration: number, peak: number, attack = 0.003,
): void {
  const source = context.createBufferSource()
  source.buffer = buffer
  const filter = context.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = freq
  filter.Q.value = q
  const gain = context.createGain()
  scheduleEnvelope(gain, now, attack, peak, duration)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(out)
  source.onended = () => {
    source.disconnect()
    filter.disconnect()
    gain.disconnect()
  }
  source.start(now)
  source.stop(now + duration + 0.02)
}

/** Plays a slice of the noise buffer whose bandpass centre sweeps from `startFreq` to `endFreq`. */
function playNoiseSweep(
  context: AudioContext, out: AudioNode, buffer: AudioBuffer, now: number,
  startFreq: number, endFreq: number, q: number, duration: number, peak: number, attack = 0.02,
): void {
  const source = context.createBufferSource()
  source.buffer = buffer
  source.loop = true
  const filter = context.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = q
  filter.frequency.setValueAtTime(startFreq, now)
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration)
  const gain = context.createGain()
  scheduleEnvelope(gain, now, attack, peak, duration)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(out)
  source.onended = () => {
    source.disconnect()
    filter.disconnect()
    gain.disconnect()
  }
  source.start(now)
  source.stop(now + duration + 0.02)
}

/** One exhaust pop: a band-passed noise crack plus a low thump, reused by the catch and the shutdown. */
function playExhaustPop(context: AudioContext, out: AudioNode, buffer: AudioBuffer, at: number, peak: number): void {
  const freq = POP_NOISE_MIN_FREQ_HZ + Math.random() * POP_NOISE_FREQ_SPREAD_HZ
  playNoiseBurst(context, out, buffer, at, freq, POP_NOISE_Q, POP_NOISE_DURATION_S, peak, 0.001)
  playTone(context, out, at, POP_THUMP_MIN_FREQ_HZ + Math.random() * POP_THUMP_FREQ_SPREAD_HZ, POP_THUMP_DURATION_S, peak * 0.6, {
    type: 'sine',
    endFreq: POP_THUMP_END_FREQ_HZ,
    attack: 0.002,
  })
}

// ---------------------------------------------------------------------------------------------
// One voice per one-shot SoundName. The `Record` below makes the compiler check every name has one.
// `starter`/`engineStop` delegate to the engine start/stop functions defined further down.
// ---------------------------------------------------------------------------------------------

function voiceClick(context: AudioContext, out: GainNode, buffer: AudioBuffer, now: number, intensity: number): void {
  const amount = 0.7 + 0.3 * clamp01(intensity)
  playNoiseBurst(context, out, buffer, now, CLICK_NOISE_FREQ_HZ, CLICK_NOISE_Q, CLICK_NOISE_DURATION_S, CLICK_NOISE_PEAK * amount, 0.0005)
  playTone(context, out, now, CLICK_TONE_FREQ_HZ, CLICK_TONE_DURATION_S, CLICK_TONE_PEAK * amount, { type: 'sine', attack: 0.001 })
}

function voiceLatchOpen(context: AudioContext, out: GainNode, buffer: AudioBuffer, now: number, intensity: number): void {
  const amount = 0.7 + 0.3 * clamp01(intensity)
  playNoiseBurst(context, out, buffer, now, LATCH_CLACK_FREQ_HZ, LATCH_CLACK_Q, LATCH_CLACK_DURATION_S, LATCH_CLACK_PEAK * amount, 0.001)
  playTone(context, out, now + 0.012, LATCH_BOING_FREQ_HZ, LATCH_BOING_DURATION_S, LATCH_BOING_PEAK * amount, { type: 'sine', attack: 0.01 })
  playTone(
    context, out, now + 0.012, LATCH_BOING_FREQ_HZ * 2, LATCH_BOING_DURATION_S * 0.7, LATCH_BOING_PEAK * 0.4 * amount,
    { type: 'sine', attack: 0.01 },
  )
}

function voiceLatchClose(context: AudioContext, out: GainNode, buffer: AudioBuffer, now: number, intensity: number): void {
  const amount = 0.7 + 0.3 * clamp01(intensity)
  playTone(context, out, now, LATCH_THUNK_FREQ_HZ, LATCH_THUNK_DURATION_S, LATCH_THUNK_PEAK * amount, { type: 'sine', endFreq: 40, attack: 0.003 })
  playNoiseBurst(
    context, out, buffer, now, LATCH_CLOSE_NOISE_FREQ_HZ, LATCH_CLOSE_NOISE_Q, LATCH_CLOSE_NOISE_DURATION_S,
    LATCH_THUNK_PEAK * 0.7 * amount, 0.001,
  )
  playNoiseBurst(
    context, out, buffer, now + 0.004, LATCH_CLOSE_RING_FREQ_HZ, LATCH_CLOSE_RING_Q, LATCH_CLOSE_RING_DURATION_S,
    LATCH_THUNK_PEAK * 0.35 * amount, 0.001,
  )
}

function voiceExplode(context: AudioContext, out: GainNode, buffer: AudioBuffer, now: number, intensity: number): void {
  const amount = 0.3 + 0.7 * clamp01(intensity)
  playNoiseSweep(context, out, buffer, now, EXPLODE_SWEEP_LOW_HZ, EXPLODE_SWEEP_HIGH_HZ, EXPLODE_SWEEP_Q, EXPLODE_DURATION_S, EXPLODE_PEAK * amount)
}

function voiceAssemble(context: AudioContext, out: GainNode, buffer: AudioBuffer, now: number, intensity: number): void {
  const amount = 0.3 + 0.7 * clamp01(intensity)
  playNoiseSweep(
    context, out, buffer, now, EXPLODE_SWEEP_HIGH_HZ, EXPLODE_SWEEP_LOW_HZ, EXPLODE_SWEEP_Q, ASSEMBLE_DURATION_S,
    ASSEMBLE_PEAK * amount,
  )
  playNoiseBurst(
    context, out, buffer, now + ASSEMBLE_DURATION_S, CLICK_NOISE_FREQ_HZ, CLICK_NOISE_Q, ASSEMBLE_CLICK_DURATION_S,
    ASSEMBLE_CLICK_PEAK * amount, 0.001,
  )
}

function voiceLightsOn(context: AudioContext, out: GainNode, buffer: AudioBuffer, now: number, intensity: number): void {
  const amount = 0.7 + 0.3 * clamp01(intensity)
  playNoiseBurst(context, out, buffer, now, RELAY_NOISE_FREQ_HZ, RELAY_NOISE_Q, RELAY_NOISE_DURATION_S, RELAY_NOISE_PEAK * amount, 0.0004)
  playTone(context, out, now, RELAY_PING_FREQ_HZ, RELAY_PING_DURATION_S, RELAY_PING_PEAK * amount, { type: 'sine', attack: 0.001 })
}

function voiceLightsOff(context: AudioContext, out: GainNode, buffer: AudioBuffer, now: number, intensity: number): void {
  const amount = 0.7 + 0.3 * clamp01(intensity)
  playNoiseBurst(
    context, out, buffer, now, RELAY_NOISE_FREQ_HZ * 0.9, RELAY_NOISE_Q, RELAY_NOISE_DURATION_S,
    RELAY_NOISE_PEAK * RELAY_OFF_LEVEL * amount, 0.0004,
  )
  playTone(
    context, out, now, RELAY_PING_FREQ_HZ * 0.85, RELAY_PING_DURATION_S, RELAY_PING_PEAK * RELAY_OFF_LEVEL * amount,
    { type: 'sine', attack: 0.001 },
  )
}

/** The engine's live nodes, from the crank until the shutdown stalls. */
interface EngineNodes {
  /** One looping source per rendered speed; the follower crossfades and pitch-shifts them. */
  loops: { rpm: number; source: AudioBufferSourceNode; gain: GainNode }[]
  /** Level for the whole engine; ramped by the catch, the throttle and the shutdown. */
  bus: GainNode
  lowpass: BiquadFilterNode
  compressor: DynamicsCompressorNode
}

interface StarterNodes {
  source: AudioBufferSourceNode
  gain: GainNode
}

interface EngineBuffers {
  loops: { rpm: number; buffer: AudioBuffer }[]
  starter: AudioBuffer
  solenoid: AudioBuffer
}

type EnginePhase = 'stopped' | 'cranking' | 'catching' | 'running' | 'stopping'

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
const easeOut = (t: number): number => 1 - (1 - clamp01(t)) ** 3

/** Normalised engine speed, 0 at idle and 1 at redline. */
const speedForRpm = (rpm: number): number => clamp01((rpm - IDLE_RPM) / (REDLINE_RPM - IDLE_RPM))
const rpmForThrottle = (amount: number): number => IDLE_RPM + (REDLINE_RPM - IDLE_RPM) * clamp01(amount) ** THROTTLE_CURVE
const levelForRpm = (rpm: number): number => lerp(ENGINE_IDLE_LEVEL, ENGINE_REDLINE_LEVEL, Math.sqrt(speedForRpm(rpm)))

/**
 * Equal-power crossfade weights over the rendered loops for `rpm`, interpolating in log-rpm so
 * each loop is pitch-shifted by at most the ratio to its neighbour.
 */
export function loopWeightsForRpm(rpm: number, loopRpms: readonly number[] = LOOP_RPMS): number[] {
  const weights = loopRpms.map(() => 0)
  if (loopRpms.length === 0) return weights
  if (rpm <= loopRpms[0]!) {
    weights[0] = 1
    return weights
  }
  const last = loopRpms.length - 1
  if (rpm >= loopRpms[last]!) {
    weights[last] = 1
    return weights
  }
  for (let i = 0; i < last; i++) {
    const low = loopRpms[i]!
    const high = loopRpms[i + 1]!
    if (rpm >= low && rpm < high) {
      const t = (Math.log(rpm) - Math.log(low)) / (Math.log(high) - Math.log(low))
      weights[i] = Math.cos((t * Math.PI) / 2)
      weights[i + 1] = Math.sin((t * Math.PI) / 2)
      return weights
    }
  }
  return weights
}

export function createAudio(): ShowroomAudio {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let noiseBuffer: AudioBuffer | null = null
  let unlocked = false
  let muted = false
  const lastPlayedAt = new Map<SoundName, number>()

  let engineBuffers: EngineBuffers | null = null
  let engine: EngineNodes | null = null
  let starter: StarterNodes | null = null
  let enginePhase: EnginePhase = 'stopped'
  /** The rpm model's own speed, before the lope and shudder wobbles are added. */
  let engineRpm = 0
  /** Context time the current phase began. */
  let phaseStartedAt = 0
  let lastTickAt = 0
  let throttleTarget = 0
  let engineTicker: ReturnType<typeof setInterval> | null = null

  function ensureContext(): boolean {
    if (ctx && master) return true
    try {
      const w = window as unknown as {
        AudioContext?: AudioContextConstructor
        webkitAudioContext?: AudioContextConstructor
      }
      const Ctor = w.AudioContext ?? w.webkitAudioContext
      if (!Ctor) return false
      const context = new Ctor()
      const gain = context.createGain()
      gain.gain.value = muted ? 0 : MASTER_GAIN
      gain.connect(context.destination)
      ctx = context
      master = gain
      return true
    } catch {
      ctx = null
      master = null
      return false
    }
  }

  /** One shared noise buffer, generated once and reused by every noise-based voice. */
  function getNoiseBuffer(context: AudioContext): AudioBuffer {
    if (noiseBuffer) return noiseBuffer
    const length = Math.floor(context.sampleRate * NOISE_BUFFER_SECONDS)
    const buffer = context.createBuffer(1, length, context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    noiseBuffer = buffer
    return buffer
  }

  function resume(): void {
    try {
      if (!ensureContext() || !ctx) return
      if (ctx.state === 'suspended') void ctx.resume()
      unlocked = true
    } catch { /* no-op: audio is optional */ }
  }

  function setMuted(nextMuted: boolean): void {
    muted = nextMuted
    if (!ctx || !master) return
    try {
      const now = ctx.currentTime
      const target = muted ? 0 : MASTER_GAIN
      master.gain.cancelScheduledValues(now)
      master.gain.setValueAtTime(master.gain.value, now)
      master.gain.linearRampToValueAtTime(target, now + MUTE_RAMP_SECONDS)
    } catch { /* no-op: audio is optional */ }
  }

  function canPlay(): boolean {
    return unlocked && !muted && ctx !== null && master !== null
  }

  /** Runs `action` with the live context/master gain when playable, and never throws. */
  function withAudio(action: (context: AudioContext, out: GainNode) => void): void {
    if (!canPlay() || !ctx || !master) return
    try {
      action(ctx, master)
    } catch { /* no-op: audio is optional */ }
  }

  // --- The V8 ----------------------------------------------------------------------------------

  function toAudioBuffer(context: AudioContext, samples: Float32Array<ArrayBuffer>): AudioBuffer {
    const buffer = context.createBuffer(1, samples.length, context.sampleRate)
    buffer.copyToChannel(samples, 0)
    return buffer
  }

  /** Renders the engine loops and starter once, on the first start, at the context's sample rate. */
  function ensureEngineBuffers(context: AudioContext): EngineBuffers {
    if (engineBuffers) return engineBuffers
    const rate = context.sampleRate
    engineBuffers = {
      loops: LOOP_RPMS.map((rpm, index) => ({ rpm, buffer: toAudioBuffer(context, generateEngineLoop(rpm, rate, index + 1)) })),
      starter: toAudioBuffer(context, generateStarterLoop(rate)),
      solenoid: toAudioBuffer(context, generateSolenoidClunk(rate)),
    }
    return engineBuffers
  }

  /** Builds and starts the looping engine sources, silent, so the follower can fade them in. */
  function ensureEngine(context: AudioContext, out: GainNode, now: number): EngineNodes {
    if (engine) return engine
    const buffers = ensureEngineBuffers(context)
    const bus = context.createGain()
    bus.gain.value = 0
    const lowpass = context.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = ENGINE_LOWPASS_HZ
    lowpass.Q.value = ENGINE_LOWPASS_Q
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = ENGINE_COMPRESSOR_THRESHOLD_DB
    compressor.ratio.value = ENGINE_COMPRESSOR_RATIO
    bus.connect(lowpass)
    lowpass.connect(compressor)
    compressor.connect(out)
    const loops = buffers.loops.map(({ rpm, buffer }) => {
      const source = context.createBufferSource()
      source.buffer = buffer
      source.loop = true
      const gain = context.createGain()
      gain.gain.value = 0
      source.connect(gain)
      gain.connect(bus)
      source.start(now)
      return { rpm, source, gain }
    })
    engine = { loops, bus, lowpass, compressor }
    return engine
  }

  function teardownEngine(): void {
    if (!engine) return
    const nodes = engine
    for (const loop of nodes.loops) {
      try {
        loop.source.stop()
      } catch { /* already stopped */ }
      loop.source.disconnect()
      loop.gain.disconnect()
    }
    nodes.bus.disconnect()
    nodes.lowpass.disconnect()
    nodes.compressor.disconnect()
    engine = null
  }

  function stopTicker(): void {
    if (engineTicker !== null) clearInterval(engineTicker)
    engineTicker = null
  }

  function startTicker(): void {
    if (engineTicker !== null) return
    engineTicker = setInterval(() => {
      try {
        if (ctx) tickEngine(ctx)
      } catch { /* no-op: audio is optional */ }
    }, ENGINE_TICK_MS)
  }

  /** Points every loop at `rpm` (crossfade weights and playback rates) and the bus at `level`. */
  function applyEngineRpm(context: AudioContext, nodes: EngineNodes, rpm: number, level: number): void {
    const now = context.currentTime
    const weights = loopWeightsForRpm(rpm, nodes.loops.map((loop) => loop.rpm))
    nodes.loops.forEach((loop, index) => {
      loop.gain.gain.setTargetAtTime(weights[index]!, now, ENGINE_TICK_SMOOTHING_S)
      loop.source.playbackRate.setTargetAtTime(Math.max(0.05, rpm / loop.rpm), now, ENGINE_TICK_SMOOTHING_S)
    })
    nodes.bus.gain.setTargetAtTime(level, now, ENGINE_TICK_SMOOTHING_S)
  }

  /** The idle lope: strongest at idle, gone by `LOPE_FADE_RPM`, slightly irregular. */
  function lopeAt(time: number, rpm: number): number {
    const depth = LOPE_RPM * clamp01(1 - (rpm - IDLE_RPM) / (LOPE_FADE_RPM - IDLE_RPM))
    return depth * (Math.sin(2 * Math.PI * LOPE_HZ * time) + 0.5 * Math.sin(2 * Math.PI * LOPE_HZ * 0.37 * time + 1))
  }

  /** One step of the rpm model, run by the ticker while the engine is cranking, running or stopping. */
  function tickEngine(context: AudioContext): void {
    const now = context.currentTime
    const dt = Math.min(0.1, Math.max(0, now - lastTickAt))
    lastTickAt = now
    const t = now - phaseStartedAt

    if (enginePhase === 'cranking') {
      if (t >= STARTER_CRANK_SECONDS && master) beginCatch(context, master, now)
      return
    }
    if (!engine) return

    if (enginePhase === 'catching') {
      engineRpm = t < CATCH_RISE_S
        ? lerp(CATCH_START_RPM, CATCH_FLARE_RPM, easeOut(t / CATCH_RISE_S))
        : IDLE_RPM + (CATCH_FLARE_RPM - IDLE_RPM) * Math.exp(-(t - CATCH_RISE_S) / CATCH_FLARE_DECAY_S)
      const swell = clamp01(t / CATCH_SWELL_S)
      applyEngineRpm(context, engine, engineRpm + lopeAt(now, engineRpm), levelForRpm(engineRpm) * swell)
      if (t >= CATCH_FLARE_SECONDS) {
        enginePhase = 'running'
        phaseStartedAt = now
      }
      return
    }

    if (enginePhase === 'running') {
      const target = rpmForThrottle(throttleTarget)
      const timeConstant = target > engineRpm ? RPM_RISE_TIME_CONSTANT_S : RPM_FALL_TIME_CONSTANT_S
      engineRpm += (target - engineRpm) * (1 - Math.exp(-dt / timeConstant))
      applyEngineRpm(context, engine, engineRpm + lopeAt(now, engineRpm), levelForRpm(engineRpm))
      return
    }

    if (enginePhase === 'stopping') {
      engineRpm -= STOP_RPM_FALL_PER_SECOND * dt
      if (engineRpm <= STOP_STALL_RPM) {
        finishStop()
        return
      }
      const dying = clamp01((engineRpm - STOP_STALL_RPM) / (IDLE_RPM - STOP_STALL_RPM))
      const shudder = STOP_SHUDDER_RPM * (1 - dying) * Math.sin(2 * Math.PI * STOP_SHUDDER_HZ * t)
      applyEngineRpm(context, engine, engineRpm + shudder, levelForRpm(engineRpm) * Math.sqrt(dying))
    }
  }

  /** Lets the starter zing free and disengage, then removes its nodes. */
  function releaseStarter(now: number): void {
    if (!starter) return
    const nodes = starter
    starter = null
    nodes.source.playbackRate.cancelScheduledValues(now)
    nodes.source.playbackRate.setValueAtTime(nodes.source.playbackRate.value, now)
    nodes.source.playbackRate.linearRampToValueAtTime(STARTER_DISENGAGE_RATE, now + STARTER_RELEASE_S)
    nodes.gain.gain.cancelScheduledValues(now)
    nodes.gain.gain.setValueAtTime(Math.max(0.0001, nodes.gain.gain.value), now)
    nodes.gain.gain.exponentialRampToValueAtTime(0.0001, now + STARTER_RELEASE_S)
    nodes.source.stop(now + STARTER_RELEASE_S + 0.05)
    nodes.source.onended = () => {
      nodes.source.disconnect()
      nodes.gain.disconnect()
    }
  }

  /** The engine fires: the starter disengages, a burst of pops, and the loops swell in on the flare. */
  function beginCatch(context: AudioContext, out: GainNode, now: number): void {
    enginePhase = 'catching'
    phaseStartedAt = now
    engineRpm = CATCH_START_RPM
    releaseStarter(now)
    ensureEngine(context, out, now)
    const buffer = getNoiseBuffer(context)
    for (let i = 0; i < CATCH_POP_COUNT; i++) {
      const at = now + 0.04 + i * 0.09 + Math.random() * 0.02
      playExhaustPop(context, out, buffer, at, CATCH_POP_PEAK * (1 - i * 0.2))
    }
  }

  /** The starter sequence: solenoid clunk, then the motor labouring up to cranking speed. Idempotent while running. */
  function startEngineAudio(context: AudioContext, out: GainNode, now: number, intensity: number): void {
    if (enginePhase !== 'stopped') return
    const amount = 0.6 + 0.4 * clamp01(intensity)
    const buffers = ensureEngineBuffers(context)
    enginePhase = 'cranking'
    phaseStartedAt = now
    lastTickAt = now
    engineRpm = 0

    const clunk = context.createBufferSource()
    clunk.buffer = buffers.solenoid
    const clunkGain = context.createGain()
    clunkGain.gain.value = SOLENOID_LEVEL * amount
    clunk.connect(clunkGain)
    clunkGain.connect(out)
    clunk.start(now)
    clunk.onended = () => {
      clunk.disconnect()
      clunkGain.disconnect()
    }

    const source = context.createBufferSource()
    source.buffer = buffers.starter
    source.loop = true
    source.playbackRate.setValueAtTime(STARTER_START_RATE, now)
    source.playbackRate.linearRampToValueAtTime(1, now + STARTER_SPIN_UP_S)
    const gain = context.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(STARTER_LEVEL * amount, now + STARTER_ATTACK_S)
    source.connect(gain)
    gain.connect(out)
    source.start(now + 0.06)
    starter = { source, gain }
    startTicker()
  }

  function finishStop(): void {
    teardownEngine()
    stopTicker()
    enginePhase = 'stopped'
    engineRpm = 0
  }

  /** Shutdown: the rpm falls away with two pops until the engine stalls; mid-crank it just lets the starter go. */
  function stopEngineAudio(context: AudioContext, out: GainNode, now: number, intensity: number): void {
    if (enginePhase === 'stopped' || enginePhase === 'stopping') return
    if (enginePhase === 'cranking') {
      releaseStarter(now)
      finishStop()
      return
    }
    enginePhase = 'stopping'
    phaseStartedAt = now
    const amount = 0.6 + 0.4 * clamp01(intensity)
    const buffer = getNoiseBuffer(context)
    for (let i = 0; i < STOP_POP_COUNT; i++) {
      const at = now + 0.25 + i * 0.32 + Math.random() * 0.05
      playExhaustPop(context, out, buffer, at, STOP_POP_PEAK * (1 - i * 0.25) * amount)
    }
  }

  function voiceStarter(context: AudioContext, out: GainNode, _buffer: AudioBuffer, now: number, intensity: number): void {
    startEngineAudio(context, out, now, intensity)
  }

  function voiceEngineStop(context: AudioContext, out: GainNode, _buffer: AudioBuffer, now: number, intensity: number): void {
    stopEngineAudio(context, out, now, intensity)
  }

  const VOICES: Record<SoundName, Voice> = {
    click: voiceClick,
    latchOpen: voiceLatchOpen,
    latchClose: voiceLatchClose,
    explode: voiceExplode,
    assemble: voiceAssemble,
    starter: voiceStarter,
    engineStop: voiceEngineStop,
    lightsOn: voiceLightsOn,
    lightsOff: voiceLightsOff,
  }

  function play(name: SoundName, intensity = 1): void {
    withAudio((context, out) => {
      const now = context.currentTime
      const last = lastPlayedAt.get(name) ?? -Infinity
      if (now - last < MIN_VOICE_INTERVAL_S) return
      lastPlayedAt.set(name, now)
      VOICES[name](context, out, getNoiseBuffer(context), now, clamp01(intensity))
    })
  }

  function setEngine(running: boolean): void {
    withAudio((context, out) => {
      const now = context.currentTime
      if (running) startEngineAudio(context, out, now, 1)
      else stopEngineAudio(context, out, now, 1)
    })
  }

  /** The rpm follower reads the target on its next tick, so this only records it. */
  function setThrottle(amount: number): void {
    throttleTarget = clamp01(amount)
  }

  function dispose(): void {
    try {
      stopTicker()
      if (starter) {
        starter.source.stop()
        starter.source.disconnect()
        starter.gain.disconnect()
      }
      teardownEngine()
      master?.disconnect()
      void ctx?.close()
    } catch { /* no-op: audio is optional */ } finally {
      starter = null
      enginePhase = 'stopped'
      engineRpm = 0
      throttleTarget = 0
      engineBuffers = null
      noiseBuffer = null
      ctx = null
      master = null
      unlocked = false
      lastPlayedAt.clear()
    }
  }

  return { play, setEngine, setThrottle, setMuted, resume, dispose }
}
