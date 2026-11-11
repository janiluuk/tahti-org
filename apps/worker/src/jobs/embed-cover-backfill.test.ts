// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  prisma: { sound: { findMany: vi.fn(), update: vi.fn() } },
  assignPresetCovers: vi.fn(),
}))

vi.mock('@tahti/db', () => db)

import { processEmbedCoverBackfillJob } from './embed-cover-backfill.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('processEmbedCoverBackfillJob', () => {
  it('stores provider covers and gives the rest a preset', async () => {
    db.prisma.sound.findMany.mockResolvedValue([
      {
        id: 'spotify',
        embedProvider: 'SPOTIFY',
        embedUri: 'spotify:track:4cOdK2wGLETKBW3PvgPWqT',
        embedSourceUrl: null,
      },
      {
        id: 'mikseri',
        embedProvider: 'MIKSERI',
        embedUri: 'https://www.mikseri.net/embed/?type=1&parameter=1',
        embedSourceUrl: null,
      },
    ])
    db.assignPresetCovers.mockResolvedValue(1)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ thumbnail_url: 'https://i.scdn.co/image/abc' })),
    )

    await expect(processEmbedCoverBackfillJob()).resolves.toEqual({
      matched: 2,
      fromProvider: 1,
      fromPresets: 1,
    })
    expect(db.prisma.sound.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { bannerUrl: null, embedProvider: { not: null } } }),
    )
    expect(db.prisma.sound.update).toHaveBeenCalledWith({
      where: { id: 'spotify' },
      data: { bannerUrl: 'https://i.scdn.co/image/abc' },
    })
    expect(db.assignPresetCovers).toHaveBeenCalledWith(db.prisma, 'sound', ['mikseri'])
  })

  it('does nothing when every embed has a cover', async () => {
    db.prisma.sound.findMany.mockResolvedValue([])
    await expect(processEmbedCoverBackfillJob()).resolves.toEqual({
      matched: 0,
      fromProvider: 0,
      fromPresets: 0,
    })
    expect(db.assignPresetCovers).not.toHaveBeenCalled()
  })
})
