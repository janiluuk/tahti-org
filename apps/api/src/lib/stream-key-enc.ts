// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

// Symmetric encryption for RTMP target stream keys at rest.
// Algorithm: AES-256-GCM with a random 12-byte nonce per value.
// Stored as base64(nonce[12] || ciphertext || authTag[16]).

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALG = 'aes-256-gcm'

function getKey(): Buffer {
  const hex =
    process.env.RTMP_KEY_ENC_KEY ??
    'dev0000000000000000000000000000000000000000000000000000000000000'
  const buf = Buffer.from(hex.slice(0, 64), 'hex')
  if (buf.length !== 32) throw new Error('RTMP_KEY_ENC_KEY must be 32 bytes (64 hex chars)')
  return buf
}

export function encryptStreamKey(plaintext: string): string {
  const key = getKey()
  const nonce = randomBytes(12)
  const cipher = createCipheriv(ALG, key, nonce)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([nonce, ct, tag]).toString('base64')
}

export function decryptStreamKey(enc: string): string {
  const key = getKey()
  const buf = Buffer.from(enc, 'base64')
  const nonce = buf.subarray(0, 12)
  const tag = buf.subarray(buf.length - 16)
  const ct = buf.subarray(12, buf.length - 16)
  const decipher = createDecipheriv(ALG, key, nonce)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}
