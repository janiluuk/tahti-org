// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { extractHandles, recordMentions } from './mentions.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../test/helpers.js'

const PREFIX = 'mention-lib-'

describe('mentions lib', () => {
  beforeAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('extractHandles parses @username tokens case-insensitively', () => {
    expect(extractHandles('Hello @Alice and @bob_12!')).toEqual(['alice', 'bob_12'])
    expect(extractHandles('no mentions here')).toEqual([])
    expect(extractHandles('@ab @ab @AB')).toEqual(['ab'])
  })

  it('recordMentions creates rows for valid targets who allow mentions', async () => {
    const mentioner = await createTestArtist(prisma, {
      email: `${PREFIX}from@example.com`,
      username: 'mention-from',
    })
    const target = await createTestArtist(prisma, {
      email: `${PREFIX}to@example.com`,
      username: 'mention-to',
    })

    await recordMentions(
      prisma,
      mentioner.id,
      'Shoutout to @mention-to for the great set',
      'BIO',
      mentioner.id,
    )

    const rows = await prisma.mention.findMany({
      where: { mentionerUserId: mentioner.id, targetUserId: target.id },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].surface).toBe('BIO')
  })

  it('recordMentions skips self-mentions and artists who muted the mentioner', async () => {
    const mentioner = await createTestArtist(prisma, {
      email: `${PREFIX}self@example.com`,
      username: 'mention-self',
    })
    const muted = await createTestArtist(prisma, {
      email: `${PREFIX}muted@example.com`,
      username: 'mention-muted',
    })

    await prisma.mentionMute.create({
      data: { muterId: muted.id, targetUserId: mentioner.id },
    })

    await recordMentions(
      prisma,
      mentioner.id,
      '@mention-self @mention-muted',
      'ANNOUNCEMENT',
      'ann-1',
    )

    const count = await prisma.mention.count({ where: { mentionerUserId: mentioner.id } })
    expect(count).toBe(0)
  })

  it('recordMentions still reaches an artist the mentioner has muted', async () => {
    const mentioner = await createTestArtist(prisma, {
      email: `${PREFIX}muter@example.com`,
      username: 'mention-muter',
    })
    const target = await createTestArtist(prisma, {
      email: `${PREFIX}heard@example.com`,
      username: 'mention-heard',
    })

    await prisma.mentionMute.create({
      data: { muterId: mentioner.id, targetUserId: target.id },
    })

    const targetIds = await recordMentions(
      prisma,
      mentioner.id,
      'thanks @mention-heard',
      'ANNOUNCEMENT',
      'ann-2',
    )

    expect(targetIds).toEqual([target.id])
  })

  it('recordMentions skips accounts with a block in either direction', async () => {
    const mentioner = await createTestArtist(prisma, {
      email: `${PREFIX}blk-from@example.com`,
      username: 'mention-blk-from',
    })
    const blocker = await createTestArtist(prisma, {
      email: `${PREFIX}blk-er@example.com`,
      username: 'mention-blk-er',
    })
    const blocked = await createTestArtist(prisma, {
      email: `${PREFIX}blk-ed@example.com`,
      username: 'mention-blk-ed',
    })
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}blk-other@example.com`,
      username: 'mention-blk-other',
    })

    await prisma.userBlock.createMany({
      data: [
        { blockerUserId: blocker.id, blockedUserId: mentioner.id },
        { blockerUserId: mentioner.id, blockedUserId: blocked.id },
      ],
    })

    const targetIds = await recordMentions(
      prisma,
      mentioner.id,
      '@mention-blk-er @mention-blk-ed @mention-blk-other',
      'ANNOUNCEMENT',
      'ann-3',
    )

    expect(targetIds).toEqual([other.id])
  })

  it('recordMentions skips suspended and deleted accounts', async () => {
    const mentioner = await createTestArtist(prisma, {
      email: `${PREFIX}gone-from@example.com`,
      username: 'mention-gone-from',
    })
    const suspended = await createTestArtist(prisma, {
      email: `${PREFIX}gone-susp@example.com`,
      username: 'mention-gone-susp',
    })
    const deleted = await createTestArtist(prisma, {
      email: `${PREFIX}gone-del@example.com`,
      username: 'mention-gone-del',
    })
    await prisma.user.update({ where: { id: suspended.id }, data: { suspendedAt: new Date() } })
    await prisma.user.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } })

    const targetIds = await recordMentions(
      prisma,
      mentioner.id,
      '@mention-gone-susp @mention-gone-del',
      'ANNOUNCEMENT',
      'ann-4',
    )

    expect(targetIds).toEqual([])
  })

  it('recordMentions respects the daily limit of 20', async () => {
    const mentioner = await createTestArtist(prisma, {
      email: `${PREFIX}limit@example.com`,
      username: 'mention-limit',
    })

    await prisma.mention.deleteMany({ where: { mentionerUserId: mentioner.id } })

    const existingTarget = await createTestArtist(prisma, {
      email: `${PREFIX}existing@example.com`,
      username: 'mention-existing',
    })

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    await prisma.mention.createMany({
      data: Array.from({ length: 20 }, (_, i) => ({
        mentionerUserId: mentioner.id,
        targetUserId: existingTarget.id,
        surface: 'NEWSLETTER' as const,
        sourceId: `seed-${i}`,
        createdAt: oneHourAgo,
      })),
    })

    const extra = await createTestArtist(prisma, {
      email: `${PREFIX}extra@example.com`,
      username: 'mention-extra',
    })

    await recordMentions(prisma, mentioner.id, `@mention-extra`, 'NEWSLETTER', 'nl-extra')

    const gotExtra = await prisma.mention.findFirst({
      where: { mentionerUserId: mentioner.id, targetUserId: extra.id },
    })
    expect(gotExtra).toBeNull()

    const count = await prisma.mention.count({ where: { mentionerUserId: mentioner.id } })
    expect(count).toBe(20)
  })
})
