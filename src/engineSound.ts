/**
 * Offline synthesis of the V8's sound: seamless engine loops at a few fixed speeds, and the
 * starter motor's crank. Pure DSP over `Float32Array`s, no Web Audio, so `audio.ts` can bake
 * them into `AudioBuffer`s and this file can be unit-tested in Node.
 *
 * The engine model: a cross-plane V8 fires every 90° of crank, alternating banks in Ford's
 * 1-5-4-2-6-3-7-8 order, so each bank's exhaust sees pulses at uneven 90/180/270/180° spacing.
 * That unevenness, summed through two slightly different pipe resonators, is the classic
 * American V8 burble. Each firing is a short noise puff (the exhaust pulse) over a low pressure
 * thump, with per-cylinder amplitude jitter for the big cam's lumpy idle, plus a faint valvetrain
 * tick. Loops are an exact number of 720° cycles long and rendered twice so the resonators' state
 * wraps cleanly at the seam.
 */

/** How long the starter cranks before the engine catches, matched by the engine bay's shake. */
export const STARTER_CRANK_SECONDS = 1.35
/** After the catch the rpm flares and settles to idle over this long. */
export const CATCH_FLARE_SECONDS = 1.6
export const IDLE_RPM = 800
export const REDLINE_RPM = 5400
/** The rpm the catch flares to before settling to idle. */
export const CATCH_FLARE_RPM = 1500
/** The speeds the loops are rendered at; playback crossfades between neighbours. */
export const LOOP_RPMS: readonly number[] = [800, 1500, 2700, 4600]
export const LOOP_SECONDS = 2
export const STARTER_LOOP_SECONDS = 1
/** Compression pulses per second while cranking (about 180 rpm on eight cylinders). */
export const STARTER_PULSE_HZ = 9.5

/** Bank of each firing in order, one per 90° of crank: Ford 1-5-4-2-6-3-7-8 with 1-4 right, 5-8 left. */
const FIRING_BANKS: readonly (0 | 1)[] = [0, 1, 0, 0, 1, 0, 1, 1]
const FIRINGS_PER_CYCLE = 8
const CYCLE_DEGREES = 720

/** The exhaust puff: a noise burst whose decay shortens as the engine speeds up. */
const PUFF_DECAY_SECONDS_AT_IDLE = 0.0075
const PUFF_DECAY_SECONDS_AT_REDLINE = 0.0028
const PUFF_LEVEL = 0.55
/** The pressure thump under each puff: one half-sine this wide. */
const THUMP_WIDTH_SECONDS_AT_IDLE = 0.0052
const THUMP_WIDTH_SECONDS_AT_REDLINE = 0.0022
const THUMP_LEVEL = 0.9
/** Per-cylinder amplitude jitter at idle (lumpy cam) and how it fades with speed. */
const JITTER_AT_IDLE = 0.22
const JITTER_AT_REDLINE = 0.05
/** Per-firing timing jitter as a fraction of one firing interval. */
const TIMING_JITTER = 0.03
/** Valvetrain tick: a short high click at twice the firing rate, well below the exhaust. */
const TICK_LEVEL = 0.05
const TICK_DECAY_SECONDS = 0.0012
/** Each bank's pipe: two resonant peaks and a feedback comb for the pipe's own length. */
const PIPE_RESONANCES: readonly { hz: number; q: number; gain: number }[][] = [
  [
    { hz: 92, q: 2.6, gain: 1 },
    { hz: 205, q: 2.2, gain: 0.7 },
    { hz: 410, q: 1.6, gain: 0.35 },
  ],
  [
    { hz: 88, q: 2.6, gain: 1 },
    { hz: 218, q: 2.2, gain: 0.7 },
    { hz: 395, q: 1.6, gain: 0.35 },
  ],
]
const PIPE_COMB_DELAY_SECONDS: readonly number[] = [0.0071, 0.0066]
const PIPE_COMB_FEEDBACK = 0.42
/** The two banks reach the listener a little apart. */
const BANK_OFFSET_SECONDS = 0.0009
const SOFT_CLIP_DRIVE = 1.6
const OUTPUT_PEAK = 0.9

// --- Starter -------------------------------------------------------------------------------

const STARTER_MOTOR_HZ = 165
/** The motor's pitch dips by this fraction on every compression stroke. */
const STARTER_PITCH_DIP = 0.16
const STARTER_MOTOR_LEVEL = 0.6
const STARTER_GEAR_NOISE_HZ = 1500
const STARTER_GEAR_NOISE_Q = 2.5
const STARTER_GEAR_NOISE_LEVEL = 0.3
const STARTER_SOLENOID_LEVEL = 0.35

/** A small deterministic PRNG (mulberry32), so a seed always renders the same loop. */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

/** A direct-form biquad bandpass (constant peak gain) with its own state. */
class Bandpass {
  private readonly b0: number
  private readonly b2: number
  private readonly a1: number
  private readonly a2: number
  private x1 = 0
  private x2 = 0
  private y1 = 0
  private y2 = 0

  constructor(sampleRate: number, hz: number, q: number) {
    const w0 = (2 * Math.PI * hz) / sampleRate
    const alpha = Math.sin(w0) / (2 * q)
    const a0 = 1 + alpha
    this.b0 = alpha / a0
    this.b2 = -alpha / a0
    this.a1 = (-2 * Math.cos(w0)) / a0
    this.a2 = (1 - alpha) / a0
  }

  process(x: number): number {
    const y = this.b0 * x + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2
    this.x2 = this.x1
    this.x1 = x
    this.y2 = this.y1
    this.y1 = y
    return y
  }
}

/** One exhaust bank: resonances in parallel plus a feedback comb, keeping some of the dry pulse. */
class Pipe {
  private readonly resonators: { filter: Bandpass; gain: number }[]
  private readonly comb: Float32Array
  private combIndex = 0

  constructor(sampleRate: number, bank: number) {
    this.resonators = PIPE_RESONANCES[bank]!.map((r) => ({ filter: new Bandpass(sampleRate, r.hz, r.q), gain: r.gain }))
    this.comb = new Float32Array(Math.max(1, Math.round(PIPE_COMB_DELAY_SECONDS[bank]! * sampleRate)))
  }

  process(x: number): number {
    const delayed = this.comb[this.combIndex]!
    const input = x + PIPE_COMB_FEEDBACK * delayed
    let y = input * 0.35
    for (const r of this.resonators) y += r.filter.process(input) * r.gain * 4
    this.comb[this.combIndex] = input
    this.combIndex = (this.combIndex + 1) % this.comb.length
    return y
  }
}

/** Number of samples in one seamless loop at `rpm`: a whole number of 720° cycles. */
export function engineLoopLength(rpm: number, sampleRate: number, seconds = LOOP_SECONDS): number {
  const cycleSeconds = (CYCLE_DEGREES / 360) * (60 / rpm)
  const cycles = Math.max(1, Math.round(seconds / cycleSeconds))
  return Math.round(cycles * cycleSeconds * sampleRate)
}

/**
 * Renders one seamless engine loop at a steady `rpm`. The result peaks at `OUTPUT_PEAK` and has
 * a whole number of engine cycles, so playing it looped with `playbackRate = rpm / loopRpm`
 * gives a continuous engine note.
 */
export function generateEngineLoop(rpm: number, sampleRate: number, seed = 1): Float32Array<ArrayBuffer> {
  const random = createRandom(seed)
  const length = engineLoopLength(rpm, sampleRate)
  const speed = clamp01((rpm - IDLE_RPM) / (REDLINE_RPM - IDLE_RPM))
  const firingInterval = (60 / rpm / 4) * sampleRate // samples between firings (8 per 2 revs)
  const puffDecay = lerp(PUFF_DECAY_SECONDS_AT_IDLE, PUFF_DECAY_SECONDS_AT_REDLINE, speed) * sampleRate
  const thumpWidth = lerp(THUMP_WIDTH_SECONDS_AT_IDLE, THUMP_WIDTH_SECONDS_AT_REDLINE, speed) * sampleRate
  const jitter = lerp(JITTER_AT_IDLE, JITTER_AT_REDLINE, speed)
  const tickDecay = TICK_DECAY_SECONDS * sampleRate

  // Lay down the dry pulse trains per bank, wrapping around the loop end so the seam is invisible.
  const dry: [Float32Array, Float32Array] = [new Float32Array(length), new Float32Array(length)]
  const ticks = new Float32Array(length)
  const firingCount = Math.round(length / firingInterval)
  for (let f = 0; f < firingCount; f++) {
    const bank = FIRING_BANKS[f % FIRINGS_PER_CYCLE]!
    const start = f * firingInterval + (random() * 2 - 1) * TIMING_JITTER * firingInterval
    const amplitude = 1 + (random() * 2 - 1) * jitter
    const puffSamples = Math.ceil(puffDecay * 6)
    for (let i = 0; i < puffSamples; i++) {
      const index = (Math.round(start) + i + length) % length
      const env = Math.exp(-i / puffDecay)
      dry[bank][index] += (random() * 2 - 1) * env * PUFF_LEVEL * amplitude
    }
    const thumpSamples = Math.ceil(thumpWidth)
    for (let i = 0; i < thumpSamples; i++) {
      const index = (Math.round(start) + i + length) % length
      dry[bank][index] += Math.sin((Math.PI * i) / thumpWidth) * THUMP_LEVEL * amplitude
    }
    // Two valve events per firing, a quarter interval apart from it, as faint clicks.
    for (let v = 0; v < 2; v++) {
      const tickStart = Math.round(start + (0.25 + 0.5 * v) * firingInterval)
      const tickSamples = Math.ceil(tickDecay * 5)
      for (let i = 0; i < tickSamples; i++) {
        const index = (tickStart + i + length) % length
        ticks[index] += (random() * 2 - 1) * Math.exp(-i / tickDecay) * TICK_LEVEL
      }
    }
  }

  // Run each bank through its pipe twice; keep the second pass so the filters' state wraps.
  const out = new Float32Array(length)
  const bankOffset = Math.round(BANK_OFFSET_SECONDS * sampleRate)
  for (let bank = 0; bank < 2; bank++) {
    const pipe = new Pipe(sampleRate, bank)
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < length; i++) {
        const y = pipe.process(dry[bank as 0 | 1][i]!)
        if (pass === 1) out[(i + bank * bankOffset) % length] += y
      }
    }
  }
  for (let i = 0; i < length; i++) out[i] += ticks[i]!

  softClipAndNormalise(out)
  return out
}

/**
 * Renders one seamless second of the starter motor cranking: a whining motor whose pitch dips on
 * each compression stroke, gear-mesh noise chopped by the same strokes.
 */
export function generateStarterLoop(sampleRate: number, seed = 7): Float32Array<ArrayBuffer> {
  const random = createRandom(seed)
  const length = Math.round(STARTER_LOOP_SECONDS * sampleRate)
  const out = new Float32Array(length)
  const gearFilter = new Bandpass(sampleRate, STARTER_GEAR_NOISE_HZ, STARTER_GEAR_NOISE_Q)
  const pulses = Math.round(STARTER_PULSE_HZ * STARTER_LOOP_SECONDS)
  const pulseHz = pulses / STARTER_LOOP_SECONDS // exact whole pulses per loop, so it wraps
  let phase = 0
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate
      // Compression load: a raised cosine per stroke; the motor slows into it and speeds out.
      const load = 0.5 - 0.5 * Math.cos(2 * Math.PI * pulseHz * t)
      const hz = STARTER_MOTOR_HZ * (1 - STARTER_PITCH_DIP * load)
      phase += (2 * Math.PI * hz) / sampleRate
      // A buzzy motor tone: fundamental plus rolled-off harmonics.
      const motor = Math.sin(phase) + 0.5 * Math.sin(2 * phase) + 0.25 * Math.sin(3 * phase) + 0.12 * Math.sin(4 * phase)
      const gear = gearFilter.process(random() * 2 - 1) * (0.55 + 0.45 * load)
      const sample = motor * STARTER_MOTOR_LEVEL * (0.75 + 0.25 * load) + gear * STARTER_GEAR_NOISE_LEVEL * 6
      if (pass === 1) out[i] = sample
    }
  }
  softClipAndNormalise(out)
  return out
}

/** The solenoid clunk before the crank: a short low knock with a metallic edge. */
export function generateSolenoidClunk(sampleRate: number, seed = 3): Float32Array<ArrayBuffer> {
  const random = createRandom(seed)
  const length = Math.round(0.09 * sampleRate)
  const out = new Float32Array(length)
  const ring = new Bandpass(sampleRate, 2400, 6)
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate
    const knock = Math.sin(2 * Math.PI * 140 * t * Math.exp(-t * 12)) * Math.exp(-t * 45)
    const edge = ring.process(random() * 2 - 1) * Math.exp(-t * 90) * 8
    out[i] = (knock + edge * 0.5) * STARTER_SOLENOID_LEVEL
  }
  softClipAndNormalise(out)
  return out
}

/** Applies a gentle tanh drive, removes any DC offset, and scales the peak to `OUTPUT_PEAK`. */
function softClipAndNormalise(samples: Float32Array): void {
  let peak = 0
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]!))
  if (peak === 0) return
  let mean = 0
  for (let i = 0; i < samples.length; i++) {
    const driven = Math.tanh((samples[i]! / peak) * SOFT_CLIP_DRIVE)
    samples[i] = driven
    mean += driven
  }
  mean /= samples.length
  let clipped = 0
  for (let i = 0; i < samples.length; i++) {
    samples[i] = samples[i]! - mean
    clipped = Math.max(clipped, Math.abs(samples[i]!))
  }
  const scale = OUTPUT_PEAK / clipped
  for (let i = 0; i < samples.length; i++) samples[i] = samples[i]! * scale
}

/** Goertzel power at `hz`, for tests that check where a loop's energy sits. */
export function powerAt(samples: Float32Array, sampleRate: number, hz: number): number {
  const k = (2 * Math.PI * hz) / sampleRate
  const coeff = 2 * Math.cos(k)
  let s0 = 0
  let s1 = 0
  let s2 = 0
  for (let i = 0; i < samples.length; i++) {
    s0 = samples[i]! + coeff * s1 - s2
    s2 = s1
    s1 = s0
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2
}
