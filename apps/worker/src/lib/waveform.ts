// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ffmpeg from 'fluent-ffmpeg'

/** Number of amplitude buckets rendered as static waveform bars on public archive pages. */
export const WAVEFORM_BUCKET_COUNT = 600

const PEAK_SAMPLE_RATE = 8000

function decodeToMonoPcm(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioChannels(1)
      .audioFrequency(PEAK_SAMPLE_RATE)
      .format('s16le')
      .on('error', reject)
      .on('end', () => resolve())
      .save(outputPath)
  })
}

/** Downsample decoded mono PCM16 into [0..255] peak-amplitude buckets for a static waveform. */
export function bucketizePcmPeaks(pcm: Buffer, bucketCount: number): number[] {
  const sampleCount = Math.floor(pcm.length / 2)
  if (sampleCount === 0) return []

  const samplesPerBucket = Math.max(1, Math.floor(sampleCount / bucketCount))
  const peaks: number[] = []
  for (let bucket = 0; bucket < bucketCount; bucket++) {
    const start = bucket * samplesPerBucket
    if (start >= sampleCount) break
    const end = Math.min(sampleCount, start + samplesPerBucket)

    let max = 0
    for (let i = start; i < end; i++) {
      const sample = Math.abs(pcm.readInt16LE(i * 2))
      if (sample > max) max = sample
    }
    peaks.push(Math.round((max / 32768) * 255))
  }
  return peaks
}

/**
 * Extract a static waveform overview from an audio file for public "per-set
 * visualisation": decode to mono PCM at a low sample rate, then bucket into
 * [0..255] peak-amplitude values for rendering as bars. Returns null on any
 * failure — the waveform is a visual extra, not required for playback.
 */
export async function extractWaveformPeaks(
  inputPath: string,
  bucketCount = WAVEFORM_BUCKET_COUNT,
): Promise<number[] | null> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'tahti-waveform-'))
  try {
    const pcmPath = join(tmpDir, 'peaks.pcm')
    await decodeToMonoPcm(inputPath, pcmPath)
    const pcm = await readFile(pcmPath)
    const peaks = bucketizePcmPeaks(pcm, bucketCount)
    return peaks.length > 0 ? peaks : null
  } catch {
    return null
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}
