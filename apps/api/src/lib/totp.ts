// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import * as OTPAuth from 'otpauth'

const ISSUER = 'Tahti'
const DIGITS = 6
const PERIOD = 30

export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32
}

/** otpauth:// URI for QR-code apps / manual entry — label is the account email. */
export function totpUri(secretBase32: string, email: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: 'SHA1',
    digits: DIGITS,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  })
  return totp.toString()
}

/** Accepts a 1-step clock drift window on either side. */
export function verifyTotpCode(secretBase32: string, code: string): boolean {
  const trimmed = code.trim()
  if (!/^\d{6}$/.test(trimmed)) return false
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: 'SHA1',
    digits: DIGITS,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  })
  return totp.validate({ token: trimmed, window: 1 }) !== null
}
