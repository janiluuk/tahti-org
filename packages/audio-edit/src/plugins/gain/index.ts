// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import type { CompileCtx, FilterStep, MeasuredLoudness } from '../../types.js'
import { LoudnormMeasuredSchema } from '../../types.js'

export const GainParamsSchema = z.object({
  db: z.number().finite().min(-24).max(24),
  normalize: z.object({
    enabled: z.boolean(),
    targetLufs: z.number().finite().min(-30).max(-5),
    targetTp: z.number().finite().min(-6).max(0),
  }),
  measured: LoudnormMeasuredSchema.optional(),
})

export type GainParams = z.infer<typeof GainParamsSchema>

export const DEFAULT_GAIN_PARAMS: GainParams = {
  db: 0,
  normalize: { enabled: false, targetLufs: -14, targetTp: -1.5 },
}

export function compileGain(params: GainParams, ctx: CompileCtx): FilterStep | null {
  const { db, normalize, measured } = params
  const filters: string[] = []
  let label = ctx.inputLabel

  // Volume adjustment (always emitted unless exactly 0 dB)
  if (Math.abs(db) >= 0.001) {
    const next = `${label}volume=${db}dB[gv]`
    filters.push(next)
    label = '[gv]'
  }

  // Loudnorm — always last in chain (enforced by compile.ts rule)
  if (normalize.enabled) {
    const { targetLufs, targetTp } = normalize
    if (measured) {
      const m = measured
      filters.push(
        `${label}loudnorm=I=${targetLufs}:TP=${targetTp}:LRA=11:` +
          `measured_I=${m.i}:measured_TP=${m.tp}:measured_LRA=${m.lra}:measured_thresh=${m.thresh}:` +
          `linear=true[${ctx.outputLabel.replace(/[[\]]/g, '')}]`,
      )
    } else {
      filters.push(
        `${label}loudnorm=I=${targetLufs}:TP=${targetTp}:LRA=11[${ctx.outputLabel.replace(/[[\]]/g, '')}]`,
      )
    }
    return { graph: filters.join(';'), inLabel: ctx.inputLabel, outLabel: ctx.outputLabel }
  }

  if (filters.length === 0) return null

  const lastRaw = filters[filters.length - 1]!
  const finalOut = ctx.outputLabel.replace(/[[\]]/g, '')
  filters[filters.length - 1] = lastRaw.replace(/\[gv\]$/, `[${finalOut}]`)
  return { graph: filters.join(';'), inLabel: ctx.inputLabel, outLabel: ctx.outputLabel }
}

export function gainLoudnormPass1Filter(params: GainParams): string | undefined {
  if (!params.normalize.enabled) return undefined
  const { targetLufs, targetTp } = params.normalize
  return `loudnorm=I=${targetLufs}:TP=${targetTp}:LRA=11:print_format=json`
}

export function gainChainSummary(params: GainParams, enabled: boolean): string {
  if (!enabled) return 'bypassed'
  const { db, normalize } = params
  if (normalize.enabled) {
    const sign = db >= 0 ? '+' : ''
    return `${sign}${db.toFixed(1)} dB → ${normalize.targetLufs} LUFS`
  }
  if (Math.abs(db) < 0.001) return '0.0 dB'
  const sign = db >= 0 ? '+' : ''
  return `${sign}${db.toFixed(1)} dB`
}

export { MeasuredLoudness }
