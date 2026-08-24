// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Per-user credentials for the code-level integration-provider registry
// (packages/shared/src/integration-providers.ts) — import/export sources and
// fingerprinting providers a user installs with their own API key. Lives in
// @tahti/db (not apps/api) so both the API and the worker can resolve a
// user's installed credential without crossing app boundaries.
//
// Encryption: AES-256-GCM with a random 12-byte nonce per value, stored as
// base64(nonce[12] || ciphertext || authTag[16]) — same shape as
// apps/api/src/lib/totp-secret-enc.ts, but a separate key/domain.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

const ALG = 'aes-256-gcm'

// Insecure but syntactically valid (pure hex) fallback for local dev/tests only.
const DEV_KEY_HEX = '22'.repeat(32)

function getKey(): Buffer {
  const hex = process.env.INTEGRATION_CREDENTIAL_ENC_KEY ?? DEV_KEY_HEX
  const buf = Buffer.from(hex.slice(0, 64), 'hex')
  if (buf.length !== 32) {
    throw new Error('INTEGRATION_CREDENTIAL_ENC_KEY must be 32 bytes (64 hex chars)')
  }
  return buf
}

function encrypt(plaintext: string): string {
  const key = getKey()
  const nonce = randomBytes(12)
  const cipher = createCipheriv(ALG, key, nonce)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([nonce, ct, tag]).toString('base64')
}

function decrypt(enc: string): string {
  const key = getKey()
  const buf = Buffer.from(enc, 'base64')
  const nonce = buf.subarray(0, 12)
  const tag = buf.subarray(buf.length - 16)
  const ct = buf.subarray(12, buf.length - 16)
  const decipher = createDecipheriv(ALG, key, nonce)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

export function encryptIntegrationFields(fields: Record<string, string>): string {
  return encrypt(JSON.stringify(fields))
}

export function decryptIntegrationFields(enc: string): Record<string, string> {
  return JSON.parse(decrypt(enc)) as Record<string, string>
}

/** The decrypted field values for a user's installed credential, or null if not installed. */
export async function getUserIntegrationCredential(
  prisma: PrismaClient,
  userId: string,
  providerSlug: string,
): Promise<Record<string, string> | null> {
  const row = await prisma.integrationCredential.findUnique({
    where: { userId_providerSlug: { userId, providerSlug } },
    select: { fieldsEnc: true, enabled: true },
  })
  if (!row || !row.enabled) return null
  return decryptIntegrationFields(row.fieldsEnc)
}

export async function upsertUserIntegrationCredential(
  prisma: PrismaClient,
  userId: string,
  providerSlug: string,
  fields: Record<string, string>,
): Promise<void> {
  const fieldsEnc = encryptIntegrationFields(fields)
  await prisma.integrationCredential.upsert({
    where: { userId_providerSlug: { userId, providerSlug } },
    create: { userId, providerSlug, fieldsEnc },
    update: { fieldsEnc, enabled: true },
  })
}

export async function removeUserIntegrationCredential(
  prisma: PrismaClient,
  userId: string,
  providerSlug: string,
): Promise<void> {
  await prisma.integrationCredential.deleteMany({ where: { userId, providerSlug } })
}
