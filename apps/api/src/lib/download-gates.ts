// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { isActiveFanSubscriber } from './fansub.js'

export type DownloadGateStatus = {
  repostRequired: boolean
  followRequired: boolean
  repostSatisfied: boolean
  followSatisfied: boolean
  canDownload: boolean
}

export async function resolveDownloadGateStatus(
  prisma: PrismaClient,
  params: {
    artistUserId: string
    archiveItemId: string
    repostToDownload: boolean
    followToDownload: boolean
    byUserId: string | null
    byFingerprint: string
    skipGates?: boolean
  },
): Promise<DownloadGateStatus> {
  if (params.skipGates) {
    return {
      repostRequired: false,
      followRequired: false,
      repostSatisfied: true,
      followSatisfied: true,
      canDownload: true,
    }
  }

  const repostRequired = params.repostToDownload
  const followRequired = params.followToDownload

  let repostSatisfied = !repostRequired
  let followSatisfied = !followRequired

  if (repostRequired) {
    const ack = await prisma.archiveRepostAck.findUnique({
      where: {
        archiveItemId_byFingerprint: {
          archiveItemId: params.archiveItemId,
          byFingerprint: params.byFingerprint,
        },
      },
    })
    repostSatisfied = !!ack
  }

  if (followRequired && params.byUserId) {
    if (params.byUserId === params.artistUserId) {
      followSatisfied = true
    } else {
      const [follow, fanSub] = await Promise.all([
        prisma.artistFollow.findUnique({
          where: {
            followerUserId_artistUserId: {
              followerUserId: params.byUserId,
              artistUserId: params.artistUserId,
            },
          },
        }),
        isActiveFanSubscriber(prisma, params.artistUserId, params.byUserId),
      ])
      followSatisfied = !!follow || fanSub
    }
  }

  const canDownload = (!repostRequired || repostSatisfied) && (!followRequired || followSatisfied)

  return {
    repostRequired,
    followRequired,
    repostSatisfied,
    followSatisfied,
    canDownload,
  }
}
