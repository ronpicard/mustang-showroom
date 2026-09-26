import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  IDLE_RPM,
  LOOP_RPMS,
  STARTER_PULSE_HZ,
  engineLoopLength,
  generateEngineLoop,
  generateSolenoidClunk,
  generateStarterLoop,
  powerAt,
} from './engineSound.ts'

const SAMPLE_RATE = 48000

function rms(samples: Float32Array): number {
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i]! * samples[i]!
  return Math.sqrt(sum / samples.length)
}

test('an engine loop is a whole number of 720-degree cycles long', () => {
  const length = engineLoopLength(IDLE_RPM, SAMPLE_RATE)
  const cycleSamples = (120 / IDLE_RPM) * SAMPLE_RATE
  assert.equal(Math.abs(length / cycleSamples - Math.round(length / cycleSamples)) < 1e-6, true)
  assert.equal(Math.abs(length / SAMPLE_RATE - 2) < 0.2, true)
})

test('engine loops stay within range, carry energy, and have no DC offset', () => {
  for (const rpm of LOOP_RPMS) {
    const loop = generateEngineLoop(rpm, SAMPLE_RATE)
    let peak = 0
    let mean = 0
    for (let i = 0; i < loop.length; i++) {
      peak = Math.max(peak, Math.abs(loop[i]!))
      mean += loop[i]!
    }
    mean /= loop.length
    assert.equal(peak <= 0.9001 && peak > 0.85, true, `peak at ${rpm} rpm: ${peak}`)
    assert.equal(Math.abs(mean) < 0.01, true, `dc offset at ${rpm} rpm: ${mean}`)
    assert.equal(rms(loop) > 0.05, true, `rms at ${rpm} rpm: ${rms(loop)}`)
  }
})

test('the idle loop has more energy at the firing rate than between harmonics', () => {
  const loop = generateEngineLoop(IDLE_RPM, SAMPLE_RATE)
  const firingHz = (IDLE_RPM / 60) * 4
  const cycleHz = IDLE_RPM / 120
  const onFiring = powerAt(loop, SAMPLE_RATE, firingHz)
  const between = powerAt(loop, SAMPLE_RATE, firingHz + cycleHz * 0.5)
  assert.equal(onFiring > between * 3, true, `firing ${onFiring} vs between ${between}`)
  // The uneven per-bank spacing puts energy on cycle harmonics that are not firing harmonics.
  const onBankHarmonic = powerAt(loop, SAMPLE_RATE, cycleHz * 13)
  const offBankHarmonic = powerAt(loop, SAMPLE_RATE, cycleHz * 13.5)
  assert.equal(onBankHarmonic > offBankHarmonic * 2, true, `bank ${onBankHarmonic} vs off ${offBankHarmonic}`)
})

test('the same seed renders the same loop and a different seed does not', () => {
  const a = generateEngineLoop(IDLE_RPM, SAMPLE_RATE, 5)
  const b = generateEngineLoop(IDLE_RPM, SAMPLE_RATE, 5)
  const c = generateEngineLoop(IDLE_RPM, SAMPLE_RATE, 6)
  assert.deepEqual(a, b)
  assert.notDeepEqual(a, c)
})

test('the starter loop pulses at the compression rate and is exactly one second', () => {
  const loop = generateStarterLoop(SAMPLE_RATE)
  assert.equal(loop.length, SAMPLE_RATE)
  // The amplitude envelope (rectified, smoothed) should be periodic at STARTER_PULSE_HZ.
  const window = Math.round(SAMPLE_RATE / 200)
  const envelope = new Float32Array(loop.length)
  let acc = 0
  for (let i = 0; i < loop.length; i++) {
    acc += Math.abs(loop[i]!)
    if (i >= window) acc -= Math.abs(loop[i - window]!)
    envelope[i] = acc / window
  }
  const onPulse = powerAt(envelope, SAMPLE_RATE, STARTER_PULSE_HZ)
  const offPulse = powerAt(envelope, SAMPLE_RATE, STARTER_PULSE_HZ * 1.6)
  assert.equal(onPulse > offPulse * 4, true, `pulse ${onPulse} vs off ${offPulse}`)
})

test('the solenoid clunk is short and decays to silence', () => {
  const clunk = generateSolenoidClunk(SAMPLE_RATE)
  assert.equal(clunk.length < SAMPLE_RATE * 0.1, true)
  const tail = clunk.subarray(clunk.length - 200)
  assert.equal(rms(tail) < 0.05, true)
})
