// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { fetchSpotifyAppToken, type SpotifyAppToken } from '@tahti/shared'
import { config } from '../config.js'

export function spotifyConfigured(): boolean {
  return Boolean(config.spotify.clientId && config.spotify.clientSecret)
}

let cachedToken: SpotifyAppToken | null = null

// Refresh a little before actual expiry so a request never races the boundary.
const EXPIRY_SAFETY_MARGIN_MS = 30_000

/** Cached Client Credentials Grant token, shared across all users — search/catalog scope only. */
export async function getSpotifyAppToken(): Promise<string> {
  if (!spotifyConfigured()) throw new Error('Spotify is not configured')

  if (cachedToken && cachedToken.expiresAt - EXPIRY_SAFETY_MARGIN_MS > Date.now()) {
    return cachedToken.accessToken
  }

  cachedToken = await fetchSpotifyAppToken({
    clientId: config.spotify.clientId,
    clientSecret: config.spotify.clientSecret,
  })
  return cachedToken.accessToken
}

/** Test-only: clears the in-memory token cache. */
export function resetSpotifyAppTokenCache(): void {
  cachedToken = null
}
