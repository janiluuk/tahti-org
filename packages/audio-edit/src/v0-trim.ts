// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createDefaultEditList, DEFAULT_COMP, type EditList } from './types.js'

export interface V0TrimOptions {
  sourceDuration: number
  startSec: number
  endSec: number
  fadeInSec: number
  fadeOutSec: number
  peakNormalize: boolean
  lufsTarget: 'none' | 'stream' | 'club'
  limiterEnabled: boolean
  highPassHz: number
  lowPassHz: number
  eq: { lowGainDb: number; midGainDb: number; highGainDb: number }
  compressorEnabled: boolean
}

/** SEC-09: map legacy v0 trim/bounce params to pro EditList for render worker. */
export function editListFromV0Trim(opts: V0TrimOptions): EditList {
  const {
    sourceDuration,
    startSec,
    endSec,
    fadeInSec,
    fadeOutSec,
    peakNormalize,
    lufsTarget,
    limiterEnabled,
    highPassHz,
    lowPassHz,
    eq,
    compressorEnabled,
  } = opts

  const edit = createDefaultEditList(sourceDuration)
  const cuts = []
  if (startSec > 0.000001) cuts.push({ start: 0, end: startSec })
  if (endSec < sourceDuration - 0.000001) cuts.push({ start: endSec, end: sourceDuration })
  edit.cuts = cuts

  const fades = []
  if (fadeInSec > 0) {
    fades.push({ type: 'in' as const, at: startSec, duration: fadeInSec, curve: 'tri' as const })
  }
  if (fadeOutSec > 0) {
    fades.push({
      type: 'out' as const,
      at: Math.max(startSec, endSec - fadeOutSec),
      duration: fadeOutSec,
      curve: 'tri' as const,
    })
  }
  edit.fades = fades

  if (lufsTarget === 'stream') {
    edit.loudnorm = { enabled: true, targetLufs: -14, targetTp: -1.5 }
  } else if (lufsTarget === 'club') {
    edit.loudnorm = { enabled: true, targetLufs: -9, targetTp: -0.5 }
  } else if (peakNormalize) {
    edit.loudnorm = { enabled: true, targetLufs: -14, targetTp: -1.5 }
  }

  edit.limiter = { ...edit.limiter, enabled: limiterEnabled }
  edit.highPassHz = highPassHz
  edit.lowPassHz = lowPassHz

  const hasEq = eq.lowGainDb !== 0 || eq.midGainDb !== 0 || eq.highGainDb !== 0
  if (hasEq) {
    edit.eq = {
      enabled: true,
      bands: [
        { freq: 200, gainDb: eq.lowGainDb, q: 1 },
        { freq: 1000, gainDb: eq.midGainDb, q: 1 },
        { freq: 4000, gainDb: eq.highGainDb, q: 1 },
      ],
    }
  }

  if (compressorEnabled) {
    edit.comp = { ...DEFAULT_COMP, enabled: true, attackMs: 20, makeupDb: 2 }
  }

  return edit
}
