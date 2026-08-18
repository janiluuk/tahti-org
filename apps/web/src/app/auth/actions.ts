// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { LoginSchema, RegisterSchema } from '@tahti/shared'
import { applySessionCookieFromResponse, clearSessionCookie } from '@/lib/apply-session-cookie'

interface LoginInput {
  email: string
  password: string
}

interface RegisterInput {
  email: string
  password: string
  username: string
  displayName: string
  gender?: string | null
  countryCode?: string | null
  hcaptchaToken?: string
}

export async function login(
  input: LoginInput,
): Promise<{ error: string | null; requiresTotp?: boolean; challengeId?: string }> {
  const parsed = LoginSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Invalid email or password' }
  }

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

  try {
    const response = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    })

    const data = (await response.json()) as {
      error?: string
      requiresTotp?: boolean
      challengeId?: string
    }

    if (!response.ok) {
      if (response.status === 403) {
        return { error: 'Please verify your email address before logging in' }
      }
      return { error: data.error ?? 'Login failed' }
    }

    if (data.requiresTotp && data.challengeId) {
      return { error: null, requiresTotp: true, challengeId: data.challengeId }
    }

    applySessionCookieFromResponse(response)
    return { error: null }
  } catch {
    return { error: 'Could not reach the server — please try again' }
  }
}

/** The old <form action="/api/auth/logout"> posted straight to a relative
 * path — there's no such route on the web app (the real logout endpoint
 * lives on api.tahti.live), so it 404'd and never actually logged anyone
 * out. Use this as a form action instead: forwards to the API to delete the
 * session server-side, clears the browser cookie, then sends the user home. */
export async function logout(): Promise<void> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const sessionCookie = cookies().get('tahti_session')
  if (sessionCookie) {
    await fetch(`${apiUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: `tahti_session=${sessionCookie.value}` },
    }).catch(() => undefined)
  }
  clearSessionCookie()
  redirect('/')
}

export async function verifyTotp(input: {
  challengeId: string
  code: string
}): Promise<{ error: string | null }> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

  try {
    const response = await fetch(`${apiUrl}/api/auth/login/totp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })

    const data = (await response.json()) as { error?: string }
    if (!response.ok) {
      return { error: data.error ?? 'Invalid code' }
    }

    applySessionCookieFromResponse(response)
    return { error: null }
  } catch {
    return { error: 'Could not reach the server — please try again' }
  }
}

export async function resendVerification(email: string): Promise<{ message: string }> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const response = await fetch(`${apiUrl}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = (await response.json()) as { message?: string; error?: string }
    return {
      message: data.message ?? data.error ?? 'If that account needs verifying, check your email.',
    }
  } catch {
    return { message: 'Could not reach the server — please try again' }
  }
}

export async function register(
  input: RegisterInput,
): Promise<{ error: string | null; userId?: string }> {
  const parsed = RegisterSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first?.message ?? 'Invalid input' }
  }

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

  try {
    const response = await fetch(`${apiUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...parsed.data, hcaptchaToken: input.hcaptchaToken }),
    })

    const data = (await response.json()) as { message?: string; userId?: string; error?: string }

    if (!response.ok) {
      return { error: data.error ?? 'Registration failed' }
    }

    return { error: null, userId: data.userId }
  } catch {
    return { error: 'Could not reach the server — please try again' }
  }
}
