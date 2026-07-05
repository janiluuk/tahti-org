// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import type { ReleaseCredit } from '@tahti/shared'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export async function createRelease(params: {
  title: string
  type: string
  releaseDate: string
  description?: string
  tracks?: Array<{ title: string; durationSec?: number; archiveItemId?: string }>
}): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/releases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to create release' }
  }
  return { error: null }
}

export async function createSmartLinkEntry(params: {
  title: string
  releaseDate: string
  smartLinkTargets: Record<string, string>
}): Promise<{ id: string | null; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/releases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ ...params, type: 'SINGLE' }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { id: null, error: (data as { error?: string }).error ?? 'Failed to create entry' }
  }
  const data = (await res.json()) as { id?: string }
  return { id: data.id ?? null, error: null }
}

export async function importReleasesFromCsv(
  csv: string,
): Promise<{ error: string | null; created?: number }> {
  const res = await fetch(`${apiUrl}/api/me/releases/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ csv }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Import failed' }
  }
  const data = (await res.json()) as { created: number }
  return { error: null, created: data.created }
}

export async function updateReleaseDate(
  id: string,
  releaseDate: string,
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/releases/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ releaseDate }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to update release date' }
  }
  return { error: null }
}

export async function updateReleaseSmartLinks(
  id: string,
  smartLinkTargets: Record<string, string>,
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/releases/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ smartLinkTargets }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to update smart links' }
  }
  return { error: null }
}

export async function publishRelease(id: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/releases/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ state: 'PUBLISHED' }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to publish' }
  }
  return { error: null }
}

export async function fetchReleaseExportJson(
  id: string,
): Promise<{ error: string | null; json?: string }> {
  const res = await fetch(`${apiUrl}/api/me/releases/${id}/export.json`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Export failed' }
  }
  return { error: null, json: await res.text() }
}

export async function updateReleaseCatalog(
  id: string,
  payload: Record<string, string | null | ReleaseCredit[]>,
): Promise<{ error: string | null; checklist?: unknown }> {
  const res = await fetch(`${apiUrl}/api/me/releases/${id}/catalog`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: (data as { error?: string }).error ?? 'Failed to save catalog' }
  }
  return { error: null, checklist: (data as { checklist?: unknown }).checklist }
}

export async function prepareReleaseArtworkUpload(
  releaseId: string,
  body: { filename: string; contentType: string },
): Promise<{ uploadKey?: string; uploadUrl?: string; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/releases/${releaseId}/artwork/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Prepare failed' }
  }
  return { ...(await res.json()), error: null }
}

export async function completeReleaseArtworkUpload(
  releaseId: string,
  uploadKey: string,
): Promise<{ artworkUrl?: string; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/releases/${releaseId}/artwork/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ uploadKey }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Upload failed' }
  }
  return { ...(await res.json()), error: null }
}

export async function fetchReleaseArtworkFromUrl(
  releaseId: string,
  sourceUrl: string,
): Promise<{ artworkUrl?: string; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/releases/${releaseId}/artwork/from-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ sourceUrl }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Fetch failed' }
  }
  return { ...(await res.json()), error: null }
}

export async function fetchReleaseTrackVersions(
  releaseId: string,
  trackId: string,
): Promise<{ versions?: import('@tahti/shared').ReleaseTrackVersionRow[]; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/releases/${releaseId}/tracks/${trackId}/versions`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to load versions' }
  }
  return { versions: await res.json(), error: null }
}

export async function prepareReleaseTrackVersionUpload(
  releaseId: string,
  trackId: string,
  body: { filename: string; contentType: string },
): Promise<{ uploadId?: string; uploadUrl?: string; error: string | null }> {
  const res = await fetch(
    `${apiUrl}/api/me/releases/${releaseId}/tracks/${trackId}/versions/prepare`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
      body: JSON.stringify(body),
      cache: 'no-store',
    },
  )
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Prepare failed' }
  }
  return { ...(await res.json()), error: null }
}

export async function completeReleaseTrackVersionUpload(
  releaseId: string,
  trackId: string,
  body: { uploadId: string; versionLabel: string },
): Promise<{ error: string | null }> {
  const res = await fetch(
    `${apiUrl}/api/me/releases/${releaseId}/tracks/${trackId}/versions/complete`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
      body: JSON.stringify(body),
      cache: 'no-store',
    },
  )
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Complete failed' }
  }
  return { error: null }
}

export async function submitReleaseToRevelator(
  id: string,
): Promise<{ error: string | null; revelatorStatus?: string; checkoutUrl?: string }> {
  const checkout = await fetch(`${apiUrl}/api/me/releases/${id}/revelator/checkout`, {
    method: 'POST',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  const checkoutData = (await checkout.json().catch(() => ({}))) as {
    checkoutUrl?: string
    paid?: boolean
    error?: string
  }
  if (!checkout.ok) {
    return { error: checkoutData.error ?? 'Distribution checkout failed' }
  }
  if (checkoutData.checkoutUrl) {
    return { error: null, checkoutUrl: checkoutData.checkoutUrl }
  }

  const res = await fetch(`${apiUrl}/api/me/releases/${id}/revelator/submit`, {
    method: 'POST',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: (data as { error?: string }).error ?? 'DSP submit failed' }
  }
  return {
    error: null,
    revelatorStatus: (data as { revelatorStatus?: string }).revelatorStatus,
  }
}

export async function fetchRevelatorBilling(id: string): Promise<{
  paid: boolean
  feeCents: number
  waived: boolean
  studioIncludedRemaining: number | null
  error: string | null
}> {
  const res = await fetch(`${apiUrl}/api/me/releases/${id}/revelator/billing`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return {
      paid: false,
      feeCents: 0,
      waived: false,
      studioIncludedRemaining: null,
      error: (data as { error?: string }).error ?? 'Failed to load billing',
    }
  }
  const data = (await res.json()) as {
    paid?: boolean
    feeCents?: number
    waived?: boolean
    studioIncludedRemaining?: number | null
  }
  return {
    paid: data.paid ?? false,
    feeCents: data.feeCents ?? 0,
    waived: data.waived ?? false,
    studioIncludedRemaining: data.studioIncludedRemaining ?? null,
    error: null,
  }
}

export async function fetchRevelatorStatus(
  id: string,
): Promise<{ revelatorStatus: string | null; revelatorId: string | null; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/releases/${id}/revelator`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return {
      revelatorStatus: null,
      revelatorId: null,
      error: (data as { error?: string }).error ?? 'Failed to load DSP status',
    }
  }
  const data = (await res.json()) as {
    revelatorStatus?: string | null
    revelatorId?: string | null
  }
  return {
    revelatorStatus: data.revelatorStatus ?? null,
    revelatorId: data.revelatorId ?? null,
    error: null,
  }
}

export async function fetchRevelatorRoyalties(id: string): Promise<{
  reports: Array<{
    id: string
    periodStart: string
    periodEnd: string
    amountCents: number
    currency: string
    streams: number | null
  }>
  error: string | null
}> {
  const res = await fetch(`${apiUrl}/api/me/releases/${id}/revelator/royalties`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { reports: [], error: (data as { error?: string }).error ?? 'Failed to load royalties' }
  }
  const data = (await res.json()) as {
    reports?: Array<{
      id: string
      periodStart: string
      periodEnd: string
      amountCents: number
      currency: string
      streams: number | null
    }>
  }
  return { reports: data.reports ?? [], error: null }
}

export async function activateReleaseTrackVersion(
  releaseId: string,
  trackId: string,
  versionId: string,
): Promise<{ error: string | null }> {
  const res = await fetch(
    `${apiUrl}/api/me/releases/${releaseId}/tracks/${trackId}/versions/${versionId}/activate`,
    { method: 'POST', headers: { Cookie: sessionHeader() }, cache: 'no-store' },
  )
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Activate failed' }
  }
  return { error: null }
}
