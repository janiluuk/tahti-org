// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { LoginSchema, RegisterSchema } from '@tahti/shared'

interface LoginInput {
  email: string
  password: string
}

interface RegisterInput {
  email: string
  password: string
  username: string
  displayName: string
  hcaptchaToken?: string
}

function applySessionCookieFrom(response: Response) {
  const setCookieHeader = response.headers.get('set-cookie') ?? ''
  const match = setCookieHeader.match(/tahti_session=([^;]+)/)
  if (match) {
    cookies().set({
      name: 'tahti_session',
      value: match[1],
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    })
  }
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

    applySessionCookieFrom(response)
    return { error: null }
  } catch {
    return { error: 'Could not reach the server — please try again' }
  }
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

    applySessionCookieFrom(response)
    return { error: null }
  } catch {
    return { error: 'Could not reach the server — please try again' }
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
