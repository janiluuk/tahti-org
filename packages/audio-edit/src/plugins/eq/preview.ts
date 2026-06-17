// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { EqBand, EqParams } from './index.js'

function applyBandToFilter(f: BiquadFilterNode, band: EqBand) {
  f.frequency.value = band.freq
  f.Q.value = band.q
  f.gain.value = band.gainDb
  switch (band.type) {
    case 'bell':
      f.type = 'peaking'
      break
    case 'highshelf':
      f.type = 'highshelf'
      break
    case 'lowshelf':
      f.type = 'lowshelf'
      break
    case 'highpass':
      f.type = 'highpass'
      break
    case 'lowpass':
      f.type = 'lowpass'
      break
  }
}

export function createEqPreviewNode(
  audioCtx: AudioContext,
  params: EqParams,
): { input: AudioNode; output: AudioNode; update(p: EqParams): void; dispose(): void } {
  const input = audioCtx.createGain()
  const output = audioCtx.createGain()
  const filters: BiquadFilterNode[] = params.bands.map((band) => {
    const f = audioCtx.createBiquadFilter()
    applyBandToFilter(f, band)
    return f
  })

  let prev: AudioNode = input
  for (const f of filters) {
    prev.connect(f)
    prev = f
  }
  prev.connect(output)

  return {
    input,
    output,
    update(p) {
      p.bands.forEach((band, i) => {
        if (filters[i]) applyBandToFilter(filters[i]!, band)
      })
    },
    dispose() {
      input.disconnect()
      filters.forEach((f) => f.disconnect())
      output.disconnect()
    },
  }
}
