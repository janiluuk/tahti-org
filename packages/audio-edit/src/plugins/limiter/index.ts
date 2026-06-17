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
  const graph = `${ctx.inputLabel}alimiter=limit=${limit.toFixed(6)}:release=${releaseMs}[${outLabel}]`
  return { graph, inLabel: ctx.inputLabel, outLabel: ctx.outputLabel }
}

export function limiterChainSummary(params: LimiterParams, enabled: boolean): string {
  if (!enabled) return 'bypassed'
  return `${params.ceilingDb} dBTP ceiling`
}

export function createLimiterPreviewNode(
  audioCtx: AudioContext,
  params: LimiterParams,
): { input: AudioNode; output: AudioNode; update(p: LimiterParams): void; dispose(): void } {
  // Web Audio has no alimiter equivalent; use a compressor with high ratio as approximation
  const input = audioCtx.createGain()
  const comp = audioCtx.createDynamicsCompressor()
  comp.threshold.value = params.ceilingDb
  comp.ratio.value = 20
  comp.attack.value = 0.001
  comp.release.value = params.releaseMs / 1000
  comp.knee.value = 0
  input.connect(comp)

  return {
    input,
    output: comp,
    update(p) {
      comp.threshold.setTargetAtTime(p.ceilingDb, audioCtx.currentTime, 0.005)
      comp.release.setTargetAtTime(p.releaseMs / 1000, audioCtx.currentTime, 0.005)
    },
    dispose() {
      input.disconnect()
      comp.disconnect()
    },
  }
}
