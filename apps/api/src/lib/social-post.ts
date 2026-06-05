// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient, SocialConnection } from '@tahti/db'
import { DEFAULT_SOCIAL_TEMPLATE, LIVE_SOCIAL_TEMPLATE } from '@tahti/shared'
import { config } from '../config.js'
import { encryptStreamKey, decryptStreamKey } from './stream-key-enc.js'
import { mediaQueue } from './queue.js'

const BSKY_PDS = 'https://bsky.social'

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

export async function createBlueskySession(
  handle: string,
  appPassword: string,
): Promise<{ accessJwt: string; did: string }> {
  const res = await fetch(`${BSKY_PDS}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
  })
  const data = (await res.json()) as { accessJwt?: string; did?: string; message?: string }
  if (!res.ok || !data.accessJwt || !data.did) {
    throw new Error(data.message ?? 'Bluesky login failed')
  }
  return { accessJwt: data.accessJwt, did: data.did }
}

export async function postToBluesky(params: {
  accessJwt: string
  did: string
  text: string
}): Promise<string> {
  const res = await fetch(`${BSKY_PDS}/xrpc/com.atproto.repo.createRecord`, {
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

async function queueTriggeredPosts(
  prisma: PrismaClient,
  userId: string,
  trigger: 'release_published' | 'channel_live',
  buildMessage: (conn: SocialConnection) => string,
  meta: { releaseId?: string; channelId?: string },
): Promise<void> {
  const flag = trigger === 'release_published' ? 'onReleasePublished' : 'onChannelLive'
  const conns = await prisma.socialConnection.findMany({
    where: { userId, [flag]: true },
  })

  for (const conn of conns) {
    const post = await prisma.socialPost.create({
      data: {
        userId,
        platform: conn.platform,
        trigger,
        releaseId: meta.releaseId ?? null,
        channelId: meta.channelId ?? null,
        message: buildMessage(conn),
      },
    })
    await enqueueSocialPostDispatch(post.id)
  }
}

export async function queueReleaseSocialPost(
  prisma: PrismaClient,
  userId: string,
  releaseId: string,
): Promise<void> {
  const release = await prisma.release.findFirst({
    where: { id: releaseId, userId },
    select: {
      title: true,
      smartLinkSlug: true,
      artworkUrl: true,
      user: { select: { displayName: true } },
    },
  })
  if (!release) return

  const vars: SocialTemplateVars = {
    artist: release.user.displayName,
    release: release.title,
    smart_link: `${config.appUrl}/r/${release.smartLinkSlug}`,
    cover_url: release.artworkUrl ?? undefined,
  }

  await queueTriggeredPosts(
    prisma,
    userId,
    'release_published',
    (conn) => fillSocialTemplate(conn.postTemplate || DEFAULT_SOCIAL_TEMPLATE, vars),
    { releaseId },
  )
}

export async function queueChannelLiveSocialPost(
  prisma: PrismaClient,
  userId: string,
  channelId: string,
  slug: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true },
  })
  if (!user) return

  const vars: SocialTemplateVars = {
    artist: user.displayName,
    channel_url: `${config.appUrl}/c/${slug}`,
  }

  await queueTriggeredPosts(
    prisma,
    userId,
    'channel_live',
    (_conn) => fillSocialTemplate(LIVE_SOCIAL_TEMPLATE, vars),
    { channelId },
  )
}

export function encryptSocialToken(token: string): string {
  return encryptStreamKey(token)
}

export function decryptSocialToken(enc: string): string {
  return decryptStreamKey(enc)
}

export function mapPlatformStatus(
  conn: SocialConnection | null,
  defaultTemplate: string,
): {
  connected: boolean
  accountLabel: string | null
  onReleasePublished: boolean
  onChannelLive: boolean
  postTemplate: string
} {
  return {
    connected: Boolean(conn),
    accountLabel: conn?.instanceUrl ?? null,
    onReleasePublished: conn?.onReleasePublished ?? false,
    onChannelLive: conn?.onChannelLive ?? false,
    postTemplate: conn?.postTemplate ?? defaultTemplate,
  }
}
