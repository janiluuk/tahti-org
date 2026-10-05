// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Shared Revelator status/submit helpers used by the legacy per-release routes
 * and the ExportProvider alias wrappers under `/api/me/export-plugins/...`.
 */

import type { PrismaClient } from '@tahti/db'
import {
  mapRevelatorWebhookStatus,
  shouldApplyRevelatorStatus,
  type RevelatorExportWebhookBody,
  type RevelatorStatus,
} from '@tahti/shared'
import { releaseCatalogSelect } from './release-catalog.js'
import { mediaQueue } from './queue.js'

const SUBMITTABLE_STATUSES = new Set(['failed', null])

export type ApplyRevelatorWebhookResult =
  | { ok: true; releaseId: string; revelatorStatus: RevelatorStatus; applied: boolean }
  | { ok: false; status: 400 | 404; error: string }

/** Apply a Revelator export webhook payload to `Release.revelatorStatus`. */
export async function applyRevelatorWebhookStatus(
  prisma: PrismaClient,
  body: RevelatorExportWebhookBody,
): Promise<ApplyRevelatorWebhookResult> {
  const next = mapRevelatorWebhookStatus(body.status, body.event)
  if (!next) {
    return { ok: false, status: 400, error: 'Unrecognized Revelator status' }
  }

  const tahtiId = body.externalId ?? body.releaseId
  const release = tahtiId
    ? await prisma.release.findUnique({
        where: { id: tahtiId },
        select: { id: true, revelatorId: true, revelatorStatus: true },
      })
    : body.revelatorId
      ? await prisma.release.findFirst({
          where: { revelatorId: body.revelatorId },
          select: { id: true, revelatorId: true, revelatorStatus: true },
        })
      : null

  if (!release) {
    return { ok: false, status: 404, error: 'Release not found' }
  }

  if (!shouldApplyRevelatorStatus(release.revelatorStatus, next)) {
    return {
      ok: true,
      releaseId: release.id,
      revelatorStatus: (release.revelatorStatus as RevelatorStatus) ?? next,
      applied: false,
    }
  }

  const updated = await prisma.release.update({
    where: { id: release.id },
    data: {
      revelatorStatus: next,
      ...(body.revelatorId && !release.revelatorId ? { revelatorId: body.revelatorId } : {}),
    },
    select: { id: true, revelatorStatus: true },
  })

  return {
    ok: true,
    releaseId: updated.id,
    revelatorStatus: updated.revelatorStatus as RevelatorStatus,
    applied: updated.revelatorStatus !== release.revelatorStatus,
  }
}

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
