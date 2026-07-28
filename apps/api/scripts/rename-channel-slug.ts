// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * One-off admin rename of a channel's <slug>.tahti.live address — mirrors the
 * self-service PATCH /api/me/channel/slug transaction in
 * routes/me/channel-slug.ts exactly (RTMP key rotation, 30-day
 * ChannelSlugRedirect), for use when the artist can't drive the settings UI
 * themselves (e.g. a board-assisted rename).
 *
 * Run (stack): docker compose run --rm api tsx apps/api/scripts/rename-channel-slug.ts <oldSlug> <newSlug>
 */

import { nanoid } from 'nanoid'
import { prisma } from '@tahti/db'
import { hashPassword } from '../src/lib/password.js'
import { hotRotatePreviousFields, clearHotRotatePreviousFields } from '../src/lib/ingest-credentials.js'

const SLUG_REDIRECT_GRACE_MS = 30 * 24 * 60 * 60 * 1000

async function main() {
  const [oldSlug, newSlug] = process.argv.slice(2)
  if (!oldSlug || !newSlug) {
    console.error('Usage: tsx rename-channel-slug.ts <oldSlug> <newSlug>')
    process.exit(1)
  }

  const channel = await prisma.channel.findUnique({
    where: { slug: oldSlug },
    select: { id: true, slug: true, state: true, rtmpStreamKeyHash: true },
  })
  if (!channel) throw new Error(`No channel with slug "${oldSlug}"`)

  const clash = await prisma.channel.findUnique({ where: { slug: newSlug }, select: { id: true } })
  if (clash) throw new Error(`Slug "${newSlug}" is already taken`)

  const redirectClash = await prisma.channelSlugRedirect.findFirst({
    where: { oldSlug: newSlug, expiresAt: { gt: new Date() }, channelId: { not: channel.id } },
  })
  if (redirectClash) throw new Error(`Slug "${newSlug}" was recently released and isn't available yet`)

  const newRtmpKey = `${newSlug}__${nanoid(32)}`
  const newRtmpHash = await hashPassword(newRtmpKey)
  const hotPrevious =
    channel.state === 'LIVE'
      ? hotRotatePreviousFields(channel.rtmpStreamKeyHash)
      : clearHotRotatePreviousFields()
  const redirectExpiresAt = new Date(Date.now() + SLUG_REDIRECT_GRACE_MS)

  await prisma.$transaction([
    prisma.channel.update({
      where: { id: channel.id },
      data: {
        slug: newSlug,
        liveSourceMount: `/live/${newSlug}`,
        rtmpStreamKey: newRtmpKey,
        rtmpStreamKeyHash: newRtmpHash,
        rtmpStreamKeyPreviousHash: hotPrevious.previousHash,
        rtmpStreamKeyPreviousExpiresAt: hotPrevious.previousExpiresAt,
      },
    }),
    prisma.channelSlugRedirect.deleteMany({ where: { oldSlug: newSlug } }),
    prisma.channelSlugRedirect.create({
      data: { oldSlug: channel.slug, channelId: channel.id, expiresAt: redirectExpiresAt },
    }),
  ])

  console.log(`Renamed channel ${oldSlug} -> ${newSlug}`)
  console.log(`New RTMP stream key: ${newRtmpKey}`)
  console.log(`${oldSlug}.tahti.live redirects to ${newSlug}.tahti.live until ${redirectExpiresAt.toISOString()}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
