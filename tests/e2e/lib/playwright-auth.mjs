// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Login via API and return a Playwright-compatible session cookie. */
export async function apiLogin(apiBase, appBase, email, password) {
  const res = await fetch(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`login ${email}: ${res.status}`)
  const setCookie = res.headers.get('set-cookie') ?? ''
  const match = setCookie.match(/tahti_session=([^;]+)/)
  if (!match) throw new Error('no session cookie')
  return sessionCookie(appBase, match[1])
}

/** Playwright cookie object for tahti_session. */
export function sessionCookie(appBase, value) {
  return {
    name: 'tahti_session',
    value,
    url: appBase,
    httpOnly: true,
    sameSite: 'Lax',
  }
}

/**
 * Log in through the web app (server action sets the session cookie on the web origin).
 * More reliable than API cookie injection for Next.js SSR dashboard routes.
 */
export async function uiLogin(page, appBase, email, password, { next = '/dashboard' } = {}) {
  await page.goto(`${appBase}/login?next=${encodeURIComponent(next)}`, {
    waitUntil: 'load',
    timeout: 45_000,
  })
  await page.locator('#auth-panel-login input[name="email"]').fill(email)
  await page.locator('#auth-panel-login input[name="password"]').fill(password)
  await page.locator('#auth-panel-login button[type="submit"]').click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45_000 })
}

/** Fail fast when SSR auth did not stick (would otherwise capture a login page). */
export async function assertAuthenticated(page, label) {
  const url = page.url()
  if (url.includes('/login')) {
    throw new Error(`${label}: redirected to login (${url})`)
  }
  const body = await page.locator('body').innerText()
  if (/^Log in$/m.test(body) && body.includes('Enter your email and password')) {
    throw new Error(`${label}: page body looks like login form`)
  }
}
