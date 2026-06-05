// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { resolveReleaseArtworkUrl } from './release-artwork.js'

function webBase(): string {
  return (process.env.PUBLIC_WEB_URL ?? 'https://tahti.live').replace(/\/$/, '')
}

export async function buildPressKit(
  prisma: PrismaClient,
  username: string,
  opts?: { includeEmail?: boolean },
) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      email: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      socialLinks: true,
      tipJarUrl: true,
      channel: { select: { slug: true } },
      releases: {
        where: { state: 'PUBLISHED' },
        orderBy: { releaseDate: 'desc' },
        take: 24,
        select: {
          title: true,
          type: true,
          releaseDate: true,
          smartLinkSlug: true,
          artworkUrl: true,
          artworkKey: true,
          description: true,
        },
      },
    },
  })

  if (!user) return null

  const base = webBase()
  const releases = await Promise.all(
    user.releases.map(async (r) => ({
      title: r.title,
      type: r.type,
      releaseDate: r.releaseDate,
      smartLinkSlug: r.smartLinkSlug,
      smartLinkUrl: `${base}/r/${r.smartLinkSlug}`,
      artworkUrl: await resolveReleaseArtworkUrl(r),
      description: r.description,
    })),
  )

  return {
    generatedAt: new Date(),
    displayName: user.displayName,
    username: user.username,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    ...(opts?.includeEmail ? { email: user.email } : {}),
    socialLinks: user.socialLinks as Record<string, unknown> | null,
    tipJarUrl: user.tipJarUrl,
    profileUrl: `${base}/u/${user.username}`,
    channelUrl: user.channel ? `${base}/c/${user.channel.slug}` : null,
    channelSlug: user.channel?.slug ?? null,
    releases,
  }
}
