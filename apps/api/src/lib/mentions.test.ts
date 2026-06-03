// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

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

  it('recordMentions skips self-mentions and muted artists', async () => {
    const mentioner = await createTestArtist(prisma, {
      email: `${PREFIX}self@example.com`,
      username: 'mention-self',
    })
    const muted = await createTestArtist(prisma, {
      email: `${PREFIX}muted@example.com`,
      username: 'mention-muted',
    })

    await prisma.mentionMute.create({
      data: { muterId: mentioner.id, targetUserId: muted.id },
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
