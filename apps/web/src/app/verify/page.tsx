// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

interface Props {
  searchParams: { token?: string }
}

export default async function VerifyPage({ searchParams }: Props) {
  const token = searchParams.token

  if (!token) {
    return (
      <div style={{ maxWidth: 480, margin: '4rem auto', padding: '0 1rem' }}>
        <h1>Invalid verification link</h1>
        <p>This link is missing a token. Please use the link from your email.</p>
      </div>
    )
  }

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

  let message = ''
  let isError = false

  try {
    const response = await fetch(`${apiUrl}/api/auth/verify?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      cache: 'no-store',
    })
    const data = (await response.json()) as { message?: string; error?: string }
    if (!response.ok) {
      message = data.error ?? 'Verification failed'
      isError = true
    } else {
      message = data.message ?? 'Email verified'
    }
  } catch {
    message = 'Could not reach the server'
    isError = true
  }

  return (
    <div style={{ maxWidth: 480, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>{isError ? 'Verification failed' : 'Email verified!'}</h1>
      <p style={{ color: isError ? 'red' : 'green' }}>{message}</p>
      {!isError && (
        <p>
          <a href="/login">Log in to your account</a>
        </p>
      )}
    </div>
  )
}
