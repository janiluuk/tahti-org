// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Shared Revelator status/submit helpers used by the legacy per-release routes
 * and the ExportProvider alias wrappers under `/api/me/export-plugins/...`.
 */

import type { PrismaClient } from '@tahti/db'
import { releaseCatalogSelect } from './release-catalog.js'
import { mediaQueue } from './queue.js'

const SUBMITTABLE_STATUSES = new Set(['failed', null])

export async function getRevelatorReleaseStatus(
  prisma: PrismaClient,
  userId: string,
  releaseId: string,
): Promise<
  | { ok: true; revelatorId: string | null; revelatorStatus: string | null; title: string }
  | { ok: false; status: 404 }
> {
  const release = await prisma.release.findFirst({
    where: { id: releaseId, userId },
    select: {
      revelatorId: true,
      revelatorStatus: true,
      title: true,
    },
  })
  if (!release) return { ok: false, status: 404 }
  return {
    ok: true,
    revelatorId: release.revelatorId,
    revelatorStatus: release.revelatorStatus,
    title: release.title,
  }
}

export type RevelatorSubmitResult =
  | { ok: true; releaseId: string; revelatorStatus: 'pending' }
  | {
      ok: false
      status: 400 | 402 | 404 | 409
      error: string
      revelatorStatus?: string | null
      revelatorId?: string | null
    }

export async function queueRevelatorDeliver(releaseId: string): Promise<void> {
  await mediaQueue.add('revelator-deliver', { releaseId })
}

export async function submitRevelatorRelease(
  prisma: PrismaClient,
  userId: string,
  releaseId: string,
): Promise<RevelatorSubmitResult> {
  const release = await prisma.release.findFirst({
    where: { id: releaseId, userId },
    select: {
      ...releaseCatalogSelect,
      distributionPaidAt: true,
    },
  })
  if (!release) return { ok: false, status: 404, error: 'Release not found' }

  if (release.tracks.length < 1) {
    return { ok: false, status: 400, error: 'Add at least one track before DSP submit' }
  }

  const hasIdentifier =
    Boolean(release.upc?.trim()) || release.tracks.every((track) => Boolean(track.isrc?.trim()))
  if (!hasIdentifier) {
    return {
      ok: false,
      status: 400,
      error: 'Add a UPC or ISRC on every track before DSP submit',
    }
  }

  if (release.revelatorStatus && !SUBMITTABLE_STATUSES.has(release.revelatorStatus)) {
    return {
      ok: false,
      status: 409,
      error: 'Release already submitted to Revelator',
      revelatorStatus: release.revelatorStatus,
      revelatorId: release.revelatorId,
    }
  }

  if (!release.distributionPaidAt) {
    return {
      ok: false,
      status: 402,
      error: 'Pay the distribution fee before submitting to Revelator',
    }
  }

  await prisma.release.update({
    where: { id: releaseId },
    data: { revelatorStatus: 'pending' },
  })

  await queueRevelatorDeliver(releaseId)

  return { ok: true, releaseId, revelatorStatus: 'pending' }
}
