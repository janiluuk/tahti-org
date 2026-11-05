// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { beforeEach, describe, expect, it, vi } from 'vitest'

const notifyListeningPartyStarting = vi.fn()
vi.mock('@tahti/db', () => ({ notifyListeningPartyStarting }))

const { processListeningPartyRemindersJob, REMINDER_GRACE_MS } =
  await import('./listening-party-reminders.js')

const NOW = new Date('2026-11-05T18:00:30.000Z')
const findMany = vi.fn()
const updateMany = vi.fn()
const prisma = { listeningParty: { findMany, updateMany } } as never

function party(id: string) {
  return {
    id,
    startAt: new Date('2026-11-05T18:00:00.000Z'),
    release: { title: 'Album' },
    host: { id: 'host-1', username: 'host', displayName: 'host@example.com' },
  }
}

describe('processListeningPartyRemindersJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notifyListeningPartyStarting.mockResolvedValue(2)
  })

  it('looks only at uncancelled parties that just started and have reminders', async () => {
    findMany.mockResolvedValue([])
    await processListeningPartyRemindersJob(prisma, NOW)
    expect(findMany.mock.calls[0]![0].where).toEqual({
      canceledAt: null,
      remindersSentAt: null,
      startAt: { lte: NOW, gte: new Date(NOW.getTime() - REMINDER_GRACE_MS) },
      reminders: { some: {} },
    })
  })

  it('claims each party before telling anyone, and skips one another worker claimed', async () => {
    findMany.mockResolvedValue([party('p1'), party('p2')])
    updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 })

    const summary = await processListeningPartyRemindersJob(prisma, NOW)

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', remindersSentAt: null },
      data: { remindersSentAt: NOW },
    })
    expect(notifyListeningPartyStarting).toHaveBeenCalledTimes(1)
    expect(notifyListeningPartyStarting.mock.calls[0]![1]).toEqual({
      id: 'host-1',
      username: 'host',
      displayName: 'host',
    })
    expect(summary).toEqual({ started: 1, told: 2 })
  })
})
