// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import { buildPeaksPyramid, type PeaksPyramid } from '@tahti/audio-edit'

/** PERF-04: build editor PeaksPyramid during archive ingest. */
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
