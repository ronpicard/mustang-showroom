/** Synthesised Mustang Showroom sound effects and the V8 idle loop, entirely Web Audio, no asset files. */

import type { SoundName } from './car/types.ts'

export interface ShowroomAudio {
  play(name: SoundName, intensity?: number): void
  /** Starts (starter crank then catch, then a looping big-block idle) or stops (a last rumble, then silence) the engine. */
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

// --- Starter cranking ------------------------------------------------------------------------

const STARTER_CRANK_HZ = 22
const STARTER_LOWPASS_HZ = 400
const STARTER_MOD_HZ = 11
const STARTER_DURATION_S = 1.1
const STARTER_ATTACK_S = 0.08
const STARTER_RELEASE_S = 0.12
const STARTER_PEAK = 0.2
/** Base level of the AM gain: with the ±1 square wave added on top this chops between 0 and 2×. */
const STARTER_CHOP_BASE = 0.5
/** How long after the crank starts the engine catches, and how it swells in. */
const CATCH_FADE_IN_S = 0.3
const CATCH_POP_BURST_S = 0.25
const CATCH_POP_COUNT = 4
const CATCH_POP_PEAK = 0.16

// --- Engine shutdown -------------------------------------------------------------------------

const STOP_FALL_S = 0.9
/** The idle loop's firing frequency never truly reaches 0 Hz (oscillators reject it); this is "stalled". */
const STOP_END_FREQ_HZ = 12
const STOP_POP_COUNT = 2
const STOP_POP_PEAK = 0.18

// --- The V8 idle loop (~750 rpm at idle: 8 cylinders firing per 2 revolutions = 50 pulses/s) ---

const IDLE_FIRING_HZ = 50
const FULL_THROTTLE_FIRING_HZ = 230
/** `setThrottle` and the starter's catch/shutdown ramps all ease toward their targets at this rate. */
const ENGINE_TIME_CONSTANT_S = 0.25
/** The big cam's lope: a slow LFO wobbling the firing pitch. */
const ENGINE_LOPE_HZ = 4
const ENGINE_LOPE_DEPTH = 0.02
/** The tracking noise bed's lowpass follows this multiple of the firing frequency. */
const ENGINE_NOISE_LOWPASS_MULT = 2
const ENGINE_LOWPASS_HZ = 1200
const ENGINE_LOWPASS_Q = 0.7
const ENGINE_COMPRESSOR_THRESHOLD_DB = -20
const ENGINE_COMPRESSOR_RATIO = 6
/** Relative mix of the three idle layers, all measured before the shared bus gain. */
const ENGINE_FIRING_MIX = 0.5
const ENGINE_SUB_MIX = 0.35
const ENGINE_NOISE_MIX = 0.22
/** Waveshaper drive: how ragged the sawtooth's firing edge sounds. */
const ENGINE_WAVESHAPER_DRIVE = 9
/** The idle loop sits well under the one-shot effects; only full throttle approaches them. */
const ENGINE_IDLE_BUS_GAIN = 0.08
const ENGINE_FULL_BUS_GAIN = 0.2

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

/** A soft clipper curve for the idle loop's waveshaper: higher `amount` sounds more ragged. */
function createDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const samples = 256
  const curve = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1
    curve[i] = ((3 + amount) * x * ((20 * Math.PI) / 180)) / (Math.PI + amount * Math.abs(x))
  }
  return curve
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

/** The idle loop's live nodes, from the first `startEngineAudio` call until it fully stops. */
interface EngineLoopNodes {
  firingOsc: OscillatorNode
  waveshaper: WaveShaperNode
  firingGain: GainNode
  subOsc: OscillatorNode
  subGain: GainNode
  noiseSource: AudioBufferSourceNode
  noiseFilter: BiquadFilterNode
  noiseGain: GainNode
  lopeLfo: OscillatorNode
  lopeDepth: GainNode
  lopeSubDepth: GainNode
  lowpass: BiquadFilterNode
  compressor: DynamicsCompressorNode
  /** Final gain for the whole idle loop; ramped by the catch, `setThrottle` and the shutdown. */
  bus: GainNode
}

type EngineState = 'stopped' | 'starting' | 'running' | 'stopping'

const firingHzForThrottle = (amount: number): number => IDLE_FIRING_HZ + (FULL_THROTTLE_FIRING_HZ - IDLE_FIRING_HZ) * clamp01(amount)
const busGainForThrottle = (amount: number): number => ENGINE_IDLE_BUS_GAIN + (ENGINE_FULL_BUS_GAIN - ENGINE_IDLE_BUS_GAIN) * clamp01(amount)

export function createAudio(): ShowroomAudio {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let noiseBuffer: AudioBuffer | null = null
  let unlocked = false
  let muted = false
  const lastPlayedAt = new Map<SoundName, number>()

  let engineLoop: EngineLoopNodes | null = null
  let engineState: EngineState = 'stopped'
  let throttleTarget = 0
  let startTimeout: ReturnType<typeof setTimeout> | null = null
  let stopTimeout: ReturnType<typeof setTimeout> | null = null

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

  // --- The V8 idle loop ------------------------------------------------------------------------

  function ensureEngineLoop(context: AudioContext, out: GainNode): EngineLoopNodes {
    if (engineLoop) return engineLoop
    const now = context.currentTime

    const firingOsc = context.createOscillator()
    firingOsc.type = 'sawtooth'
    firingOsc.frequency.value = IDLE_FIRING_HZ
    const waveshaper = context.createWaveShaper()
    waveshaper.curve = createDistortionCurve(ENGINE_WAVESHAPER_DRIVE)
    waveshaper.oversample = '2x'
    const firingGain = context.createGain()
    firingGain.gain.value = ENGINE_FIRING_MIX

    const subOsc = context.createOscillator()
    subOsc.type = 'sine'
    subOsc.frequency.value = IDLE_FIRING_HZ / 2
    const subGain = context.createGain()
    subGain.gain.value = ENGINE_SUB_MIX

    const noiseSource = context.createBufferSource()
    noiseSource.buffer = getNoiseBuffer(context)
    noiseSource.loop = true
    const noiseFilter = context.createBiquadFilter()
    noiseFilter.type = 'lowpass'
    noiseFilter.frequency.value = IDLE_FIRING_HZ * ENGINE_NOISE_LOWPASS_MULT
    const noiseGain = context.createGain()
    noiseGain.gain.value = ENGINE_NOISE_MIX

    // The cam's lope: a slow wobble on both the firing pitch and its sub-octave.
    const lopeLfo = context.createOscillator()
    lopeLfo.type = 'sine'
    lopeLfo.frequency.value = ENGINE_LOPE_HZ
    const lopeDepth = context.createGain()
    lopeDepth.gain.value = IDLE_FIRING_HZ * ENGINE_LOPE_DEPTH
    const lopeSubDepth = context.createGain()
    lopeSubDepth.gain.value = (IDLE_FIRING_HZ / 2) * ENGINE_LOPE_DEPTH

    const lowpass = context.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.Q.value = ENGINE_LOWPASS_Q
    lowpass.frequency.value = ENGINE_LOWPASS_HZ

    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = ENGINE_COMPRESSOR_THRESHOLD_DB
    compressor.ratio.value = ENGINE_COMPRESSOR_RATIO

    const bus = context.createGain()
    bus.gain.value = 0.0001

    firingOsc.connect(waveshaper)
    waveshaper.connect(firingGain)
    firingGain.connect(lowpass)

    subOsc.connect(subGain)
    subGain.connect(lowpass)

    noiseSource.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(lowpass)

    lopeLfo.connect(lopeDepth)
    lopeDepth.connect(firingOsc.frequency)
    lopeLfo.connect(lopeSubDepth)
    lopeSubDepth.connect(subOsc.frequency)

    lowpass.connect(compressor)
    compressor.connect(bus)
    bus.connect(out)

    firingOsc.start(now)
    subOsc.start(now)
    noiseSource.start(now)
    lopeLfo.start(now)

    engineLoop = {
      firingOsc, waveshaper, firingGain, subOsc, subGain, noiseSource, noiseFilter, noiseGain,
      lopeLfo, lopeDepth, lopeSubDepth, lowpass, compressor, bus,
    }
    return engineLoop
  }

  /** Eases the loop's firing frequency (and everything that tracks it) toward `amount`'s throttle. */
  function applyThrottle(context: AudioContext, nodes: EngineLoopNodes, amount: number, includeBus: boolean): void {
    const now = context.currentTime
    const freq = firingHzForThrottle(amount)
    nodes.firingOsc.frequency.setTargetAtTime(freq, now, ENGINE_TIME_CONSTANT_S)
    nodes.subOsc.frequency.setTargetAtTime(freq / 2, now, ENGINE_TIME_CONSTANT_S)
    nodes.noiseFilter.frequency.setTargetAtTime(freq * ENGINE_NOISE_LOWPASS_MULT, now, ENGINE_TIME_CONSTANT_S)
    nodes.lopeDepth.gain.setTargetAtTime(freq * ENGINE_LOPE_DEPTH, now, ENGINE_TIME_CONSTANT_S)
    nodes.lopeSubDepth.gain.setTargetAtTime((freq / 2) * ENGINE_LOPE_DEPTH, now, ENGINE_TIME_CONSTANT_S)
    if (includeBus) nodes.bus.gain.setTargetAtTime(busGainForThrottle(amount), now, ENGINE_TIME_CONSTANT_S)
  }

  function teardownEngineLoop(): void {
    if (!engineLoop) return
    const nodes = engineLoop
    try {
      nodes.firingOsc.stop()
      nodes.subOsc.stop()
      nodes.noiseSource.stop()
      nodes.lopeLfo.stop()
    } catch { /* already stopped */ }
    for (const node of [
      nodes.firingOsc, nodes.waveshaper, nodes.firingGain, nodes.subOsc, nodes.subGain,
      nodes.noiseSource, nodes.noiseFilter, nodes.noiseGain, nodes.lopeLfo, nodes.lopeDepth,
      nodes.lopeSubDepth, nodes.lowpass, nodes.compressor, nodes.bus,
    ]) node.disconnect()
    engineLoop = null
  }

  /** The starter crank, then the catch (idle loop fade-in plus a burst of exhaust pops). Idempotent while running. */
  function startEngineAudio(context: AudioContext, out: GainNode, now: number, intensity: number): void {
    if (engineState !== 'stopped') return
    engineState = 'starting'
    const amount = 0.6 + 0.4 * clamp01(intensity)
    const buffer = getNoiseBuffer(context)

    const crankOsc = context.createOscillator()
    crankOsc.type = 'sawtooth'
    crankOsc.frequency.value = STARTER_CRANK_HZ
    const crankLowpass = context.createBiquadFilter()
    crankLowpass.type = 'lowpass'
    crankLowpass.frequency.value = STARTER_LOWPASS_HZ
    const chopOsc = context.createOscillator()
    chopOsc.type = 'square'
    chopOsc.frequency.value = STARTER_MOD_HZ
    const chopDepth = context.createGain()
    chopDepth.gain.value = STARTER_CHOP_BASE
    const ampGain = context.createGain()
    ampGain.gain.value = STARTER_CHOP_BASE
    const envelopeGain = context.createGain()
    envelopeGain.gain.setValueAtTime(0.0001, now)
    envelopeGain.gain.linearRampToValueAtTime(STARTER_PEAK * amount, now + STARTER_ATTACK_S)
    envelopeGain.gain.setValueAtTime(STARTER_PEAK * amount, now + STARTER_DURATION_S - STARTER_RELEASE_S)
    envelopeGain.gain.linearRampToValueAtTime(0.0001, now + STARTER_DURATION_S)

    crankOsc.connect(crankLowpass)
    crankLowpass.connect(ampGain)
    chopOsc.connect(chopDepth)
    chopDepth.connect(ampGain.gain)
    ampGain.connect(envelopeGain)
    envelopeGain.connect(out)

    const crankStopAt = now + STARTER_DURATION_S + 0.05
    crankOsc.start(now)
    chopOsc.start(now)
    crankOsc.stop(crankStopAt)
    chopOsc.stop(crankStopAt)
    crankOsc.onended = () => {
      crankOsc.disconnect()
      crankLowpass.disconnect()
      ampGain.disconnect()
      envelopeGain.disconnect()
    }
    chopOsc.onended = () => {
      chopOsc.disconnect()
      chopDepth.disconnect()
    }

    const catchTime = now + STARTER_DURATION_S
    const nodes = ensureEngineLoop(context, out)
    applyThrottle(context, nodes, throttleTarget, false)
    nodes.bus.gain.cancelScheduledValues(catchTime)
    nodes.bus.gain.setValueAtTime(0.0001, catchTime)
    nodes.bus.gain.exponentialRampToValueAtTime(busGainForThrottle(throttleTarget), catchTime + CATCH_FADE_IN_S)

    for (let i = 0; i < CATCH_POP_COUNT; i++) {
      const t = catchTime + (i / CATCH_POP_COUNT) * CATCH_POP_BURST_S + Math.random() * 0.01
      playExhaustPop(context, out, buffer, t, CATCH_POP_PEAK * (1 - i * 0.18) * amount)
    }

    if (startTimeout !== null) clearTimeout(startTimeout)
    startTimeout = setTimeout(() => {
      if (engineState === 'starting') engineState = 'running'
      startTimeout = null
    }, (STARTER_DURATION_S + CATCH_FADE_IN_S) * 1000)
  }

  /** The falling-rpm shutdown: idle loop pitch and level fall over `STOP_FALL_S` with two pops. */
  function stopEngineAudio(context: AudioContext, out: GainNode, now: number, intensity: number): void {
    if (engineState === 'stopped' || engineState === 'stopping' || !engineLoop) return
    engineState = 'stopping'
    const nodes = engineLoop
    const amount = 0.6 + 0.4 * clamp01(intensity)
    const buffer = getNoiseBuffer(context)

    nodes.firingOsc.frequency.cancelScheduledValues(now)
    nodes.firingOsc.frequency.setValueAtTime(nodes.firingOsc.frequency.value, now)
    nodes.firingOsc.frequency.exponentialRampToValueAtTime(STOP_END_FREQ_HZ, now + STOP_FALL_S)
    nodes.subOsc.frequency.cancelScheduledValues(now)
    nodes.subOsc.frequency.setValueAtTime(nodes.subOsc.frequency.value, now)
    nodes.subOsc.frequency.exponentialRampToValueAtTime(STOP_END_FREQ_HZ / 2, now + STOP_FALL_S)
    nodes.noiseFilter.frequency.cancelScheduledValues(now)
    nodes.noiseFilter.frequency.setValueAtTime(nodes.noiseFilter.frequency.value, now)
    nodes.noiseFilter.frequency.exponentialRampToValueAtTime(STOP_END_FREQ_HZ * ENGINE_NOISE_LOWPASS_MULT, now + STOP_FALL_S)
    nodes.bus.gain.cancelScheduledValues(now)
    nodes.bus.gain.setValueAtTime(nodes.bus.gain.value, now)
    nodes.bus.gain.exponentialRampToValueAtTime(0.0001, now + STOP_FALL_S)

    for (let i = 0; i < STOP_POP_COUNT; i++) {
      const t = now + STOP_FALL_S * (0.3 + i * 0.35) + Math.random() * 0.04
      playExhaustPop(context, out, buffer, t, STOP_POP_PEAK * (1 - i * 0.25) * amount)
    }

    if (startTimeout !== null) {
      clearTimeout(startTimeout)
      startTimeout = null
    }
    if (stopTimeout !== null) clearTimeout(stopTimeout)
    stopTimeout = setTimeout(() => {
      teardownEngineLoop()
      engineState = 'stopped'
      stopTimeout = null
    }, (STOP_FALL_S + 0.1) * 1000)
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

  function setThrottle(amount: number): void {
    throttleTarget = clamp01(amount)
    withAudio((context) => {
      if (!engineLoop || engineState !== 'running') return
      applyThrottle(context, engineLoop, throttleTarget, true)
    })
  }

  function dispose(): void {
    try {
      if (startTimeout !== null) clearTimeout(startTimeout)
      if (stopTimeout !== null) clearTimeout(stopTimeout)
      teardownEngineLoop()
      master?.disconnect()
      void ctx?.close()
    } catch { /* no-op: audio is optional */ } finally {
      startTimeout = null
      stopTimeout = null
      engineState = 'stopped'
      throttleTarget = 0
      noiseBuffer = null
      ctx = null
      master = null
      unlocked = false
      lastPlayedAt.clear()
    }
  }

  return { play, setEngine, setThrottle, setMuted, resume, dispose }
}
