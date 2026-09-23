// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { FINE_PEAKS_MIN_DURATION_SEC, PEAK_PYRAMID_LEVELS, type PeaksPyramid } from './types.js'

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
    silenceRegionsSec: detectSilenceRegions(pcm, PEAK_DECODE_SAMPLE_RATE, durationSec),
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

const SILENCE_WINDOW_SAMPLES = 400
const SILENCE_MIN_DURATION_SEC = 0.35
const SILENCE_THRESHOLD = 400

/** Regions below ~−38 dBFS for at least minDurationSec. */
export function detectSilenceRegions(
  pcm: Uint8Array,
  sampleRate: number,
  durationSec: number,
  maxRegions = 24,
): Array<{ start: number; end: number }> {
  const sampleCount = Math.floor(pcm.byteLength / 2)
  if (sampleCount === 0) return []

  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  const regions: Array<{ start: number; end: number }> = []
  let runStart: number | null = null

  for (let i = 0; i < sampleCount; i += SILENCE_WINDOW_SAMPLES) {
    const end = Math.min(sampleCount, i + SILENCE_WINDOW_SAMPLES)
    let peak = 0
    for (let j = i; j < end; j++) {
      peak = Math.max(peak, Math.abs(view.getInt16(j * 2, true)))
    }
    const quiet = peak < SILENCE_THRESHOLD
    const t = i / sampleRate
    if (quiet) {
      if (runStart === null) runStart = t
    } else if (runStart !== null) {
      const start = runStart
      const endSec = t
      if (endSec - start >= SILENCE_MIN_DURATION_SEC) {
        regions.push({ start, end: Math.min(endSec, durationSec) })
      }
      runStart = null
    }
  }

  if (runStart !== null) {
    const endSec = durationSec
    if (endSec - runStart >= SILENCE_MIN_DURATION_SEC) {
      regions.push({ start: runStart, end: endSec })
    }
  }

  return regions.slice(0, maxRegions)
}

export function peaksCacheKey(archiveId: string, sourceKey: string): string {
  return `tahti-peaks:${archiveId}:${sourceKey}`
}

export { PEAK_DECODE_SAMPLE_RATE }

/**
 * Streams interleaved PCM16 (little-endian) into fine peaks: for each
 * bucket of `sampleRate / bucketsPerSec` frames, the lowest and highest
 * sample of every channel as int8 (sample / 256), laid out
 * `[min c0, max c0, min c1, max c1, …]` per bucket. Chunks may split a
 * sample or frame anywhere.
 */
export class FinePeaksEncoder {
  private readonly framesPerBucket: number
  private readonly out: number[] = []
  private readonly min: number[]
  private readonly max: number[]
  private carry = new Uint8Array(0)
  private frameInBucket = 0
  private channel = 0

  constructor(
    private readonly channels: number,
    sampleRate: number,
    bucketsPerSec: number,
  ) {
    this.framesPerBucket = Math.max(1, Math.round(sampleRate / bucketsPerSec))
    this.min = new Array(channels).fill(0)
    this.max = new Array(channels).fill(0)
    this.resetBucket()
  }

  private resetBucket() {
    this.min.fill(127)
    this.max.fill(-128)
    this.frameInBucket = 0
  }

  private flushBucket() {
    for (let c = 0; c < this.channels; c++) {
      this.out.push(this.min[c]!, this.max[c]!)
    }
    this.resetBucket()
  }

  push(chunk: Uint8Array): void {
    const bytes = new Uint8Array(this.carry.length + chunk.length)
    bytes.set(this.carry, 0)
    bytes.set(chunk, this.carry.length)
    const usable = bytes.length - (bytes.length % 2)
    const view = new DataView(bytes.buffer, bytes.byteOffset, usable)
    for (let offset = 0; offset < usable; offset += 2) {
      const value = view.getInt16(offset, true) >> 8
      const c = this.channel
      if (value < this.min[c]!) this.min[c] = value
      if (value > this.max[c]!) this.max[c] = value
      this.channel += 1
      if (this.channel === this.channels) {
        this.channel = 0
        this.frameInBucket += 1
        if (this.frameInBucket === this.framesPerBucket) this.flushBucket()
      }
    }
    this.carry = bytes.slice(usable)
  }

  /** The encoded peaks, including a final partial bucket. */
  finish(): { bytes: Int8Array; bucketCount: number } {
    if (this.frameInBucket > 0) this.flushBucket()
    return {
      bytes: Int8Array.from(this.out),
      bucketCount: this.out.length / (2 * this.channels),
    }
  }
}

/** True when a sound this long should have fine peaks and its stored
 * pyramid doesn't reference any yet. */
export function needsFinePeaks(durationSec: number | null | undefined, peaks: unknown): boolean {
  if ((durationSec ?? 0) < FINE_PEAKS_MIN_DURATION_SEC) return false
  return !(peaks && typeof peaks === 'object' && 'fine' in peaks && peaks.fine)
}
