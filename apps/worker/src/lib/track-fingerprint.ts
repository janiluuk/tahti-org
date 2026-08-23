// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { lookupAcoustidFullTrack, type AcoustidFullMatch } from '@tahti/shared'

const execFileAsync = promisify(execFile)

// Alpine's `ffmpeg` package (apps/worker/Dockerfile) isn't built with
// chromaprint support, so ffmpeg's own chromaprint muxer isn't available in
// this image — confirmed via `ffmpeg -muxers` on the deployed worker
// container. Using the standalone `fpcalc` binary (Alpine package
// `chromaprint`) instead, same underlying Chromaprint library.
export async function generateChromaprintFingerprint(
  inputPath: string,
): Promise<{ fingerprint: string; duration: number } | null> {
  const { stdout } = await execFileAsync('fpcalc', ['-json', inputPath])
  const parsed = JSON.parse(stdout) as { fingerprint?: string; duration?: number }
  if (!parsed.fingerprint) return null
  return { fingerprint: parsed.fingerprint, duration: parsed.duration ?? 0 }
}

/**
 * Best-effort: generates a Chromaprint fingerprint and looks it up via
 * AcoustID (used both to surface a title/artist suggestion for original
 * uploads and as a copyright-conflict signal — a fingerprint that already
 * matches an existing recording is very likely not a novel work). Never
 * throws — a fingerprinting failure shouldn't fail the whole transcode job.
 */
export async function fingerprintAndIdentify(
  inputPath: string,
  durationSec: number,
): Promise<{ fingerprint: string | null; match: AcoustidFullMatch | null }> {
  const apiKey = process.env.ACOUSTID_API_KEY?.trim() ?? ''

  try {
    const fp = await generateChromaprintFingerprint(inputPath)
    if (!fp) return { fingerprint: null, match: null }

    if (!apiKey) return { fingerprint: fp.fingerprint, match: null }

    const match = await lookupAcoustidFullTrack(fp.fingerprint, fp.duration || durationSec, {
      apiKey,
    })
    return { fingerprint: fp.fingerprint, match }
  } catch {
    return { fingerprint: null, match: null }
  }
}
