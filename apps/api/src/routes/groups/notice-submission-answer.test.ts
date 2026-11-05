// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'group-notice-subanswer-'
const slug = 'notice-subanswer-crew'

describe('group submission answer notice', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const cookies: Record<string, string> = {}
  const ids: Record<string, string> = {}
  const sounds: Record<string, string> = {}

  const submitAndAnswer = async (title: string, answer: 'approve' | 'reject') => {
    const sent = await app.inject({
      method: 'POST',
      url: `/api/me/groups/${slug}/sounds`,
      headers: { cookie: cookies.member! },
      payload: { soundId: sounds[title]! },
    })
    expect(sent.statusCode).toBe(202)
    const { submission } = sent.json() as { submission: { id: string } }
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/groups/${slug}/submissions/${submission.id}/${answer}`,
      headers: { cookie: cookies.owner! },
    })
    expect(res.statusCode).toBe(200)
    return prisma.notification.findFirst({
      where: { userId: ids.member!, type: 'GROUP_SUBMISSION_RESOLVED', body: { contains: title } },
    })
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    for (const name of ['owner', 'member']) {
      const user = await createTestArtist(prisma, {
        email: `${PREFIX}${name}@example.com`,
        username: `${PREFIX}${name}`,
      })
      ids[name] = user.id
      cookies[name] = await sessionCookieFor(prisma, user.id)
      if (name === 'member') {
        for (const title of ['Keeper', 'Skipper']) {
          sounds[title] = (await createReadySound(prisma, user.channel!.id, title)).id
        }
      }
    }
    const created = await app.inject({
      method: 'POST',
      url: '/api/me/groups',
      headers: { cookie: cookies.owner! },
      payload: { name: 'Notice Subanswer Crew', slug, submitPolicy: 'APPROVE' },
    })
    expect(created.statusCode).toBe(201)
    const groupId = (created.json() as { id: string }).id
    await prisma.artistGroupMember.create({
      data: { groupId, userId: ids.member!, role: 'MEMBER' },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('tells the submitter their track was added', async () => {
    const notice = await submitAndAnswer('Keeper', 'approve')
    expect(notice).toMatchObject({
      title: 'Your track is in the group playlist',
      actorUserId: ids.owner,
      url: `/groups/${slug}`,
    })
  })

  it('tells the submitter their track was declined', async () => {
    const notice = await submitAndAnswer('Skipper', 'reject')
    expect(notice?.title).toBe('Your track was not added')
  })
})
