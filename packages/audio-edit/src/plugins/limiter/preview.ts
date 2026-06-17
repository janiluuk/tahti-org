// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { LimiterParams } from './index.js'

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
