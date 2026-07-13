// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { randomInt } from 'node:crypto'

const BACKUP_CODE_COUNT = 8
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I — avoids transcription errors

function randomSegment(length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)]
  }
  return out
}

/** e.g. "K7F2-9QRT" — plaintext, shown to the user exactly once. */
export function generateBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => `${randomSegment(4)}-${randomSegment(4)}`)
}

/** Normalizes user input for comparison against a stored hash (case/whitespace-insensitive). */
export function normalizeBackupCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '')
}
