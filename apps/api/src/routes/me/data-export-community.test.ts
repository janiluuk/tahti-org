// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'export-community-'

describe('GET /api/me/data-export.json — governance and feature requests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let motionId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: `${PREFIX}member`,
    })
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
    })
    cookie = await sessionCookieFor(prisma, member.id)

    const request = await prisma.featureRequest.create({
      data: { title: `${PREFIX}dark mode`, description: 'Please', proposedById: member.id },
    })
    const othersRequest = await prisma.featureRequest.create({
      data: { title: `${PREFIX}offline`, description: 'Cache', proposedById: other.id },
    })
    await prisma.featureRequestComment.create({
      data: { featureRequestId: othersRequest.id, authorId: member.id, body: 'Yes please' },
    })
    await prisma.featureRequestVote.create({
      data: { featureRequestId: othersRequest.id, userId: member.id },
    })
    void request

    const motion = await prisma.motion.create({
      data: {
        title: `${PREFIX}budget`,
        description: 'Budget motion',
        proposedBy: other.id,
        openAt: new Date(),
        closeAt: new Date(Date.now() + 86400000),
        state: 'OPEN',
      },
    })
    motionId = motion.id
    await prisma.motionComment.create({
      data: { motionId, authorId: member.id, body: 'Support this' },
    })
    await prisma.motionSecond.create({ data: { motionId, userId: member.id } })
    await prisma.vote.create({ data: { motionId, userId: member.id, choice: 'YES' } })
    await prisma.vote.create({ data: { motionId, userId: other.id, choice: 'NO' } })
    await prisma.governanceCorrectionRequest.create({
      data: { requesterId: member.id, subject: 'MEMBER_REGISTER', details: 'Fix my join date' },
    })
  })

  afterAll(async () => {
    await prisma.motion.deleteMany({ where: { id: motionId } })
    await prisma.featureRequest.deleteMany({ where: { title: { startsWith: PREFIX } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists the member’s own requests, comments, seconds, votes and correction requests', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/data-export.json',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.featureRequests.map((r: { title: string }) => r.title)).toEqual([
      `${PREFIX}dark mode`,
    ])
    expect(body.featureRequestComments[0]).toMatchObject({
      body: 'Yes please',
      featureRequest: { title: `${PREFIX}offline` },
    })
    expect(body.featureRequestVotes).toHaveLength(1)
    expect(body.motionComments[0]).toMatchObject({ body: 'Support this' })
    expect(body.motionSeconds[0]).toMatchObject({ motion: { title: `${PREFIX}budget` } })
    expect(body.motionVotes).toEqual([
      expect.objectContaining({
        choice: 'YES',
        motion: { id: motionId, title: `${PREFIX}budget` },
      }),
    ])
    expect(body.correctionRequests[0]).toMatchObject({
      subject: 'MEMBER_REGISTER',
      details: 'Fix my join date',
    })
  })
})
