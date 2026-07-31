// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET ?? ''
const HCAPTCHA_VERIFY_URL = 'https://api.hcaptcha.com/siteverify'

/** Compose local stacks bake a non-`dev` sentinel so NODE_ENV=production +
 * SEC-005 still boots — that sentinel must not be treated as a real secret
 * (siteverify would always fail and block chat/signup). */
const LOCAL_STACK_HCAPTCHA_SENTINEL = 'local-stack-hcaptcha-secret'

/** True when we have a real hCaptcha secret and should require a token. */
export function isHcaptchaEnforced(): boolean {
  return (
    Boolean(HCAPTCHA_SECRET) &&
    HCAPTCHA_SECRET !== 'dev' &&
    HCAPTCHA_SECRET !== LOCAL_STACK_HCAPTCHA_SENTINEL
  )
}

// Returns true if hCaptcha is disabled (dev / local-stack) or verification passes.
export async function verifyHcaptcha(token: string | undefined): Promise<boolean> {
  if (!isHcaptchaEnforced()) return true
  if (!token) return false

  const body = new URLSearchParams({ secret: HCAPTCHA_SECRET, response: token })
  const res = await fetch(HCAPTCHA_VERIFY_URL, { method: 'POST', body })
  const data = (await res.json()) as { success: boolean }
  return data.success === true
}
