// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { buildDistributionIntegrationsStatus } from './distribution-integrations.js'

describe('buildDistributionIntegrationsStatus', () => {
  it('returns mixcloud and revelator rows with live or stub mode', () => {
    const status = buildDistributionIntegrationsStatus()
    expect(status.integrations).toHaveLength(2)
    expect(status.integrations.map((i) => i.id).sort()).toEqual(['mixcloud', 'revelator'])
    for (const row of status.integrations) {
      expect(['live', 'stub']).toContain(row.mode)
      expect(row.configured).toBe(row.mode === 'live')
      expect(row.detail).toBeTruthy()
    }
  })
})
