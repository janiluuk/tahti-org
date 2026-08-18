// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { DASHBOARD_NAV } from './dashboard-nav.js'

describe('artist dashboard library navigation', () => {
  it('puts Artist feed first in My Library and recorded shows in Broadcasting', () => {
    const feedIndex = DASHBOARD_NAV.findIndex((item) => item.href === '/feed')
    const uploadIndex = DASHBOARD_NAV.findIndex((item) => item.href === '/dashboard/upload')
    const discographyIndex = DASHBOARD_NAV.findIndex((item) => item.href === '/dashboard/archive')
    const broadcastIndex = DASHBOARD_NAV.findIndex((item) => item.href === '/dashboard/broadcast')
    const recordingsIndex = DASHBOARD_NAV.findIndex((item) => item.href === '/dashboard/recordings')

    expect(DASHBOARD_NAV[feedIndex]?.group).toBe('My Library')
    expect(DASHBOARD_NAV[feedIndex]?.label).toBe('Artist feed')
    expect(feedIndex).toBeLessThan(uploadIndex)
    expect(DASHBOARD_NAV[discographyIndex]?.label).toBe('Discography')
    expect(discographyIndex).toBeGreaterThan(uploadIndex)
    expect(discographyIndex).toBeLessThan(broadcastIndex)

    expect(DASHBOARD_NAV[broadcastIndex]?.group).toBe('Broadcasting')
    expect(DASHBOARD_NAV[recordingsIndex]?.label).toBe('Recordings')
    expect(recordingsIndex).toBeGreaterThan(broadcastIndex)
  })
})
