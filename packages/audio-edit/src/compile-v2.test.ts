// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { compileFiltergraphV2 } from './compile.js'
import { createDefaultEditListV2, migrateV1toV2 } from './migrate.js'
import { createDefaultEditList } from './types.js'
import type { EditListV2, PluginInstance } from './types.js'

function makeV2(plugins: PluginInstance[] = []): EditListV2 {
  return { version: 2, sourceDuration: 60, cuts: [], fades: [], plugins }
}

describe('compileFiltergraphV2', () => {
  it('compiles empty plugin list without error', () => {
    const result = compileFiltergraphV2(makeV2())
    expect(result.filtergraph).toBeTruthy()
    expect(result.outputLabel).toBe('[out]')
  })

  it('skips disabled plugins', () => {
    const el = createDefaultEditListV2(60)
    // Disable all plugins
    el.plugins = el.plugins.map((p) => ({ ...p, enabled: false }))
    const result = compileFiltergraphV2(el)
    expect(result.filtergraph).not.toContain('volume=')
    expect(result.filtergraph).not.toContain('loudnorm=')
  })

  it('emits gain filter when db != 0', () => {
    const el = createDefaultEditListV2(60)
    const gainIdx = el.plugins.findIndex((p) => p.pluginId === 'gain')
    el.plugins[gainIdx] = {
      ...el.plugins[gainIdx]!,
      params: { db: 3, normalize: { enabled: false, targetLufs: -14, targetTp: -1.5 } },
    }
    const result = compileFiltergraphV2(el)
    expect(result.filtergraph).toContain('volume=3dB')
  })

  it('emits loudnorm filter when normalize enabled', () => {
    const el = createDefaultEditListV2(60)
    const gainIdx = el.plugins.findIndex((p) => p.pluginId === 'gain')
    el.plugins[gainIdx] = {
      ...el.plugins[gainIdx]!,
      params: { db: 0, normalize: { enabled: true, targetLufs: -14, targetTp: -1.5 } },
    }
    const result = compileFiltergraphV2(el)
    expect(result.filtergraph).toContain('loudnorm=')
    expect(result.loudnormPass1Filter).toContain('loudnorm=')
  })

  it('audition: rangeSec clips the filtergraph to the selection', () => {
    const el: EditListV2 = { version: 2, sourceDuration: 60, cuts: [], fades: [], plugins: [] }
    const result = compileFiltergraphV2(el, { rangeSec: [30, 60] })
    // Should trim from 30-60 seconds
    expect(result.filtergraph).toContain('atrim=')
    expect(result.postCutDurationSec).toBeCloseTo(30, 0)
  })

  it('two EQ instances compile independently without collision', () => {
    const eqParams = { bands: [{ freq: 80, q: 1, gainDb: 2, type: 'bell' as const }] }
    const el: EditListV2 = {
      version: 2,
      sourceDuration: 60,
      cuts: [],
      fades: [],
      plugins: [
        { instanceId: 'eq-a', pluginId: 'eq', enabled: true, params: eqParams },
        { instanceId: 'eq-b', pluginId: 'eq', enabled: true, params: eqParams },
      ],
    }
    const result = compileFiltergraphV2(el)
    const eqCount = (result.filtergraph.match(/equalizer=/g) ?? []).length
    expect(eqCount).toBe(2)
  })
})

describe('migrateV1toV2', () => {
  it('produces a valid v2 EditList from defaults', () => {
    const v1 = createDefaultEditList(100)
    const v2 = migrateV1toV2(v1)
    expect(v2.version).toBe(2)
    expect(v2.sourceDuration).toBe(100)
    expect(v2.plugins.length).toBe(5)
    expect(v2.plugins[0]!.pluginId).toBe('filter')
    expect(v2.plugins[1]!.pluginId).toBe('gain')
    expect(v2.plugins[2]!.pluginId).toBe('eq')
    expect(v2.plugins[3]!.pluginId).toBe('comp')
    expect(v2.plugins[4]!.pluginId).toBe('limiter')
  })

  it('preserves gainDb in gain plugin params', () => {
    const v1 = { ...createDefaultEditList(100), gainDb: 6 }
    const v2 = migrateV1toV2(v1)
    const gainParams = v2.plugins.find((p) => p.pluginId === 'gain')!.params as { db: number }
    expect(gainParams.db).toBe(6)
  })

  it('adds IDs to cuts and fades', () => {
    const v1 = {
      ...createDefaultEditList(100),
      cuts: [{ start: 0, end: 5 }],
      fades: [{ type: 'in' as const, at: 0, duration: 2, curve: 'tri' as const }],
    }
    const v2 = migrateV1toV2(v1)
    expect(v2.cuts[0]).toHaveProperty('id')
    expect(v2.fades[0]).toHaveProperty('id')
  })

  it('preserves enabled state of eq, comp, limiter, filter', () => {
    const v1 = createDefaultEditList(100)
    v1.eq = { ...v1.eq, enabled: true }
    v1.comp = { ...v1.comp, enabled: true }
    v1.filter = { ...v1.filter, enabled: true, mode: 'lowpass', freq: 12000, slope: '24db' }
    const v2 = migrateV1toV2(v1)
    expect(v2.plugins.find((p) => p.pluginId === 'eq')?.enabled).toBe(true)
    expect(v2.plugins.find((p) => p.pluginId === 'comp')?.enabled).toBe(true)
    expect(v2.plugins.find((p) => p.pluginId === 'limiter')?.enabled).toBe(false)
    const filterPlugin = v2.plugins.find((p) => p.pluginId === 'filter')
    expect(filterPlugin?.enabled).toBe(true)
    expect(filterPlugin?.params).toEqual({ mode: 'lowpass', freq: 12000, slope: '24db' })
  })

  it('backfills a default filter when v1.filter is missing (pre-existing saved edits)', () => {
    const v1 = createDefaultEditList(100)
    // @ts-expect-error -- simulating an old, already-saved EditList JSON that predates this field
    delete v1.filter
    const v2 = migrateV1toV2(v1)
    const filterPlugin = v2.plugins.find((p) => p.pluginId === 'filter')
    expect(filterPlugin?.enabled).toBe(false)
    expect(filterPlugin?.params).toEqual({ mode: 'highpass', freq: 80, slope: '12db' })
  })
})
