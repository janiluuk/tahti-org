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
  return {
    sampleRate: PEAK_DECODE_SAMPLE_RATE,
    durationSec,
    levels,
    zeroCrossingsSec: extractZeroCrossings(pcm, PEAK_DECODE_SAMPLE_RATE),
  }
}

const MAX_ZERO_CROSSINGS = 12_000

/** PCM sign-change timestamps for snap-to-zero (subsampled on long files). */
export function extractZeroCrossings(
  pcm: Uint8Array,
  sampleRate: number,
  maxPoints = MAX_ZERO_CROSSINGS,
): number[] {
  const sampleCount = Math.floor(pcm.byteLength / 2)
  if (sampleCount < 2) return []

  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  const raw: number[] = []
  for (let i = 1; i < sampleCount; i++) {
    const prev = view.getInt16((i - 1) * 2, true)
    const curr = view.getInt16(i * 2, true)
    if ((prev <= 0 && curr > 0) || (prev >= 0 && curr < 0)) {
      raw.push(i / sampleRate)
    }
  }
  if (raw.length <= maxPoints) return raw

  const step = raw.length / maxPoints
  return Array.from({ length: maxPoints }, (_, j) => raw[Math.floor(j * step)]!)
}

/** Nearest zero crossing to `sec` (requires sorted crossings). */
export function snapToNearestZeroCrossing(crossings: number[], sec: number): number {
  if (crossings.length === 0) return sec
  let lo = 0
  let hi = crossings.length - 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (crossings[mid]! < sec) lo = mid + 1
    else hi = mid
  }
  const next = crossings[lo]!
  const prev = lo > 0 ? crossings[lo - 1]! : next
  return Math.abs(next - sec) <= Math.abs(prev - sec) ? next : prev
}

export function peaksCacheKey(archiveId: string, sourceKey: string): string {
  return `tahti-peaks:${archiveId}:${sourceKey}`
}

export { PEAK_DECODE_SAMPLE_RATE }
