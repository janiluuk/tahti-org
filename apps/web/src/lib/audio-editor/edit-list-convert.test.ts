// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { createDefaultEditListV2, type EditListV2 } from '@tahti/audio-edit'
import { v2ToV1 } from './edit-list-convert'

describe('v2ToV1', () => {
  it('converts defaults with all plugins disabled', () => {
    const v1 = v2ToV1(createDefaultEditListV2(120))
    expect(v1.version).toBe(1)
    expect(v1.sourceDuration).toBe(120)
    expect(v1.gainDb).toBe(0)
    expect(v1.eq.enabled).toBe(false)
    expect(v1.comp.enabled).toBe(false)
    expect(v1.limiter.enabled).toBe(false)
    expect(v1.filter.enabled).toBe(false)
    expect(v1.loudnorm.enabled).toBe(false)
    expect(v1.cuts).toEqual([])
    expect(v1.fades).toEqual([])
  })

  it('carries gain, normalize, and EQ band settings across', () => {
    const v2 = createDefaultEditListV2(60)
    const gain = v2.plugins.find((p) => p.pluginId === 'gain')!
    gain.enabled = true
    gain.params = {
      db: 3,
      normalize: { enabled: true, targetLufs: -16, targetTp: -2 },
    }
    const eq = v2.plugins.find((p) => p.pluginId === 'eq')!
    eq.enabled = true
    eq.params = { bands: [{ freq: 100, gainDb: 2, q: 1, type: 'bell' as const }] }

    const v1 = v2ToV1(v2)
    expect(v1.gainDb).toBe(3)
    expect(v1.loudnorm).toMatchObject({ enabled: true, targetLufs: -16, targetTp: -2 })
    expect(v1.eq.enabled).toBe(true)
    expect(v1.eq.bands).toEqual([{ freq: 100, gainDb: 2, q: 1 }])
  })

  it('maps cuts and fades to v1 shapes', () => {
    const v2: EditListV2 = {
      ...createDefaultEditListV2(90),
      cuts: [{ id: 'c1', start: 1, end: 2 }],
      fades: [{ id: 'f1', type: 'in', at: 0, duration: 2, curve: 'tri' }],
    }
    const v1 = v2ToV1(v2)
    expect(v1.cuts).toEqual([{ start: 1, end: 2 }])
    expect(v1.fades).toEqual([{ type: 'in', at: 0, duration: 2, curve: 'tri' }])
  })
})
