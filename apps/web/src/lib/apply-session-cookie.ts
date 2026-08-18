// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'

const SESSION_COOKIE_NAME = 'tahti_session'
const SESSION_COOKIE_DOMAIN =
  process.env.SESSION_COOKIE_DOMAIN ??
  (process.env.NODE_ENV === 'production' ? '.tahti.live' : undefined)

export function applySessionCookieFromResponse(response: Response): void {
  const setCookieHeader = response.headers.get('set-cookie') ?? ''
  const match = setCookieHeader.match(/tahti_session=([^;]+)/)
  if (!match?.[1]) return

  const cookieStore = cookies()
  if (SESSION_COOKIE_DOMAIN) {
    cookieStore.set({
      name: SESSION_COOKIE_NAME,
      value: '',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })
  }
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: match[1],
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
    domain: SESSION_COOKIE_DOMAIN,
  })
}

/** Must clear with the same Domain attribute the cookie was set with
 * (.tahti.live in prod) — a Set-Cookie without it clears a host-only cookie
 * that was never there, leaving the real domain-scoped session cookie alive
 * and the user still logged in. */
export function clearSessionCookie(): void {
  cookies().set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
    domain: SESSION_COOKIE_DOMAIN,
  })
}
