// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { buildPeaksPyramid, extractZeroCrossings, snapToNearestZeroCrossing } from './peaks.js'

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
