// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { decryptStreamKey } from '../lib/stream-key-enc.js'

async function postToMastodon(params: {
  instanceUrl: string
  accessToken: string
  status: string
}): Promise<string> {
  const base = params.instanceUrl.replace(/\/+$/, '')
  const res = await fetch(`${base}/api/v1/statuses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: params.status.slice(0, 500) }),
  })

  const data = (await res.json()) as { id?: string; error?: string }
  if (!res.ok || !data.id) {
    throw new Error(data.error ?? `Mastodon post failed (${res.status})`)
  }
  return String(data.id)
}

async function postToBluesky(params: {
  accessJwt: string
  did: string
  text: string
}): Promise<string> {
  const res = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repo: params.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text: params.text.slice(0, 300),
        createdAt: new Date().toISOString(),
      },
    }),
  })
  const data = (await res.json()) as { uri?: string; message?: string }
  if (!res.ok || !data.uri) {
    throw new Error(data.message ?? `Bluesky post failed (${res.status})`)
  }
  return data.uri
}

async function postToTwitter(accessToken: string, text: string): Promise<string> {
  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: text.slice(0, 280) }),
  })
  const data = (await res.json()) as { data?: { id: string }; detail?: string; title?: string }
  if (!res.ok || !data.data?.id) {
    throw new Error(data.detail ?? data.title ?? `Twitter post failed (${res.status})`)
  }
  return data.data.id
}

function decodeTwitterTokens(enc: string): { accessToken: string; refreshToken?: string } {
  return JSON.parse(decryptStreamKey(enc)) as { accessToken: string; refreshToken?: string }
}

const GRAPH_API = 'https://graph.facebook.com/v21.0'

function decodeInstagramTokens(enc: string): { accessToken: string; igUserId: string } {
  return JSON.parse(decryptStreamKey(enc)) as { accessToken: string; igUserId: string }
}

// Instagram has no text-only post type — every post needs a publicly
// reachable image. We use the release's cover art, falling back to the
// channel's gallery image or the artist's avatar for live/manual posts.
async function resolveInstagramImageUrl(
  prisma: PrismaClient,
  post: { userId: string; releaseId: string | null; channelId: string | null },
): Promise<string> {
  if (post.releaseId) {
    const release = await prisma.release.findUnique({
      where: { id: post.releaseId },
      select: { artworkUrl: true },
    })
    if (release?.artworkUrl) return release.artworkUrl
  }
  if (post.channelId) {
    const channel = await prisma.channel.findUnique({
      where: { id: post.channelId },
      select: { slideshowImages: true },
    })
    if (channel?.slideshowImages[0]) return channel.slideshowImages[0]
  }
  const user = await prisma.user.findUnique({
    where: { id: post.userId },
    select: { avatarUrl: true },
  })
  if (user?.avatarUrl) return user.avatarUrl

  throw new Error(
    'Instagram posts require an image — add cover art to the release, a channel banner, or a profile picture',
  )
}

async function postToInstagram(params: {
  accessToken: string
  igUserId: string
  caption: string
  imageUrl: string
}): Promise<string> {
  const createRes = await fetch(`${GRAPH_API}/${params.igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: params.imageUrl,
      caption: params.caption.slice(0, 2200),
      access_token: params.accessToken,
    }),
  })
  const created = (await createRes.json()) as { id?: string; error?: { message?: string } }
  if (!createRes.ok || !created.id) {
    throw new Error(created.error?.message ?? `Instagram media create failed (${createRes.status})`)
  }

  const publishRes = await fetch(`${GRAPH_API}/${params.igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: created.id,
      access_token: params.accessToken,
    }),
  })
  const published = (await publishRes.json()) as { id?: string; error?: { message?: string } }
  if (!publishRes.ok || !published.id) {
    throw new Error(
      published.error?.message ?? `Instagram media publish failed (${publishRes.status})`,
    )
  }
  return published.id
}

export async function processSocialPostDispatchJob(prisma: PrismaClient, postId: string) {
  const post = await prisma.socialPost.findUnique({ where: { id: postId } })
  if (!post || post.state === 'SENT') return

  const conn = await prisma.socialConnection.findUnique({
    where: { userId_platform: { userId: post.userId, platform: post.platform } },
  })
  if (!conn) {
    await prisma.socialPost.update({
      where: { id: postId },
      data: { state: 'FAILED', error: 'Social connection removed', attempts: { increment: 1 } },
    })
    return
  }

  try {
    const tokenEnc = conn.accessTokenEnc
    let externalId: string
    if (conn.platform === 'BLUESKY') {
      const token = decryptStreamKey(tokenEnc)
      externalId = await postToBluesky({
        accessJwt: token,
        did: conn.externalAccountId ?? conn.instanceUrl,
        text: post.message,
      })
    } else if (conn.platform === 'TWITTER') {
      const tokens = decodeTwitterTokens(tokenEnc)
      externalId = await postToTwitter(tokens.accessToken, post.message)
    } else if (conn.platform === 'INSTAGRAM') {
      const tokens = decodeInstagramTokens(tokenEnc)
      const imageUrl = await resolveInstagramImageUrl(prisma, post)
      externalId = await postToInstagram({
        accessToken: tokens.accessToken,
        igUserId: tokens.igUserId,
        caption: post.message,
        imageUrl,
      })
    } else {
      const token = decryptStreamKey(tokenEnc)
      externalId = await postToMastodon({
        instanceUrl: conn.instanceUrl,
        accessToken: token,
        status: post.message,
      })
    }
    await prisma.socialPost.update({
      where: { id: postId },
      data: { state: 'SENT', externalId, sentAt: new Date(), attempts: { increment: 1 } },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Post failed'
    await prisma.socialPost.update({
      where: { id: postId },
      data: { state: 'FAILED', error: message, attempts: { increment: 1 } },
    })
    throw err
  }
}
