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

const PREFIX = 'fr-status-notice-'

describe('Feature request status notices', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let boardId: string
  let proposerId: string
  let voterId: string
  let requestId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const make = (tag: string) =>
      createTestArtist(prisma, {
        email: `${PREFIX}${tag}@example.com`,
        username: `${PREFIX}${tag}`,
      })
    const board = await make('board')
    await prisma.user.update({ where: { id: board.id }, data: { isBoard: true, isMember: true } })
    boardId = board.id
    boardCookie = await sessionCookieFor(prisma, board.id)
    proposerId = (await make('proposer')).id
    voterId = (await make('voter')).id
    const request = await prisma.featureRequest.create({
      data: {
        title: `${PREFIX}offline mode`,
        description: 'Cache tracks',
        proposedById: proposerId,
      },
    })
    requestId = request.id
    await prisma.featureRequestVote.createMany({
      data: [
        { featureRequestId: request.id, userId: voterId },
        { featureRequestId: request.id, userId: boardId },
      ],
    })
  })

  afterAll(async () => {
    await prisma.featureRequest.deleteMany({ where: { title: { startsWith: PREFIX } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const notices = (userId: string) =>
    prisma.notification.findMany({ where: { userId, type: 'FEATURE_REQUEST_UPDATED' } })

  const patch = (payload: object) =>
    app.inject({
      method: 'PATCH',
      url: `/api/admin/feature-requests/${requestId}`,
      headers: { cookie: boardCookie },
      payload,
    })

  it('tells the proposer and voters when the status changes, not the board member', async () => {
    expect((await patch({ status: 'PLANNED' })).statusCode).toBe(200)
    const [toProposer] = await notices(proposerId)
    expect(toProposer).toMatchObject({
      title: `Feature request planned: ${PREFIX}offline mode`,
      body: 'You proposed this.',
      url: '/governance/feature-requests',
    })
    expect((await notices(voterId))[0]?.body).toBe('You voted for this.')
    expect(await notices(boardId)).toHaveLength(0)
  })

  it('stays quiet when only the review note changes', async () => {
    expect((await patch({ reviewNote: 'Looking at Q1' })).statusCode).toBe(200)
    expect(await notices(proposerId)).toHaveLength(1)
  })
})
