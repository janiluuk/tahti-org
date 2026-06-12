// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { PEAK_PYRAMID_LEVELS, type PeaksPyramid } from './types.js'

const PEAK_DECODE_SAMPLE_RATE = 8000

/** Bucket mono PCM16 into [0..255] peak values. */
export function bucketizePcmPeaks(pcm: Uint8Array, bucketCount: number): number[] {
  const sampleCount = Math.floor(pcm.byteLength / 2)
  if (sampleCount === 0) return []

  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  const samplesPerBucket = Math.max(1, Math.floor(sampleCount / bucketCount))
  const peaks: number[] = []

  for (let bucket = 0; bucket < bucketCount; bucket++) {
    const start = bucket * samplesPerBucket
    if (start >= sampleCount) break
    const end = Math.min(sampleCount, start + samplesPerBucket)
    let max = 0
    for (let i = start; i < end; i++) {
      const sample = Math.abs(view.getInt16(i * 2, true))
      if (sample > max) max = sample
    }
    peaks.push(Math.round((max / 32768) * 255))
  }
  return peaks
}

/** Build multi-resolution peak pyramid for waveform zoom. */
export function buildPeaksPyramid(pcm: Uint8Array, durationSec: number): PeaksPyramid {
  const levels = PEAK_PYRAMID_LEVELS.map((bucketCount) => bucketizePcmPeaks(pcm, bucketCount))
  return { sampleRate: PEAK_DECODE_SAMPLE_RATE, durationSec, levels }
}

export function peaksCacheKey(archiveId: string, sourceKey: string): string {
  return `tahti-peaks:${archiveId}:${sourceKey}`
}

export { PEAK_DECODE_SAMPLE_RATE }
