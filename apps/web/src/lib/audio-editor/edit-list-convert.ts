// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// EditListV2 → EditList v1 conversion for audio pipeline boundaries
// (extracted from app/dashboard/pro-audio-editor.tsx so the migration logic
// is unit-testable without mounting the editor).

import type {
  CompParams,
  EditList,
  EditListV2,
  EqParams,
  FilterParams,
  GainParams,
  LimiterParams,
} from '@tahti/audio-edit'
import {
  DEFAULT_COMP_PARAMS,
  DEFAULT_EQ_PARAMS,
  DEFAULT_FILTER_PARAMS,
  DEFAULT_LIMITER_PARAMS,
} from '@tahti/audio-edit'

/** Convert EditListV2 → EditList v1 for audio pipeline boundaries. */
export function v2ToV1(v2: EditListV2): EditList {
  const gainP = v2.plugins.find((p) => p.pluginId === 'gain')
  const eqP = v2.plugins.find((p) => p.pluginId === 'eq')
  const compP = v2.plugins.find((p) => p.pluginId === 'comp')
  const limP = v2.plugins.find((p) => p.pluginId === 'limiter')
  const filterP = v2.plugins.find((p) => p.pluginId === 'filter')
  const gp = gainP?.params as GainParams | undefined
  const ep = eqP?.params as EqParams | undefined
  const cp = compP?.params as CompParams | undefined
  const lp = limP?.params as LimiterParams | undefined
  const fp = filterP?.params as FilterParams | undefined
  return {
    version: 1 as const,
    sourceDuration: v2.sourceDuration,
    gainDb: gp?.db ?? 0,
    highPassHz: 0,
    lowPassHz: 0,
    loudnorm: {
      enabled: gainP?.enabled !== false && (gp?.normalize.enabled ?? false),
      targetLufs: gp?.normalize.targetLufs ?? -14,
      targetTp: gp?.normalize.targetTp ?? -1.5,
      measured: gp?.measured,
    },
    eq: {
      enabled: eqP?.enabled ?? false,
      bands: (ep?.bands ?? DEFAULT_EQ_PARAMS.bands).map((b) => ({
        freq: b.freq,
        gainDb: b.gainDb,
        q: b.q,
      })),
    },
    comp: {
      enabled: compP?.enabled ?? false,
      thresholdDb: cp?.thresholdDb ?? DEFAULT_COMP_PARAMS.thresholdDb,
      ratio: cp?.ratio ?? DEFAULT_COMP_PARAMS.ratio,
      attackMs: cp?.attackMs ?? DEFAULT_COMP_PARAMS.attackMs,
      releaseMs: cp?.releaseMs ?? DEFAULT_COMP_PARAMS.releaseMs,
      makeupDb: cp?.makeupDb ?? DEFAULT_COMP_PARAMS.makeupDb,
    },
    limiter: {
      enabled: limP?.enabled ?? false,
      ceilingDb: lp?.ceilingDb ?? DEFAULT_LIMITER_PARAMS.ceilingDb,
      releaseMs: lp?.releaseMs ?? DEFAULT_LIMITER_PARAMS.releaseMs,
    },
    filter: {
      enabled: filterP?.enabled ?? false,
      mode: fp?.mode ?? DEFAULT_FILTER_PARAMS.mode,
      freq: fp?.freq ?? DEFAULT_FILTER_PARAMS.freq,
      slope: fp?.slope ?? DEFAULT_FILTER_PARAMS.slope,
    },
    cuts: v2.cuts.map((c) => ({ start: c.start, end: c.end })),
    fades: v2.fades.map((f) => ({ type: f.type, at: f.at, duration: f.duration, curve: f.curve })),
  }
}
