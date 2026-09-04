// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

const LISTENBRAINZ_API = 'https://api.listenbrainz.org/1'

export type ListenBrainzListenPayload = {
  listenedAt: number
  artistName: string
  trackName: string
  recordingMbid?: string
  releaseName?: string
  originUrl?: string
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Token ${token}`,
    'Content-Type': 'application/json',
  }
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string; message?: string }
    return body.error ?? body.message ?? `ListenBrainz HTTP ${res.status}`
  } catch {
    return `ListenBrainz HTTP ${res.status}`
  }
}

export async function validateListenBrainzToken(
  token: string,
): Promise<{ ok: true; userName: string } | { ok: false; error: string }> {
  const trimmed = token.trim()
  if (!trimmed) return { ok: false, error: 'Missing ListenBrainz user token' }

  let res: Response
  try {
    res = await fetch(`${LISTENBRAINZ_API}/validate-token`, {
      method: 'GET',
      headers: authHeaders(trimmed),
    })
  } catch {
    return { ok: false, error: 'Could not reach ListenBrainz' }
  }

  if (!res.ok) {
    return { ok: false, error: await readErrorMessage(res) }
  }

  let body: { valid?: boolean; user_name?: string; message?: string }
  try {
    body = (await res.json()) as typeof body
  } catch {
    return { ok: false, error: 'Invalid ListenBrainz response' }
  }

  if (!body.valid || !body.user_name) {
    return { ok: false, error: body.message ?? 'ListenBrainz user token is invalid' }
  }

  return { ok: true, userName: body.user_name }
}

export async function submitListenBrainzListen(
  token: string,
  payload: ListenBrainzListenPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = token.trim()
  if (!trimmed) return { ok: false, error: 'Missing ListenBrainz user token' }

  const additionalInfo: Record<string, string> = {
    submission_client: 'tahti',
  }
  if (payload.recordingMbid) additionalInfo.recording_mbid = payload.recordingMbid
  if (payload.releaseName) additionalInfo.release_name = payload.releaseName
  if (payload.originUrl) additionalInfo.origin_url = payload.originUrl

  const body = {
    listen_type: 'single',
    payload: [
      {
        listened_at: payload.listenedAt,
        track_metadata: {
          artist_name: payload.artistName,
          track_name: payload.trackName,
          additional_info: additionalInfo,
        },
      },
    ],
  }

  let res: Response
  try {
    res = await fetch(`${LISTENBRAINZ_API}/submit-listens`, {
      method: 'POST',
      headers: authHeaders(trimmed),
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, error: 'Could not reach ListenBrainz' }
  }

  if (!res.ok) {
    return { ok: false, error: await readErrorMessage(res) }
  }

  return { ok: true }
}
