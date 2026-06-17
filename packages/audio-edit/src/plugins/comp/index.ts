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
  const outLabel = ctx.outputLabel.replace(/[\[\]]/g, '')
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

export function createCompPreviewNode(
  audioCtx: AudioContext,
  params: CompParams,
): { input: AudioNode; output: AudioNode; update(p: CompParams): void; dispose(): void } {
  const input = audioCtx.createGain()
  const output = audioCtx.createGain()
  const comp = audioCtx.createDynamicsCompressor()
  comp.threshold.value = params.thresholdDb
  comp.ratio.value = params.ratio
  comp.attack.value = params.attackMs / 1000
  comp.release.value = params.releaseMs / 1000
  const makeup = audioCtx.createGain()
  makeup.gain.value = Math.pow(10, params.makeupDb / 20)
  input.connect(comp)
  comp.connect(makeup)
  makeup.connect(output)

  return {
    input,
    output,
    update(p) {
      comp.threshold.setTargetAtTime(p.thresholdDb, audioCtx.currentTime, 0.01)
      comp.ratio.setTargetAtTime(p.ratio, audioCtx.currentTime, 0.01)
      comp.attack.setTargetAtTime(p.attackMs / 1000, audioCtx.currentTime, 0.01)
      comp.release.setTargetAtTime(p.releaseMs / 1000, audioCtx.currentTime, 0.01)
      makeup.gain.setTargetAtTime(Math.pow(10, p.makeupDb / 20), audioCtx.currentTime, 0.01)
    },
    dispose() {
      input.disconnect()
      comp.disconnect()
      makeup.disconnect()
      output.disconnect()
    },
  }
}
