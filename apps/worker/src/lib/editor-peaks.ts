// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import ffmpeg from 'fluent-ffmpeg'
import {
  buildPeaksPyramid,
  FINE_PEAKS_BUCKETS_PER_SEC,
  FinePeaksEncoder,
  type FinePeaksRef,
  type PeaksPyramid,
} from '@tahti/audio-edit'
import { uploadStream } from './minio.js'

/** PERF-04: build editor PeaksPyramid during sound ingest. */
export async function extractEditorPeaksPyramid(
  inputPath: string,
  durationSec: number,
): Promise<PeaksPyramid | null> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'tahti-editor-peaks-'))
  try {
    const outPcm = join(tmpDir, 'peaks.pcm')
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .audioChannels(1)
        .audioFrequency(8000)
        .format('s16le')
        .on('error', reject)
        .on('end', () => resolve())
        .save(outPcm)
    })
    const pcm = new Uint8Array(await readFile(outPcm))
    return buildPeaksPyramid(pcm, durationSec)
  } catch {
    return null
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}

const FINE_PEAKS_DECODE_RATE = 22050

export function finePeaksKey(channelSlug: string, soundId: string): string {
  return `editor-peaks/${channelSlug}/${soundId}.bin`
}

/**
 * Fine peaks for long sources (see `FinePeaksEncoder`): decoded at 22.05 kHz
 * with up to two channels and streamed straight into the encoder, so an
 * hour-long set never sits on disk or in memory as PCM. Uploaded as a small
 * binary object (~1.4 MB per stereo hour). Null on any failure — like the
 * pyramid, it is a visual extra.
 */
export async function extractAndStoreFinePeaks(
  inputPath: string,
  sourceChannels: number | null,
  key: string,
): Promise<FinePeaksRef | null> {
  const channels = Math.min(2, Math.max(1, sourceChannels ?? 2))
  const encoder = new FinePeaksEncoder(channels, FINE_PEAKS_DECODE_RATE, FINE_PEAKS_BUCKETS_PER_SEC)
  try {
    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .audioChannels(channels)
        .audioFrequency(FINE_PEAKS_DECODE_RATE)
        .format('s16le')
        .on('error', reject)
        .on('end', () => resolve())
      command.pipe().on('data', (chunk: Buffer) => encoder.push(chunk))
    })
    const { bytes, bucketCount } = encoder.finish()
    if (bucketCount === 0) return null
    const body = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    await uploadStream(key, Readable.from([body]), 'application/octet-stream', body.length)
    return { key, bucketsPerSec: FINE_PEAKS_BUCKETS_PER_SEC, channels, bucketCount }
  } catch {
    return null
  }
}
