// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { LoginSchema } from '@tahti/shared'

interface LoginInput {
  email: string
  password: string
}

export async function login(input: LoginInput): Promise<{ error: string | null }> {
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

    const data = (await response.json()) as { error?: string }

    if (!response.ok) {
      if (response.status === 403) {
        return { error: 'Please verify your email address before logging in' }
      }
      return { error: data.error ?? 'Login failed' }
    }

    // Forward the session cookie set by the API to the browser
    const setCookieHeader = response.headers.get('set-cookie') ?? ''
    const match = setCookieHeader.match(/tahti_session=([^;]+)/)
    if (match) {
      const cookieStore = cookies()
      cookieStore.set({
        name: 'tahti_session',
        value: match[1],
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      })
    }

    return { error: null }
  } catch {
    return { error: 'Could not reach the server — please try again' }
  }
}
