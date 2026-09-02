// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { DASHBOARD_NAV, DASHBOARD_SUBMENUS } from './dashboard-nav.js'

describe('artist dashboard library navigation', () => {
  it('has no separate Artist feed entry — it lives on the dashboard main page', () => {
    expect(DASHBOARD_NAV.some((item) => item.href === '/feed')).toBe(false)
  })

  it('orders My Library uploads before Discography, and Broadcasting before Recordings', () => {
    const uploadIndex = DASHBOARD_NAV.findIndex((item) => item.href === '/dashboard/upload')
    const discographyIndex = DASHBOARD_NAV.findIndex((item) => item.href === '/dashboard/archive')
    const broadcastIndex = DASHBOARD_NAV.findIndex((item) => item.href === '/dashboard/broadcast')
    const recordingsIndex = DASHBOARD_NAV.findIndex((item) => item.href === '/dashboard/recordings')

    expect(DASHBOARD_NAV[uploadIndex]?.group).toBe('My Library')
    expect(DASHBOARD_NAV[discographyIndex]?.label).toBe('Discography')
    expect(discographyIndex).toBeGreaterThan(uploadIndex)
    expect(discographyIndex).toBeLessThan(broadcastIndex)

    expect(DASHBOARD_NAV[broadcastIndex]?.group).toBe('Broadcasting')
    expect(DASHBOARD_NAV[recordingsIndex]?.label).toBe('Recordings')
    expect(recordingsIndex).toBeGreaterThan(broadcastIndex)
  })

  it('groups secondary destinations by the job they support', () => {
    expect(DASHBOARD_NAV.find((item) => item.href === '/dashboard/stash')?.group).toBe('Library')
    expect(DASHBOARD_NAV.find((item) => item.href === '/dashboard/embeds')?.group).toBe(
      'Channel setup',
    )
  })

  it('surfaces Distribution under the Library tab, alongside releases', () => {
    const libraryMenu = DASHBOARD_SUBMENUS['/dashboard/archive'] ?? []
    const releasesIndex = libraryMenu.findIndex((item) => item.href === '/dashboard/releases')
    const distributionIndex = libraryMenu.findIndex(
      (item) => item.href === '/dashboard/distribution',
    )
    expect(distributionIndex).toBeGreaterThan(-1)
    expect(distributionIndex).toBeGreaterThan(releasesIndex)
    expect(DASHBOARD_NAV.some((item) => item.href === '/dashboard/distribution')).toBe(false)
  })
})
