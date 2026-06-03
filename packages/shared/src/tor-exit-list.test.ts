// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { parseTorBulkExitList } from './tor-exit-list.js'

describe('parseTorBulkExitList', () => {
  it('parses IPv4 lines into /32 CIDRs', () => {
    const body = `# comment\n1.2.3.4\n\n5.6.7.8\n`
    expect(parseTorBulkExitList(body)).toEqual(['1.2.3.4/32', '5.6.7.8/32'])
  })

  it('skips invalid lines', () => {
    expect(parseTorBulkExitList('not-an-ip\n999.1.1.1\n')).toEqual([])
  })
})
