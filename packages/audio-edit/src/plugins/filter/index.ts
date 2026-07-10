// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { FILTER_MODES, FILTER_SLOPES } from '../../types.js'
import type { CompileCtx, FilterMode, FilterSlope, FilterStep } from '../../types.js'

export const FilterParamsSchema = z.object({
  mode: z.enum(FILTER_MODES),
  freq: z.number().finite().min(20).max(20000),
  slope: z.enum(FILTER_SLOPES),
})

export type FilterParams = z.infer<typeof FilterParamsSchema>

export const DEFAULT_FILTER_PARAMS: FilterParams = {
  mode: 'highpass',
  freq: 80,
  slope: '12db',
}

/** ffmpeg's highpass/lowpass poles=2 is 12dB/octave; cascade stages for steeper slopes. */
const HP_LP_STAGE_COUNT: Record<FilterSlope, number> = {
  '12db': 1,
  '24db': 2,
  brickwall: 4, // ~48dB/octave — no true infinite-slope brickwall in ffmpeg's biquad filters
}

/**
 * ffmpeg's `bass`/`treble` (lowshelf/highshelf) support poles=1|2 only, no arbitrary cascade
 * count for a "12/24dB" style slope — approximate steeper curves by cascading stages.
 */
const SHELF_STAGES: Record<FilterSlope, { poles: 1 | 2; count: number }> = {
  '12db': { poles: 1, count: 1 },
  '24db': { poles: 2, count: 1 },
  brickwall: { poles: 2, count: 2 },
}

/** Shelf modes act as filters (cut everything past the corner), not tone-shaping shelves. */
const SHELF_CUT_DB = -60

export function compileFilter(params: FilterParams, ctx: CompileCtx): FilterStep | null {
  const { mode, freq, slope } = params
  const outLabel = ctx.outputLabel.replace(/[[\]]/g, '')

  let graph: string
  if (mode === 'highpass' || mode === 'lowpass') {
    const stageCount = HP_LP_STAGE_COUNT[slope]
    const stages = Array.from({ length: stageCount }, () => `${mode}=f=${freq}:poles=2`).join(',')
    graph = `${ctx.inputLabel}${stages}[${outLabel}]`
  } else {
    // ffmpeg's `equalizer` is always a peaking filter — there is no shelf `t=` type on it.
    // Real shelf filters are the dedicated `bass` (lowshelf) / `treble` (highshelf) filters.
    const filterName = mode === 'highshelf' ? 'treble' : 'bass'
    const { poles, count } = SHELF_STAGES[slope]
    const stages = Array.from(
      { length: count },
      () => `${filterName}=f=${freq}:g=${SHELF_CUT_DB}:poles=${poles}`,
    ).join(',')
    graph = `${ctx.inputLabel}${stages}[${outLabel}]`
  }

  return { graph, inLabel: ctx.inputLabel, outLabel: ctx.outputLabel }
}

const MODE_LABELS: Record<FilterMode, string> = {
  highpass: 'Highpass',
  highshelf: 'High shelf',
  lowpass: 'Lowpass',
  lowshelf: 'Low shelf',
}

const SLOPE_LABELS: Record<FilterSlope, string> = {
  '12db': '12 dB/oct',
  '24db': '24 dB/oct',
  brickwall: 'Brickwall',
}

export function filterChainSummary(params: FilterParams, enabled: boolean): string {
  if (!enabled) return 'bypassed'
  const freqLabel = params.freq >= 1000 ? `${(params.freq / 1000).toFixed(1)}k` : `${params.freq}`
  return `${MODE_LABELS[params.mode]} · ${freqLabel} Hz · ${SLOPE_LABELS[params.slope]}`
}
