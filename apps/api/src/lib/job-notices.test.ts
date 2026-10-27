// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { notifyJobOutcome, prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../test/helpers.js'

const PREFIX = 'job-notices-'

describe('notifyJobOutcome', () => {
  let userId: string
  let suspendedId: string

  beforeAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    userId = (
      await createTestArtist(prisma, { email: `${PREFIX}a@example.com`, username: `${PREFIX}a` })
    ).id
    const suspended = await createTestArtist(prisma, {
      email: `${PREFIX}s@example.com`,
      username: `${PREFIX}s`,
    })
    suspendedId = suspended.id
    await prisma.user.update({ where: { id: suspendedId }, data: { suspendedAt: new Date() } })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('files done and failed outcomes under their own types', async () => {
    await notifyJobOutcome(prisma, { userId, outcome: 'done', title: 'Render ready', url: '/a' })
    await notifyJobOutcome(prisma, {
      userId,
      outcome: 'failed',
      title: 'Upload failed',
      body: 'Damaged file',
      url: '/b',
    })
    const rows = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { type: true, title: true, body: true, url: true },
    })
    expect(rows).toEqual([
      { type: 'BACKGROUND_JOB_DONE', title: 'Render ready', body: null, url: '/a' },
      { type: 'BACKGROUND_JOB_FAILED', title: 'Upload failed', body: 'Damaged file', url: '/b' },
    ])
  })

  it('respects the Studio notices preference', async () => {
    await prisma.user.update({ where: { id: userId }, data: { notifyStudioJobsInApp: false } })
    const before = await prisma.notification.count({ where: { userId } })
    await notifyJobOutcome(prisma, { userId, outcome: 'done', title: 'Quiet', url: '/' })
    expect(await prisma.notification.count({ where: { userId } })).toBe(before)
    await prisma.user.update({ where: { id: userId }, data: { notifyStudioJobsInApp: true } })
  })

  it('skips a suspended account', async () => {
    await notifyJobOutcome(prisma, { userId: suspendedId, outcome: 'done', title: 'x', url: '/' })
    expect(await prisma.notification.count({ where: { userId: suspendedId } })).toBe(0)
  })
})
