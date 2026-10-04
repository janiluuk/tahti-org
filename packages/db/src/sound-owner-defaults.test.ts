// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { soundDefaultsFromOwner, soundOwnerDefaults } from './sound-owner-defaults.js'

const prisma = new PrismaClient()
const PREFIX = 'sound-owner-defaults-'

function channelFor(name: string) {
  const slug = `${PREFIX}${name}`
  return {
    create: {
      slug,
      liveSourceMount: `/live/${slug}`,
      liveSourcePass: `${slug}-pass`,
      liveSourcePassHash: `${slug}-pass-hash`,
      rtmpStreamKey: `${slug}__key`,
      rtmpStreamKeyHash: `${slug}__key-hash`,
    },
  }
}

async function cleanup() {
  await prisma.channel.deleteMany({ where: { slug: { startsWith: PREFIX } } })
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
}

describe('sound owner defaults', () => {
  let optedOutChannelId: string
  let defaultChannelId: string

  beforeAll(async () => {
    await cleanup()
    const optedOut = await prisma.user.create({
      data: {
        email: `${PREFIX}opted-out@example.com`,
        username: `${PREFIX}opted-out`,
        displayName: 'Opted Out',
        defaultTrackCommentsEnabled: false,
        topListsOptOut: true,
        channel: channelFor('opted-out'),
      },
      select: { channel: { select: { id: true } } },
    })
    optedOutChannelId = optedOut.channel!.id
    const defaults = await prisma.user.create({
      data: {
        email: `${PREFIX}defaults@example.com`,
        username: `${PREFIX}defaults`,
        displayName: 'Defaults',
        channel: channelFor('defaults'),
      },
      select: { channel: { select: { id: true } } },
    })
    defaultChannelId = defaults.channel!.id
  })

  afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
  })

  it('maps the owner settings onto the sound fields', () => {
    expect(
      soundDefaultsFromOwner({ defaultTrackCommentsEnabled: false, topListsOptOut: true }),
    ).toEqual({ commentsEnabled: false, topListsEligible: false })
    expect(
      soundDefaultsFromOwner({ defaultTrackCommentsEnabled: true, topListsOptOut: false }),
    ).toEqual({ commentsEnabled: true, topListsEligible: true })
  })

  it("reads the channel owner's settings", async () => {
    await expect(soundOwnerDefaults(prisma, optedOutChannelId)).resolves.toEqual({
      commentsEnabled: false,
      topListsEligible: false,
    })
    await expect(soundOwnerDefaults(prisma, defaultChannelId)).resolves.toEqual({
      commentsEnabled: true,
      topListsEligible: true,
    })
  })
})
