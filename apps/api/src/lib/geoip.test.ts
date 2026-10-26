// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { cityFromIp, countryDisplayName, countryFromIp } from './geoip.js'

describe('countryFromIp', () => {
  it('returns null for private and loopback addresses', () => {
    expect(countryFromIp('127.0.0.1')).toBeNull()
    expect(countryFromIp('10.0.0.1')).toBeNull()
    expect(countryFromIp('192.168.1.1')).toBeNull()
    expect(countryFromIp('::1')).toBeNull()
  })

  it('normalizes IPv4-mapped IPv6', () => {
    expect(countryFromIp('::ffff:8.8.8.8')).toBe('US')
  })

  it('returns null for empty input', () => {
    expect(countryFromIp('')).toBeNull()
  })
})

describe('cityFromIp', () => {
  it('returns the city when the database has one', () => {
    expect(cityFromIp('81.175.255.179')).toBe('Helsinki')
  })

  it('returns null without a city, for private addresses and empty input', () => {
    expect(cityFromIp('8.8.8.8')).toBeNull()
    expect(cityFromIp('192.168.1.1')).toBeNull()
    expect(cityFromIp('')).toBeNull()
  })
})

describe('countryDisplayName', () => {
  it('returns English region names for ISO codes', () => {
    expect(countryDisplayName('FI')).toBe('Finland')
    expect(countryDisplayName('US')).toBe('United States')
  })
})
