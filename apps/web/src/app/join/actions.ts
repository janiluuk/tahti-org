// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

'use server'

import { RegisterSchema } from '@tahti/shared'

interface RegisterInput {
  email: string
  password: string
  username: string
  displayName: string
  hcaptchaToken?: string
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
