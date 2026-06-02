// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET ?? ''
const HCAPTCHA_VERIFY_URL = 'https://api.hcaptcha.com/siteverify'

// Returns true if hCaptcha is disabled (dev mode) or verification passes.
export async function verifyHcaptcha(token: string | undefined): Promise<boolean> {
  if (!HCAPTCHA_SECRET || HCAPTCHA_SECRET === 'dev') return true
  if (!token) return false

  const body = new URLSearchParams({ secret: HCAPTCHA_SECRET, response: token })
  const res = await fetch(HCAPTCHA_VERIFY_URL, { method: 'POST', body })
  const data = (await res.json()) as { success: boolean }
  return data.success === true
}
