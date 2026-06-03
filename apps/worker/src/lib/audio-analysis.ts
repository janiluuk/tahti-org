// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import ffmpeg from 'fluent-ffmpeg'
import { frequencyToPitchClass } from '@tahti/shared'

const execFileAsync = promisify(execFile)

/** Analyze at most this many seconds (long DJ mixes — use the opening section). */
export const ANALYSIS_MAX_DURATION_SEC = 120

export type AcousticAnalysis = {
  bpm: number | null
  key: string | null
}

export async function prepareAnalysisWav(
  inputPath: string,
  outputPath: string,
  durationSec: number,
): Promise<void> {
  const clipSec = Math.min(Math.max(durationSec, 1), ANALYSIS_MAX_DURATION_SEC)
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioChannels(1)
      .audioFrequency(44100)
      .duration(clipSec)
      .format('wav')
      .on('error', reject)
      .on('end', () => resolve())
      .save(outputPath)
  })
}

function medianBeatBpm(beatTimesSec: number[]): number | null {
  if (beatTimesSec.length < 4) return null
  const intervals: number[] = []
  for (let i = 1; i < beatTimesSec.length; i++) {
    const dt = beatTimesSec[i]! - beatTimesSec[i - 1]!
    // ~30–240 BPM
    if (dt >= 0.25 && dt <= 2) intervals.push(dt)
  }
  if (intervals.length < 3) return null
  intervals.sort((a, b) => a - b)
  const median = intervals[Math.floor(intervals.length / 2)]!
  const bpm = Math.round(60 / median)
  return bpm >= 40 && bpm <= 300 ? bpm : null
}

export async function detectBpmFromWav(wavPath: string): Promise<number | null> {
  const { stdout } = await execFileAsync('aubiotrack', ['-i', wavPath], {
    maxBuffer: 16 * 1024 * 1024,
  })
  const beatTimes = stdout
    .trim()
    .split('\n')
    .map((line) => parseFloat(line.trim()))
    .filter((t) => Number.isFinite(t) && t >= 0)
  return medianBeatBpm(beatTimes)
}

export async function detectKeyFromWav(wavPath: string): Promise<string | null> {
  const { stdout } = await execFileAsync('aubiopitch', ['-i', wavPath], {
    maxBuffer: 16 * 1024 * 1024,
  })
  const freqs: number[] = []
  for (const line of stdout.trim().split('\n')) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 2) continue
    const hz = parseFloat(parts[1]!)
    if (Number.isFinite(hz) && hz >= 50 && hz <= 2000) freqs.push(hz)
  }
  if (freqs.length < 10) return null
  freqs.sort((a, b) => a - b)
  const medianHz = freqs[Math.floor(freqs.length / 2)]!
  return frequencyToPitchClass(medianHz)
}

export async function analyzeAudioAcoustics(
  wavPath: string,
  opts?: { needBpm?: boolean; needKey?: boolean },
): Promise<AcousticAnalysis> {
  const needBpm = opts?.needBpm ?? true
  const needKey = opts?.needKey ?? true
  const [bpm, key] = await Promise.all([
    needBpm ? detectBpmFromWav(wavPath).catch(() => null) : Promise.resolve(null),
    needKey ? detectKeyFromWav(wavPath).catch(() => null) : Promise.resolve(null),
  ])
  return { bpm, key }
}
