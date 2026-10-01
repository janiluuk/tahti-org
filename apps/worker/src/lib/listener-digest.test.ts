// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const { sendWorkerMail } = vi.hoisted(() => ({
  sendWorkerMail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('./mailer.js', () => ({ sendWorkerMail, APP_URL: 'https://app.test' }))

import { prisma } from '@tahti/db'
import { processListenerDigests } from './listener-digest.js'

const PREFIX = 'listener-digest-'

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

describe('daily listener digest email', () => {
  const now = new Date('2026-10-04T17:00:00.000Z')
  const recent = new Date('2026-10-04T09:00:00.000Z')

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    const busy = await artist('busy')
    const self = await artist('self-only')
    await artist('opted-out', { notifyListenerActivityEmail: false })
    const fan = await prisma.user.create({
      data: {
        email: `${PREFIX}fan@example.com`,
        username: `${PREFIX}fan`,
        displayName: 'Fan',
        passwordHash: 'x',
      },
    })

    await prisma.chatMessage.createMany({
      data: [
        {
          channelId: busy.channel.id,
          handle: 'fan',
          text: 'hi',
          userId: fan.id,
          createdAt: recent,
        },
        { channelId: busy.channel.id, handle: 'guest', text: 'yo', createdAt: recent },
        {
          channelId: busy.channel.id,
          handle: 'me',
          text: 'own',
          userId: busy.user.id,
          createdAt: recent,
        },
        {
          channelId: busy.channel.id,
          handle: 'old',
          text: 'old',
          userId: fan.id,
          createdAt: new Date('2026-10-01T09:00:00.000Z'),
        },
        {
          channelId: self.channel.id,
          handle: 'me',
          text: 'own',
          userId: self.user.id,
          createdAt: recent,
        },
      ],
    })
    const sound = await prisma.sound.create({
      data: { channelId: busy.channel.id, title: 'Track', status: 'READY', isPublic: true },
    })
    await prisma.comment.create({
      data: { body: 'Nice', authorId: fan.id, soundId: sound.id, createdAt: recent },
    })
    const broadcast = await prisma.broadcast.create({
      data: { channelId: busy.channel.id, source: 'RTMP' },
    })
    await prisma.broadcastReaction.create({
      data: { broadcastId: broadcast.id, emoji: '🔥', elapsedSec: 12, createdAt: recent },
    })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
  })

  it("emails opted-in artists about other people's activity in the last day", async () => {
    await processListenerDigests(prisma, now)
    const mine = sendWorkerMail.mock.calls
      .map(([mail]) => mail as { to: string; subject: string; text: string })
      .filter((mail) => mail.to.startsWith(PREFIX))
    expect(mine.map((m) => m.to)).toEqual([`${PREFIX}busy@example.com`])
    expect(mine[0]!.subject).toBe('Tahti · 4 new listener actions')
    expect(mine[0]!.text).toContain('• 2 new chat messages')
    expect(mine[0]!.text).toContain('• 1 new comment')
    expect(mine[0]!.text).toContain('• 1 reaction during your broadcasts')
  })
})
