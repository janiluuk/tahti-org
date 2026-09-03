// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { config } from '../config.js'
import { decryptStreamKey, encryptStreamKey } from './stream-key-enc.js'

export const DISCORD_BOT_SETTINGS_ID = 'default'

export type DiscordBotCredentialSource = 'database' | 'env' | 'none'

export type ResolvedDiscordBotCredentials = {
  clientId: string
  token: string
  source: Exclude<DiscordBotCredentialSource, 'none'>
}

export type DiscordBotSettingsView = {
  clientId: string
  tokenConfigured: boolean
  tokenHint: string | null
  source: DiscordBotCredentialSource
}

export function tokenHint(token: string): string {
  const trimmed = token.trim()
  if (trimmed.length < 4) return '••••'
  return `••••${trimmed.slice(-4)}`
}

function envCredentials(): ResolvedDiscordBotCredentials | null {
  const clientId = config.discordBot.clientId.trim()
  const token = config.discordBot.token.trim()
  if (!clientId || !token) return null
  return { clientId, token, source: 'env' }
}

export async function resolveDiscordBotCredentials(
  prisma: PrismaClient,
): Promise<ResolvedDiscordBotCredentials | null> {
  const row = await prisma.discordBotSettings.findUnique({
    where: { id: DISCORD_BOT_SETTINGS_ID },
  })
  if (row) {
    return {
      clientId: row.clientId,
      token: decryptStreamKey(row.tokenEnc),
      source: 'database',
    }
  }
  return envCredentials()
}

export function toSettingsView(
  resolved: ResolvedDiscordBotCredentials | null,
): DiscordBotSettingsView {
  if (!resolved) {
    return { clientId: '', tokenConfigured: false, tokenHint: null, source: 'none' }
  }
  return {
    clientId: resolved.clientId,
    tokenConfigured: true,
    tokenHint: tokenHint(resolved.token),
    source: resolved.source,
  }
}

export async function saveDiscordBotSettings(
  prisma: PrismaClient,
  input: { clientId: string; token?: string; updatedById: string },
): Promise<DiscordBotSettingsView> {
  const existing = await resolveDiscordBotCredentials(prisma)
  const token = input.token?.trim() || existing?.token
  if (!token) {
    throw new Error('TOKEN_REQUIRED')
  }

  await prisma.discordBotSettings.upsert({
    where: { id: DISCORD_BOT_SETTINGS_ID },
    create: {
      id: DISCORD_BOT_SETTINGS_ID,
      clientId: input.clientId,
      tokenEnc: encryptStreamKey(token),
      updatedById: input.updatedById,
    },
    update: {
      clientId: input.clientId,
      tokenEnc: encryptStreamKey(token),
      updatedById: input.updatedById,
    },
  })

  return toSettingsView({
    clientId: input.clientId,
    token,
    source: 'database',
  })
}
