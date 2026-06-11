// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

const AUTH_ROUTES = ['/api/auth/register', '/api/auth/login']

/** Chat POST (token issuance, publish proxy) — strict limit; GET discovery stays on API limit. */
export function usesAuthRateLimit(url: string, method: string): boolean {
  if (AUTH_ROUTES.some((r) => url.startsWith(r))) return true
  return method === 'POST' && url.startsWith('/api/chat/')
}
