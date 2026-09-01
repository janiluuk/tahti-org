// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { customAlphabet } from 'nanoid'

// No 0/O/1/I/L — meant to be read off a screen and typed on a phone.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const generate = customAlphabet(ALPHABET, 6)

export function generateJamCode(): string {
  return generate()
}
