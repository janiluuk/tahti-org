// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Small ffmpeg-shelling helpers for e2e tests that need real (synthesized,
 * not fixture-file) audio: pushing a distinctive sine tone into an Icecast
 * mount as a live source, and later detecting whether that tone (or plain
 * non-silence) is present in a captured/downloaded audio file.
 */

import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile } from 'node:fs/promises'

const execFileAsync = promisify(execFile)

/**
 * Starts an ffmpeg process that synthesizes a sine tone and pushes it to an
 * Icecast mount as a live MP3 source, for durationSec (or until killed).
 * Returns the child process — caller is responsible for eventually killing it
 * (or letting it exit naturally once durationSec elapses).
 */
export function pushToneToIcecast({ host, port, mount, sourcePass, toneHz, durationSec }) {
  const url = `icecast://source:${sourcePass}@${host}:${port}${mount}`
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-re',
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=${toneHz}:duration=${durationSec}`,
    '-c:a',
    'libmp3lame',
    '-b:a',
    '128k',
    '-content_type',
    'audio/mpeg',
    '-f',
    'mp3',
    url,
  ]
  const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })
  child.getStderr = () => stderr
  return child
}

/** Downloads a URL to a local file path (follows redirects via fetch). */
export async function downloadFile(url, destPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed: ${url} -> ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(destPath, buf)
  return destPath
}

/** Runs ffmpeg's volumedetect filter (optionally band-passed around a target
 * frequency) and returns the mean volume in dBFS — very negative (< -50) means
 * effectively silent / the target band is empty. */
export async function meanVolumeDb(filePath, { bandpassHz } = {}) {
  const filters = []
  if (bandpassHz) filters.push(`bandpass=f=${bandpassHz}:width_type=h:w=40`)
  filters.push('volumedetect')
  const args = [
    '-hide_banner',
    '-nostats',
    '-i',
    filePath,
    '-af',
    filters.join(','),
    '-f',
    'null',
    '-',
  ]
  const { stderr } = await execFileAsync('ffmpeg', args).catch((e) => ({ stderr: e.stderr ?? '' }))
  const match = /mean_volume:\s*(-?\d+(\.\d+)?)\s*dB/.exec(stderr)
  return match ? parseFloat(match[1]) : null
}

/** Duration in seconds via ffprobe, or null if it can't be determined. */
export async function probeDurationSec(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ])
    const val = parseFloat(stdout.trim())
    return Number.isFinite(val) ? val : null
  } catch {
    return null
  }
}
