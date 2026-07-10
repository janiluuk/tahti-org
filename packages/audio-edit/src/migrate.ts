// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { randomUUID } from 'crypto'
import type { EditList } from './types.js'
import type { EditListV2, PluginInstance } from './types.js'
import {
  DEFAULT_GAIN_PARAMS,
  DEFAULT_EQ_PARAMS,
  DEFAULT_COMP_PARAMS,
  DEFAULT_LIMITER_PARAMS,
  DEFAULT_FILTER_PARAMS,
} from './plugins/registry.js'
import type { GainParams } from './plugins/gain/index.js'
import type { EqParams } from './plugins/eq/index.js'
import type { CompParams } from './plugins/comp/index.js'
import type { LimiterParams } from './plugins/limiter/index.js'
import type { FilterParams } from './plugins/filter/index.js'

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return randomUUID()
}

/** Convert EditList v1 → v2, seeding the standard four-plugin chain. */
export function migrateV1toV2(v1: EditList): EditListV2 {
  const gainParams: GainParams = {
    db: v1.gainDb,
    normalize: {
      enabled: v1.loudnorm.enabled,
      targetLufs: v1.loudnorm.targetLufs,
      targetTp: v1.loudnorm.targetTp,
    },
    measured: v1.loudnorm.measured,
  }

  const eqParams: EqParams = {
    bands: v1.eq.bands.map((b) => ({
      freq: b.freq,
      q: b.q,
      gainDb: b.gainDb,
      type: 'bell' as const,
    })),
  }

  const compParams: CompParams = {
    thresholdDb: v1.comp.thresholdDb,
    ratio: v1.comp.ratio,
    attackMs: v1.comp.attackMs,
    releaseMs: v1.comp.releaseMs,
    makeupDb: v1.comp.makeupDb,
  }

  const limiterParams: LimiterParams = {
    ceilingDb: v1.limiter.ceilingDb,
    releaseMs: v1.limiter.releaseMs,
  }

  // v1.filter is optional at runtime — existing saved edits predate this field.
  const filterParams: FilterParams = {
    mode: v1.filter?.mode ?? DEFAULT_FILTER_PARAMS.mode,
    freq: v1.filter?.freq ?? DEFAULT_FILTER_PARAMS.freq,
    slope: v1.filter?.slope ?? DEFAULT_FILTER_PARAMS.slope,
  }

  const plugins: PluginInstance[] = [
    {
      instanceId: uuid(),
      pluginId: 'filter',
      enabled: v1.filter?.enabled ?? false,
      params: filterParams,
    },
    { instanceId: uuid(), pluginId: 'gain', enabled: true, params: gainParams },
    { instanceId: uuid(), pluginId: 'eq', enabled: v1.eq.enabled, params: eqParams },
    { instanceId: uuid(), pluginId: 'comp', enabled: v1.comp.enabled, params: compParams },
    {
      instanceId: uuid(),
      pluginId: 'limiter',
      enabled: v1.limiter.enabled,
      params: limiterParams,
    },
  ]

  return {
    version: 2,
    sourceDuration: v1.sourceDuration,
    cuts: v1.cuts.map((c) => ({ id: uuid(), start: c.start, end: c.end })),
    fades: v1.fades.map((f) => ({
      id: uuid(),
      type: f.type,
      at: f.at,
      duration: f.duration,
      curve: f.curve,
    })),
    plugins,
  }
}

/** Create a fresh v2 EditList with the default five-plugin chain. */
export function createDefaultEditListV2(sourceDuration: number): EditListV2 {
  return {
    version: 2,
    sourceDuration,
    cuts: [],
    fades: [],
    plugins: [
      {
        instanceId: uuid(),
        pluginId: 'filter',
        enabled: false,
        params: { ...DEFAULT_FILTER_PARAMS },
      },
      { instanceId: uuid(), pluginId: 'gain', enabled: true, params: { ...DEFAULT_GAIN_PARAMS } },
      { instanceId: uuid(), pluginId: 'eq', enabled: false, params: { ...DEFAULT_EQ_PARAMS } },
      {
        instanceId: uuid(),
        pluginId: 'comp',
        enabled: false,
        params: { ...DEFAULT_COMP_PARAMS },
      },
      {
        instanceId: uuid(),
        pluginId: 'limiter',
        enabled: false,
        params: { ...DEFAULT_LIMITER_PARAMS },
      },
    ],
  }
}
