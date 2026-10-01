// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const { sendWorkerMail } = vi.hoisted(() => ({
  sendWorkerMail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('./mailer.js', () => ({ sendWorkerMail, APP_URL: 'https://app.test' }))

import { prisma } from '@tahti/db'
import { processWeeklyRecaps, weeklyRecapText } from './weekly-recap.js'

const PREFIX = 'weekly-recap-'

async function artist(tag: string, data: Record<string, unknown> = {}) {
  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}${tag}@example.com`,
      username: `${PREFIX}${tag}`,
      displayName: `Artist ${tag}`,
      passwordHash: 'x',
      emailVerifiedAt: new Date(),
      ...data,
    },
  })
  const channel = await prisma.channel.create({
    data: {
      userId: user.id,
      slug: `${PREFIX}${tag}`,
      liveSourceMount: `/live/${PREFIX}${tag}`,
      liveSourcePass: 'x',
      liveSourcePassHash: 'x',
      rtmpStreamKey: `${PREFIX}${tag}-key`,
      rtmpStreamKeyHash: 'x',
    },
  })
  return { user, channel }
}

describe('weekly recap email', () => {
  const now = new Date('2026-10-04T16:00:00.000Z')

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    const busy = await artist('busy')
    await artist('quiet')
    const optedOut = await artist('opted-out', { notifyWeeklyRecapEmail: false })
    const fan = await prisma.user.create({
      data: {
        email: `${PREFIX}fan@example.com`,
        username: `${PREFIX}fan`,
        displayName: 'Fan',
        passwordHash: 'x',
      },
    })

    for (const a of [busy, optedOut]) {
      const sound = await prisma.sound.create({
        data: { channelId: a.channel.id, title: 'Track', status: 'READY', isPublic: true },
      })
      await prisma.listenEvent.createMany({
        data: [1, 2, 3].map((n) => ({
          soundId: sound.id,
          dedupeKey: `${PREFIX}${a.user.id}-${n}`,
          dayBucket: '2026-10-02',
          playedAt: new Date('2026-10-02T12:00:00.000Z'),
        })),
      })
    }
    await prisma.listenEvent.create({
      data: {
        soundId: (await prisma.sound.findFirstOrThrow({ where: { channelId: busy.channel.id } }))
          .id,
        dedupeKey: `${PREFIX}old`,
        dayBucket: '2026-09-01',
        playedAt: new Date('2026-09-01T12:00:00.000Z'),
      },
    })
    await prisma.artistFollow.create({
      data: {
        artistUserId: busy.user.id,
        followerUserId: fan.id,
        createdAt: new Date('2026-10-03T10:00:00.000Z'),
      },
    })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
  })

  it('emails opted-in artists who had a week, and skips quiet and opted-out ones', async () => {
    await processWeeklyRecaps(prisma, now)
    const mine = sendWorkerMail.mock.calls
      .map(([mail]) => mail as { to: string; subject: string; text: string })
      .filter((mail) => mail.to.startsWith(PREFIX))
    expect(mine.map((m) => m.to)).toEqual([`${PREFIX}busy@example.com`])
    expect(mine[0]!.subject).toBe('Your week on Tahti: 3 plays')
    expect(mine[0]!.text).toContain('• 1 new followers')
    expect(mine[0]!.text).toContain('Settings → Notifications')
  })

  it('formats the money line in euros', () => {
    const text = weeklyRecapText('Aino', {
      plays: 1247,
      downloads: 89,
      newFollowers: 4,
      newFanSubscribers: 1,
      earnedCents: 11500,
    })
    expect(text).toContain('• 1,247 plays')
    expect(text).toContain('• €115.00 from fans')
  })
})
