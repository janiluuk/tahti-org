// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { GainParams } from './index.js'

export function createGainPreviewNode(
  audioCtx: AudioContext,
  params: GainParams,
): { input: AudioNode; output: AudioNode; update(p: GainParams): void; dispose(): void } {
  const gain = audioCtx.createGain()
  gain.gain.value = Math.pow(10, params.db / 20)
  return {
    input: gain,
    output: gain,
    update(p) {
      gain.gain.setTargetAtTime(Math.pow(10, p.db / 20), audioCtx.currentTime, 0.01)
    },
    dispose() {
      gain.disconnect()
    },
  }
}
