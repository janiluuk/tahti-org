// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import {
  getRadioFeatureHistory,
  listRadioEligibleChannels,
  recordRadioFeature,
} from './radio-feature.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../test/helpers.js'

const PREFIX = 'radio-feature-'

describe('radio-feature helpers', () => {
  let channelId: string
  let optedOutId: string

  beforeAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const eligible = await createTestArtist(prisma, {
      email: `${PREFIX}eligible@example.com`,
      username: `${PREFIX}eligible`,
      isMember: true,
      memberNumber: 98440,
      tier: 'ARTIST',
    })
    channelId = eligible.channel!.id
    await prisma.channel.update({
      where: { id: channelId },
      data: { state: 'LIVE', metaStreamOptOut: false, lastFeaturedAt: null },
    })

    const opted = await createTestArtist(prisma, {
      email: `${PREFIX}opted@example.com`,
      username: `${PREFIX}opted`,
      isMember: true,
      memberNumber: 98441,
      tier: 'ARTIST',
    })
    optedOutId = opted.channel!.id
    await prisma.channel.update({
      where: { id: optedOutId },
      data: { state: 'LIVE', metaStreamOptOut: true },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('lists live member channels that have not opted out', async () => {
    const eligible = await listRadioEligibleChannels(prisma)
    const ids = eligible.map((c) => c.id)
    expect(ids).toContain(channelId)
    expect(ids).not.toContain(optedOutId)
  })

  it('records feature and returns history newest-first', async () => {
    await recordRadioFeature(prisma, channelId)

    const channel = await prisma.channel.findUniqueOrThrow({ where: { id: channelId } })
    expect(channel.lastFeaturedAt).not.toBeNull()

    const history = await getRadioFeatureHistory(prisma, 5)
    expect(history.some((row) => row.channelId === channelId)).toBe(true)
    expect(history[0].featuredAt).toBeInstanceOf(Date)
  })
})
