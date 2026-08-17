import { describe, expect, it } from 'vitest'
import { humanizeFutureDate } from './profile-upcoming.js'

describe('humanizeFutureDate', () => {
  const now = new Date('2026-08-17T12:00:00.000Z')

  it('uses natural short-term labels', () => {
    expect(humanizeFutureDate(new Date('2026-08-17T18:00:00.000Z'), now)).toBe('today')
    expect(humanizeFutureDate(new Date('2026-08-18T12:00:00.000Z'), now)).toBe('tomorrow')
    expect(humanizeFutureDate(new Date('2026-08-24T12:00:00.000Z'), now)).toBe('in 7 days')
  })

  it('humanizes distant gigs in weeks or months', () => {
    expect(humanizeFutureDate(new Date('2026-09-07T12:00:00.000Z'), now)).toBe('in 3 weeks')
    expect(humanizeFutureDate(new Date('2026-11-15T12:00:00.000Z'), now)).toBe('in 3 months')
  })
})
