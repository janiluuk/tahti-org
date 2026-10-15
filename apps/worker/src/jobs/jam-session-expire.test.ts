// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi } from 'vitest'
import { expireAbandonedJams, JAM_IDLE_AFTER_MS } from './jam-session-expire.js'

const NOW = new Date('2026-10-15T12:00:00Z')

function fakePrisma(staleIds: string[], updated = staleIds.length) {
  return {
    jamSession: {
      findMany: vi.fn().mockResolvedValue(staleIds.map((id) => ({ id }))),
      updateMany: vi.fn().mockResolvedValue({ count: updated }),
    },
  } as never as Parameters<typeof expireAbandonedJams>[0] & {
    jamSession: { findMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> }
  }
}

describe('expireAbandonedJams', () => {
  it('ends open jams with no host push for six hours and tells their guests', async () => {
    const prisma = fakePrisma(['jam-a', 'jam-b'])
    const publish = vi.fn().mockResolvedValue(undefined)

    expect(await expireAbandonedJams(prisma, NOW, publish)).toEqual({ ended: 2 })

    const idleBefore = new Date(NOW.getTime() - JAM_IDLE_AFTER_MS)
    expect(prisma.jamSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endedAt: null, positionUpdatedAt: { lt: idleBefore } },
      }),
    )
    expect(prisma.jamSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['jam-a', 'jam-b'] },
        endedAt: null,
        positionUpdatedAt: { lt: idleBefore },
      },
      data: { endedAt: NOW, isPlaying: false },
    })
    expect(publish).toHaveBeenCalledWith('jam-a', { type: 'ended' })
    expect(publish).toHaveBeenCalledWith('jam-b', { type: 'ended' })
  })

  it('does nothing when every jam is still in use', async () => {
    const prisma = fakePrisma([])
    const publish = vi.fn()
    expect(await expireAbandonedJams(prisma, NOW, publish)).toEqual({ ended: 0 })
    expect(prisma.jamSession.updateMany).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
  })
})
