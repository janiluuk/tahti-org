// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { EditorProjectRow } from '@tahti/shared'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export async function fetchEditorProjects(): Promise<{
  projects?: EditorProjectRow[]
  error: string | null
}> {
  const res = await fetch(`${apiUrl}/api/me/editor/projects`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to load projects' }
  }
  return { projects: await res.json(), error: null }
}

export async function createEditorProject(body: {
  title?: string
  archiveItemId?: string
}): Promise<{ project?: EditorProjectRow; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/editor/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to create project' }
  }
  return { project: await res.json(), error: null }
}

export async function fetchEditorProject(id: string): Promise<{
  project?: {
    id: string
    title: string
    archiveItemId: string | null
    timeline: Record<string, unknown>
    sources: Array<{
      archiveItemId: string
      title: string
      url: string
      durationSec: number | null
    }>
    updatedAt: string
  }
  error: string | null
}> {
  const res = await fetch(`${apiUrl}/api/me/editor/projects/${id}`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to load project' }
  }
  return { project: await res.json(), error: null }
}

export async function saveEditorProject(
  id: string,
  body: { title?: string; timeline?: Record<string, unknown> },
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/editor/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to save project' }
  }
  return { error: null }
}

export async function deleteEditorProject(id: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/editor/projects/${id}`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to delete project' }
  }
  return { error: null }
}

export async function createEmptyEditorProject(): Promise<void> {
  const res = await createEditorProject({ title: 'New session' })
  if (res.project) redirect(`/dashboard/editor/${res.project.id}`)
  redirect('/dashboard/editor')
}
