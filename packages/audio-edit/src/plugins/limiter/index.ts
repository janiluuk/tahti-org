// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import type { CompileCtx, FilterStep } from '../../types.js'

export const LimiterParamsSchema = z.object({
  ceilingDb: z.number().finite().min(-3).max(0),
  releaseMs: z.number().finite().min(1).max(1000),
})

export type LimiterParams = z.infer<typeof LimiterParamsSchema>

export const DEFAULT_LIMITER_PARAMS: LimiterParams = {
  ceilingDb: -1.0,
  releaseMs: 50,
}

export function compileLimiter(params: LimiterParams, ctx: CompileCtx): FilterStep | null {
  const { ceilingDb, releaseMs } = params
  const limit = Math.pow(10, ceilingDb / 20)
  const outLabel = ctx.outputLabel.replace(/[[\]]/g, '')
  // level=0 disables ffmpeg's default auto-leveling, which otherwise boosts audio that
  // never approached the ceiling up toward it — a limiter should only touch true peaks.
  const graph = `${ctx.inputLabel}alimiter=limit=${limit.toFixed(6)}:release=${releaseMs}:level=0[${outLabel}]`
  return { graph, inLabel: ctx.inputLabel, outLabel: ctx.outputLabel }
}

export function limiterChainSummary(params: LimiterParams, enabled: boolean): string {
  if (!enabled) return 'bypassed'
  return `${params.ceilingDb} dBTP ceiling`
}
