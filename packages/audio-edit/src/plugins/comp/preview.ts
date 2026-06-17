// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { CompParams } from './index.js'

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
