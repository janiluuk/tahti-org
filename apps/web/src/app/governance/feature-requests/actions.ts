// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const sessionCookie = cookies().get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export interface FeatureRequestRef {
  id: string
  title: string
  description: string
  status: string
  proposer: string
  voteCount: number
  youVoted: boolean
  commentCount: number
  reviewNote: string | null
  reviewedAt: string | null
  mergedIntoId: string | null
  mergedIntoTitle: string | null
  createdAt: string
}

export async function createFeatureRequest(params: {
  title: string
  description: string
}): Promise<{ error: string | null; request: FeatureRequestRef | null }> {
  const res = await fetch(`${apiUrl}/api/v1/governance/feature-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return {
      error: (data as { error?: string }).error ?? 'Failed to submit feature request',
      request: null,
    }
  }
  revalidatePath('/governance/feature-requests')
  return { error: null, request: (await res.json()) as FeatureRequestRef }
}

export async function voteFeatureRequest(id: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/v1/governance/feature-requests/${id}/vote`, {
    method: 'POST',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to vote' }
  }
  revalidatePath('/governance/feature-requests')
  return { error: null }
}

export async function unvoteFeatureRequest(id: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/v1/governance/feature-requests/${id}/vote`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to remove vote' }
  }
  revalidatePath('/governance/feature-requests')
  return { error: null }
}

export interface FeatureRequestCommentRef {
  id: string
  body: string
  authorId: string | null
  authorDisplayName: string | null
  createdAt: string
}

export async function listFeatureRequestComments(
  id: string,
): Promise<{ error: string | null; comments: FeatureRequestCommentRef[] }> {
  const res = await fetch(`${apiUrl}/api/v1/governance/feature-requests/${id}/comments`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return {
      error: (data as { error?: string }).error ?? 'Failed to load comments',
      comments: [],
    }
  }
  return { error: null, comments: (await res.json()) as FeatureRequestCommentRef[] }
}

export async function postFeatureRequestComment(
  id: string,
  body: string,
): Promise<{ error: string | null; comment: FeatureRequestCommentRef | null }> {
  const res = await fetch(`${apiUrl}/api/v1/governance/feature-requests/${id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ body }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return {
      error: (data as { error?: string }).error ?? 'Failed to post comment',
      comment: null,
    }
  }
  return { error: null, comment: (await res.json()) as FeatureRequestCommentRef }
}
