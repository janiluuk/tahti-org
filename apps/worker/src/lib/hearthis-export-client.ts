// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Pushes a track out to a user's own hearthis.at account, using their
// installed hearthis-export API key.
//
// UNVERIFIED: hearthis.at's upload endpoint/payload shape below has not been
// checked against their real API docs (no internet access at implementation
// time) — this is a best-effort shape (multipart form POST with a key
// param, matching how most SoundCloud-alike upload APIs work) and MUST be
// verified against https://hearthis.at/api docs before this ships to
// production. Everything else in the hearthis-export pipeline (queueing,
// status tracking, credential storage) is independent of getting this exact
// shape right.

export interface HearthisUploadInput {
  title: string
  audioBuffer: Buffer
  filename: string
}

export interface HearthisUploadResult {
  remoteId: string
  url?: string
}

const HEARTHIS_UPLOAD_URL = 'https://api.hearthis.at/upload/'

export async function uploadTrackToHearthis(
  apiKey: string,
  input: HearthisUploadInput,
): Promise<HearthisUploadResult> {
  const form = new FormData()
  form.set('key', apiKey)
  form.set('title', input.title)
  form.set('mp3', new Blob([input.audioBuffer]), input.filename)

  const res = await fetch(HEARTHIS_UPLOAD_URL, { method: 'POST', body: form })
  if (!res.ok) {
    throw new Error(`hearthis.at upload failed: ${res.status} ${await res.text().catch(() => '')}`)
  }

  const data = (await res.json()) as { id?: string | number; permalink_url?: string }
  if (!data.id) throw new Error('hearthis.at upload response had no track id')

  return { remoteId: String(data.id), url: data.permalink_url }
}
