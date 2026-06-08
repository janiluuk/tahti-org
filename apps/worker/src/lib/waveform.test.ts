// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { bucketizePcmPeaks } from './waveform.js'

function pcmFromSamples(samples: number[]): Buffer {
  const buf = Buffer.alloc(samples.length * 2)
  samples.forEach((s, i) => buf.writeInt16LE(s, i * 2))
  return buf
}

describe('bucketizePcmPeaks', () => {
  it('returns an empty array for empty input', () => {
    expect(bucketizePcmPeaks(Buffer.alloc(0), 10)).toEqual([])
  })

  it('maps full-scale amplitude to 255 and silence to 0', () => {
    const loud = pcmFromSamples(new Array(100).fill(32767))
    const silent = pcmFromSamples(new Array(100).fill(0))
    expect(bucketizePcmPeaks(loud, 4)).toEqual([255, 255, 255, 255])
    expect(bucketizePcmPeaks(silent, 4)).toEqual([0, 0, 0, 0])
  })

  it('takes the peak absolute amplitude within each bucket, including negative samples', () => {
    // bucket 0: quiet samples; bucket 1: one loud negative spike
    const samples = [10, -10, 5, -5, 100, -32000, 50, -50]
    const peaks = bucketizePcmPeaks(pcmFromSamples(samples), 2)
    expect(peaks).toHaveLength(2)
    expect(peaks[0]).toBeLessThan(peaks[1]!)
    expect(peaks[1]).toBeGreaterThan(200)
  })

  it('stops at the number of available sample groups when bucketCount exceeds them', () => {
    const peaks = bucketizePcmPeaks(pcmFromSamples([1, 2, 3]), 10)
    expect(peaks).toHaveLength(3)
  })
})
