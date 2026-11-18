// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { soundPlaybackKey } from '@tahti/shared'
import { presignedGetUrl } from './minio.js'
import { trackArtistName, userName } from './safe-names.js'

const PREVIEW_URL_TTL_SEC = 3600

const rotationItemSelect = {
  id: true,
  position: true,
  createdAt: true,
  addedBy: { select: { username: true, displayName: true } },
  sound: {
    select: {
      id: true,
      title: true,
      durationSec: true,
      license: true,
      artistName: true,
      mp3Key: true,
      flacKey: true,
      channel: {
        select: { slug: true, user: { select: { username: true, displayName: true } } },
      },
    },
  },
} as const

const browseSoundSelect = {
  id: true,
  title: true,
  durationSec: true,
  license: true,
  artistName: true,
  mp3Key: true,
  flacKey: true,
  channel: {
    select: { slug: true, user: { select: { username: true, displayName: true } } },
  },
} as const

async function previewAudioUrl(sound: {
  mp3Key: string | null
  flacKey: string | null
}): Promise<string | null> {
  const key = soundPlaybackKey(sound)
  return key ? presignedGetUrl(key, PREVIEW_URL_TTL_SEC) : null
}

export async function getCuratedChannelIdBySlug(
  prisma: PrismaClient,
  slug: string,
): Promise<string | null> {
  const channel = await prisma.channel.findUnique({
    where: { slug },
    select: { id: true },
  })
  return channel?.id ?? null
}

export async function listCuratedRotationForAdmin(prisma: PrismaClient, channelId: string) {
  const items = await prisma.curatedRotationItem.findMany({
    where: { channelId },
    orderBy: { position: 'asc' },
    select: rotationItemSelect,
  })
  const audioUrls = await Promise.all(items.map((item) => previewAudioUrl(item.sound)))
  return items.map((item, index) => ({
    id: item.id,
    position: item.position,
    addedAt: item.createdAt.toISOString(),
    addedBy: userName(item.addedBy),
    soundId: item.sound.id,
    title: item.sound.title,
    durationSec: item.sound.durationSec,
    license: item.sound.license,
    artistName: trackArtistName(item.sound),
    channelSlug: item.sound.channel.slug,
    audioUrl: audioUrls[index] ?? null,
  }))
}

export async function browseReadyPublicSoundsForAdmin(prisma: PrismaClient, q?: string) {
  const items = await prisma.sound.findMany({
    where: {
      isPublic: true,
      status: 'READY',
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: browseSoundSelect,
  })
  const audioUrls = await Promise.all(items.map((item) => previewAudioUrl(item)))
  return items.map((item, index) => ({
    id: item.id,
    title: item.title,
    durationSec: item.durationSec,
    license: item.license,
    artistName: trackArtistName(item),
    channelSlug: item.channel.slug,
    audioUrl: audioUrls[index] ?? null,
  }))
}

export type AddCuratedRotationResult =
  | { ok: true; id: string }
  | {
      ok: false
      status: 400 | 404 | 409
      error: string
    }

export async function addCuratedRotationItem(
  prisma: PrismaClient,
  input: { channelId: string; soundId: string; addedById: string },
): Promise<AddCuratedRotationResult> {
  const sound = await prisma.sound.findUnique({
    where: { id: input.soundId },
    select: { isPublic: true },
  })
  if (!sound) return { ok: false, status: 404, error: 'Sound item not found' }
  if (!sound.isPublic) {
    return { ok: false, status: 400, error: 'Only public sound items can be curated' }
  }

  const existing = await prisma.curatedRotationItem.findUnique({
    where: { channelId_soundId: { channelId: input.channelId, soundId: input.soundId } },
  })
  if (existing) return { ok: false, status: 409, error: 'Already in rotation' }

  const last = await prisma.curatedRotationItem.findFirst({
    where: { channelId: input.channelId },
    orderBy: { position: 'desc' },
    select: { position: true },
  })

  const item = await prisma.curatedRotationItem.create({
    data: {
      channelId: input.channelId,
      soundId: input.soundId,
      position: (last?.position ?? -1) + 1,
      addedById: input.addedById,
    },
  })

  return { ok: true, id: item.id }
}

export async function deleteCuratedRotationItem(
  prisma: PrismaClient,
  input: { id: string; channelId: string },
): Promise<{ ok: true } | { ok: false; status: 404; error: string }> {
  const item = await prisma.curatedRotationItem.findUnique({ where: { id: input.id } })
  if (!item || item.channelId !== input.channelId) {
    return { ok: false, status: 404, error: 'Not found' }
  }
  await prisma.curatedRotationItem.delete({ where: { id: input.id } })
  return { ok: true }
}

export async function reorderCuratedRotationItems(
  prisma: PrismaClient,
  input: { channelId: string; itemIds: string[] },
): Promise<{ ok: true } | { ok: false; status: 400; error: string }> {
  const current = await prisma.curatedRotationItem.findMany({
    where: { channelId: input.channelId },
    select: { id: true },
  })
  const currentIds = new Set(current.map((item) => item.id))
  if (input.itemIds.length !== currentIds.size || input.itemIds.some((id) => !currentIds.has(id))) {
    return { ok: false, status: 400, error: 'itemIds must match the current rotation' }
  }
  await prisma.$transaction(
    input.itemIds.map((id, position) =>
      prisma.curatedRotationItem.update({ where: { id }, data: { position } }),
    ),
  )
  return { ok: true }
}

export async function reorderCuratedRotationItemByPosition(
  prisma: PrismaClient,
  input: { id: string; channelId: string; position: number },
): Promise<{ ok: true } | { ok: false; status: 404; error: string }> {
  const item = await prisma.curatedRotationItem.findUnique({ where: { id: input.id } })
  if (!item || item.channelId !== input.channelId) {
    return { ok: false, status: 404, error: 'Not found' }
  }

  const siblings = await prisma.curatedRotationItem.findMany({
    where: { channelId: input.channelId },
    orderBy: { position: 'asc' },
    select: { id: true },
  })
  const reordered = siblings.filter((s) => s.id !== input.id).map((s) => s.id)
  reordered.splice(Math.min(input.position, reordered.length), 0, input.id)

  await prisma.$transaction(
    reordered.map((itemId, index) =>
      prisma.curatedRotationItem.update({
        where: { id: itemId },
        data: { position: index },
      }),
    ),
  )
  return { ok: true }
}
