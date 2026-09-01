import { describe, expect, it } from 'vitest'
import { formatRecentlyPlayedAgo } from './recently-played-channels'

describe('formatRecentlyPlayedAgo', () => {
  it.each([
    [0, 'just now'],
    [1, '1m ago'],
    [59, '59m ago'],
    [60, '1h ago'],
    [23 * 60, '23h ago'],
    [24 * 60, '1d ago'],
    [7 * 24 * 60, '1w ago'],
  ])('formats %i minutes as %s', (minutes, expected) => {
    const iso = new Date(Date.now() - minutes * 60_000).toISOString()
    expect(formatRecentlyPlayedAgo(iso)).toBe(expected)
  })

  it('does not show negative time for a future timestamp', () => {
    expect(formatRecentlyPlayedAgo(new Date(Date.now() + 60_000).toISOString())).toBe('just now')
  })
})
