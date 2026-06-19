// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const cookieStore = cookies()
  const session = cookieStore.get('tahti_session')
  return session ? `tahti_session=${session.value}` : ''
}

export interface UploadPrepareResult {
  uploadId: string
  uploadUrl: string
  expiresAt: string
}

export async function prepareNewUpload(params: {
  filename: string
  contentType: string
  fileSizeBytes: number
  title: string
}): Promise<UploadPrepareResult & { error?: string }> {
  const res = await fetch(`${apiUrl}/api/uploads/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return {
      error: (data as { error?: string }).error ?? 'Prepare failed',
      uploadId: '',
      uploadUrl: '',
      expiresAt: '',
    }
  }
  return res.json()
}

export async function finaliseUpload(params: {
  uploadId: string
  etag: string
  title: string
  artist?: string
  year?: number
  genre?: string
  contentType?: string
  collectionSlugs?: string[]
  metadata?: Record<string, unknown>
}): Promise<{ itemId: string; error?: string }> {
  const res = await fetch(`${apiUrl}/api/uploads/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { itemId: '', error: (data as { error?: string }).error ?? 'Complete failed' }
  }
  const data = (await res.json()) as { itemId: string }
  return { itemId: data.itemId }
}

export interface RecentBroadcast {
  id: string
  startedAt: string
  recordingKey: string | null
  archiveItemId: string | null
  archiveItemTitle?: string
  archiveItemStatus?: string
  durationSec?: number
}

export async function fetchRecentBroadcasts(limit = 5): Promise<RecentBroadcast[]> {
  const res = await fetch(`${apiUrl}/api/me/broadcasts/recent?limit=${limit}&unpublished=true`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = (await res.json()) as { broadcasts?: RecentBroadcast[] }
  return data.broadcasts ?? []
}

export interface StorageStatus {
  usedBytes: number
  softTargetBytes?: number
  showSoftTarget: boolean
  tier: string
}

export async function fetchStorageStatus(): Promise<StorageStatus | null> {
  const res = await fetch(`${apiUrl}/api/auth/me`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const data = (await res.json()) as {
    storage?: { usedBytes: string; softTargetBytes?: string; showSoftTarget?: boolean }
    tier?: string
  }
  if (!data.storage) return null
  return {
    usedBytes: Number(data.storage.usedBytes),
    softTargetBytes: data.storage.softTargetBytes
      ? Number(data.storage.softTargetBytes)
      : undefined,
    showSoftTarget: data.storage.showSoftTarget ?? false,
    tier: data.tier ?? 'FREE',
  }
}

export interface CollectionOption {
  slug: string
  name: string
  style: string
}

export async function fetchCollectionOptions(): Promise<CollectionOption[]> {
  const res = await fetch(`${apiUrl}/api/me/collections`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = (await res.json()) as CollectionOption[] | { collections?: CollectionOption[] }
  return Array.isArray(data) ? data : (data.collections ?? [])
}
