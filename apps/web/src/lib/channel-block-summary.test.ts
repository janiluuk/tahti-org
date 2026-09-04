// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import type { AddonInstallView, ChannelBlockView } from '@tahti/shared'
import { channelBlockSummary, unblockedAddonInstalls } from './channel-block-summary.js'

function block(overrides: Partial<ChannelBlockView>): ChannelBlockView {
  return {
    id: 'block-1',
    type: 'LOGO',
    width: 'FULL',
    position: 0,
    configJson: {},
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
    ...overrides,
  }
}

function install(overrides: Partial<AddonInstallView>): AddonInstallView {
  return {
    id: 'install-1',
    widget: {
      id: 'widget-1',
      slug: 'clock',
      name: 'Clock',
      description: 'A clock',
      authorName: 'Tahti',
      categories: [],
      iconUrl: null,
      currentVersion: '1.0.0',
    },
    position: 0,
    enabled: true,
    configJson: {},
    createdAt: new Date('2026-09-01T00:00:00Z'),
    ...overrides,
  }
}

describe('channelBlockSummary', () => {
  it('shows the asset URL for a LOGO block', () => {
    const b = block({ type: 'LOGO', configJson: { assetUrl: 'https://example.com/logo.png' } })
    expect(channelBlockSummary(b, [])).toBe('https://example.com/logo.png')
  })

  it('falls back to a placeholder for a LOGO block with no asset yet', () => {
    const b = block({ type: 'LOGO', configJson: {} })
    expect(channelBlockSummary(b, [])).toBe('No image set yet')
  })

  it("shows the referenced add-on's name for an ADDON block", () => {
    const i = install({ id: 'install-42' })
    const b = block({ type: 'ADDON', configJson: { addonInstallId: 'install-42' } })
    expect(channelBlockSummary(b, [i])).toBe('Clock')
  })

  it('falls back to a placeholder when the referenced install is missing', () => {
    const b = block({ type: 'ADDON', configJson: { addonInstallId: 'gone' } })
    expect(channelBlockSummary(b, [])).toBe('Add-on not found')
  })
})

describe('unblockedAddonInstalls', () => {
  it('returns all installs when none are blocked yet', () => {
    const installs = [install({ id: 'a' }), install({ id: 'b' })]
    expect(unblockedAddonInstalls(installs, [])).toEqual(installs)
  })

  it('excludes installs already referenced by an ADDON block', () => {
    const a = install({ id: 'a' })
    const b = install({ id: 'b' })
    const blocks = [block({ type: 'ADDON', configJson: { addonInstallId: 'a' } })]
    expect(unblockedAddonInstalls([a, b], blocks)).toEqual([b])
  })

  it('is unaffected by LOGO blocks', () => {
    const a = install({ id: 'a' })
    const blocks = [block({ type: 'LOGO', configJson: { assetUrl: 'x' } })]
    expect(unblockedAddonInstalls([a], blocks)).toEqual([a])
  })
})
