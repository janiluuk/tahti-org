// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { executeAccountDeletion } from './account-deletion.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../test/helpers.js'

const PREFIX = 'deletion-leftovers-'
const log = { info: () => {}, warn: () => {}, error: () => {} } as never

describe('Account deletion ends what was still pending', () => {
  const jamIds: string[] = []

  beforeAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  afterAll(async () => {
    await prisma.jamSession.deleteMany({ where: { id: { in: jamIds } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('removes setup links, fails queued imports and uploads, ends and leaves jams', async () => {
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: `${PREFIX}user`,
    })
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
    })
    const sound = await prisma.sound.create({
      data: { channelId: user.channel!.id, title: 'Mix', status: 'READY' },
    })
    await prisma.passwordSetup.create({
      data: {
        userId: user.id,
        token: `${PREFIX}token`,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    })
    const queued = await prisma.cloudImportJob.create({
      data: { userId: user.id, source: 'GOOGLE_DRIVE', externalFileId: 'f1' },
    })
    const done = await prisma.cloudImportJob.create({
      data: { userId: user.id, source: 'GOOGLE_DRIVE', externalFileId: 'f2', status: 'DONE' },
    })
    const upload = await prisma.mixUpload.create({
      data: { userId: user.id, soundId: sound.id },
    })
    const hosted = await prisma.jamSession.create({
      data: { hostUserId: user.id, code: 'DLHOST01', isPlaying: true },
    })
    const joined = await prisma.jamSession.create({
      data: { hostUserId: board.id, code: 'DLJOIN01' },
    })
    jamIds.push(hosted.id, joined.id)
    const guest = await prisma.jamParticipant.create({
      data: { sessionId: joined.id, userId: user.id, role: 'GUEST' },
    })

    await executeAccountDeletion(prisma, log, { userId: user.id, actorId: board.id })

    expect(await prisma.passwordSetup.count({ where: { userId: user.id } })).toBe(0)
    expect(
      await prisma.cloudImportJob.findUniqueOrThrow({ where: { id: queued.id } }),
    ).toMatchObject({ status: 'FAILED', error: 'Account deleted' })
    expect((await prisma.cloudImportJob.findUniqueOrThrow({ where: { id: done.id } })).status).toBe(
      'DONE',
    )
    expect((await prisma.mixUpload.findUniqueOrThrow({ where: { id: upload.id } })).status).toBe(
      'FAILED',
    )
    const hostedAfter = await prisma.jamSession.findUniqueOrThrow({ where: { id: hosted.id } })
    expect(hostedAfter.endedAt).not.toBeNull()
    expect(hostedAfter.isPlaying).toBe(false)
    expect(
      (await prisma.jamSession.findUniqueOrThrow({ where: { id: joined.id } })).endedAt,
    ).toBeNull()
    expect(
      (await prisma.jamParticipant.findUniqueOrThrow({ where: { id: guest.id } })).leftAt,
    ).not.toBeNull()
  })
})
