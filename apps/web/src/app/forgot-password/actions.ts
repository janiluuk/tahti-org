// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

export async function forgotPassword(input: {
  email: string
  hcaptchaToken?: string
}): Promise<{ message: string }> {
  try {
    const res = await fetch(`${apiUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
    })
    const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
    return {
      message: data.message ?? data.error ?? 'If an account exists for that email, we sent a link.',
    }
  } catch {
    return { message: 'Could not reach the server — please try again' }
  }
}
