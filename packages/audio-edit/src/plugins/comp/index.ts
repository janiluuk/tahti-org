// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import type { CompileCtx, FilterStep } from '../../types.js'

export const CompParamsSchema = z.object({
  thresholdDb: z.number().finite().min(-60).max(0),
  ratio: z.number().finite().min(1).max(20),
  attackMs: z.number().finite().min(0.1).max(500),
  releaseMs: z.number().finite().min(1).max(5000),
  makeupDb: z.number().finite().min(0).max(24),
})

export type CompParams = z.infer<typeof CompParamsSchema>

export const DEFAULT_COMP_PARAMS: CompParams = {
  thresholdDb: -18,
  ratio: 3,
  attackMs: 25,
  releaseMs: 250,
  makeupDb: 0,
}

export function compileComp(params: CompParams, ctx: CompileCtx): FilterStep | null {
  const { thresholdDb, ratio, attackMs, releaseMs, makeupDb } = params
  const outLabel = ctx.outputLabel.replace(/[[\]]/g, '')
  const graph =
    `${ctx.inputLabel}acompressor=threshold=${thresholdDb}dB:ratio=${ratio}` +
    `:attack=${attackMs}:release=${releaseMs}:makeup=${makeupDb}[${outLabel}]`
  return { graph, inLabel: ctx.inputLabel, outLabel: ctx.outputLabel }
}

export function compChainSummary(params: CompParams, enabled: boolean): string {
  if (!enabled) return 'bypassed'
  const { thresholdDb, ratio, attackMs } = params
  return `${thresholdDb} dB · ${ratio}:1 · ${attackMs} ms`
}
