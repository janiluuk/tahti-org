// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Browser-only: relies on `fetch(credentials: 'include')` and `EventSource`,
 * so every export here must be called from a Client Component. */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export type JamParticipant = {
  userId: string
  username: string
  displayName: string
  avatarUrl: string | null
  role: 'HOST' | 'GUEST'
  canControl: boolean
  joinedAt: string
}

export type JamTrack = {
  id: string
  title: string
  artistName: string
  coverUrl: string | null
  /** Null for embed-only tracks — guests see "now playing" but can't auto-play them. */
  streamUrl: string | null
  protocol: 'hls' | 'https' | null
  channelSlug: string | null
  durationSec: number | null
}

export type JamSession = {
  id: string
  code: string
  hostUserId: string
  collectionId: string | null
  isPlaying: boolean
  currentTrack: JamTrack | null
  positionSec: number
  positionUpdatedAt: string
  createdAt: string
  endedAt: string | null
  participants: JamParticipant[]
}

export type JamEvent = { type: 'state'; session: JamSession } | { type: 'ended' }

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function createJam(collectionSlug: string): Promise<JamSession> {
  return requestJson<JamSession>('/api/v1/jam', {
    method: 'POST',
    body: JSON.stringify({ collectionSlug }),
  })
}

export async function joinJam(code: string): Promise<JamSession> {
  return requestJson<JamSession>(`/api/v1/jam/${encodeURIComponent(code)}/join`, {
    method: 'POST',
  })
}

export async function fetchJam(sessionId: string): Promise<JamSession> {
  return requestJson<JamSession>(`/api/v1/jam/${encodeURIComponent(sessionId)}`)
}

export async function pushJamState(
  sessionId: string,
  state: { isPlaying: boolean; currentTrack: JamTrack | null; positionSec: number },
): Promise<JamSession> {
  return requestJson<JamSession>(`/api/v1/jam/${encodeURIComponent(sessionId)}/state`, {
    method: 'POST',
    body: JSON.stringify(state),
  })
}

export async function leaveJam(sessionId: string): Promise<void> {
  await requestJson(`/api/v1/jam/${encodeURIComponent(sessionId)}/leave`, { method: 'POST' })
}

export async function endJam(sessionId: string): Promise<void> {
  await requestJson(`/api/v1/jam/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
}

/** Opens the session's SSE stream. Cookie auth, same session as the rest of the site. */
export function subscribeToJamEvents(
  sessionId: string,
  handlers: {
    onEvent: (event: JamEvent) => void
    onError?: () => void
    onOpen?: () => void
  },
): () => void {
  const source = new EventSource(`${API_URL}/api/v1/jam/${encodeURIComponent(sessionId)}/events`, {
    withCredentials: true,
  })
  source.onopen = () => handlers.onOpen?.()
  source.onerror = () => handlers.onError?.()
  source.onmessage = (message) => {
    try {
      handlers.onEvent(JSON.parse(message.data) as JamEvent)
    } catch {
      // Malformed/ping frame — ignore, the next real message will land fine.
    }
  }
  return () => source.close()
}
