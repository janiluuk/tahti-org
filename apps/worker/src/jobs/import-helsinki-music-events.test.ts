// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchText } = vi.hoisted(() => ({ fetchText: vi.fn() }))
vi.mock('../lib/music-feeds.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/music-feeds.js')>()),
  fetchText,
}))

import {
  HELSINKI_EVENTS_SOURCE,
  processImportHelsinkiMusicEventsJob,
  toImportedEvent,
  type LinkedEvent,
} from './import-helsinki-music-events.js'

const NOW = new Date('2026-11-24T12:00:00Z')

function event(id: string, patch: Partial<LinkedEvent> = {}): LinkedEvent {
  return {
    id,
    name: { fi: `Konsertti ${id}` },
    short_description: { fi: '<p>Ilta täynnä musiikkia.</p>' },
    start_time: '2026-12-05T17:00:00Z',
    end_time: '2026-12-05T19:00:00Z',
    event_status: 'EventScheduled',
    super_event_type: null,
    info_url: { fi: `https://venue.example/${id}` },
    images: [{ url: `https://img.example/${id}.jpg` }],
    location: { name: { fi: 'Musiikkitalo' }, address_locality: { fi: 'Helsinki' } },
    ...patch,
  }
}

describe('toImportedEvent', () => {
  it('maps a scheduled concert with attribution', () => {
    const fields = toImportedEvent(event('e1'))!
    expect(fields).toMatchObject({
      title: 'Konsertti e1',
      place: 'Musiikkitalo',
      location: 'Helsinki',
      eventUrl: 'https://venue.example/e1',
      imageUrl: 'https://img.example/e1.jpg',
    })
    expect(fields.description).toContain('Ilta täynnä musiikkia.')
    expect(fields.description).toContain('CC BY 4.0')
  })

  it.each([
    ['a recurring series parent', { super_event_type: 'recurring' }],
    ['a cancelled event', { event_status: 'EventCancelled' }],
    ['an event without a place', { location: null }],
    ['an event without a start', { start_time: null }],
  ])('skips %s', (_label, patch) => {
    expect(toImportedEvent(event('x', patch as Partial<LinkedEvent>))).toBeNull()
  })
})

describe('processImportHelsinkiMusicEventsJob', () => {
  const findUnique = vi.fn()
  const findMany = vi.fn()
  const create = vi.fn()
  const prisma = {
    user: { findUnique },
    artistEvent: { findMany, create },
  } as never

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  it('imports upcoming events as drafts hosted by the Tahti account', async () => {
    findUnique.mockResolvedValue({ id: 'tahti-user' })
    findMany.mockResolvedValue([{ externalId: 'known' }])
    fetchText.mockResolvedValue(
      JSON.stringify({
        data: [
          event('new'),
          event('known'),
          event('started', { start_time: '2026-11-01T10:00:00Z' }),
        ],
        meta: { next: null },
      }),
    )

    const result = await processImportHelsinkiMusicEventsJob(prisma, NOW)

    expect(result).toEqual({ imported: 1, skipped: 1, hostMissing: false })
    expect(fetchText.mock.calls[0]![0]).toContain('keyword=yso%3Ap1808')
    expect(fetchText.mock.calls[0]![0]).toContain('super_event_type=none')
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'tahti-user',
        status: 'DRAFT',
        timezone: 'Europe/Helsinki',
        externalSource: HELSINKI_EVENTS_SOURCE,
        externalId: 'new',
      }),
    })
  })

  it('does nothing without the Tahti host account', async () => {
    findUnique.mockResolvedValue(null)
    const result = await processImportHelsinkiMusicEventsJob(prisma, NOW)
    expect(result).toEqual({ imported: 0, skipped: 0, hostMissing: true })
    expect(fetchText).not.toHaveBeenCalled()
  })
})
