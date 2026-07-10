// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { computeKeepSegments, mergeCuts, postCutDuration, sourceTimeToPostCut } from './segments.js'
import type {
  CompileOptions,
  CompiledGraph,
  EditFade,
  EditList,
  EditListV2,
  KeepSegment,
  OutputFormat,
} from './types.js'
import { BROWSER_RENDER_MAX_BYTES } from './types.js'
import { PLUGINS } from './plugins/registry.js'
import type { AnyPlugin } from './plugins/registry.js'
import { compileFilter } from './plugins/filter/index.js'

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

function buildHpLpStage(inputLabel: string, edit: EditList): string {
  const hp = edit.highPassHz ?? 0
  const lp = edit.lowPassHz ?? 0
  if (hp <= 0 && lp <= 0) return `${inputLabel}anull[fhp]`

  const filters: string[] = []
  let chain = inputLabel
  if (hp > 0) {
    filters.push(`${chain}highpass=f=${hp}[hp]`)
    chain = '[hp]'
  }
  if (lp > 0) {
    filters.push(`${chain}lowpass=f=${lp}[lp]`)
    chain = '[lp]'
  }
  if (filters.length === 0) return `${inputLabel}anull[fhp]`
  const last = filters[filters.length - 1]!
  return filters
    .slice(0, -1)
    .concat(last.replace(/\[(hp|lp)\]$/, '[fhp]'))
    .join(';')
}

function buildFilterStage(inputLabel: string, edit: EditList): string {
  if (!edit.filter.enabled) return `${inputLabel}anull[filt]`
  const step = compileFilter(edit.filter, { inputLabel, outputLabel: '[filt]' })
  return step ? step.graph : `${inputLabel}anull[filt]`
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
    buildHpLpStage(chainLabel, edit),
    buildFilterStage('[fhp]', edit),
    buildFadeStage('[filt]', edit.fades, segments),
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

/** Worker renders one keep-segment at a time when cuts fragment the timeline heavily. */
export const SEGMENT_RENDER_MIN_CUTS = 8
export const SEGMENT_RENDER_MIN_SEGMENTS = 6
/** PERF-07: ffmpeg filter_complex planning slows beyond ~24k chars. */
export const FILTERGRAPH_MAX_CHARS = 24_000

export function isFiltergraphTooLarge(edit: EditList): boolean {
  return compileFiltergraph(edit).filtergraph.length > FILTERGRAPH_MAX_CHARS
}

export function shouldUseSegmentRender(edit: EditList): boolean {
  const segments = computeKeepSegments(edit.sourceDuration, mergeCuts(edit.cuts))
  if (
    edit.cuts.length >= SEGMENT_RENDER_MIN_CUTS ||
    segments.length >= SEGMENT_RENDER_MIN_SEGMENTS
  ) {
    return true
  }
  return isFiltergraphTooLarge(edit)
}

export function compileLoudnormOutputFiltergraph(edit: EditList): string {
  const { targetLufs, targetTp, measured } = edit.loudnorm
  if (measured) {
    const m = measured
    return (
      `[0:a]loudnorm=I=${targetLufs}:TP=${targetTp}:LRA=11:` +
      `measured_I=${m.i}:measured_TP=${m.tp}:measured_LRA=${m.lra}:measured_thresh=${m.thresh}:` +
      `linear=true[out]`
    )
  }
  return `[0:a]loudnorm=I=${targetLufs}:TP=${targetTp}:LRA=11[out]`
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

// ── v2 compile ────────────────────────────────────────────────────────────────

export interface CompileV2Options {
  inputLabel?: string
  /** Clip to this time range before applying plugins (audition selection). */
  rangeSec?: [number, number]
}

export interface CompiledGraphV2 {
  filtergraph: string
  outputLabel: string
  postCutDurationSec: number
  /** Set when the gain plugin has normalize.enabled and no measured values yet. */
  loudnormPass1Filter?: string
}

/**
 * Compile an EditList v2 into an FFmpeg filtergraph.
 *
 * Plugin order: cuts/fades happen first, then plugins iterate in array order.
 * The gain plugin's loudnorm clause always moves to the tail of the chain
 * regardless of plugin array position — compile.ts enforces this by collecting
 * loudnorm steps and appending them after all other plugin steps.
 */
export function compileFiltergraphV2(
  edit: EditListV2,
  options: CompileV2Options = {},
): CompiledGraphV2 {
  const inputLabel = options.inputLabel ?? '[0:a]'

  // If rangeSec is set, clip the cut list to that range (audition path).
  const effectiveCuts = options.rangeSec
    ? clampCutsToRange(edit.cuts, options.rangeSec)
    : edit.cuts.map((c) => ({ start: c.start, end: c.end }))

  const segments = computeKeepSegments(edit.sourceDuration, mergeCuts(effectiveCuts))
  const postDur = postCutDuration(segments)

  // ── Cut stage ───────────────────────────────────────────────────────────────
  const cutStage = buildCutStage(inputLabel, segments)
  let chainLabel = '[cut]'
  if (!cutStage.filter.includes('[cut]')) chainLabel = `[${cutStage.label}]`

  // ── Fade stage (uses v2 fades — same logic, fades now have ids) ─────────────
  const fadesCompat: EditFade[] = edit.fades.map((f) => ({
    type: f.type,
    at: f.at,
    duration: f.duration,
    curve: f.curve,
  }))
  const fadeStage = buildFadeStage(chainLabel, fadesCompat, segments)

  const pluginStages: string[] = []
  const loudnormStages: string[] = []
  let loudnormPass1Filter: string | undefined
  let plugLabel = '[fad]'
  let plugIdx = 0

  for (const instance of edit.plugins) {
    if (!instance.enabled) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plugin = PLUGINS[instance.pluginId as keyof typeof PLUGINS] as AnyPlugin | undefined
    if (!plugin) continue

    const parsed = plugin.paramsSchema.safeParse(instance.params)
    if (!parsed.success) continue

    const outLabel = `[p${plugIdx}]`
    const ctx = { inputLabel: plugLabel, outputLabel: outLabel }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step = plugin.compile(parsed.data as any, ctx)

    if (plugin.loudnormPass1Filter) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lnFilter = plugin.loudnormPass1Filter(parsed.data as any)
      if (lnFilter) loudnormPass1Filter = lnFilter
    }

    if (step) {
      // Loudnorm steps go to the tail; other steps go in order.
      if (step.graph.includes('loudnorm=')) {
        loudnormStages.push(step.graph)
      } else {
        pluginStages.push(step.graph)
      }
      plugLabel = outLabel
    }
    plugIdx++
  }

  // Loudnorm steps are appended after all other plugin steps.
  const allStages = [cutStage.filter, fadeStage, ...pluginStages, ...loudnormStages]

  // Patch final output label to '[out]'
  const lastStageIdx = allStages.length - 1
  allStages[lastStageIdx] = allStages[lastStageIdx]!.replace(/\[p\d+\]$/, '[out]')
  // If no plugin emitted anything, fade stage output is [fad] — rename to [out]
  if (pluginStages.length === 0 && loudnormStages.length === 0) {
    allStages[lastStageIdx] = allStages[lastStageIdx]!.replace(/\[fad\]$/, '[out]')
  }

  return {
    filtergraph: allStages.join(';'),
    outputLabel: '[out]',
    postCutDurationSec: postDur,
    loudnormPass1Filter,
  }
}

/** Clip a v2 cut list so only cuts outside [rangeStart, rangeEnd] remain,
 *  effectively auditioning just that region. */
function clampCutsToRange(
  cuts: EditListV2['cuts'],
  [rangeStart, rangeEnd]: [number, number],
): { start: number; end: number }[] {
  const result: { start: number; end: number }[] = []
  // Keep everything before rangeStart as a cut (except nothing before 0)
  if (rangeStart > 0) result.push({ start: 0, end: rangeStart })
  // Keep everything after rangeEnd as a cut
  if (Number.isFinite(rangeEnd)) result.push({ start: rangeEnd, end: Infinity })
  // Also include original cuts that fall inside the range
  for (const c of cuts) {
    if (c.end > rangeStart && c.start < rangeEnd) result.push({ start: c.start, end: c.end })
  }
  return result
}
