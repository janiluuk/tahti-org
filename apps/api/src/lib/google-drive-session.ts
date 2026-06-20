// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { GOOGLE_DRIVE_OAUTH_SCOPE, refreshGoogleDriveToken } from '@tahti/shared'
import { config } from '../config.js'
import { encryptStreamKey, decryptStreamKey } from './stream-key-enc.js'

export function googleDriveConfigured(): boolean {
  return Boolean(config.googleDrive.clientId && config.googleDrive.clientSecret)
}

export function googleDrivePickerConfigured(): boolean {
  return googleDriveConfigured() && Boolean(config.googleDrive.developerKey)
}

export async function getGoogleDriveAccessTokenForUser(
  prisma: PrismaClient,
  userId: string,
): Promise<string | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleDriveAccessTokenEnc: true, googleDriveRefreshTokenEnc: true },
  })
  if (!row?.googleDriveAccessTokenEnc) return null

  const accessToken = decryptStreamKey(row.googleDriveAccessTokenEnc)
  if (row.googleDriveRefreshTokenEnc) return accessToken

  return accessToken
}

export async function refreshGoogleDriveAccessTokenForUser(
  prisma: PrismaClient,
  userId: string,
): Promise<string> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleDriveAccessTokenEnc: true, googleDriveRefreshTokenEnc: true },
  })
  if (!row?.googleDriveRefreshTokenEnc) {
    throw new Error('Google Drive refresh token missing — reconnect required')
  }

  const refreshToken = decryptStreamKey(row.googleDriveRefreshTokenEnc)
  const tokenData = await refreshGoogleDriveToken(
    {
      clientId: config.googleDrive.clientId,
      clientSecret: config.googleDrive.clientSecret,
    },
    refreshToken,
  )

  await prisma.user.update({
    where: { id: userId },
    data: {
      googleDriveAccessTokenEnc: encryptStreamKey(tokenData.access_token),
      ...(tokenData.refresh_token
        ? { googleDriveRefreshTokenEnc: encryptStreamKey(tokenData.refresh_token) }
        : {}),
    },
  })

  return tokenData.access_token
}

export async function getValidGoogleDriveAccessToken(
  prisma: PrismaClient,
  userId: string,
  options?: { forceRefresh?: boolean },
): Promise<string> {
  if (options?.forceRefresh) {
    return refreshGoogleDriveAccessTokenForUser(prisma, userId)
  }

  const token = await getGoogleDriveAccessTokenForUser(prisma, userId)
  if (!token) throw new Error('Google Drive not connected')
  return token
}

export function buildGoogleDriveAuthorizeUrl(state: string): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', config.googleDrive.clientId)
  url.searchParams.set('redirect_uri', config.googleDrive.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', GOOGLE_DRIVE_OAUTH_SCOPE)
  url.searchParams.set('state', state)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  return url.toString()
}

export async function clearGoogleDriveConnection(
  prisma: PrismaClient,
  userId: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleDriveAccessTokenEnc: null,
      googleDriveRefreshTokenEnc: null,
    },
  })
}
