// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { buildIcs, escapeIcsText, foldIcsLine } from './venues.js'

const venue = { name: 'Bar; Grill', slug: 'bar', address: 'Main St 1, B', city: 'Helsinki' }
const show = {
  id: 'b1',
  startAt: new Date('2026-11-01T18:00:00Z'),
  endAt: null,
  description: 'Doors 18:00, set 19:00\nBring ID',
  state: 'SCHEDULED',
}

describe('venue calendar feed', () => {
  it('escapes RFC 5545 text', () => {
    expect(escapeIcsText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne')
  })

  it('stamps every event and escapes its text', () => {
    const ics = buildIcs(venue, [show], new Date('2026-10-17T00:00:00Z'))
    const lines = ics.split('\r\n')
    expect(lines).toContain('DTSTAMP:20261017T000000Z')
    expect(lines).toContain('SUMMARY:Live at Bar\\; Grill')
    expect(lines).toContain('LOCATION:Main St 1\\, B\\, Helsinki')
    expect(lines).toContain('DESCRIPTION:Doors 18:00\\, set 19:00\\nBring ID')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('folds long lines at 75 octets without splitting a character', () => {
    const long = `DESCRIPTION:${'ä'.repeat(60)}`
    const folded = foldIcsLine(long)
    const parts = folded.split('\r\n')
    expect(parts.length).toBeGreaterThan(1)
    for (const part of parts) expect(Buffer.byteLength(part, 'utf8')).toBeLessThanOrEqual(75)
    expect(parts.slice(1).every((p) => p.startsWith(' '))).toBe(true)
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join('')).toBe(long)
  })
})
