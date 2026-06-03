// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createDecipheriv } from 'node:crypto'

const ALG = 'aes-256-gcm'

function getKey(): Buffer {
  const hex =
    process.env.RTMP_KEY_ENC_KEY ??
    'dev0000000000000000000000000000000000000000000000000000000000000'
  const buf = Buffer.from(hex.slice(0, 64), 'hex')
  if (buf.length !== 32) throw new Error('RTMP_KEY_ENC_KEY must be 32 bytes (64 hex chars)')
  return buf
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
