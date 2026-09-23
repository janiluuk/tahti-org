// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  buildPeaksPyramid,
  FinePeaksEncoder,
  needsFinePeaks,
  detectSilenceRegions,
  extractZeroCrossings,
  snapToNearestZeroCrossing,
} from './peaks.js'

function makeSinePcm(cycles: number, sampleRate = 8000): Uint8Array {
  const sampleCount = sampleRate * cycles
  const buf = Buffer.alloc(sampleCount * 2)
  for (let i = 0; i < sampleCount; i++) {
    const sample = Math.round(Math.sin((2 * Math.PI * i) / sampleRate) * 16000)
    buf.writeInt16LE(sample, i * 2)
  }
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}

describe('zero crossing snap', () => {
  it('extracts crossings from PCM', () => {
    const pcm = makeSinePcm(1)
    const crossings = extractZeroCrossings(pcm, 8000)
    expect(crossings.length).toBeGreaterThan(1)
  })

  it('snaps to the nearest crossing', () => {
    const crossings = [0.1, 0.25, 0.4, 0.55]
    expect(snapToNearestZeroCrossing(crossings, 0.23)).toBe(0.25)
    expect(snapToNearestZeroCrossing(crossings, 0.52)).toBe(0.55)
  })

  it('includes crossings in buildPeaksPyramid', () => {
    const pcm = makeSinePcm(1)
    const pyramid = buildPeaksPyramid(pcm, 1)
    expect(pyramid.zeroCrossingsSec?.length).toBeGreaterThan(0)
  })
})

describe('detectSilenceRegions', () => {
  it('finds silence in quiet PCM', () => {
    const sampleRate = 8000
    const sampleCount = sampleRate * 2
    const buf = Buffer.alloc(sampleCount * 2)
    for (let i = 0; i < sampleCount; i++) {
      const amp = i >= sampleRate && i < sampleRate * 1.5 ? 0 : 8000
      buf.writeInt16LE(amp, i * 2)
    }
    const regions = detectSilenceRegions(new Uint8Array(buf), sampleRate, 2)
    expect(regions.length).toBeGreaterThan(0)
    expect(regions[0]!.start).toBeLessThan(1.5)
  })
})

describe('FinePeaksEncoder', () => {
  function pcm16(samples: number[]): Uint8Array {
    const bytes = new Uint8Array(samples.length * 2)
    const view = new DataView(bytes.buffer)
    samples.forEach((sample, i) => view.setInt16(i * 2, sample, true))
    return bytes
  }

  it('keeps min and max per channel per bucket, as int8', () => {
    const encoder = new FinePeaksEncoder(2, 4, 1)
    encoder.push(pcm16([1000, -32768, -2560, 256, 32767, 0, 0, 0]))
    const { bytes, bucketCount } = encoder.finish()
    expect(bucketCount).toBe(1)
    expect(Array.from(bytes)).toEqual([-10, 127, -128, 1])
  })

  it('gives the same result however the stream is chunked, and flushes a partial bucket', () => {
    const samples = Array.from({ length: 50 }, (_, i) => ((i * 7919) % 65536) - 32768)
    const whole = new FinePeaksEncoder(1, 10, 1)
    whole.push(pcm16(samples))
    const split = new FinePeaksEncoder(1, 10, 1)
    const bytes = pcm16(samples)
    for (let i = 0; i < bytes.length; i += 3) split.push(bytes.subarray(i, i + 3))
    const a = whole.finish()
    const b = split.finish()
    expect(Array.from(b.bytes)).toEqual(Array.from(a.bytes))
    expect(a.bucketCount).toBe(5)
  })
})

describe('needsFinePeaks', () => {
  it('only asks for fine peaks on long sources that lack them', () => {
    expect(needsFinePeaks(600, null)).toBe(false)
    expect(needsFinePeaks(3600, null)).toBe(true)
    expect(needsFinePeaks(3600, { levels: [] })).toBe(true)
    expect(needsFinePeaks(3600, { levels: [], fine: { key: 'k' } })).toBe(false)
  })
})
