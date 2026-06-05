// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { DEFAULT_SOCIAL_TEMPLATE, LIVE_SOCIAL_TEMPLATE } from '@tahti/shared'
import { config } from '../config.js'
import { encryptStreamKey, decryptStreamKey } from './stream-key-enc.js'
import { mediaQueue } from './queue.js'

export interface SocialTemplateVars {
  artist?: string
  release?: string
  smart_link?: string
  channel_url?: string
  cover_url?: string
}

export function fillSocialTemplate(template: string, vars: SocialTemplateVars): string {
  return template.replace(
    /\{(\w+)\}/g,
    (_, key: string) => vars[key as keyof SocialTemplateVars] ?? '',
  )
}

export async function postToMastodon(params: {
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

export async function enqueueSocialPostDispatch(postId: string): Promise<void> {
  await mediaQueue.add(
    'social-post-dispatch',
    { postId },
    {
      jobId: `social-post-${postId}`,
      attempts: 4,
      backoff: { type: 'exponential', delay: 60_000 },
    },
  )
}

export async function queueReleaseSocialPost(
  prisma: PrismaClient,
  userId: string,
  releaseId: string,
): Promise<void> {
  const conn = await prisma.socialConnection.findUnique({
    where: { userId_platform: { userId, platform: 'MASTODON' } },
  })
  if (!conn?.onReleasePublished) return

  const release = await prisma.release.findFirst({
    where: { id: releaseId, userId },
    select: {
      title: true,
      smartLinkSlug: true,
      artworkUrl: true,
      user: { select: { displayName: true, username: true } },
    },
  })
  if (!release) return

  const message = fillSocialTemplate(conn.postTemplate || DEFAULT_SOCIAL_TEMPLATE, {
    artist: release.user.displayName,
    release: release.title,
    smart_link: `${config.appUrl}/r/${release.smartLinkSlug}`,
    cover_url: release.artworkUrl ?? undefined,
  })

  const post = await prisma.socialPost.create({
    data: {
      userId,
      platform: 'MASTODON',
      trigger: 'release_published',
      releaseId,
      message,
    },
  })
  await enqueueSocialPostDispatch(post.id)
}

export async function queueChannelLiveSocialPost(
  prisma: PrismaClient,
  userId: string,
  channelId: string,
  slug: string,
): Promise<void> {
  const conn = await prisma.socialConnection.findUnique({
    where: { userId_platform: { userId, platform: 'MASTODON' } },
  })
  if (!conn?.onChannelLive) return

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true },
  })
  if (!user) return

  const message = fillSocialTemplate(LIVE_SOCIAL_TEMPLATE, {
    artist: user.displayName,
    channel_url: `${config.appUrl}/c/${slug}`,
  })

  const post = await prisma.socialPost.create({
    data: {
      userId,
      platform: 'MASTODON',
      trigger: 'channel_live',
      channelId,
      message,
    },
  })
  await enqueueSocialPostDispatch(post.id)
}

export function encryptSocialToken(token: string): string {
  return encryptStreamKey(token)
}

export function decryptSocialToken(enc: string): string {
  return decryptStreamKey(enc)
}

export async function processSocialPostJob(prisma: PrismaClient, postId: string): Promise<void> {
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
    const externalId = await postToMastodon({
      instanceUrl: conn.instanceUrl,
      accessToken: decryptSocialToken(conn.accessTokenEnc),
      status: post.message,
    })
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
