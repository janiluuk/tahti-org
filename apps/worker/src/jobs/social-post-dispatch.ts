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
    const externalId = await postToMastodon({
      instanceUrl: conn.instanceUrl,
      accessToken: decryptStreamKey(conn.accessTokenEnc),
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
