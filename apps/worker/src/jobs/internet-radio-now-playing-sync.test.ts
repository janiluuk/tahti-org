// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'

const { prismaMock, fetchNowPlaying } = vi.hoisted(() => ({
  prismaMock: {
    internetRadioStation: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
  fetchNowPlaying: vi.fn(),
}))

vi.mock('@tahti/db', () => ({ prisma: prismaMock }))
vi.mock('../lib/internet-radio-now-playing.js', () => ({
  fetchNowPlaying,
  parserForUrl: (url: string) => (url.includes('radiohelsinki.fi') ? () => null : null),
}))

import { processInternetRadioNowPlayingSyncJob } from './internet-radio-now-playing-sync.js'

function jobStub(): Job {
  return {} as Job
}

describe('processInternetRadioNowPlayingSyncJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates only stations whose host has a parser', async () => {
    prismaMock.internetRadioStation.findMany.mockResolvedValue([
      { id: 'a', programmingUrl: 'https://www.radiohelsinki.fi/ohjelmakartta/' },
      { id: 'b', programmingUrl: 'https://www.radiorock.fi/' },
    ])
    fetchNowPlaying.mockResolvedValue({ title: 'CADIA', artist: 'Bloc Party — Positive Tension' })

    const result = await processInternetRadioNowPlayingSyncJob(jobStub())

    expect(result).toEqual({ checked: 2, updated: 1 })
    expect(fetchNowPlaying).toHaveBeenCalledTimes(1)
    expect(prismaMock.internetRadioStation.update).toHaveBeenCalledTimes(1)
    expect(prismaMock.internetRadioStation.update).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: expect.objectContaining({
        currentProgramTitle: 'CADIA',
        currentProgramArtist: 'Bloc Party — Positive Tension',
      }),
    })
  })

  it('only queries stations missing a fetch or past the staleness window', async () => {
    prismaMock.internetRadioStation.findMany.mockResolvedValue([])

    await processInternetRadioNowPlayingSyncJob(jobStub())

    expect(prismaMock.internetRadioStation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          programmingUrl: { not: null },
          OR: expect.arrayContaining([{ currentProgramFetchedAt: null }]),
        }),
      }),
    )
  })

  it('clears cached fields when a fetch returns null instead of leaving stale data', async () => {
    prismaMock.internetRadioStation.findMany.mockResolvedValue([
      { id: 'a', programmingUrl: 'https://www.radiohelsinki.fi/ohjelmakartta/' },
    ])
    fetchNowPlaying.mockResolvedValue(null)

    await processInternetRadioNowPlayingSyncJob(jobStub())

    expect(prismaMock.internetRadioStation.update).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: expect.objectContaining({
        currentProgramTitle: null,
        currentProgramArtist: null,
      }),
    })
  })
})
