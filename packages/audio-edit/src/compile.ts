// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { computeKeepSegments, mergeCuts, postCutDuration, sourceTimeToPostCut } from './segments.js'
import type {
  CompileOptions,
  CompiledGraph,
  EditFade,
  EditList,
  KeepSegment,
  OutputFormat,
} from './types.js'
import { BROWSER_RENDER_MAX_BYTES } from './types.js'

function fadeCurveParam(curve: EditFade['curve']): string {
  return curve === 'exp' ? ':curve=exp' : ''
}

function buildCutStage(
  inputLabel: string,
  segments: KeepSegment[],
  segmentIndex?: number,
): { filter: string; label: string } {
  const targets =
    segmentIndex !== undefined ? segments.filter((_, i) => i === segmentIndex) : segments

  if (targets.length === 0) return { filter: `${inputLabel}anull[cut]`, label: 'cut' }

  if (targets.length === 1) {
    const seg = targets[0]!
    if (seg.start === 0 && segmentIndex === undefined && segments.length === 1) {
      return { filter: `${inputLabel}asetpts=PTS-STARTPTS[cut]`, label: 'cut' }
    }
    const idx = segmentIndex ?? 0
    return {
      filter: `${inputLabel}atrim=${seg.start}:${seg.end},asetpts=PTS-STARTPTS[s${idx}]`,
      label: `s${idx}`,
    }
  }

  const parts: string[] = []
  const labels: string[] = []
  targets.forEach((seg, i) => {
    parts.push(`${inputLabel}atrim=${seg.start}:${seg.end},asetpts=PTS-STARTPTS[s${i}]`)
    labels.push(`[s${i}]`)
  })
  parts.push(`${labels.join('')}concat=n=${targets.length}:v=0:a=1[cut]`)
  return { filter: parts.join(';'), label: 'cut' }
}

function buildFadeStage(inputLabel: string, fades: EditFade[], segments: KeepSegment[]): string {
  if (fades.length === 0) return `${inputLabel}anull[fad]`

  const filters: string[] = []
  let chain = inputLabel

  for (const fade of fades) {
    const postAt = sourceTimeToPostCut(fade.at, segments)
    if (postAt === null) continue
    const st = Math.max(0, postAt)
    const curve = fadeCurveParam(fade.curve)
    filters.push(
      `${chain}afade=t=${fade.type}:st=${formatSec(st)}:d=${formatSec(fade.duration)}${curve}[fad${filters.length}]`,
    )
    chain = `[fad${filters.length}]`
  }

  if (filters.length === 0) return `${inputLabel}anull[fad]`
  const last = filters[filters.length - 1]!
  return filters
    .slice(0, -1)
    .concat(last.replace(/\[fad\d+\]$/, '[fad]'))
    .join(';')
}

function buildGainStage(inputLabel: string, gainDb: number): string {
  if (Math.abs(gainDb) < 0.001) return `${inputLabel}anull[g]`
  return `${inputLabel}volume=${gainDb}dB[g]`
}

function buildEqStage(inputLabel: string, edit: EditList): string {
  if (!edit.eq.enabled || edit.eq.bands.length === 0) return `${inputLabel}anull[eq]`
  const parts = edit.eq.bands.map((b) => `equalizer=f=${b.freq}:t=q:w=${b.q}:g=${b.gainDb}`)
  return `${inputLabel}${parts.join(',')}[eq]`
}

function buildCompStage(inputLabel: string, edit: EditList): string {
  if (!edit.comp.enabled) return `${inputLabel}anull[cmp]`
  const c = edit.comp
  return `${inputLabel}acompressor=threshold=${c.thresholdDb}dB:ratio=${c.ratio}:attack=${c.attackMs}:release=${c.releaseMs}:makeup=${c.makeupDb}[cmp]`
}

function buildLimiterStage(inputLabel: string, edit: EditList): string {
  if (!edit.limiter.enabled) return `${inputLabel}anull[lim]`
  const { ceilingDb, releaseMs } = edit.limiter
  const limit = 10 ** (ceilingDb / 20)
  return `${inputLabel}alimiter=limit=${formatSec(limit)}:release=${releaseMs}[lim]`
}

function buildLoudnormStage(inputLabel: string, edit: EditList): string {
  if (!edit.loudnorm.enabled) return `${inputLabel}anull[out]`
  const { targetLufs, targetTp, measured } = edit.loudnorm
  if (measured) {
    const m = measured
    return (
      `${inputLabel}loudnorm=I=${targetLufs}:TP=${targetTp}:LRA=11:` +
      `measured_I=${m.i}:measured_TP=${m.tp}:measured_LRA=${m.lra}:measured_thresh=${m.thresh}:` +
      `linear=true[out]`
    )
  }
  return `${inputLabel}loudnorm=I=${targetLufs}:TP=${targetTp}:LRA=11[out]`
}

export function compileLoudnormPass1Filter(edit: EditList): string | undefined {
  if (!edit.loudnorm.enabled) return undefined
  const { targetLufs, targetTp } = edit.loudnorm
  return `loudnorm=I=${targetLufs}:TP=${targetTp}:LRA=11:print_format=json`
}

function formatSec(n: number): string {
  return Number(n.toFixed(4)).toString()
}

export function compileFiltergraph(edit: EditList, options: CompileOptions = {}): CompiledGraph {
  const inputLabel = options.inputLabel ?? '[0:a]'
  const segments = computeKeepSegments(edit.sourceDuration, mergeCuts(edit.cuts))
  const postDur =
    options.segmentIndex !== undefined
      ? (() => {
          const seg = segments[options.segmentIndex!]
          return seg ? seg.end - seg.start : 0
        })()
      : postCutDuration(segments)

  const cutStage = buildCutStage(inputLabel, segments, options.segmentIndex)
  let chainLabel = '[cut]'
  if (!cutStage.filter.includes('[cut]')) {
    chainLabel = `[${cutStage.label}]`
  }

  const stages = [
    cutStage.filter,
    buildFadeStage(chainLabel, edit.fades, segments),
    buildGainStage('[fad]', edit.gainDb),
    buildEqStage('[g]', edit),
    buildCompStage('[eq]', edit),
    buildLimiterStage('[cmp]', edit),
    buildLoudnormStage('[lim]', edit),
  ]

  return {
    filtergraph: stages.join(';'),
    outputLabel: '[out]',
    postCutDurationSec: postDur,
    keepSegments: segments,
    loudnormPass1Filter: compileLoudnormPass1Filter(edit),
  }
}

export function compileOutputArgs(format: OutputFormat, sampleRate?: number) {
  switch (format) {
    case 'flac':
      return { codecArgs: ['-c:a', 'flac', '-sample_fmt', 's32'], ar: sampleRate }
    case 'mp3':
      return { codecArgs: ['-c:a', 'libmp3lame', '-b:a', '320k'], ar: sampleRate }
    case 'wav':
      return { codecArgs: ['-c:a', 'pcm_s16le'], ar: sampleRate ?? 44100 }
  }
}

export function estimateOutputBytes(edit: EditList, bitrateKbps = 1411): number {
  const segments = computeKeepSegments(edit.sourceDuration, mergeCuts(edit.cuts))
  return Math.ceil((postCutDuration(segments) * bitrateKbps * 1000) / 8)
}

export function shouldRenderInBrowser(
  edit: EditList,
  sourceFileSizeBytes?: number | null,
  bitrateKbps?: number,
): boolean {
  if (
    sourceFileSizeBytes != null &&
    Number.isFinite(sourceFileSizeBytes) &&
    sourceFileSizeBytes > BROWSER_RENDER_MAX_BYTES
  ) {
    return false
  }
  return estimateOutputBytes(edit, bitrateKbps) <= BROWSER_RENDER_MAX_BYTES
}

export function remapTracklistTimestamps(
  entries: { startSec: number; title: string; artist?: string; artistUsername?: string }[],
  edit: EditList,
) {
  const segments = computeKeepSegments(edit.sourceDuration, mergeCuts(edit.cuts))
  return entries
    .map((entry) => {
      const post = sourceTimeToPostCut(entry.startSec, segments)
      return post === null ? null : { ...entry, startSec: post }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => a.startSec - b.startSec)
}
