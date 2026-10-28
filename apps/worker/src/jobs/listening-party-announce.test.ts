// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nowPlayingText, processListeningPartyAnnounceJob } from './listening-party-announce.js'

const START = new Date('2026-11-01T18:00:00.000Z')
const at = (sec: number) => new Date(START.getTime() + sec * 1000)

const mockFindMany = vi.fn()
const mockUpdateMany = vi.fn()
const publish = vi.fn()

function fakePrisma() {
  return { listeningParty: { findMany: mockFindMany, updateMany: mockUpdateMany } } as never
}

function party(overrides: { announcedPosition?: number | null; chatEnabled?: boolean } = {}) {
  return {
    id: 'party-1',
    startAt: START,
    announcedPosition: overrides.announcedPosition ?? null,
    channel: { slug: 'host', user: { chatEnabled: overrides.chatEnabled ?? true } },
    release: {
      tracks: [
        { id: 't1', position: 1, title: 'Opener', durationSec: 100 },
        { id: 't2', position: 3, title: 'Middle', durationSec: 100 },
        { id: 't3', position: 7, title: 'Closer', durationSec: 100 },
      ],
    },
  }
}

describe('processListeningPartyAnnounceJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateMany.mockResolvedValue({ count: 1 })
    publish.mockResolvedValue(undefined)
  })

  it('announces the current track by its place in the tracklist', async () => {
    mockFindMany.mockResolvedValue([party({ announcedPosition: 1 })])

    const summary = await processListeningPartyAnnounceJob(fakePrisma(), publish, at(150))

    expect(publish).toHaveBeenCalledWith({ slug: 'host', text: 'Now playing 2/3 · Middle' })
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'party-1',
        OR: [{ announcedPosition: null }, { announcedPosition: { lt: 3 } }],
      },
      data: { announcedPosition: 3 },
    })
    expect(summary).toEqual({ live: 1, announced: 1, failed: 0 })
  })

  it('announces the first track at startAt', async () => {
    mockFindMany.mockResolvedValue([party()])
    await processListeningPartyAnnounceJob(fakePrisma(), publish, at(0))
    expect(publish).toHaveBeenCalledWith({ slug: 'host', text: 'Now playing 1/3 · Opener' })
  })

  it('does not repeat a track already announced', async () => {
    mockFindMany.mockResolvedValue([party({ announcedPosition: 3 })])
    const summary = await processListeningPartyAnnounceJob(fakePrisma(), publish, at(150))
    expect(mockUpdateMany).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
    expect(summary.announced).toBe(0)
  })

  it('does not post when another worker claimed the track first', async () => {
    mockFindMany.mockResolvedValue([party()])
    mockUpdateMany.mockResolvedValue({ count: 0 })
    await processListeningPartyAnnounceJob(fakePrisma(), publish, at(150))
    expect(publish).not.toHaveBeenCalled()
  })

  it('skips parties that have ended or whose host turned chat off', async () => {
    mockFindMany.mockResolvedValue([party({ chatEnabled: false })])
    let summary = await processListeningPartyAnnounceJob(fakePrisma(), publish, at(150))
    expect(summary).toEqual({ live: 1, announced: 0, failed: 0 })

    mockFindMany.mockResolvedValue([party()])
    summary = await processListeningPartyAnnounceJob(fakePrisma(), publish, at(300))
    expect(summary).toEqual({ live: 0, announced: 0, failed: 0 })
    expect(publish).not.toHaveBeenCalled()
  })

  it('counts a failed publish and keeps going', async () => {
    mockFindMany.mockResolvedValue([party(), { ...party(), id: 'party-2' }])
    publish.mockRejectedValueOnce(new Error('down'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const summary = await processListeningPartyAnnounceJob(fakePrisma(), publish, at(10))
    expect(summary).toEqual({ live: 2, announced: 1, failed: 1 })
    warn.mockRestore()
  })
})

describe('nowPlayingText', () => {
  it('formats the chat line', () => {
    expect(nowPlayingText(3, 10, 'Title')).toBe('Now playing 3/10 · Title')
  })
})
